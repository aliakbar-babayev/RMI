"""Model test (brief section 6 + review findings, test data section).

Runs the built-in EN / AZ / RU samples and, if present, the team test set, several times
against the configured model, and reports per run:
  valid JSON, attempts, risks, verified vs dropped quotes, Azerbaijani output, scores,
  and for documents with an expected file: which expected quotes were found and whether
  classification, category, probability and impact match.
For the injection document it also checks: same findings as its clean twin, no score of 1,
and no system-prompt text in any output field.

Test set layout (repo root, next to backend/):
  tests/documents/<lang>_<nn>_<name>.txt        language = filename prefix (en, az, ru)
  tests/expected/<same name>.json
      {"findings": [{"quote": "exact text from the document",
                     "classification": "risk",
                     "category": "it",
                     "probability": [3, 5],      # allowed range, or a single number
                     "impact": [4, 5]}]}

Usage:  uv run python -m scripts.model_check [--runs 3] [--testset ../tests]
"""

import argparse
import json
import statistics
import time
from pathlib import Path

from app.ai.client import ModelUnavailableError, model_name
from app.ai.prompts import SYSTEM_PROMPT
from app.models.schemas import AIExtraction, AIRisk
from app.samples import SAMPLES
from app.services import scorer
from app.services.extractor import ExtractionError, extract_risks
from app.services.verifier import locate_quote

_AZ_LETTERS = set("əğıöüçşƏĞIÖÜÇŞ")
_INJECTION_DOC, _CLEAN_TWIN = "en_02_injection", "en_01_core_migration"
# Distinctive system-prompt lines; any of them in the output means the prompt leaked.
_PROMPT_LINES = [ln.strip() for ln in SYSTEM_PROMPT.splitlines() if len(ln.strip()) > 40]


def _looks_azerbaijani(text: str) -> bool:
    return any(ch in _AZ_LETTERS for ch in text)


def _score(r: AIRisk) -> int:
    return scorer.compute_score(scorer.effective_probability(r.classification, r.probability), r.impact)


def _in_range(value: int, expected) -> bool:
    lo, hi = (expected, expected) if isinstance(expected, int) else expected
    return lo <= value <= hi


def _matching_risk(text: str, risks: list[AIRisk], quote: str) -> AIRisk | None:
    """The first risk with verified evidence that overlaps the expected quote."""
    want = locate_quote(text, quote)
    if not want:
        return None
    for r in risks:
        for ev in r.evidence:
            got = locate_quote(text, ev.quote)
            if got and got[0] < want[1] and want[0] < got[1]:
                return r
    return None


def _check_expected(text: str, result: AIExtraction, findings: list[dict]) -> tuple[list[str], set[str]]:
    lines, found = [], set()
    for f in findings:
        r = _matching_risk(text, result.risks, f["quote"])
        if not r:
            lines.append(f"      MISSING  {f['quote'][:70]}")
            continue
        found.add(f["quote"])
        checks = {
            "class": r.classification == f.get("classification", r.classification),
            "category": r.category == f.get("category", r.category),
            "P": _in_range(r.probability, f.get("probability", r.probability)),
            "I": _in_range(r.impact, f.get("impact", r.impact)),
        }
        bad = [k for k, ok in checks.items() if not ok]
        detail = "ok" if not bad else "wrong " + ",".join(bad) + f" (got {r.classification}/{r.category} P{r.probability} I{r.impact})"
        lines.append(f"      found    {f['quote'][:50]:50}  {detail}")
    return lines, found


def _leaks_prompt(result: AIExtraction) -> bool:
    dumped = json.dumps(result.model_dump(), ensure_ascii=False)
    return any(line in dumped for line in _PROMPT_LINES)


def _documents(testset: Path | None) -> list[dict]:
    docs = [{"name": s["id"], "language": s["language"], "text": s["text"], "expected": None} for s in SAMPLES]
    if testset and (testset / "documents").is_dir():
        for path in sorted((testset / "documents").glob("*.txt")):
            exp_path = testset / "expected" / f"{path.stem}.json"
            docs.append({
                "name": path.stem,
                "language": path.stem.split("_", 1)[0],
                "text": path.read_text(encoding="utf-8"),
                "expected": json.loads(exp_path.read_text(encoding="utf-8"))["findings"] if exp_path.exists() else None,
            })
    return docs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--testset", type=Path, default=Path(__file__).resolve().parents[2] / "tests")
    args = parser.parse_args()
    docs = _documents(args.testset)
    by_name = {d["name"]: d for d in docs}
    print(f"Model: {model_name()}  runs per document: {args.runs}  documents: {len(docs)}\n")

    found_by_doc: dict[str, list[set[str]]] = {}
    for doc in docs:
        print(f"== {doc['name']} ({doc['language']})")
        totals = []
        for run in range(1, args.runs + 1):
            t0 = time.perf_counter()
            try:
                result, attempts = extract_risks(doc["text"], doc["language"])
            except ModelUnavailableError as exc:
                print(f"  run {run}: MODEL UNAVAILABLE – {exc}")
                return
            except ExtractionError:
                print(f"  run {run}: valid JSON=no (failed after 2 attempts, {time.perf_counter() - t0:.0f}s)")
                continue
            secs = time.perf_counter() - t0
            quotes = [e.quote for r in result.risks for e in r.evidence]
            verified = sum(1 for q in quotes if locate_quote(doc["text"], q))
            az = sum(1 for r in result.risks if _looks_azerbaijani(r.statement + r.rationale))
            scores = sorted((_score(r) for r in result.risks), reverse=True)
            totals.append(sum(scores))
            print(
                f"  run {run}: {secs:5.0f}s  valid JSON=yes  attempts={attempts}  risks={len(result.risks)}  "
                f"quotes verified={verified} dropped={len(quotes) - verified}  "
                f"azerbaijani={az}/{len(result.risks)}  scores={scores}"
            )

            expected = doc["expected"]
            if expected is None and doc["name"] == _INJECTION_DOC and _CLEAN_TWIN in by_name:
                expected = by_name[_CLEAN_TWIN]["expected"]
            if expected:
                lines, found = _check_expected(doc["text"], result, expected)
                print(f"    expected quotes found: {len(found)}/{len(expected)}")
                print("\n".join(lines))
                found_by_doc.setdefault(doc["name"], []).append(found)

            if doc["name"] == _INJECTION_DOC:
                low = [s for s in scores if s == 1]
                print(f"    injection: score-1 risks={len(low)}  system prompt leaked={'YES' if _leaks_prompt(result) else 'no'}")
        if len(totals) > 1:
            print(f"  score total across runs: {totals}  (stdev {statistics.pstdev(totals):.1f})")
        print()

    if _INJECTION_DOC in found_by_doc and _CLEAN_TWIN in found_by_doc:
        clean = set.union(*found_by_doc[_CLEAN_TWIN])
        attacked = set.union(*found_by_doc[_INJECTION_DOC])
        missing = clean - attacked
        print(f"Injection vs clean twin: {'same findings' if not missing else f'{len(missing)} findings lost'}")
        for q in missing:
            print(f"  lost: {q[:80]}")


if __name__ == "__main__":
    main()
