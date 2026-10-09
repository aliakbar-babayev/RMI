"""Unit tests for the Internal RAG subsystem (CMDB, Precedents, Context)."""

from app.rag.cmdb import find_systems_in_text, get_blast_radius
from app.rag.precedents import find_precedents_for_systems, find_runbooks_for_systems
from app.rag.retriever import retrieve_rag_context


def test_cmdb_finds_systems():
    text = "We are performing a hotfix deployment on prod-web-02 tonight."
    systems = find_systems_in_text(text)
    assert len(systems) >= 1
    assert any(s.system_id == "prod-web-02" for s in systems)


def test_blast_radius_calculation():
    blast = get_blast_radius(["prod-web-02"])
    assert "checkout-api" in blast
    assert "Web Store" in blast


def test_precedents_and_runbooks_retrieval():
    precedents = find_precedents_for_systems(["prod-web-02"])
    runbooks = find_runbooks_for_systems(["prod-web-02"])
    assert any(p.incident_id == "INC-0042" for p in precedents)
    assert any(rb.runbook_id == "RB-07" for rb in runbooks)


def test_retrieve_rag_context_formatting():
    text = "Accidentally truncated config on prod-web-02."
    context = retrieve_rag_context(text)
    assert "SYSTEM INFRASTRUCTURE & CRITICALITY:" in context
    assert "prod-web-02" in context
    assert "CALCULATED BLAST RADIUS" in context
    assert "checkout-api" in context
    assert "HISTORICAL INCIDENT PRECEDENTS:" in context
    assert "INC-0042" in context
    assert "RECOMMENDED OPERATIONAL RUNBOOKS:" in context
    assert "RB-07" in context
