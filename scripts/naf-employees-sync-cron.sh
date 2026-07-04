#!/usr/bin/env bash
# Cron horario: sincroniza empleados NAF vía API interna (sin Oracle client en el contenedor).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${NAF_SYNC_ENV:-$ROOT/.env.production}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi

BASE_URL="${NAF_SYNC_BASE_URL:-http://127.0.0.1:3000}"
SECRET="${SYNTRA_CRON_SECRET:-${NAF_SYNC_CRON_SECRET:-}}"

if [ -z "$SECRET" ]; then
  echo "SYNTRA_CRON_SECRET o NAF_SYNC_CRON_SECRET no definido; use scripts/naf-employees-sync.sh con Oracle client." >&2
  exit 1
fi

curl -fsS -X POST \
  -H "Authorization: Bearer $SECRET" \
  "$BASE_URL/api/empleados-naf/sync"
