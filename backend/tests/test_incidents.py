import json

import pytest

from app.samples import INCIDENT_SAMPLES, SAMPLES
from app.services.incidents import blast_radius, locate, systems_by_id

NGINX = INCIDENT_SAMPLES[0]


def _report(client, **over):
    body = {"report": NGINX["report"], "systems": NGINX["systems"], "occurred_at": "2026-10-09T10:30:00Z", **over}
    return client.post("/incidents", json=body)


def test_registry_is_seeded(client):
    ids = {s["system_id"] for s in client.get("/systems").json()}
    assert {"prod-web-02", "core-db", "api-gateway"} <= ids


def test_locate_uses_selection_text_and_known_ai_names_only(db):
    registry = systems_by_id(db)
    found, unmapped = locate("Disk full on core-db; also checkout", ["prod-web-02"], ["api-gateway", "made-up-01"], registry)
    assert found == ["prod-web-02", "core-db", "api-gateway"]
    assert unmapped == ["made-up-01"]
    # A system id inside a longer name is not a match.
    assert locate("prod-web-021 is fine", [], [], registry)[0] == []


def test_blast_radius_walks_dependents(db):
    nodes = {n["system_id"]: n for n in blast_radius(["prod-web-02"], systems_by_id(db))}
    assert nodes["prod-web-02"]["hop"] == 0
    assert nodes["api-gateway"]["hop"] == 1 and nodes["customer-portal"]["hop"] == 1
    assert nodes["mobile-api"]["hop"] == 2 and nodes["mobile-api"]["via"] == "api-gateway"
    assert "core-db" not in nodes  # core-db does not depend on the web tier


def test_report_creates_assessed_incident(client):
    r = _report(client)
    assert r.status_code == 201
    inc = r.json()
    assert inc["incident_id"] == "INC-001" and inc["status"] == "reported"
    assert inc["severity"] == "SEV2" and inc["systems"] == ["prod-web-02"]
    assert inc["notify"] == ["Risk team", "System owner"]
    assert inc["metrics"]["detection_lag_seconds"] is not None
    # Consequential risks land in the register, linked to the incident, with verified quotes.
    risk = inc["consequential_risks"][0]
    assert risk["incident_id"] == "INC-001" and risk["status"] == "pending"
    assert all(e["verified"] for e in risk["evidence"])
    assert client.get(f"/risks/{risk['risk_id']}").json()["incident_id"] == "INC-001"


def test_destructive_suggestions_are_flagged(client, monkeypatch):
    reply = {
        "title": "t", "severity": "SEV2", "systems": [],
        "response": {"immediate": [{"action": "Run rm -rf /var/cache/nginx", "owner_role": "x"},
                                   {"action": "Freeze deploys", "owner_role": "x"}]},
    }
    monkeypatch.setattr("app.services.extractor.call_model", lambda *_: json.dumps(reply))
    plan = _report(client).json()["response_plan"]["immediate"]
    assert [a["flagged"] for a in plan] == [True, False]


def test_lifecycle_and_metrics(client):
    iid = _report(client).json()["incident_id"]
    assert client.post(f"/incidents/{iid}/close").json()["error"] == "invalid_transition"
    for action, status in (("acknowledge", "acknowledged"), ("contain", "contained"), ("recover", "recovered"), ("close", "closed")):
        body = client.post(f"/incidents/{iid}/{action}", json={"note": action}).json()
        assert body["status"] == status
    m = body["metrics"]
    assert m["time_to_acknowledge_seconds"] is not None and m["time_to_recover_seconds"] is not None
    assert m["sla"]["acknowledge"]["state"] == "met"
    assert client.get("/incidents?status=open").json() == []
    events = [e["event_type"] for e in client.get(f"/incidents/{iid}/timeline").json()]
    assert events[0] == "incident.reported" and "incident.assessed" in events and events[-1] == "incident.closed"


def test_severity_change_is_logged(client):
    iid = _report(client).json()["incident_id"]
    assert client.patch(f"/incidents/{iid}/severity", json={"severity": "SEV1", "reason": ""}).status_code == 422
    body = client.patch(f"/incidents/{iid}/severity", json={"severity": "sev1", "reason": "Deploy restarted nginx"}).json()
    assert body["severity"] == "SEV1" and body["notify"][-1] == "Executive"
    assert client.patch(f"/incidents/{iid}/severity", json={"severity": "SEV1", "reason": "x"}).json()["error"] == "nothing_to_change"


def test_predicted_risk_can_be_confirmed_as_materialized(client):
    s = SAMPLES[0]  # mentions prod-web-02, so a risk is predicted on it
    client.post("/analyses", json={"text": s["text"], "source": s["source"]})
    inc = _report(client).json()
    candidates = [r["risk_id"] for r in inc["materialize_candidates"]]
    assert candidates and all(r["source"] == "prod-web-02" for r in inc["materialize_candidates"])
    # The incident's own consequential risk is never a candidate.
    assert inc["consequential_risks"][0]["risk_id"] not in candidates

    assert client.post(f"/incidents/{inc['incident_id']}/materialize", json={"risk_id": "R-999"}).json()["error"] == "not_a_candidate"
    risk = client.post(f"/incidents/{inc['incident_id']}/materialize", json={"risk_id": candidates[0]}).json()
    assert risk["materialized_by"] == inc["incident_id"]
    assert client.get("/dashboard/kpis").json()["materialized"] == 1
    events = [e["event_type"] for e in client.get(f"/incidents/{inc['incident_id']}/timeline").json()]
    assert "risk.materialized" in events and "incident.linked_risk" in events


def test_auditor_cannot_report_and_anonymous_hides_role(client):
    assert _report(client, report="x", systems=[]).status_code == 201
    r = client.post("/incidents", json={"report": "x"}, headers={"X-Role": "auditor"})
    assert r.status_code == 403
    inc = _report(client, anonymous=True).json()
    assert inc["reporter_role"] is None and inc["anonymous"] is True
    reported = client.get(f"/incidents/{inc['incident_id']}/timeline").json()[0]
    assert reported["actor"]["role"] is None


@pytest.mark.parametrize("report", ["   ", "x" * 20001])
def test_report_limits(client, report):
    assert client.post("/incidents", json={"report": report}).status_code in (413, 422)
