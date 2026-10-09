"""Deterministic stand-in for the real model (AI_PROVIDER=fake).

Lets the frontend and tests run without Ollama. It picks sentences that look like
risks and quotes them verbatim, so the rest of the pipeline is exercised for real.
Its wording is generic on purpose: it is not a model and must not look like one.
"""

import json
import re

_DOC = re.compile(r"<<<DOCUMENT-(\w+)\n(?P<data>.*)\nDOCUMENT-\1>>>", re.S)
_FACTS = re.compile(r"<<<FACTS-(\w+)\n(?P<data>.*)\nFACTS-\1>>>", re.S)
_KNOWN = re.compile(r"^- ([\w.-]+) \(", re.M)
_SENTENCE = re.compile(r"[^.!?\n]+[.!?]?")
_HOST = re.compile(r"\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b")

# (keyword stems in EN / AZ / RU, category, probability, impact)
_RULES = [
    (("delay", "late", "gecik", "задерж", "срок"), "operational", 4, 4),
    (("vendor", "contract", "podratçı", "müqavilə", "поставщик", "договор"), "financial", 3, 4),
    (("password", "access", "root", "parol", "giriş", "доступ", "парол"), "infosec", 3, 5),
    (("server", "outage", "database", "deleted", "сервер", "баз"), "it", 3, 4),
    (("budget", "cost", "büdcə", "xərc", "бюджет"), "financial", 3, 3),
    (("customer", "complain", "müştəri", "жалоб", "клиент"), "reputational", 2, 4),
]

# Readiness dimension -> words that suggest the plan covers it.
_DIMENSION_WORDS = {
    "scope": ("scope", "deliverable", "əhatə", "объем"),
    "success_criteria": ("success", "criteria", "kpi", "meyar"),
    "schedule": ("date", "deadline", "week", "march", "aprel", "срок", "tarix"),
    "budget": ("budget", "cost", "contingency", "büdcə", "бюджет"),
    "resourcing": ("team", "developer", "komanda", "proqramçı", "сотрудник"),
    "vendors": ("vendor", "contract", "podratçı", "поставщик"),
    "dependencies": ("integration", "api", "inteqrasiya", "интеграц"),
    "testing": ("test", "qa", "regression", "тест"),
    "rollback": ("rollback", "parallel run", "geri qaytar"),
    "security_access": ("access", "encrypt", "şifrə", "доступ"),
    "compliance": ("central bank", "regulat", "mərkəzi bank", "pci", "закон"),
    "stakeholders": ("sponsor", "stakeholder", "marketing", "marketinq", "бухгалтер"),
}
_DIMENSION_FAIL = {
    "rollback": ("single weekend", "no parallel"),
    "security_access": ("share the root password", "şifrələnmədən", "у всех сотрудников"),
    "testing": ("but the plan gives", "не проверялось"),
}


def _sentences(doc: str) -> list[str]:
    return [s.strip() for s in _SENTENCE.findall(doc) if s.strip()]


def _risk(sentence: str, category: str, p: int, i: int, source: str | None) -> dict:
    return {
        "classification": "risk",
        "statement": f"Sənəddə qeyd olunan problem səbəbindən {category} riski baş verə bilər və bu, gecikmə və ya itki ilə nəticələnə bilər.",
        "category": category,
        "source": source,
        "probability": p,
        "impact": i,
        "confidence": 0.75,
        "rationale": "Test rejimi: bu risk açar sözlərə görə seçilib, real model istifadə olunmayıb.",
        "evidence": [{"quote": sentence}],
        "strategy": "mitigate",
        "actions": ["Məsul şəxs təyin edin", "Həftəlik vəziyyəti yoxlayın"],
        "trigger": "Problem növbəti hesabatda təkrarlanarsa",
        "owner_role": "Project Manager",
    }


def _extract(doc: str) -> dict:
    risks = []
    for sentence in _sentences(doc):
        lowered = sentence.lower()
        for stems, category, p, i in _RULES:
            if any(stem in lowered for stem in stems):
                host = _HOST.search(sentence)
                risks.append(_risk(sentence, category, p, i, host.group(0) if host else None))
                break
        if len(risks) == 5:
            break
    return {"risks": risks}


def _readiness(doc: str) -> dict:
    sentences = _sentences(doc)
    dims = []
    for key, words in _DIMENSION_WORDS.items():
        fail = next((s for s in sentences if any(w in s.lower() for w in _DIMENSION_FAIL.get(key, ()))), None)
        hit = next((s for s in sentences if any(w in s.lower() for w in words)), None)
        if fail:
            dims.append({"key": key, "status": "failed", "finding": "Test rejimi: planda bu sahədə ciddi boşluq var.",
                         "recommendation": "Bu sahə üçün ayrıca plan hazırlayın.", "quote": fail})
        elif hit:
            dims.append({"key": key, "status": "passed", "finding": "Test rejimi: sənəddə bu sahə qeyd olunub.",
                         "recommendation": "", "quote": hit})
        else:
            dims.append({"key": key, "status": "warning", "finding": "Test rejimi: sənəddə bu sahə haqqında məlumat yoxdur.",
                         "recommendation": "Bu sahəni plana əlavə edin.", "quote": None})
    return {"summary": "Test rejimi: qiymətləndirmə açar sözlərə əsaslanır.", "dimensions": dims}


def _incident(user_text: str, doc: str) -> dict:
    lowered = doc.lower()
    known = _KNOWN.findall(user_text)
    systems = [s for s in known if s in lowered]
    first = _sentences(doc)[0] if _sentences(doc) else doc
    if any(w in lowered for w in ("dropped", "data loss", "breach", "down for all")):
        sev = "SEV1"
    elif any(w in lowered for w in ("staging", "dev ", "test environment")):
        sev = "SEV3"
    elif any(w in lowered for w in ("prod", "deleted", "outage", "rm ")):
        sev = "SEV2"
    else:
        sev = "SEV4"
    root = systems[0] if systems else None
    return {
        "title": first[:80],
        "summary": "Test rejimi: hesabatda təsvir olunan hadisə sistemin işinə təsir edə bilər.",
        "severity": sev,
        "severity_reason": "Test rejimi: ciddilik açar sözlərə görə təyin olunub.",
        "environment": "production" if "prod" in lowered else None,
        "systems": systems,
        "time_to_impact": "hours" if sev in ("SEV1", "SEV2") else "days",
        "consequential_risks": [_risk(first, "it", 4, 4, root)],
        "response": {
            "immediate": [{"action": "Sistemdə yeni dəyişiklikləri dayandırın", "owner_role": "On-call"}],
            "recovery": [{"action": "Ehtiyat nüsxədən bərpa edin və yoxlayın", "owner_role": "Platform Team"}],
            "prevention": [{"action": "Konfiqurasiyaları versiya nəzarətinə keçirin", "owner_role": "Platform Lead"}],
        },
        "escalation": (
            {"resource": root, "access_level": "sudo: config only", "duration_minutes": 120,
             "reason": "Test rejimi: bərpa üçün məhdud giriş lazımdır."}
            if root and sev in ("SEV1", "SEV2") else None
        ),
    }


def reply(user_text: str, task: str = "AIExtraction") -> str:
    facts = _FACTS.search(user_text)
    if facts:
        data = json.loads(facts.group("data"))
        return json.dumps({"insights": [{"text": f["text"], "fact_ids": [f["id"]]} for f in data]}, ensure_ascii=False)
    m = _DOC.search(user_text)
    doc = m.group("data") if m else user_text
    if task == "AIReadiness":
        result = _readiness(doc)
    elif task == "AIIncident":
        result = _incident(user_text, doc)
    else:
        result = _extract(doc)
    return json.dumps(result, ensure_ascii=False)
