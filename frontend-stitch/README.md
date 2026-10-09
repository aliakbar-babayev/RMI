# RM AI – Frontend (Stitch design, all modules)

This is `frontend-stitch/`, the full-module UI built from the Stitch "RMAI" screens. `frontend/` is the Phase 1 UI. Both talk to the same backend; the team picks one later.

React + TypeScript (Vite), Tailwind CSS, Recharts. Talks only to the backend API in `../backend`.

## Run

```bash
# 1. Backend (in ../backend)
uv run uvicorn app.main:app --reload --port 8000     # AI_PROVIDER=fake in .env works without a model

# 2. Frontend
npm install
npm run dev          # http://localhost:5173
```

In development, requests to `/api/*` go through Vite's proxy to `http://localhost:8000`, so no CORS setup is needed. To point at another backend: `BACKEND_URL=http://host:8000 npm run dev`. For a production build served elsewhere, set `VITE_API_URL` (e.g. `https://api.example.com`) before `npm run build`.

## Pages (design: Stitch "RMAI" screens in ~/Downloads/stitch)

| Route | Page |
|---|---|
| `/` | Overview & Analytics: KPI tiles, risks by treatment, review/incident status rings, 5×5 matrix, source exposure, fact-grounded AI insights, urgent tasks |
| `/risks` | Risk Register: filters + active-filter chips, scenario table, pagination, side inspector (CSV/JSON export) |
| `/analyze` | Project Analyzer: presets (incl. injection probe), payload box with SHA-256, 12-dimension readiness gauge, verbatim offset inspector, Accept/Triage (`?analysis=AN-001` keeps the result) |
| `/incidents` | Incident Reporter & Blast Radius: report form, severity, SLA metrics, "predicted risk happened" link, dependency graph, response horizons, least-privilege escalation, break-glass, activity trail (`?incident=INC-001`) |
| `/escalations` | Executive decisions: approve / approve narrower / reject, active grants and revoke, break-glass review |
| `/audit` | Cryptographic Audit Trail: chain state + re-verify, safeguards, block list with filters, proof inspector, proof export (`?event=N`) |
| `?risk=R-001` | Opens the risk inspector on any page |

## Notes
- **Role switcher** (header) sends `X-Role`. Auditor is read-only; only Executive decides escalations. It is not access control.
- **Polling**: data refreshes every 4 s and right after any change.
- **Colors**: level colors (green / yellow / orange / red) and chart colors were checked with a color-blindness palette validator. Numbers are always printed on cells and badges, so color is never the only signal.
- **Labels** for all backend values are in `src/lib/labels.ts`, the place to translate the UI.

## Layout
```
src/
  lib/api.ts          typed API client (mirrors backend schemas)
  lib/app.tsx         role, refresh signal, usePoll()
  lib/labels.ts       display text, level rules, allowed status transitions
  lib/useOpenRisk.ts  open/close the drawer via ?risk=
  components/         Layout, RiskInspector, RiskActions, HeatMap, ui (design-system components)
  pages/              Overview, Risks, Analyze, Incidents, Escalations, AuditTrail
```
