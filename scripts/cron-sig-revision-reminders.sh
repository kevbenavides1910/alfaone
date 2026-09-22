#!/usr/bin/env bash
# Recordatorios de vigencia SIG (documentos por revisar / vencidos).
# Ejemplo crontab (8:15 AM):
#   15 8 * * 1-5 /mnt/data/projects/alfa-one/code/presupuestos-alfa/scripts/cron-sig-revision-reminders.sh >> /var/log/alfa-one/sig-revision-reminders.log 2>&1
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
CRON_SECRET="${CRON_SECRET:-${ALFAONE_CRON_SECRET:-}}"
WITHIN_DAYS="${WITHIN_DAYS:-30}"

if [[ -z "$CRON_SECRET" && -f /mnt/data/projects/alfa-one/code/presupuestos-alfa/.env.production ]]; then
  # shellcheck disable=SC1091
  set -a
  source /mnt/data/projects/alfa-one/code/presupuestos-alfa/.env.production 2>/dev/null || true
  set +a
  CRON_SECRET="${CRON_SECRET:-${ALFAONE_CRON_SECRET:-}}"
fi

HDR=(-H "Content-Type: application/json")
if [[ -n "${CRON_SECRET:-}" ]]; then
  HDR+=(-H "Authorization: Bearer ${CRON_SECRET}")
  HDR+=(-H "x-cron-secret: ${CRON_SECRET}")
fi

echo "$(date -Is) POST ${BASE_URL}/api/cron/sig-revision-reminders?withinDays=${WITHIN_DAYS}"
curl -fsS -X POST "${HDR[@]}" \
  "${BASE_URL}/api/cron/sig-revision-reminders?withinDays=${WITHIN_DAYS}"
echo
