#!/usr/bin/env bash
# Respaldo diario de PostgreSQL → /mnt/data/backups/postgres
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/mnt/data/backups/postgres}"
DB_CONTAINER="${DB_CONTAINER:-security_contracts_db}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-security_contracts}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
outfile="$BACKUP_DIR/${POSTGRES_DB}_${stamp}.sql.gz"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "ERROR: contenedor $DB_CONTAINER no está en ejecución" >&2
  exit 1
fi

docker exec "$DB_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip -9 > "$outfile"

find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

echo "OK backup=$outfile size=$(du -h "$outfile" | awk '{print $1}')"

# Copia opcional a otro servidor (ver config/backup-remote.env.example)
if [ -f "${BACKUP_REMOTE_ENV:-/etc/alfa-one/backup-remote.env}" ]; then
  "$(dirname "$0")/postgres-backup-remote-sync.sh" || {
    echo "WARN: falló sincronización remota (respaldo local OK en $outfile)" >&2
    exit 0
  }
fi
