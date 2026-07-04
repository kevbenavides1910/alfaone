#!/usr/bin/env bash
# Respaldo completo Alfa One → Oracle 10.1.1.6
# - PostgreSQL (security_contracts + alfa_one)
# - Archivos de aplicación (APP_DATA_HOST: SIG, gastos, branding, facturación, etc.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

ORACLE_HOST="${BACKUP_ORACLE_HOST:-10.1.1.6}"
ORACLE_USER="${BACKUP_ORACLE_USER:-oracle}"
ORACLE_PATH="${BACKUP_ORACLE_PATH:-/backups/alfa-one}"
PG_CONTAINER="${DB_CONTAINER:-security_contracts_db}"
PG_USER="${POSTGRES_USER:-postgres}"
APP_DATA="${APP_DATA_HOST:-/mnt/data/projects/alfa-one/app}"
LOG_DIR="${BACKUP_ORACLE_LOG_DIR:-/var/log/alfa-one}"
POSTGRES_RETENTION_DAYS="${BACKUP_ORACLE_POSTGRES_RETENTION_DAYS:-30}"
LOCK_FILE="${BACKUP_ORACLE_LOCK:-/tmp/alfa-one-backup-to-oracle.lock}"

FECHA_RESP="$(date +%Y%m%d_%H%M)"
LOGFILE="${LOG_DIR}/backup-to-oracle_${FECHA_RESP}.log"

RSYNC_OPTS=(-av --partial --timeout=600)
SSH_CMD="ssh -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=20"

mkdir -p "$LOG_DIR" "$(dirname "$LOCK_FILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) SKIP: respaldo a Oracle ya en curso" >> "${LOG_DIR}/backup-to-oracle.skip.log"
  exit 0
fi

{
  echo "**********"
  echo "* Inicio: $(date -Is)"
  echo "* Host: $(hostname) → ${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_PATH}"
  echo "**********"

  if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    echo "ERROR: contenedor $PG_CONTAINER no está en ejecución"
    exit 1
  fi

  ${SSH_CMD} "${ORACLE_USER}@${ORACLE_HOST}" \
    "mkdir -p '${ORACLE_PATH}/postgres' '${ORACLE_PATH}/app' '${ORACLE_PATH}/odoo'"

  ODOO_BACKUP_SCRIPT="${ODOO_BACKUP_SCRIPT:-/mnt/data/projects/odoo18-alfa/scripts/odoo-backup.sh}"
  if [ -x "$ODOO_BACKUP_SCRIPT" ] && docker ps --format '{{.Names}}' | grep -qx "${ODOO_DB_CONTAINER:-odoo18_db}"; then
    echo "==>> Odoo 18 (BD + filestore + config) =="
    ODOO_TMP="/tmp/odoo-backup-${FECHA_RESP}"
    mkdir -p "$ODOO_TMP"
    BACKUP_DIR="$ODOO_TMP" INCLUDE_EXTRA_ADDONS=0 bash "$ODOO_BACKUP_SCRIPT" "$FECHA_RESP"
    rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" \
      "$ODOO_TMP/" "${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_PATH}/odoo/"
    if [ -d /mnt/data/projects/odoo18-alfa/extra-addons ]; then
      echo "==>> Odoo extra-addons =="
      rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" \
        /mnt/data/projects/odoo18-alfa/extra-addons/ \
        "${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_PATH}/odoo/extra-addons/"
    fi
    rm -rf "$ODOO_TMP"
    echo "OK odoo"
  else
    echo "WARN: Odoo omitido (script ausente o contenedor odoo18_db inactivo)"
  fi

  echo "==>> Configuración (configs, Docker, n8n, crontabs) =="
  CONFIG_TAR="$("$ROOT/scripts/backup-config-bundle.sh" "$FECHA_RESP")"
  rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" \
    "$CONFIG_TAR" "${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_PATH}/postgres/"
  rm -f "$CONFIG_TAR"
  echo "OK config bundle"

  echo "==>> PostgreSQL security_contracts =="
  docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d security_contracts -Fc -Z 9 \
    > "/tmp/security_contracts_${FECHA_RESP}.dump"
  rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" \
    "/tmp/security_contracts_${FECHA_RESP}.dump" \
    "${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_PATH}/postgres/"
  rm -f "/tmp/security_contracts_${FECHA_RESP}.dump"
  echo "OK security_contracts"

  if docker exec "$PG_CONTAINER" psql -U "$PG_USER" -lqt | cut -d \| -f 1 | grep -qw alfa_one; then
    echo "==>> PostgreSQL alfa_one =="
    docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d alfa_one -Fc -Z 9 \
      > "/tmp/alfa_one_${FECHA_RESP}.dump"
    rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" \
      "/tmp/alfa_one_${FECHA_RESP}.dump" \
      "${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_PATH}/postgres/"
    rm -f "/tmp/alfa_one_${FECHA_RESP}.dump"
    echo "OK alfa_one"
  fi

  if [ ! -d "$APP_DATA" ]; then
    echo "ERROR: APP_DATA_HOST no existe: $APP_DATA"
    exit 1
  fi

  echo "==>> Archivos de aplicación ($APP_DATA) =="
  rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" --delete \
    "${APP_DATA}/" "${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_PATH}/app/"
  echo "OK app files"

  echo "==>> Retención dumps PostgreSQL en Oracle (>${POSTGRES_RETENTION_DAYS}d) =="
  ${SSH_CMD} "${ORACLE_USER}@${ORACLE_HOST}" bash -s <<EOF
set -euo pipefail
find '${ORACLE_PATH}/postgres' -name '*.dump' -mtime +${POSTGRES_RETENTION_DAYS} -print -delete 2>/dev/null || true
find '${ORACLE_PATH}/postgres' -name 'config_*.tar.gz' -mtime +${POSTGRES_RETENTION_DAYS} -print -delete 2>/dev/null || true
find '${ORACLE_PATH}/odoo' -name '*.dump' -mtime +${POSTGRES_RETENTION_DAYS} -print -delete 2>/dev/null || true
find '${ORACLE_PATH}/odoo' -name 'filestore_*.tar.gz' -mtime +${POSTGRES_RETENTION_DAYS} -print -delete 2>/dev/null || true
find '${ORACLE_PATH}/odoo' -name 'odoo_config_*.tar.gz' -mtime +${POSTGRES_RETENTION_DAYS} -print -delete 2>/dev/null || true
echo "OK retención postgres/odoo"
EOF

  echo "==>> Resumen en Oracle =="
  ${SSH_CMD} "${ORACLE_USER}@${ORACLE_HOST}" \
    "du -sh '${ORACLE_PATH}/postgres' '${ORACLE_PATH}/app' '${ORACLE_PATH}/odoo' 2>/dev/null; \
     ls -1 '${ORACLE_PATH}/postgres'/*.dump 2>/dev/null | wc -l | xargs echo 'dumps alfa:'; \
     ls -1 '${ORACLE_PATH}/odoo'/*.dump 2>/dev/null | wc -l | xargs echo 'dumps odoo:'; \
     ls -lht '${ORACLE_PATH}/postgres'/config_*.tar.gz 2>/dev/null | head -1; \
     ls -lht '${ORACLE_PATH}/odoo'/*.dump 2>/dev/null | head -1"

  echo "**********"
  echo "* Final: $(date -Is)"
  echo "**********"
} >> "$LOGFILE" 2>&1

find "$LOG_DIR" -name 'backup-to-oracle_*.log' -mtime +60 -delete 2>/dev/null || true

echo "OK log=$LOGFILE"
