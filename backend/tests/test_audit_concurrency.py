import json
import threading

from sqlalchemy import text

from app.db import SessionLocal
from app.services import risks as svc
from app.services.audit_log import verify_chain

N = 20


def test_concurrent_approvals_keep_one_chain(client, monkeypatch, db):
    reply = {"risks": [{
        "classification": "risk", "statement": "s", "category": "it", "probability": 3, "impact": 3,
        "confidence": 0.9, "rationale": "r", "evidence": [], "strategy": "mitigate",
    }] * N}
    monkeypatch.setattr("app.services.extractor.call_model", lambda *_: json.dumps(reply))
    ids = [r["risk_id"] for r in client.post("/analyses", json={"text": "doc"}).json()["risks"]]
    before = db.scalar(text("SELECT COUNT(*) FROM audit_events"))

    barrier = threading.Barrier(N)
    errors = []

    def approve(risk_id):
        session = SessionLocal()
        try:
            risk = svc.get_risk(session, risk_id)
            session.commit()  # return the pooled connection before waiting (pool < N)
            barrier.wait(timeout=30)
            svc.approve(session, risk, "analyst", None)
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            session.close()

    threads = [threading.Thread(target=approve, args=(rid,)) for rid in ids]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    assert verify_chain(db) == (True, before + N, None)
    dupes = db.scalar(text("SELECT COUNT(*) - COUNT(DISTINCT prev_hash) FROM audit_events"))
    assert dupes == 0


def test_concurrent_analyses_and_approvals_do_not_deadlock(client, monkeypatch, db):
    """Analyses write a row before their first audit entry; approvals do the opposite."""
    reply = json.dumps({"risks": [{
        "classification": "risk", "statement": "s", "category": "it", "probability": 2, "impact": 2,
        "confidence": 0.9, "rationale": "r", "evidence": [], "strategy": "mitigate",
    }]})
    monkeypatch.setattr("app.services.extractor.call_model", lambda *_: reply)
    ids = [client.post("/analyses", json={"text": "doc"}).json()["risks"][0]["risk_id"] for _ in range(6)]

    barrier = threading.Barrier(12)
    errors = []

    def run(fn):
        try:
            barrier.wait(timeout=30)
            fn()
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    def approve(rid):
        session = SessionLocal()
        try:
            svc.approve(session, svc.get_risk(session, rid), "analyst", None)
        finally:
            session.close()

    jobs = [lambda rid=rid: approve(rid) for rid in ids]
    jobs += [lambda: client.post("/analyses", json={"text": "doc"}).raise_for_status() for _ in range(6)]
    threads = [threading.Thread(target=run, args=(job,)) for job in jobs]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)

    assert not any(t.is_alive() for t in threads)
    assert errors == []
    assert verify_chain(db)[0]


def test_failed_request_releases_lock(db):
    from app.services.audit_log import _chain_lock, record_event

    record_event(db, entity_type="risk", entity_id="R-1", event_type="x", actor_type="system")
    assert _chain_lock.locked()
    db.rollback()
    assert not _chain_lock.locked()
