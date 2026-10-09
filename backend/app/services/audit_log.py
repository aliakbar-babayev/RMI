"""Append-only, hash-chained audit log.

Each entry's hash covers its own content plus the previous entry's hash, so changing
or removing any past entry breaks the chain from that point on.
"""

import hashlib
import json
import threading
from datetime import UTC, datetime

from sqlalchemy import event, select
from sqlalchemy.orm import Session, SessionTransaction

from app.models.tables import AuditEvent

GENESIS_HASH = "0" * 64

# Reading the last hash and committing the new entry must not interleave between requests,
# or two entries get the same prev_hash and the chain forks. A session takes this lock at its
# first write (flush or audit entry, whichever comes first, so always before SQLite's own
# write lock) and holds it until its transaction ends (commit, rollback or close).
# This covers one server process; the UNIQUE index on prev_hash catches anything else.
_chain_lock = threading.Lock()
_HOLDS_LOCK = "holds_audit_chain_lock"


def _acquire_chain_lock(db: Session) -> None:
    if not db.info.get(_HOLDS_LOCK):
        _chain_lock.acquire()
        db.info[_HOLDS_LOCK] = True


@event.listens_for(Session, "before_flush")
def _lock_before_write(db: Session, *_) -> None:
    if db.new or db.dirty or db.deleted:
        _acquire_chain_lock(db)


@event.listens_for(Session, "after_transaction_end")
def _release_chain_lock(db: Session, transaction: SessionTransaction) -> None:
    if transaction.parent is None and db.info.pop(_HOLDS_LOCK, False):
        _chain_lock.release()


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def canonical_payload(
    *,
    entity_type: str,
    entity_id: str,
    event_type: str,
    actor_type: str,
    actor_role: str | None,
    data: dict,
    recorded_at: str,
    prev_hash: str,
) -> str:
    """The exact bytes that are hashed: sorted keys, no spaces, UTF-8."""
    return json.dumps(
        {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "event_type": event_type,
            "actor_type": actor_type,
            "actor_role": actor_role,
            "data": data,
            "recorded_at": recorded_at,
            "prev_hash": prev_hash,
        },
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _compute_hash(
    *,
    entity_type: str,
    entity_id: str,
    event_type: str,
    actor_type: str,
    actor_role: str | None,
    data: dict,
    recorded_at: str,
    prev_hash: str,
) -> str:
    payload = canonical_payload(
        entity_type=entity_type, entity_id=entity_id, event_type=event_type, actor_type=actor_type,
        actor_role=actor_role, data=data, recorded_at=recorded_at, prev_hash=prev_hash,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def record_event(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    event_type: str,
    actor_type: str,
    actor_role: str | None = None,
    data: dict | None = None,
) -> AuditEvent:
    """Add an audit entry to the session. The caller commits it with the change it records."""
    _acquire_chain_lock(db)
    last = db.scalar(select(AuditEvent).order_by(AuditEvent.event_id.desc()).limit(1))
    prev_hash = last.hash if last else GENESIS_HASH
    data = data or {}
    recorded_at = utc_now()
    entry = AuditEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=event_type,
        actor_type=actor_type,
        actor_role=actor_role,
        data=data,
        recorded_at=recorded_at,
        prev_hash=prev_hash,
        hash=_compute_hash(
            entity_type=entity_type,
            entity_id=entity_id,
            event_type=event_type,
            actor_type=actor_type,
            actor_role=actor_role,
            data=data,
            recorded_at=recorded_at,
            prev_hash=prev_hash,
        ),
    )
    db.add(entry)
    db.flush()
    return entry


def verify_chain(db: Session) -> tuple[bool, int, int | None]:
    """Return (ok, entries_checked, first_broken_event_id)."""
    prev_hash = GENESIS_HASH
    checked = 0
    for ev in db.scalars(select(AuditEvent).order_by(AuditEvent.event_id)):
        expected = _compute_hash(
            entity_type=ev.entity_type,
            entity_id=ev.entity_id,
            event_type=ev.event_type,
            actor_type=ev.actor_type,
            actor_role=ev.actor_role,
            data=ev.data,
            recorded_at=ev.recorded_at,
            prev_hash=prev_hash,
        )
        checked += 1
        if ev.prev_hash != prev_hash or ev.hash != expected:
            return False, checked, ev.event_id
        prev_hash = ev.hash
    return True, checked, None


def proof(db: Session, event_id: int) -> dict | None:
    """Recompute one entry's hash from its stored fields and check its link to the previous entry."""
    ev = db.get(AuditEvent, event_id)
    if ev is None:
        return None
    prev = db.scalar(
        select(AuditEvent).where(AuditEvent.event_id < event_id).order_by(AuditEvent.event_id.desc()).limit(1)
    )
    fields = dict(
        entity_type=ev.entity_type, entity_id=ev.entity_id, event_type=ev.event_type, actor_type=ev.actor_type,
        actor_role=ev.actor_role, data=ev.data, recorded_at=ev.recorded_at, prev_hash=ev.prev_hash,
    )
    payload = canonical_payload(**fields)
    recomputed = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    expected_prev = prev.hash if prev else GENESIS_HASH
    return {
        "event_id": ev.event_id,
        "components": fields,
        "canonical_payload": payload,
        "payload_bytes": len(payload.encode("utf-8")),
        "stored_hash": ev.hash,
        "recomputed_hash": recomputed,
        "hash_matches": recomputed == ev.hash,
        "previous_event_id": prev.event_id if prev else None,
        "expected_prev_hash": expected_prev,
        "prev_link_ok": ev.prev_hash == expected_prev,
        "algorithm": "SHA-256 over canonical JSON (sorted keys, no spaces, UTF-8)",
    }
