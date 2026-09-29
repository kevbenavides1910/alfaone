#!/usr/bin/env bash
# SICOP → Alfa One: sincroniza oportunidades de licitación (seguridad/vigilancia).
# Cron lun–vie 9:40 CR (15:40 UTC):
#   40 15 * * 1-5 soporte-ti BASE_URL=http://127.0.0.1:3000 LOG_DIR=/var/log/alfa-one /mnt/data/projects/alfa-one/code/presupuestos-alfa/scripts/cron-sicop-oportunidades.sh >> /var/log/alfa-one/cron-sicop-oportunidades.log 2>&1

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
LOG_DIR="${LOG_DIR:-/var/log/alfa-one}"
SICOP_DIR="$ROOT/scripts/sicop"

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

# Mantener scripts n8n alineados con el repo.
bash "$SICOP_DIR/install-on-host.sh" >/dev/null 2>&1 || true

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
export BASE_URL LOG_DIR SYNTRA_CRON_SECRET
export ALFA_ONE_SECRET="$SYNTRA_CRON_SECRET"

if ! summary="$(
  bash "$SICOP_DIR/run-sync.sh" 2>"$LOG_DIR/sicop-sync.stderr" | python3 -c "
import json, sys
raw = sys.stdin.read().strip()
if not raw:
    raise SystemExit(1)
data = json.loads(raw)
ao = data.get('alfa_one') or {}
print(
    'found=%s sent=%s created=%s updated=%s skipped=%s error=%s'
    % (
        data.get('total_found', '?'),
        ao.get('sent', '?'),
        ao.get('created', '?'),
        ao.get('updated', '?'),
        ao.get('skipped', '?'),
        ao.get('error') or 'none',
    )
)
" 2>/dev/null
)"; then
  tail="$(tail -c 400 "$LOG_DIR/sicop-sync.stderr" 2>/dev/null || true)"
  echo "$timestamp FAIL sync_error tail=${tail}"
  exit 1
fi

echo "$timestamp OK $summary"
