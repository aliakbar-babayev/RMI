from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models.schemas import RiskOut, RiskPatch, Status
from app.models.tables import Risk
from app.services import scorer
from app.services.audit_log import record_event, utc_now

# Which statuses each action may start from. rejected and resolved are final.
_ALLOWED_FROM: dict[str, set[Status]] = {
    "edit": {Status.pending, Status.approved, Status.edited, Status.escalated},
    "approve": {Status.pending, Status.edited, Status.escalated},
    "reject": {Status.pending, Status.edited, Status.escalated, Status.approved},
    "escalate": {Status.pending, Status.edited, Status.approved},
    "resolve": {Status.approved, Status.edited, Status.escalated},
}


_DERIVED = {"analysis_id", "incident_id"}


def to_out(risk: Risk) -> RiskOut:
    return RiskOut.model_validate(
        {**{c: getattr(risk, c) for c in RiskOut.model_fields if c not in _DERIVED},
         "analysis_id": risk.analysis.analysis_id,
         "incident_id": risk.analysis.incident_id}
    )


def get_risk(db: Session, risk_id: str) -> Risk:
    risk = db.scalar(select(Risk).where(Risk.risk_id == risk_id))
    if not risk:
        raise AppError(404, "not_found", f"Risk {risk_id} not found.")
    return risk


def _check(risk: Risk, action: str) -> None:
    if Status(risk.status) not in _ALLOWED_FROM[action]:
        raise AppError(409, "invalid_transition", f"Cannot {action} a risk with status '{risk.status}'.")


def _log(db: Session, risk: Risk, event_type: str, role: str, data: dict) -> None:
    risk.updated_at = utc_now()
    record_event(
        db, entity_type="risk", entity_id=risk.risk_id, event_type=event_type,
        actor_type="human", actor_role=role, data=data,
    )
    db.commit()


def edit(db: Session, risk: Risk, patch: RiskPatch, role: str) -> Risk:
    _check(risk, "edit")
    changes = patch.model_dump(exclude_unset=True)
    comment = changes.pop("comment", None)
    if not changes:
        raise AppError(422, "nothing_to_change", "Send at least one field to change.")

    diff = {}
    for field, new in changes.items():
        old = getattr(risk, field)
        if old != new:
            diff[field] = {"from": old, "to": new}
            setattr(risk, field, new)
    if not diff:
        raise AppError(422, "nothing_to_change", "The new values equal the current ones.")

    if "probability" in diff or "impact" in diff:
        new_score = scorer.compute_score(risk.probability, risk.impact)
        if new_score != risk.score:
            diff["score"] = {"from": risk.score, "to": new_score}
        risk.score = new_score
        risk.level = scorer.level_for(new_score)

    risk.status = Status.edited
    _log(db, risk, "risk.edited", role, {"changes": diff, "comment": comment})
    return risk


def approve(db: Session, risk: Risk, role: str, comment: str | None) -> Risk:
    _check(risk, "approve")
    risk.status = Status.approved
    _log(db, risk, "risk.approved", role, {"comment": comment})
    return risk


def reject(db: Session, risk: Risk, role: str, reason: str) -> Risk:
    _check(risk, "reject")
    risk.status = Status.rejected
    _log(db, risk, "risk.rejected", role, {"reason": reason})
    return risk


def escalate(db: Session, risk: Risk, role: str, to: str, reason: str) -> Risk:
    _check(risk, "escalate")
    risk.status = Status.escalated
    risk.escalated_to = to
    _log(db, risk, "risk.escalated", role, {"to": to, "reason": reason})
    return risk


def resolve(db: Session, risk: Risk, role: str, comment: str | None) -> Risk:
    _check(risk, "resolve")
    risk.status = Status.resolved
    _log(db, risk, "risk.resolved", role, {"comment": comment})
    return risk
