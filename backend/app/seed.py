"""Demo system registry for a fictional bank, loaded once into an empty database.

Replace with the company's real systems (or an import from its CMDB) for real use.
`depends_on` lists what a system needs; if that breaks, this system is affected.
"""

from app.db import SessionLocal
from app.models.tables import System

DEMO_SYSTEMS = [
    ("k8s-ingress", "Kubernetes ingress", "network", "production", "critical", "Platform", [], "Entry point for all public HTTP traffic."),
    ("prod-web-01", "Web server 01 (nginx)", "server", "production", "high", "Platform", ["k8s-ingress"], "Public web tier, node 1."),
    ("prod-web-02", "Web server 02 (nginx)", "server", "production", "high", "Platform", ["k8s-ingress"], "Public web tier, node 2."),
    ("auth-sso", "Single sign-on (OAuth2)", "service", "production", "critical", "Security", [], "Login and tokens for staff and customers."),
    ("api-gateway", "API gateway cluster", "service", "production", "critical", "Platform", ["prod-web-01", "prod-web-02", "auth-sso"], "Routes all API calls."),
    ("core-db", "Core banking database", "database", "production", "critical", "DBA", ["s3-backups"], "Accounts and balances (primary replica cluster)."),
    ("s3-backups", "Backup storage", "cloud", "production", "high", "Platform", [], "Nightly database and config backups."),
    ("payment-auth-worker", "Payment authorization worker", "service", "production", "critical", "Payments", ["api-gateway", "core-db"], "Authorizes card and transfer payments."),
    ("customer-portal", "Customer web portal", "application", "production", "high", "Digital", ["prod-web-02", "api-gateway"], "Internet banking for customers."),
    ("mobile-api", "Mobile banking API", "service", "production", "high", "Digital", ["api-gateway", "core-db"], "Backend for the mobile app."),
    ("mobile-app-sync", "Mobile app sync service", "service", "production", "medium", "Digital", ["mobile-api"], "Push and background sync for iOS/Android."),
    ("erp-prod", "ERP system", "application", "production", "high", "Finance IT", ["core-db"], "Accounting, procurement, payroll."),
    ("warehouse-sync", "Warehouse integration", "service", "production", "medium", "Finance IT", ["erp-prod"], "Order sync between ERP and warehouse."),
    ("staging-db", "Staging database", "database", "staging", "low", "DBA", [], "Test copy of core-db."),
]


def seed_systems() -> None:
    with SessionLocal() as db:
        if db.query(System).first():
            return
        for sid, name, kind, env, crit, team, deps, desc in DEMO_SYSTEMS:
            db.add(System(system_id=sid, name=name, kind=kind, environment=env, criticality=crit,
                          owner_team=team, depends_on=deps, description=desc))
        db.commit()
