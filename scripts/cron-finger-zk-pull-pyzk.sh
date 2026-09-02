#!/usr/bin/env bash
# Trae marcas ZK → Odoo (pyzk). Programar cada 5–15 min en el host.
# */10 * * * * /mnt/data/projects/alfa-one/code/presupuestos-alfa/scripts/cron-finger-zk-pull-pyzk.sh >> /var/log/alfa-one/finger-zk-pull.log 2>&1
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${LOG_DIR:-/var/log/alfa-one}"
mkdir -p "$LOG_DIR"
ODOO_URL="$(docker exec security_contracts_app printenv ODOO_BIOMETRIC_DATABASE_URL 2>/dev/null || true)"
if [ -z "$ODOO_URL" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) FAIL missing ODOO_BIOMETRIC_DATABASE_URL"
  exit 1
fi
SCRIPT="$ROOT/scripts/finger-zk-pull-odoo.py"
if [ ! -f "$SCRIPT" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) FAIL missing $SCRIPT"
  exit 1
fi
docker run --rm --network presupuestos-alfa_default \
  -e ODOO_BIOMETRIC_DATABASE_URL="$ODOO_URL" \
  -v "$SCRIPT:/tmp/t.py:ro" \
  --entrypoint bash odoo18-alfa:18.0 -lc \
  'python3 -c "import psycopg2" 2>/dev/null || pip install -q psycopg2-binary; python3 /tmp/t.py'
