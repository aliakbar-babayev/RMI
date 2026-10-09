import json
import sqlite3

from app.models.schemas import READINESS_DIMENSIONS
from app.samples import SAMPLES
from app.services.analysis import readiness_review

EN = SAMPLES[0]


def test_readiness_only_when_requested(client):
    assert client.post("/analyses", json={"text": EN["text"]}).json()["readiness"] is None
    r = client.post("/analyses", json={"text": EN["text"], "readiness": True}).json()["readiness"]
    assert [d["key"] for d in r["dimensions"]] == READINESS_DIMENSIONS
    assert sum(r["counts"].values()) == 12
    statuses = {d["key"]: d["status"] for d in r["dimensions"]}
    assert statuses["rollback"] == "failed" and statuses["security_access"] == "failed"
    for d in r["dimensions"]:
        if d["evidence"]:
            assert EN["text"][d["evidence"]["start"]:d["evidence"]["end"]] == d["evidence"]["text"]


def _fake_review(monkeypatch, dims, summary="s"):
    monkeypatch.setattr("app.services.extractor.call_model",
                        lambda *_: json.dumps({"summary": summary, "dimensions": dims}))


def test_score_and_decision_are_computed_by_backend(monkeypatch):
    _fake_review(monkeypatch, [{"key": k, "status": "passed", "score": 1} for k in READINESS_DIMENSIONS])
    assert readiness_review("doc", None, 0)["score"] == 100
    assert readiness_review("doc", None, 0)["decision"] == "go"
    # Each open critical risk costs 5 points, at most 20.
    assert readiness_review("doc", None, 2)["score"] == 90
    assert readiness_review("doc", None, 9)["score"] == 80


def test_missing_and_unknown_dimensions(monkeypatch):
    _fake_review(monkeypatch, [{"key": "scope", "status": "FAILED", "quote": "not in the doc"},
                               {"key": "made_up", "status": "passed"}])
    r = readiness_review("doc", None, 0)
    scope = next(d for d in r["dimensions"] if d["key"] == "scope")
    assert scope["status"] == "failed" and scope["evidence"] is None  # invented quote dropped
    others = [d for d in r["dimensions"] if d["key"] != "scope"]
    assert all(d["status"] == "warning" and not d["assessed"] for d in others)
    assert r["score"] == round(11 * 5 / 12 * 10) and r["decision"] == "not_ready"


def test_proof_recomputes_hash(client):
    client.post("/analyses", json={"text": EN["text"]})
    head = client.get("/audit/stats").json()["head"]["event_id"]
    p = client.get(f"/audit/{head}/proof").json()
    assert p["hash_matches"] and p["prev_link_ok"] and p["recomputed_hash"] == p["stored_hash"]
    assert json.loads(p["canonical_payload"])["prev_hash"] == p["components"]["prev_hash"]
    first = client.get("/audit/1/proof").json()
    assert first["previous_event_id"] is None and first["expected_prev_hash"] == "0" * 64
    r = client.get(f"/audit/{head}/proof/download")
    assert r.headers["content-disposition"].startswith("attachment") and r.json()["event_id"] == head
    assert client.get("/audit/99999/proof").json()["error"] == "not_found"


def test_audit_filters(client):
    client.post("/analyses", json={"text": EN["text"]})
    assert {e["entity_type"] for e in client.get("/audit?category=risk").json()} == {"risk"}
    head = client.get("/audit/stats").json()["head"]
    assert client.get(f"/audit?search={head['hash'][:10]}").json()[0]["event_id"] == head["event_id"]
    assert client.get("/audit/verify").json()["duration_ms"] is not None


def test_old_database_gets_new_columns(tmp_path, monkeypatch):
    """A database from before this release keeps working: missing columns are added."""
    from sqlalchemy import create_engine

    from app import db as dbmod

    path = tmp_path / "old.db"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE analyses (id INTEGER PRIMARY KEY, text TEXT)")
    con.execute("CREATE TABLE risks (id INTEGER PRIMARY KEY, statement TEXT)")
    con.commit()
    con.close()
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as conn:
        dbmod._add_missing_columns(conn)
    con = sqlite3.connect(path)
    cols = {r[1] for r in con.execute("PRAGMA table_info(analyses)")} | {r[1] for r in con.execute("PRAGMA table_info(risks)")}
    assert {"readiness", "incident_id", "materialized_by"} <= cols
