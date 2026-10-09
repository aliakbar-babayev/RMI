# RM AI – Backend (Phase 1)

FastAPI + SQLite backend for the Phase 1 demo in `RM_AI_Backend_Frontend_Brief.md`:
paste project text → local AI proposes scored, evidence-backed risks → review (approve / edit / escalate / reject / resolve) → dashboard numbers → hash-chained audit log.

## Run

```bash
uv sync
cp .env.example .env          # set AI_PROVIDER=fake to work without Ollama
uv run uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Local model (Ollama)
```bash
ollama pull qwen2.5:7b        # ~5 GB; any model works, set OLLAMA_MODEL
uv run python -m scripts.model_check --runs 3
```
`model_check` runs the EN / AZ / RU samples and reports valid JSON, quote verification, Azerbaijani output and score consistency, which is the 30-minute model test from the brief. On a CPU-only laptop expect 1–3 minutes per analysis.

### Tests
```bash
uv run pytest -q
```

## Layout
```
app/
  main.py            app, CORS, /samples, /health
  config.py          settings from .env
  db.py              SQLite engine, append-only triggers on audit_events
  deps.py            X-Role header (executive | analyst | auditor)
  errors.py          all errors as {"error", "message"}
  samples.py         demo documents (EN / AZ / RU)
  ai/client.py       call_model() – the only code that knows the model
  ai/prompts.py      system prompt, delimited document block
  ai/fake_model.py   deterministic stand-in (AI_PROVIDER=fake)
  services/          extractor, verifier, scorer, analysis, risks, heatmap, audit_log
  routers/           analyses, risks, dashboard, audit
scripts/model_check.py
tests/
```

## How the core rules are enforced
| Rule | Where |
|---|---|
| Evidence or nothing | `services/verifier.py`: quotes must appear in the text (case and whitespace ignored). Failed quotes are dropped; risks left with none get `needs_review`. Stored evidence is the exact text from the document, with `start`/`end` offsets for highlighting. |
| Validate AI output | `services/extractor.py`: Pydantic validation, one retry with the error, then `502 invalid_model_output`. |
| Score = P × I by backend | `services/scorer.py`. Any score the model sends is ignored. Issues get P = 5 (already happened). |
| Numbers from queries | `services/heatmap.py` |
| Input is data | `ai/prompts.py`: document inside `<<<DOCUMENT … DOCUMENT>>>`, instructions inside it are to be ignored |
| Humans decide | New risks are always `pending`. |
| Append-only audit | `services/audit_log.py` (SHA-256 chain) + SQLite triggers blocking UPDATE/DELETE; `GET /audit/verify` |
| No secrets in git | `.env`, `*.db` in `.gitignore` |

## API notes for the frontend
- Send `X-Role: executive | analyst | auditor` on every request (default `analyst`). Auditors get `403` on changes.
- `POST /analyses` is synchronous and can take minutes with a local model. Show a progress state.
- Status changes: `approve`, `reject` (`{reason}`), `escalate` (`{to: "ciso"|"pmo", reason}`), `resolve`. `rejected` and `resolved` are final; other invalid moves return `409 invalid_transition`.
- `PATCH /risks/{id}` accepts `probability, impact, statement, owner_role, category, strategy, trigger, actions, source, comment`. Score and level are recomputed.
- `GET /risks` filters: `status, category, level, source, needs_review`. Use `source=unassigned` for risks without a source.
- `GET /dashboard/heatmap?mode=all|open&source=` always returns all 25 cells. Rejected risks are excluded.
- `GET /dashboard/insights` returns `{insights: [{text, fact_ids}], facts, generated_by: "ai"|"template"|"none"}`. The backend computes the facts; the AI only rephrases them in Azerbaijani. If the AI text contains any number not in the facts, or the model is down, the fixed template sentences are returned. The reply is cached until the numbers change, so polling is cheap.

## Additions beyond the brief's API table
- `POST /risks/{id}/resolve`: needed so the heat map can show solved risks.
- `GET /health`: shows which model is configured.
- KPIs also return `needs_review`, `rejected`, `total`.

## Known limits
- The hash chain detects edited or removed entries, but not removal of the newest entries (truncation). Fix later by publishing the latest hash elsewhere.
- AZ and RU sample texts need a check by a native speaker.
