"""RAG Context Formatting & Prompt Delimiter Envelope for Project RMAI."""

import secrets
from app.rag.cmdb import SystemNode
from app.rag.precedents import Precedent, Runbook


def build_rag_context_block(
    systems: list[SystemNode],
    blast_radius: list[str],
    precedents: list[Precedent],
    runbooks: list[Runbook],
) -> str:
    """Format retrieved knowledge into a protected, delimited context block."""
    if not systems and not precedents and not runbooks:
        return ""

    nonce = secrets.token_hex(6)
    lines = [f"Marker ID: {nonce}", f"<<<RAG_CONTEXT-{nonce}"]

    if systems:
        lines.append("SYSTEM INFRASTRUCTURE & CRITICALITY:")
        for s in systems:
            lines.append(f"• System: {s.system_id} | Service: {s.service} | Env: {s.environment} | Criticality: {s.criticality} | Owner: {s.owner_team}")

    if blast_radius:
        lines.append(f"CALCULATED BLAST RADIUS (DEPENDENT SERVICES): {', '.join(blast_radius)}")

    if precedents:
        lines.append("HISTORICAL INCIDENT PRECEDENTS:")
        for p in precedents:
            lines.append(f"• [{p.incident_id}] {p.title} ({p.system_id}): {p.outcome} Lesson: {p.lesson_learned}")

    if runbooks:
        lines.append("RECOMMENDED OPERATIONAL RUNBOOKS:")
        for rb in runbooks:
            steps = " -> ".join(rb.recovery_steps[:2])
            lines.append(f"• [{rb.runbook_id}] {rb.title}: {steps}")

    lines.append(f"RAG_CONTEXT-{nonce}>>>")
    return "\n".join(lines)
