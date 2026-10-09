import json

import pytest

from app.ai.client import ModelUnavailableError
from app.samples import SAMPLES
from app.services import insights


@pytest.fixture(autouse=True)
def clear_cache():
    insights._cache.clear()


@pytest.fixture
def seeded(client):
    s = SAMPLES[0]
    client.post("/analyses", json={"text": s["text"], "source": s["source"]})
    return client


def _patch_model(monkeypatch, reply):
    calls = []

    def fake(system_prompt, user_text, schema):
        calls.append(user_text)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr("app.services.insights.call_model", fake)
    return calls


def test_empty_database(client):
    assert client.get("/dashboard/insights").json() == {"insights": [], "facts": [], "generated_by": "none"}


def test_facts_come_from_database(seeded):
    body = seeded.get("/dashboard/insights").json()
    facts = {f["id"]: f for f in body["facts"]}
    kpis = seeded.get("/dashboard/kpis").json()
    assert facts["open"]["values"] == {"open": kpis["open"], "critical": kpis["critical"]}
    assert body["generated_by"] == "ai"  # fake model restates the facts


def test_invented_number_falls_back_to_template(seeded, monkeypatch):
    _patch_model(monkeypatch, json.dumps({"insights": [{"text": "Risklərin 73%-i kritikdir.", "fact_ids": ["open"]}]}))
    body = seeded.get("/dashboard/insights").json()
    assert body["generated_by"] == "template"
    assert body["insights"][0]["text"] == body["facts"][0]["text"]


def test_unknown_fact_id_falls_back(seeded, monkeypatch):
    _patch_model(monkeypatch, json.dumps({"insights": [{"text": "Diqqət.", "fact_ids": ["made_up"]}]}))
    assert seeded.get("/dashboard/insights").json()["generated_by"] == "template"


def test_valid_ai_reply_is_cached(seeded, monkeypatch):
    calls = _patch_model(monkeypatch, json.dumps({"insights": [{"text": "Kritik risklərə baxın.", "fact_ids": ["open"]}]}))
    for _ in range(3):
        assert seeded.get("/dashboard/insights").json()["generated_by"] == "ai"
    assert len(calls) == 1


def test_model_down_uses_template(seeded, monkeypatch):
    _patch_model(monkeypatch, ModelUnavailableError("down"))
    body = seeded.get("/dashboard/insights").json()
    assert body["generated_by"] == "template" and body["insights"]
