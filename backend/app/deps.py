from fastapi import Header

from app.errors import AppError
from app.models.schemas import Role


def current_role(x_role: str = Header(default=Role.analyst.value)) -> Role:
    """Phase 1 has no login: the frontend's role switcher sends X-Role."""
    try:
        return Role(x_role.strip().lower())
    except ValueError:
        raise AppError(400, "invalid_role", "X-Role must be executive, analyst or auditor.")


def can_act(x_role: str = Header(default=Role.analyst.value)) -> Role:
    """Roles allowed to change risks. Auditors only read."""
    role = current_role(x_role)
    if role == Role.auditor:
        raise AppError(403, "forbidden", "Auditors have read-only access.")
    return role
