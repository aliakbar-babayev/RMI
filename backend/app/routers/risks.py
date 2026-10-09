from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import can_act
from app.models.schemas import (
    Category, CommentBody, EscalateBody, Level, RejectBody, RiskOut, RiskPatch, Role, Status,
)
from app.models.tables import Risk
from app.services import risks as svc
from app.services.heatmap import UNASSIGNED

router = APIRouter(prefix="/risks", tags=["risks"])


@router.get("", response_model=list[RiskOut])
def list_risks(
    status: Status | None = None,
    category: Category | None = None,
    level: Level | None = None,
    source: str | None = None,
    needs_review: bool | None = None,
    db: Session = Depends(get_db),
):
    q = select(Risk)
    if status:
        q = q.where(Risk.status == status)
    if category:
        q = q.where(Risk.category == category)
    if level:
        q = q.where(Risk.level == level)
    if source:
        q = q.where(Risk.source.is_(None) if source == UNASSIGNED else Risk.source == source)
    if needs_review is not None:
        q = q.where(Risk.needs_review == needs_review)
    return [svc.to_out(r) for r in db.scalars(q.order_by(Risk.score.desc(), Risk.id))]


@router.get("/{risk_id}", response_model=RiskOut)
def get_risk(risk_id: str, db: Session = Depends(get_db)):
    return svc.to_out(svc.get_risk(db, risk_id))


@router.patch("/{risk_id}", response_model=RiskOut)
def edit_risk(risk_id: str, body: RiskPatch, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    return svc.to_out(svc.edit(db, svc.get_risk(db, risk_id), body, role))


@router.post("/{risk_id}/approve", response_model=RiskOut)
def approve_risk(
    risk_id: str, body: CommentBody | None = None, db: Session = Depends(get_db), role: Role = Depends(can_act)
):
    return svc.to_out(svc.approve(db, svc.get_risk(db, risk_id), role, body.comment if body else None))


@router.post("/{risk_id}/reject", response_model=RiskOut)
def reject_risk(risk_id: str, body: RejectBody, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    return svc.to_out(svc.reject(db, svc.get_risk(db, risk_id), role, body.reason))


@router.post("/{risk_id}/escalate", response_model=RiskOut)
def escalate_risk(risk_id: str, body: EscalateBody, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    return svc.to_out(svc.escalate(db, svc.get_risk(db, risk_id), role, body.to, body.reason))


@router.post("/{risk_id}/resolve", response_model=RiskOut)
def resolve_risk(
    risk_id: str, body: CommentBody | None = None, db: Session = Depends(get_db), role: Role = Depends(can_act)
):
    return svc.to_out(svc.resolve(db, svc.get_risk(db, risk_id), role, body.comment if body else None))
