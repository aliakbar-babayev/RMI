from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import can_act
from app.models.schemas import BreakGlassCreate, EscalationCreate, EscalationDecision, Role
from app.models.tables import Escalation
from app.services import escalations as svc

router = APIRouter(prefix="/escalations", tags=["escalations"])


class ReviewBody(BaseModel):
    justified: bool
    comment: str | None = None


@router.get("")
def list_escalations(status: str | None = None, incident_id: str | None = None, db: Session = Depends(get_db)):
    svc.expire_due(db)
    q = select(Escalation)
    if status:
        q = q.where(Escalation.status == status)
    if incident_id:
        q = q.where(Escalation.incident_id == incident_id)
    return [svc.to_out(e) for e in db.scalars(q.order_by(Escalation.id.desc()))]


@router.post("", status_code=201)
def request_escalation(body: EscalationCreate, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    return svc.to_out(svc.create(db, body, role))


@router.post("/break-glass", status_code=201)
def break_glass(body: BreakGlassCreate, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    return svc.to_out(svc.break_glass(db, body, role))


@router.get("/{escalation_id}")
def get_escalation(escalation_id: str, db: Session = Depends(get_db)):
    svc.expire_due(db)
    return svc.to_out(svc.get(db, escalation_id))


@router.post("/{escalation_id}/decision")
def decide(escalation_id: str, body: EscalationDecision, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    svc.expire_due(db)
    return svc.to_out(svc.decide(db, svc.get(db, escalation_id), body, role))


@router.post("/{escalation_id}/revoke")
def revoke(escalation_id: str, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    svc.expire_due(db)
    return svc.to_out(svc.revoke(db, svc.get(db, escalation_id), role))


@router.post("/{escalation_id}/review")
def review(escalation_id: str, body: ReviewBody, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    return svc.to_out(svc.review(db, svc.get(db, escalation_id), role, body.justified, body.comment))
