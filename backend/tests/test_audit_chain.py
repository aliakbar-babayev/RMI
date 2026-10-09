import pytest
from sqlalchemy import text
from sqlalchemy.exc import DatabaseError

from app.services.audit_log import GENESIS_HASH, record_event, verify_chain


def _add(db, n=3):
    for k in range(n):
        record_event(db, entity_type="risk", entity_id=f"R-{k}", event_type="risk.approved",
                     actor_type="human", actor_role="analyst", data={"comment": f"c{k}"})
    db.commit()


def test_chain_links_and_verifies(db):
    _add(db)
    rows = db.execute(text("SELECT prev_hash, hash FROM audit_events ORDER BY event_id")).all()
    assert rows[0][0] == GENESIS_HASH
    assert rows[1][0] == rows[0][1] and rows[2][0] == rows[1][1]
    assert verify_chain(db) == (True, 3, None)


def test_empty_chain_is_ok(db):
    assert verify_chain(db) == (True, 0, None)


def test_update_and_delete_blocked_by_database(db):
    _add(db)
    with pytest.raises(DatabaseError):
        db.execute(text("UPDATE audit_events SET data = '{}' WHERE event_id = 2"))
    db.rollback()
    with pytest.raises(DatabaseError):
        db.execute(text("DELETE FROM audit_events WHERE event_id = 2"))
    db.rollback()


def _tamper(db, sql):
    # Simulates an attacker with direct DB access who first removes the protection triggers.
    db.execute(text("DROP TRIGGER audit_no_update"))
    db.execute(text("DROP TRIGGER audit_no_delete"))
    db.execute(text(sql))
    db.commit()
    db.expire_all()


def test_edited_entry_detected(db):
    _add(db)
    _tamper(db, """UPDATE audit_events SET data = '{"comment":"forged"}' WHERE event_id = 2""")
    assert verify_chain(db) == (False, 2, 2)


def test_deleted_middle_entry_detected(db):
    _add(db)
    _tamper(db, "DELETE FROM audit_events WHERE event_id = 2")
    ok, _, broken_at = verify_chain(db)
    assert not ok and broken_at == 3
