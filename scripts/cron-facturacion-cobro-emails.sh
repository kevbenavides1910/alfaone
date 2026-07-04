#!/usr/bin/env bash
# Envío automático de correos de facturación/cobro (recordatorio por vencer + cobro vencido).
# Programar en crontab del VPS a las 8:00 AM (hora local del servidor):
#   0 8 * * * /root/Presupuestos-Alfa/scripts/cron-facturacion-cobro-emails.sh >> /var/log/presupuestos-alfa/cobro-emails.log 2>&1

set -u

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MAX_TIME="${MAX_TIME:-120}"
LOG_DIR="${LOG_DIR:-/var/log/presupuestos-alfa}"

mkdir -p "$LOG_DIR"

if [ -z "${SYNTRA_CRON_SECRET:-}" ]; then
  if [ -f .env.production ]; then
    # shellcheck disable=SC1091
    set -a
    # shellcheck disable=SC1091
    source .env.production
    set +a
  elif [ -f .env ]; then
    # shellcheck disable=SC1091
    set -a
    # shellcheck disable=SC1091
    source .env
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
  "${BASE_URL}/api/cron/facturacion-cobro-emails" 2>&1)" || {
  echo "$timestamp FAIL curl_exit=$? details=$response"
  exit 1
}

echo "$timestamp OK $response"
