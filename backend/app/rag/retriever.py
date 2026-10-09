"""Hybrid Entity & Semantic Retriever for Project RMAI Internal RAG.

Connects input text to CMDB nodes, blast radius, historical precedents, and runbooks.
"""

from app.rag.cmdb import find_systems_in_text, get_blast_radius
from app.rag.context import build_rag_context_block
from app.rag.precedents import find_precedents_for_systems, find_runbooks_for_systems


def retrieve_rag_context(text: str) -> str:
    """Retrieve grounded operational facts and format as prompt context."""
    systems = find_systems_in_text(text)
    system_ids = [s.system_id for s in systems]

    blast_radius = get_blast_radius(system_ids) if system_ids else []
    precedents = find_precedents_for_systems(system_ids) if system_ids else []
    runbooks = find_runbooks_for_systems(system_ids) if system_ids else []

    return build_rag_context_block(systems, blast_radius, precedents, runbooks)
