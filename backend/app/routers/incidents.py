from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import ModelUnavailableError
from app.config import settings
from app.db import get_db
from app.deps import can_act
from app.errors import AppError
from app.models.schemas import IncidentCreate, Role, SeverityChange
from app.models.tables import Incident
from app.routers.audit import entry_out
from app.services import incidents as svc
from app.services.extractor import ExtractionError
from app.services.risks import to_out as risk_out

router = APIRouter(prefix="/incidents", tags=["incidents"])


class NoteBody(BaseModel):
    note: str | None = None


class MaterializeBody(BaseModel):
    risk_id: str


def _summary(inc: Incident) -> dict:
    return {
        "incident_id": inc.incident_id, "title": inc.title, "severity": inc.severity, "status": inc.status,
        "environment": inc.environment, "systems": inc.systems, "reported_at": inc.reported_at,
        "time_to_impact": inc.time_to_impact, "metrics": svc.metrics(inc),
    }


def _detail(db: Session, inc: Incident) -> dict:
    registry = svc.systems_by_id(db)
    return {
        **_summary(inc),
        "report": inc.report,
        "reporter_role": inc.reporter_role,
        "anonymous": inc.anonymous,
        "unmapped_systems": inc.unmapped_systems,
        "severity_reason": inc.severity_reason,
        "summary": inc.summary,
        "response_plan": inc.response_plan,
        "escalation_suggestion": inc.escalation_suggestion,
        "analysis_id": inc.analysis_id,
        "occurred_at": inc.occurred_at,
        "acknowledged_at": inc.acknowledged_at,
        "contained_at": inc.contained_at,
        "recovered_at": inc.recovered_at,
        "closed_at": inc.closed_at,
        "notify": svc.ROUTING[inc.severity],
        "sla_minutes": svc.SLA_MINUTES[inc.severity],
        "blast_radius": svc.blast_radius(inc.systems, registry),
        "consequential_risks": [risk_out(r) for r in svc.consequential_risks(db, inc)],
        "materialize_candidates": [risk_out(r) for r in svc.materialize_candidates(db, inc)],
    }


@router.post("", status_code=201)
def report_incident(body: IncidentCreate, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    if not body.report.strip():
        raise AppError(422, "empty_input", "Describe what happened.")
    if len(body.report) > settings.max_input_chars:
        raise AppError(413, "input_too_long", f"The report is limited to {settings.max_input_chars} characters.")
    try:
        inc = svc.create_incident(db, body, role)
    except ModelUnavailableError as exc:
        raise AppError(503, "model_unavailable", f"The local AI model could not be reached: {exc}")
    except ExtractionError:
        raise AppError(502, "invalid_model_output", "The AI returned invalid output twice. Try again.")
    return _detail(db, inc)


@router.get("")
def list_incidents(status: str | None = None, severity: str | None = None, db: Session = Depends(get_db)):
    q = select(Incident)
    if status == "open":
        q = q.where(Incident.status != "closed")
    elif status:
        q = q.where(Incident.status == status)
    if severity:
        q = q.where(Incident.severity == severity.upper())
    return [_summary(i) for i in db.scalars(q.order_by(Incident.id.desc()))]


@router.get("/{incident_id}")
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    return _detail(db, svc.get_incident(db, incident_id))


@router.get("/{incident_id}/timeline")
def incident_timeline(incident_id: str, db: Session = Depends(get_db)):
    return [entry_out(e) for e in svc.timeline(db, svc.get_incident(db, incident_id))]


@router.patch("/{incident_id}/severity")
def change_severity(incident_id: str, body: SeverityChange, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    inc = svc.change_severity(db, svc.get_incident(db, incident_id), body.severity, body.reason, role)
    return _detail(db, inc)


@router.post("/{incident_id}/materialize")
def materialize(incident_id: str, body: MaterializeBody, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    return risk_out(svc.confirm_materialized(db, svc.get_incident(db, incident_id), body.risk_id, role))


# Keep last: this generic route would otherwise capture /materialize.
@router.post("/{incident_id}/{action}")
def advance(
    incident_id: str,
    action: Literal["acknowledge", "contain", "recover", "close"],
    body: NoteBody | None = None,
    db: Session = Depends(get_db),
    role: Role = Depends(can_act),
):
    inc = svc.advance(db, svc.get_incident(db, incident_id), action, role, body.note if body else None)
    return _detail(db, inc)
