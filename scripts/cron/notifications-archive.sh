#!/usr/bin/env bash
# Archiva notificaciones visibles > 3 días (historial permanente).
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MAX_TIME="${MAX_TIME:-120}"

if [ -z "${SYNTRA_CRON_SECRET:-}" ]; then
  if [ -f "$ROOT/.env.production" ]; then
    # shellcheck disable=SC1091
    set -a
    source "$ROOT/.env.production"
    set +a
  elif [ -f "$ROOT/.env" ]; then
    # shellcheck disable=SC1091
    set -a
    source "$ROOT/.env"
    set +a
  fi
fi

if [ -z "${SYNTRA_CRON_SECRET:-}" ]; then
  echo "SYNTRA_CRON_SECRET no configurado" >&2
  exit 1
fi

curl -fsS --max-time "$MAX_TIME" -X POST \
  -H "Authorization: Bearer ${SYNTRA_CRON_SECRET}" \
  "${BASE_URL}/api/cron/notifications/archive"
