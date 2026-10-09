#!/usr/bin/env bash
# One-time setup of the RMI backend on a fresh Ubuntu/Debian server.
#
#   sudo bash setup.sh <api-domain> <frontend-url>
#   e.g. sudo bash setup.sh api.rmi.sysadmin.az https://rmi.vercel.app
#
# Clone to /opt first:  sudo git clone https://github.com/aliakbar-babayev/RMI.git /opt/RMI
# Before running: point a DNS A record for <api-domain> to this server, and open ports 80 and 443.
# Re-running is safe: it updates the code's dependencies and restarts the service.
set -euo pipefail

DOMAIN="${1:?usage: sudo bash setup.sh <api-domain> <frontend-url>}"
FRONTEND="${2:?usage: sudo bash setup.sh <api-domain> <frontend-url>}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"   # the cloned RMI repository
BACKEND="$APP_DIR/backend"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
case "$APP_DIR" in
  /home/*|/root/*) echo "Clone the repo outside home folders (the service cannot read /home), e.g.:"
                   echo "  sudo git clone https://github.com/aliakbar-babayev/RMI.git /opt/RMI"; exit 1 ;;
esac
echo "==> App folder: $APP_DIR   API domain: $DOMAIN   Frontend: $FRONTEND"

echo "==> System packages"
apt-get update -qq
apt-get install -y -qq curl ca-certificates debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null

echo "==> Service user 'rmi'"
id rmi >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin rmi
chown -R rmi:rmi "$APP_DIR"

echo "==> uv + Python dependencies"
if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh
fi
sudo -u rmi env HOME="$APP_DIR" UV_CACHE_DIR="$APP_DIR/.uv-cache" uv sync --directory "$BACKEND" --no-dev -q

echo "==> .env"
if [ ! -f "$BACKEND/.env" ]; then
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  echo "   Created backend/.env from the example. Put GCP_API_KEY in it, then re-run this script."
fi
# Allow the frontend's address (and keep local development working).
python3 - "$BACKEND/.env" "$FRONTEND" <<'PY'
import json, re, sys
path, frontend = sys.argv[1], sys.argv[2].rstrip("/")
text = open(path).read()
origins = [frontend, "http://localhost:5173"]
line = "CORS_ORIGINS=" + json.dumps(origins)
text = re.sub(r"^CORS_ORIGINS=.*$", line, text, flags=re.M) if re.search(r"^CORS_ORIGINS=", text, re.M) else text + "\n" + line + "\n"
open(path, "w").write(text)
PY
chown rmi:rmi "$BACKEND/.env"
chmod 600 "$BACKEND/.env"           # only the service user can read the key
if ! grep -qE '^GCP_API_KEY=.+' "$BACKEND/.env" && grep -qE '^AI_PROVIDER=vertex' "$BACKEND/.env"; then
  echo "   WARNING: AI_PROVIDER=vertex but GCP_API_KEY is empty. Analyses will fail until you add it."
fi

echo "==> systemd service"
sed "s#__APP_DIR__#$APP_DIR#g" "$BACKEND/deploy/rmi-backend.service" > /etc/systemd/system/rmi-backend.service
systemctl daemon-reload
systemctl enable --now rmi-backend
systemctl restart rmi-backend

echo "==> Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
sed "s#__DOMAIN__#$DOMAIN#g" "$BACKEND/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Check"
for i in $(seq 1 20); do curl -fs http://127.0.0.1:8000/health >/dev/null && break; sleep 1; done
curl -fs http://127.0.0.1:8000/health && echo "   backend OK (local)"
echo
echo "Done. In a minute: https://$DOMAIN/health"
echo "On Vercel set VITE_API_URL=https://$DOMAIN and redeploy the frontend."
echo "Logs: journalctl -u rmi-backend -f"
