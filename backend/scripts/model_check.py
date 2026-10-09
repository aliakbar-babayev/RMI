"""Early model test from the brief (section 6).

Runs each sample document (EN / AZ / RU) several times against the configured model and
reports: valid JSON, attempts, risk count, quote verification rate, whether the output
is in Azerbaijani, score consistency across runs, and time per run.

Usage:  uv run python -m scripts.model_check [--runs 3]
"""

import argparse
import statistics
import time

from app.ai.client import ModelUnavailableError, model_name
from app.samples import SAMPLES
from app.services import scorer
from app.services.extractor import ExtractionError, extract_risks
from app.services.verifier import locate_quote

_AZ_LETTERS = set("əğıöüçşƏĞIÖÜÇŞ")


def _looks_azerbaijani(text: str) -> bool:
    return any(ch in _AZ_LETTERS for ch in text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()
    print(f"Model: {model_name()}  runs per sample: {args.runs}\n")

    for sample in SAMPLES:
        print(f"== {sample['id']} ({sample['language']})")
        totals = []
        for run in range(1, args.runs + 1):
            t0 = time.perf_counter()
            try:
                result, attempts = extract_risks(sample["text"], sample["language"])
            except ModelUnavailableError as exc:
                print(f"  run {run}: MODEL UNAVAILABLE – {exc}")
                return
            except ExtractionError:
                print(f"  run {run}: INVALID JSON after 2 attempts ({time.perf_counter() - t0:.0f}s)")
                continue
            secs = time.perf_counter() - t0
            quotes = [e.quote for r in result.risks for e in r.evidence]
            verified = sum(1 for q in quotes if locate_quote(sample["text"], q))
            az = sum(1 for r in result.risks if _looks_azerbaijani(r.statement + r.rationale))
            scores = sorted(
                (scorer.compute_score(scorer.effective_probability(r.classification, r.probability), r.impact)
                 for r in result.risks),
                reverse=True,
            )
            totals.append(sum(scores))
            print(
                f"  run {run}: {secs:5.0f}s  attempts={attempts}  risks={len(result.risks)}  "
                f"quotes verified={verified}/{len(quotes)}  azerbaijani={az}/{len(result.risks)}  scores={scores}"
            )
        if len(totals) > 1:
            print(f"  score total across runs: {totals}  (stdev {statistics.pstdev(totals):.1f})")
        print()


if __name__ == "__main__":
    main()
