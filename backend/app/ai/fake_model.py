"""Deterministic stand-in for the real model (AI_PROVIDER=fake).

Lets the frontend and tests run without Ollama. It picks sentences that look like
risks and quotes them verbatim, so the rest of the pipeline is exercised for real.
"""

import json
import re

_DOC = re.compile(r"<<<DOCUMENT\n(.*)\nDOCUMENT>>>", re.S)
_SENTENCE = re.compile(r"[^.!?\n]+[.!?]?")
_HOST = re.compile(r"\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b")

# (keyword stems in EN / AZ / RU, category, probability, impact)
_RULES = [
    (("delay", "late", "gecik", "задерж", "срок"), "operational", 4, 4),
    (("vendor", "contract", "podratçı", "müqavilə", "поставщик", "договор"), "financial", 3, 4),
    (("password", "access", "root", "parol", "giriş", "доступ", "парол"), "infosec", 3, 5),
    (("server", "outage", "database", "server", "сервер", "баз"), "it", 3, 4),
    (("budget", "cost", "büdcə", "xərc", "бюджет"), "financial", 3, 3),
    (("customer", "complain", "müştəri", "жалоб", "клиент"), "reputational", 2, 4),
]


_FACTS = re.compile(r"<<<FACTS\n(.*)\nFACTS>>>", re.S)


def reply(user_text: str) -> str:
    facts = _FACTS.search(user_text)
    if facts:
        return json.dumps(
            {"insights": [{"text": f["text"], "fact_ids": [f["id"]]} for f in json.loads(facts.group(1))]},
            ensure_ascii=False,
        )
    m = _DOC.search(user_text)
    doc = m.group(1) if m else user_text
    risks = []
    for sentence in (s.strip() for s in _SENTENCE.findall(doc)):
        lowered = sentence.lower()
        for stems, category, p, i in _RULES:
            if any(stem in lowered for stem in stems):
                host = _HOST.search(sentence)
                risks.append(
                    {
                        "classification": "risk",
                        "statement": f"Sənəddə qeyd olunan problem səbəbindən layihədə {category} riski baş verə bilər və bu, gecikmə və ya itki ilə nəticələnə bilər.",
                        "category": category,
                        "source": host.group(0) if host else None,
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
                )
                break
        if len(risks) == 5:
            break
    return json.dumps({"risks": risks}, ensure_ascii=False)
