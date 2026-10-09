# RM AI – Frontend

React + TypeScript + Vite + Tailwind CSS frontend for the RM AI risk management platform.

## Quick Start

```bash
# 1. Start the backend (fake model, no Ollama needed)
cd ../backend
cp .env.example .env        # set AI_PROVIDER=fake
uv sync && uv run uvicorn app.main:app --reload --port 8000

# 2. Start the frontend
cd ../frontend
cp .env.example .env        # default: VITE_API_URL=http://localhost:8000
npm install
npm run dev                  # opens http://localhost:5173
```

## Pages

- **Analyze** (`/`) — Paste text or pick a sample, run AI analysis, view identified risks.
- **Dashboard** (`/dashboard`) — KPIs, 5×5 heat map, top 10 risks, AI insights. Polls every 5s.
- **Action Center** (`/actions`) — Pending and needs-review risks with one-click actions.
- **Audit Log** (`/audit`) — Tamper-evident log with chain integrity verification.

## Architecture

- `src/types.ts` — All TypeScript types matching the backend schemas.
- `src/api.ts` — Single API client; all requests go through here. Sends `X-Role` header.
- `src/strings.ts` — All UI text in one file for future localization.
- `src/components/` — Reusable components (Header, RiskRow, RiskDrawer, HeatMap, EvidenceHighlight).
- `src/pages/` — Page components for each route.
- `src/hooks/` — Custom hooks (usePolling).

## Role Switcher

The header includes a role switcher (Executive / Analyst / Auditor). The selected role is sent as the `X-Role` header on every API request.

**Known Phase 1 limitation:** The role switcher is not a security mechanism. The backend trusts the `X-Role` header without authentication. Real auth is planned for Phase 2.

## Security Notes

- All risk text from AI and documents is rendered as plain text only — no `dangerouslySetInnerHTML`, no markdown rendering of backend strings.
- Evidence highlighting uses React element slicing with `<mark>`, never HTML string building.
- No secrets in frontend code or `.env` files committed to git.
- All requests go through `api.ts`; URL parameters are encoded.
- External links use `rel="noopener noreferrer"`.
