#!/usr/bin/env bash
# Sincroniza histórico de nómina NAF (Oracle NAF5.ARPLHS) hacia PostgreSQL.
#
# Uso:
#   bash scripts/naf-nomina-sync.sh           # año actual
#   bash scripts/naf-nomina-sync.sh 2014      # backfill desde 2014
#
# En producción el cron usa la API interna con SYNTRA_CRON_SECRET.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DESDE_ANO="${1:-}"

if [ -f .env.production ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASE_URL="${NAF_SYNC_BASE_URL:-http://127.0.0.1:3000}"
SECRET="${SYNTRA_CRON_SECRET:-${NAF_SYNC_CRON_SECRET:-}}"
QUERY=""
if [ -n "$DESDE_ANO" ]; then
  QUERY="?desdeAno=${DESDE_ANO}"
fi

if [ -n "$SECRET" ]; then
  echo "[$(date -Iseconds)] NAF nómina sync vía API $BASE_URL/api/empleados-naf/nomina/sync${QUERY}"
  curl -fsS -X POST \
    -H "Authorization: Bearer $SECRET" \
    "$BASE_URL/api/empleados-naf/nomina/sync${QUERY}"
  echo
  exit 0
fi

echo "SYNTRA_CRON_SECRET / NAF_SYNC_CRON_SECRET no definido; intentando sync directo (solo desarrollo)..." >&2

if [[ "${DATABASE_URL:-}" == *"@postgres:5432"* ]]; then
  export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/security_contracts?schema=public"
fi

export NAF_ORACLE_USER="${NAF_ORACLE_USER:-ALFA_ONE}"
export NAF_ORACLE_PASSWORD="${NAF_ORACLE_PASSWORD:-}"
export NAF_ORACLE_CONNECT_STRING="${NAF_ORACLE_CONNECT_STRING:-10.1.1.6:1521/GRUPOALFA}"
export NAF_ORACLE_CLIENT_DIR="${NAF_ORACLE_CLIENT_DIR:-/opt/oracle/instantclient_19_23}"

if [ -z "${NAF_ORACLE_PASSWORD:-}" ]; then
  echo "NAF_ORACLE_PASSWORD no definido." >&2
  exit 1
fi

if [ ! -d "$NAF_ORACLE_CLIENT_DIR" ] && [ -d /tmp/oracle/instantclient_19_23 ]; then
  export NAF_ORACLE_CLIENT_DIR=/tmp/oracle/instantclient_19_23
fi

if [ ! -f "$NAF_ORACLE_CLIENT_DIR/libclntsh.so" ]; then
  echo "Oracle Instant Client no encontrado en $NAF_ORACLE_CLIENT_DIR" >&2
  exit 1
fi

export LD_LIBRARY_PATH="${NAF_ORACLE_CLIENT_DIR}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

ARGS=()
if [ -n "$DESDE_ANO" ]; then
  ARGS+=("$DESDE_ANO")
fi

exec npx ts-node --transpile-only -r tsconfig-paths/register --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/naf-nomina-sync.ts "${ARGS[@]}"
