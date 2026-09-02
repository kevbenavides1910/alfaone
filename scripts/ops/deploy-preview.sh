#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/ops/acquire-deploy-lock.sh"
START_EPOCH="$(date +%s)"
COMPOSE=(docker compose -f "${COMPOSE_FILE:-docker-compose.prod.yml}")
DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
SHA="$(git rev-parse HEAD)"
export APP_IMAGE="${APP_IMAGE:-${DEFAULT_IMAGE_REPO}:${SHA}}"
export COMPOSE_PROJECT_NAME=presupuestos-alfa COMPOSE_PROFILES=preview
APP_PREVIEW_URL="${APP_PREVIEW_URL:-http://127.0.0.1:3001}"
section(){ echo ""; echo "== $1 =="; }
elapsed(){ echo "$(( $(date +%s) - START_EPOCH ))s"; }
section "Deploy preview"; echo "deploy_path=preview"; echo "APP_IMAGE=$APP_IMAGE"
[ -f "$ROOT/.env.production" ] || { echo "ERROR: falta .env.production" >&2; exit 1; }
set -a; # shellcheck disable=SC1091
source "$ROOT/.env.production"; set +a; export APP_IMAGE
if ! docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  DEPLOY_GHCR_PUSH=0 bash "$ROOT/scripts/ops/build-ghcr-image-local.sh"
fi
APP_DATA_HOST_EFF="${APP_DATA_HOST:-/mnt/storage/apps/presupuestos-alfa}"
OVERRIDE_FILE="$APP_DATA_HOST_EFF/static-overrides/alfa-overrides.css"
mkdir -p "$(dirname "$OVERRIDE_FILE")" 2>/dev/null || true
[ -f "$OVERRIDE_FILE" ] || cp "$ROOT/public/alfa-overrides.css" "$OVERRIDE_FILE" 2>/dev/null || echo "/* empty */" >"$OVERRIDE_FILE" 2>/dev/null || true
section "Recreate app-preview"
"${COMPOSE[@]}" up -d --no-build --pull never app-preview
section "Esperando health preview"
for _ in $(seq 1 30); do
  status="$(docker inspect security_contracts_app_preview --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' 2>/dev/null || echo missing)"
  echo "health:$status"
  case "$status" in healthy|no-healthcheck) break ;; unhealthy) exit 1 ;; esac
  sleep 2
done
code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$APP_PREVIEW_URL/login" || echo 000)"
echo "login:$code"
case "$code" in 2*|3*) ;; *) echo "ERROR: preview /login → $code" >&2; exit 1 ;; esac
section "PREVIEW OK"
echo "url=$APP_PREVIEW_URL"; echo "image=$APP_IMAGE"; echo "deploy_path=preview"
echo "elapsed_build=0"; echo "elapsed_recreate=$(elapsed)"; echo "cache_hit=1"; echo "elapsed=$(elapsed)"
