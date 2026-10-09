import json
import time

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models.schemas import AuditActor, AuditEntryOut, VerifyOut
from app.models.tables import AuditEvent
from app.services.audit_log import GENESIS_HASH, proof, verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])


def entry_out(e: AuditEvent) -> AuditEntryOut:
    return AuditEntryOut(
        event_id=e.event_id, entity_type=e.entity_type, entity_id=e.entity_id, event_type=e.event_type,
        actor=AuditActor(type=e.actor_type, role=e.actor_role), data=e.data,
        recorded_at=e.recorded_at, prev_hash=e.prev_hash, hash=e.hash,
    )


@router.get("", response_model=list[AuditEntryOut])
def list_audit(
    entity_id: str | None = None,
    category: str | None = None,
    search: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """`category` filters by entity type (risk, analysis, incident, escalation);
    `search` matches an entity id or the start of a hash."""
    q = select(AuditEvent)
    if entity_id:
        q = q.where(AuditEvent.entity_id == entity_id)
    if category:
        q = q.where(AuditEvent.entity_type == category)
    if search:
        s = search.strip()
        q = q.where((AuditEvent.entity_id == s) | AuditEvent.hash.startswith(s.lower()) | AuditEvent.prev_hash.startswith(s.lower()))
    events = db.scalars(q.order_by(AuditEvent.event_id.desc()).limit(limit))
    return [entry_out(e) for e in events]


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    counts = dict(db.execute(select(AuditEvent.entity_type, func.count()).group_by(AuditEvent.entity_type)).all())
    head = db.scalar(select(AuditEvent).order_by(AuditEvent.event_id.desc()).limit(1))
    return {
        "total": sum(counts.values()),
        "by_category": counts,
        "head": {"event_id": head.event_id, "hash": head.hash, "recorded_at": head.recorded_at} if head else None,
        "genesis_prev_hash": GENESIS_HASH,
    }


@router.get("/verify", response_model=VerifyOut)
def verify(db: Session = Depends(get_db)):
    t0 = time.perf_counter()
    ok, checked, broken_at = verify_chain(db)
    return VerifyOut(ok=ok, checked=checked, broken_at=broken_at, duration_ms=round((time.perf_counter() - t0) * 1000, 2))


@router.get("/{event_id}/proof")
def get_proof(event_id: int, db: Session = Depends(get_db)):
    p = proof(db, event_id)
    if p is None:
        raise AppError(404, "not_found", f"Audit entry {event_id} not found.")
    return p


@router.get("/{event_id}/proof/download")
def download_proof(event_id: int, db: Session = Depends(get_db)):
    p = proof(db, event_id)
    if p is None:
        raise AppError(404, "not_found", f"Audit entry {event_id} not found.")
    return Response(
        json.dumps(p, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="audit-proof-{event_id}.json"'},
    )
