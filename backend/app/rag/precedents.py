"""Historical Precedents & Runbooks Knowledge Catalog for Project RMAI.

Stores past incident post-mortems and operational recovery runbooks to ground AI reasoning.
"""

from dataclasses import dataclass


@dataclass
class Precedent:
    incident_id: str
    system_id: str
    title: str
    description: str
    outcome: str
    lesson_learned: str


@dataclass
class Runbook:
    runbook_id: str
    title: str
    target_system: str
    recovery_steps: list[str]


PRECEDENTS: list[Precedent] = [
    Precedent(
        incident_id="INC-0042",
        system_id="prod-web-02",
        title="Nginx Config Loss Outage",
        description="Configuration file was deleted during manual hotfix deployment.",
        outcome="47-minute checkout outage occurred upon service reload.",
        lesson_learned="Freeze restarts immediately until config is restored from Git IaC.",
    ),
    Precedent(
        incident_id="INC-0019",
        system_id="core-db",
        title="Un-reconciled Core Banking Migration",
        description="0.5% account balance discrepancy ignored before scheduled weekend cutover.",
        outcome="Emergency rollback required, incurring 14-day delay and regulatory fine.",
        lesson_learned="Never cut over without automated zero-discrepancy reconciliation rehearsal.",
    ),
    Precedent(
        incident_id="INC-0088",
        system_id="mobile-api",
        title="Unencrypted Test Data Exposure",
        description="Production customer data transferred to staging environment without anonymization.",
        outcome="Regulatory audit warning issued by Central Bank.",
        lesson_learned="Enforce automated field-masking pipelines before any test DB sync.",
    ),
]

RUNBOOKS: list[Runbook] = [
    Runbook(
        runbook_id="RB-07",
        title="Nginx Configuration Emergency Restore",
        target_system="prod-web-02",
        recovery_steps=[
            "Freeze all incoming deployments and scheduled cron restarts.",
            "Restore /etc/nginx/nginx.conf from the Git IaC repository branch 'main'.",
            "Execute 'nginx -t' to validate configuration syntax.",
            "Reload the service using 'systemctl reload nginx' without terminating workers.",
        ],
    ),
    Runbook(
        runbook_id="RB-12",
        title="Core Database Ledger Discrepancy Reconciliation",
        target_system="core-db",
        recovery_steps=[
            "Halt all scheduled batch synchronization jobs.",
            "Execute the ledger reconciler audit script against yesterday's snapshot.",
            "Generate delta journal entries for unreconciled accounts.",
            "Require Migration Lead and CFO sign-off prior to resuming cutover.",
        ],
    ),
    Runbook(
        runbook_id="RB-15",
        title="Data Sanitization & Test Database Masking",
        target_system="mobile-api",
        recovery_steps=[
            "Purge unencrypted tables from the test database instance.",
            "Apply the FieldMasker utility on primary database replica.",
            "Verify all PII attributes are replaced with synthetic deterministic hashes.",
        ],
    ),
]


def find_precedents_for_systems(system_ids: list[str]) -> list[Precedent]:
    """Retrieve precedents matching given system IDs."""
    return [p for p in PRECEDENTS if p.system_id in system_ids]


def find_runbooks_for_systems(system_ids: list[str]) -> list[Runbook]:
    """Retrieve operational runbooks for given system IDs."""
    return [rb for rb in RUNBOOKS if rb.target_system in system_ids]
