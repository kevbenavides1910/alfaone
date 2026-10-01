#!/usr/bin/env bash
# Recordatorios de documentos legales (vencimientos del responsable).
# Crontab (todos los días, 8:20 AM Costa Rica = 14:20 UTC):
#   20 14 * * * /mnt/data/projects/alfa-one/code/presupuestos-alfa/scripts/cron-documentos-legales-recordatorios.sh >> /var/log/alfa-one/documentos-legales-recordatorios.log 2>&1
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
CRON_SECRET="${CRON_SECRET:-${ALFAONE_CRON_SECRET:-${SYNTRA_CRON_SECRET:-}}}"

if [[ -z "$CRON_SECRET" && -f /mnt/data/projects/alfa-one/code/presupuestos-alfa/.env.production ]]; then
  # shellcheck disable=SC1091
  set -a
  source /mnt/data/projects/alfa-one/code/presupuestos-alfa/.env.production 2>/dev/null || true
  set +a
  CRON_SECRET="${CRON_SECRET:-${ALFAONE_CRON_SECRET:-${SYNTRA_CRON_SECRET:-}}}"
fi

HDR=(-H "Content-Type: application/json")
if [[ -n "${CRON_SECRET:-}" ]]; then
  HDR+=(-H "Authorization: Bearer ${CRON_SECRET}")
  HDR+=(-H "x-cron-secret: ${CRON_SECRET}")
fi

echo "$(date -Is) POST ${BASE_URL}/api/cron/documentos-legales-recordatorios"
curl -fsS -X POST "${HDR[@]}" \
  "${BASE_URL}/api/cron/documentos-legales-recordatorios"
echo
