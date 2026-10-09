from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.schemas import AuditActor, AuditEntryOut, VerifyOut
from app.models.tables import AuditEvent
from app.services.audit_log import verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditEntryOut])
def list_audit(
    entity_id: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = select(AuditEvent)
    if entity_id:
        q = q.where(AuditEvent.entity_id == entity_id)
    events = db.scalars(q.order_by(AuditEvent.event_id.desc()).limit(limit))
    return [
        AuditEntryOut(
            event_id=e.event_id, entity_type=e.entity_type, entity_id=e.entity_id, event_type=e.event_type,
            actor=AuditActor(type=e.actor_type, role=e.actor_role), data=e.data,
            recorded_at=e.recorded_at, prev_hash=e.prev_hash, hash=e.hash,
        )
        for e in events
    ]


@router.get("/verify", response_model=VerifyOut)
def verify(db: Session = Depends(get_db)):
    ok, checked, broken_at = verify_chain(db)
    return VerifyOut(ok=ok, checked=checked, broken_at=broken_at)
