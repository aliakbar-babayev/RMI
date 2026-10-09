import json

import pytest

from app.ai.client import ModelUnavailableError
from app.samples import SAMPLES

DOC = "The vendor missed the sandbox date again. Several developers share the root password for prod-web-02."


def _ai_risk(**over):
    base = {
        "classification": "risk",
        "statement": "Test",
        "category": "IT",  # mixed case on purpose: must be normalized
        "source": "prod-web-02",
        "probability": 4,
        "impact": 5,
        "score": 1,  # wrong on purpose: the backend must ignore it
        "confidence": 0.9,
        "rationale": "Səbəb",
        "evidence": [{"quote": "share the root password for prod-web-02"}],
        "strategy": "Mitigate",
        "actions": ["a"],
        "trigger": "t",
        "owner_role": "CISO",
    }
    return {**base, **over}


@pytest.fixture
def model(monkeypatch):
    """Replace the model with a queue of canned replies."""
    replies: list = []

    def fake_call(system_prompt, user_text, schema=None):
        reply = replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr("app.services.extractor.call_model", fake_call)
    return replies


def _analyze(client, text=DOC, **headers):
    return client.post("/analyses", json={"text": text}, headers=headers)


def test_backend_computes_score_and_verifies_quotes(client, model):
    model.append(json.dumps({"risks": [_ai_risk()]}))
    r = _analyze(client)
    assert r.status_code == 201
    risk = r.json()["risks"][0]
    assert risk["score"] == 20 and risk["level"] == "critical"
    assert risk["category"] == "it" and risk["strategy"] == "mitigate"
    ev = risk["evidence"][0]
    assert ev["verified"] and DOC[ev["start"]:ev["end"]] == "share the root password for prod-web-02"
    assert not risk["needs_review"]


def test_invented_quote_is_dropped_and_flagged(client, model):
    model.append(json.dumps({"risks": [_ai_risk(evidence=[{"quote": "The vendor went bankrupt."}])]}))
    body = _analyze(client).json()
    assert body["risks"][0]["evidence"] == []
    assert body["risks"][0]["needs_review"]
    assert body["stats"]["dropped_quotes"] == 1


def test_low_confidence_flagged(client, model):
    model.append(json.dumps({"risks": [_ai_risk(confidence=0.5)]}))
    assert _analyze(client).json()["risks"][0]["needs_review"]


def test_retries_once_on_bad_output(client, model):
    model.extend(["not json", "```json\n" + json.dumps({"risks": [_ai_risk()]}) + "\n```"])
    r = _analyze(client)
    assert r.status_code == 201
    assert r.json()["stats"]["model_attempts"] == 2


def test_fails_after_two_bad_outputs(client, model):
    model.extend(["not json", json.dumps({"risks": [_ai_risk(probability=9)]})])
    r = _analyze(client)
    assert r.status_code == 502 and r.json()["error"] == "invalid_model_output"
    assert client.get("/risks").json() == []


def test_model_unavailable(client, model):
    model.append(ModelUnavailableError("connection refused"))
    r = _analyze(client)
    assert r.status_code == 503 and r.json()["error"] == "model_unavailable"


def test_input_limits(client):
    assert _analyze(client, text="   ").json()["error"] == "empty_input"
    r = _analyze(client, text="x" * 20001)
    assert r.status_code == 413 and r.json()["error"] == "input_too_long"


def test_auditor_is_read_only(client):
    r = _analyze(client, **{"X-Role": "auditor"})
    assert r.status_code == 403 and r.json()["error"] == "forbidden"
    assert _analyze(client, **{"X-Role": "boss"}).json()["error"] == "invalid_role"


def test_review_flow_and_audit(client, model):
    model.append(json.dumps({"risks": [_ai_risk(), _ai_risk(source=None, probability=1, impact=2)]}))
    r1, r2 = (x["risk_id"] for x in _analyze(client).json()["risks"])

    edited = client.patch(f"/risks/{r1}", json={"impact": 3, "comment": "too high"}).json()
    assert edited["score"] == 12 and edited["level"] == "high" and edited["status"] == "edited"

    assert client.post(f"/risks/{r1}/approve").json()["status"] == "approved"
    assert client.post(f"/risks/{r1}/resolve", json={"comment": "fixed"}).json()["status"] == "resolved"
    esc = client.post(f"/risks/{r2}/escalate", json={"to": "ciso", "reason": "needs CISO"}).json()
    assert esc["status"] == "escalated" and esc["escalated_to"] == "ciso"

    # Final statuses cannot change.
    r = client.post(f"/risks/{r1}/approve")
    assert r.status_code == 409 and r.json()["error"] == "invalid_transition"
    assert client.post(f"/risks/{r2}/reject", json={"reason": ""}).status_code == 422

    events = [e["event_type"] for e in client.get(f"/audit?entity_id={r1}").json()]
    assert events == ["risk.resolved", "risk.approved", "risk.edited", "risk.proposed"]
    proposed = client.get(f"/audit?entity_id={r1}").json()[-1]
    assert proposed["actor"]["type"] == "ai"
    assert client.get("/audit/verify").json()["ok"]

    kpis = client.get("/dashboard/kpis").json()
    assert kpis["open"] == 1 and kpis["escalated"] == 1 and kpis["resolved"] == 1 and kpis["critical"] == 0

    hm = client.get("/dashboard/heatmap").json()
    assert len(hm["cells"]) == 25
    cell = next(c for c in hm["cells"] if c["p"] == 4 and c["i"] == 3)
    assert cell == {"p": 4, "i": 3, "open": 0, "total": 1, "risk_ids": [r1]}
    rows = {s["source"]: s for s in hm["sources"]}
    assert rows["prod-web-02"]["solved"] == 1 and rows["unassigned"]["open"] == 1

    assert [r["risk_id"] for r in client.get("/dashboard/top").json()] == [r2]
    assert client.get("/dashboard/heatmap?mode=open").json()["sources"][0]["source"] == "unassigned"


def test_edit_validation(client, model):
    model.append(json.dumps({"risks": [_ai_risk()]}))
    rid = _analyze(client).json()["risks"][0]["risk_id"]
    assert client.patch(f"/risks/{rid}", json={"probability": 6}).status_code == 422
    assert client.patch(f"/risks/{rid}", json={"score": 1}).status_code == 422  # score is not editable
    assert client.patch(f"/risks/{rid}", json={"probability": 4}).json()["error"] == "nothing_to_change"
    assert client.get("/risks/R-999").json()["error"] == "not_found"


def test_samples_run_end_to_end_with_fake_model(client):
    samples = client.get("/samples").json()
    assert {s["language"] for s in samples} == {"en", "az", "ru"}
    for s in SAMPLES:
        body = client.post("/analyses", json={"text": s["text"], "language_hint": s["language"],
                                              "source": s["source"]}).json()
        assert body["risks"], s["id"]
        assert all(ev["verified"] for r in body["risks"] for ev in r["evidence"])
    assert client.get("/audit/verify").json()["ok"]
