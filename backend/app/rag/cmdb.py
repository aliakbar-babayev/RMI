"""Lightweight CMDB System Registry & Dependency Graph for Project RMAI.

Enables automated blast radius calculation and system entity resolution.
"""

from dataclasses import dataclass, field


@dataclass
class SystemNode:
    system_id: str
    service: str
    environment: str
    criticality: str
    owner_team: str
    dependents: list[str] = field(default_factory=list)


SYSTEM_REGISTRY: dict[str, SystemNode] = {
    "prod-web-02": SystemNode(
        system_id="prod-web-02",
        service="web-frontend",
        environment="production",
        criticality="high",
        owner_team="Platform",
        dependents=["checkout-api", "admin-portal", "Mobile App", "Web Store"],
    ),
    "prod-web-01": SystemNode(
        system_id="prod-web-01",
        service="web-frontend",
        environment="production",
        criticality="high",
        owner_team="Platform",
        dependents=["checkout-api", "Web Store"],
    ),
    "core-db": SystemNode(
        system_id="core-db",
        service="banking-ledger",
        environment="production",
        criticality="critical",
        owner_team="Database Team",
        dependents=["core-banking-api", "settlement-engine", "reconciliation-batch", "mobile-api"],
    ),
    "mobile-api": SystemNode(
        system_id="mobile-api",
        service="mobile-gateway",
        environment="production",
        criticality="high",
        owner_team="Mobile Engineering",
        dependents=["iOS App", "Android App", "Notification Service"],
    ),
    "erp-prod": SystemNode(
        system_id="erp-prod",
        service="enterprise-erp",
        environment="production",
        criticality="high",
        owner_team="Enterprise Apps",
        dependents=["accounting-service", "warehouse-management", "procurement-system"],
    ),
}


def find_systems_in_text(text: str) -> list[SystemNode]:
    """Identify registered systems mentioned in text."""
    lower = text.lower()
    matches = []
    for sys_id, node in SYSTEM_REGISTRY.items():
        if sys_id in lower or node.service in lower:
            matches.append(node)
    return matches


def get_blast_radius(system_ids: list[str]) -> list[str]:
    """Calculate aggregate blast radius for systems."""
    dependents = set()
    for sys_id in system_ids:
        node = SYSTEM_REGISTRY.get(sys_id)
        if node:
            dependents.update(node.dependents)
    return sorted(dependents)
