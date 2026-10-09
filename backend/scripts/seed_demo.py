"""Build a reproducible demo database from the project documents in ../data.

Every document goes through the normal API (POST /analyses), so quotes are verified, scores are
computed by the backend and every step is in the hash-chained audit log. A few human decisions
are then made so the dashboards, register and action tracker have content.

Usage (from backend/):
  python -m scripts.seed_demo                      # writes demo.db with the AI_PROVIDER from .env
  python -m scripts.seed_demo --db demo.db --force # rebuild; the old file is kept as a .bak copy
  python -m scripts.seed_demo --no-decisions       # analyses only, every risk stays pending
Then start the server on it:  DATABASE_URL=sqlite:///./demo.db uvicorn app.main:app ...

With AI_PROVIDER=fake every document gets the same canned risks: fine for testing the app, not
for the demo. Use the real model (ollama or vertex) to build the demo database. Note that with
vertex the documents are sent to Google Cloud.
"""

import argparse
import os
import shutil
import sys
import time
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
LANG = {"AZ": "az", "RU": "ru"}


def documents() -> list[dict]:
    out = []
    for path in sorted(DATA_DIR.glob("P*_*.md")):
        parts = path.stem.split("_")  # P1_PayBridge or P1_PayBridge_AZ
        out.append({
            "file": path.name,
            "project": parts[1],
            "language": LANG.get(parts[2], "en") if len(parts) > 2 else "en",
            "text": path.read_text(encoding="utf-8"),
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--db", default="demo.db", help="SQLite file to create (default: demo.db)")
    ap.add_argument("--force", action="store_true", help="rebuild even if the file exists (keeps a .bak copy)")
    ap.add_argument("--no-decisions", action="store_true", help="do not approve/escalate/resolve any risk")
    args = ap.parse_args()

    db_path = Path(args.db).resolve()
    if db_path.exists():
        if not args.force:
            print(f"{db_path.name} already exists. Use --force to rebuild it (a backup copy is kept).")
            return 1
        backup = db_path.with_name(f"{db_path.name}.bak-{time.strftime('%Y%m%d-%H%M%S')}")
        shutil.move(db_path, backup)
        print(f"kept the old database as {backup.name}")

    docs = documents()
    if not docs:
        print(f"no project documents found in {DATA_DIR}")
        return 1

    # Settings and the engine are created at import time, so point them at the new file first.
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    from fastapi.testclient import TestClient

    from app.ai.client import model_name
    from app.main import app

    print(f"model: {model_name()}   database: {db_path.name}   documents: {len(docs)}\n")
    if model_name() == "fake":
        print("note: AI_PROVIDER=fake gives the same canned risks for every document (test data only)\n")

    failures = 0
    analyses: list[tuple[dict, dict]] = []
    with TestClient(app) as client:
        analyst = {"X-Role": "analyst"}
        executive = {"X-Role": "executive"}
        for d in docs:
            started = time.monotonic()
            res = client.post("/analyses", headers=analyst,
                              json={"text": d["text"], "source": d["project"], "language_hint": d["language"]})
            took = time.monotonic() - started
            if res.status_code != 201:
                failures += 1
                print(f"FAIL {d['file']:26} {res.status_code} {res.json().get('message', '')}")
                continue
            a = res.json()
            analyses.append((d, a))
            levels = [r["level"] for r in a["risks"]]
            print(f"OK   {d['file']:26} {a['analysis_id']}  {len(a['risks'])} risks "
                  f"({levels.count('critical')} critical, {levels.count('high')} high)  "
                  f"dropped quotes: {a['stats'].get('dropped_quotes', 0)}  {took:.1f}s")

        decided = {"approved": 0, "resolved": 0, "escalated": 0}
        if not args.no_decisions:
            escalated_once = False
            for d, a in analyses:
                risks = sorted(a["risks"], key=lambda r: -r["score"])
                if not risks:
                    continue
                top = risks[0]
                if top["level"] == "critical" and not escalated_once:
                    # One escalation for the demo: the most severe risk goes to the CISO.
                    client.post(f"/risks/{top['risk_id']}/escalate", headers=executive,
                                json={"to": "ciso", "reason": "Critical risk needs an executive decision."})
                    decided["escalated"] += 1
                    escalated_once = True
                else:
                    client.post(f"/risks/{top['risk_id']}/approve", headers=executive, json={})
                    decided["approved"] += 1
                if len(risks) > 2:
                    low = risks[-1]
                    client.post(f"/risks/{low['risk_id']}/approve", headers=executive, json={})
                    client.post(f"/risks/{low['risk_id']}/resolve", headers=executive,
                                json={"comment": "Mitigation completed (demo data)."})
                    decided["resolved"] += 1

        kpis = client.get("/dashboard/kpis").json()
        verify = client.get("/audit/verify").json()

    os.chmod(db_path, 0o600)  # the database holds the full document texts
    print(f"\ndecisions: {decided}")
    print(f"risks: {kpis['total']} total, {kpis['open']} open, {kpis['critical']} critical")
    print(f"audit chain: {'intact' if verify['ok'] else 'BROKEN'} ({verify['checked']} entries)")
    print(f"\nstart the server on it:\n  DATABASE_URL=sqlite:///./{db_path.name} uvicorn app.main:app --host 0.0.0.0 --port 8000")
    return 1 if failures or not verify["ok"] else 0


if __name__ == "__main__":
    sys.exit(main())
