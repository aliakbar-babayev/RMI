"""Append-only, hash-chained audit log.

Each entry's hash covers its own content plus the previous entry's hash, so changing
or removing any past entry breaks the chain from that point on.
"""

import hashlib
import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tables import AuditEvent

GENESIS_HASH = "0" * 64


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


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
    payload = json.dumps(
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
