#!/usr/bin/env bash
# Avisos del calendario operativo: correo del día y recordatorio diario
# hasta que la tarea se marque como realizada.
# Crontab (todos los días, 7:10 AM Costa Rica = 13:10 UTC):
#   10 13 * * * /mnt/data/projects/alfa-one/code/presupuestos-alfa/scripts/cron-calendario-operativo-avisos.sh >> /var/log/alfa-one/calendario-operativo-avisos.log 2>&1
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

echo "$(date -Is) POST ${BASE_URL}/api/cron/calendario-operativo-avisos"
curl -fsS -X POST "${HDR[@]}" \
  "${BASE_URL}/api/cron/calendario-operativo-avisos"
echo
