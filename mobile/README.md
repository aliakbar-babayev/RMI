# RM AI – Mobile (Expo / React Native)

Mobile client for the RM AI backend in `../backend`. It uses the same API as the web frontend; there is no AI logic or API key in the app.

## Screens
- **Overview** – risks by treatment type, task status, decision status, current risk matrix, top risk categories.
- **Risks** – level counts (Extreme / High / Medium / Low), 5×5 risk matrix with numbered markers, risk list.
- **Register** – risk scenarios with search and filters (status, inherent risk, treatment plan, category).
- **Actions** – tasks from approved risks (open / completed).
- **Add** – analyze a document, or add a scenario from the risk library (the AI scores it).
- **Risk detail** – likelihood/consequence steppers (saved to the backend), evidence quotes highlighted in the source, audit history, approve / escalate / reject / resolve.
- **Settings** (tap the avatar) – server address, demo role, audit-chain verification.

## Run
1. Start the backend so the phone can reach it (same Wi-Fi):
   `uvicorn app.main:app --host 0.0.0.0 --port 8000` (in `../backend`).
   The API has no real login, so use a trusted network or a phone hotspot.
2. In this folder:
   ```bash
   npm install
   EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8000 npx expo start --lan
   ```
3. Open the project in **Expo Go** (scan the QR code, or enter `exp://<LAN-IP>:8081`). Sign in to the same Expo account in the CLI (`npx expo login`) and in Expo Go.
4. If needed, change the server address in Settings. A phone cannot use `localhost`.

## Notes
- All server text is rendered as plain text; no HTML is interpreted.
- The role switcher is for the demo only; the backend trusts the `X-Role` header (Phase 1 limit).
- Plain HTTP is fine on a local network for the demo, not for production.
