#!/usr/bin/env bash
# Finger System: sync automática (dispositivos + marcas ATT2016).
# Programar cada 5 min; el intervalo real lo controla syncIntervalMinutes en app_finger_settings.
#   */5 * * * * /mnt/data/projects/alfa-one/code/presupuestos-alfa/scripts/cron-finger-sync.sh >> /var/log/alfa-one/finger-sync.log 2>&1

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MAX_TIME="${MAX_TIME:-300}"
LOG_DIR="${LOG_DIR:-/var/log/alfa-one}"

mkdir -p "$LOG_DIR"

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
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") FAIL missing SYNTRA_CRON_SECRET"
  exit 1
fi

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
response="$(curl -sS -X POST \
  --max-time "$MAX_TIME" \
  -H "Authorization: Bearer ${SYNTRA_CRON_SECRET}" \
  "${BASE_URL}/api/cron/finger-sync" 2>&1)" || {
  echo "$timestamp FAIL curl_exit=$? details=$response"
  exit 1
}

echo "$timestamp OK $response"
