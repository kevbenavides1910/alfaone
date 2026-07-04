#!/usr/bin/env bash
# Restaura security_contracts desde un respaldo .sql.gz SIN tocar el volumen Docker.
# Uso: bash scripts/restore-db-from-backup.sh /mnt/data/backups/postgres/security_contracts_20260608T021501Z.sql.gz
set -euo pipefail

BACKUP_FILE="${1:?Indique el archivo .sql.gz}"
DB_CONTAINER="${DB_CONTAINER:-alfa_one_db}"
DB_NAME="${DB_NAME:-security_contracts}"
STAGING_DB="${STAGING_DB:-security_contracts_restore}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SAFETY_BACKUP="/mnt/data/backups/postgres/${DB_NAME}_before_restore_${TIMESTAMP}.sql.gz"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: no existe $BACKUP_FILE" >&2
  exit 1
fi

echo "== 1) Respaldo de seguridad del estado ACTUAL =="
docker exec "$DB_CONTAINER" pg_dump -U postgres -d "$DB_NAME" --no-owner --no-acl | gzip -9 > "$SAFETY_BACKUP"
echo "OK: $SAFETY_BACKUP ($(du -h "$SAFETY_BACKUP" | awk '{print $1}'))"

echo "== 2) Detener app (postgres sigue corriendo) =="
docker stop alfa_one_app 2>/dev/null || true

echo "== 3) Restaurar en BD staging: $STAGING_DB =="
docker exec "$DB_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS \"$STAGING_DB\";" 
docker exec "$DB_CONTAINER" psql -U postgres -c "CREATE DATABASE \"$STAGING_DB\";"
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U postgres -d "$STAGING_DB" -q

users="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$STAGING_DB" -tAc 'SELECT count(*) FROM users;' 2>/dev/null || echo 0)"
contracts="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$STAGING_DB" -tAc 'SELECT count(*) FROM contracts;' 2>/dev/null || echo 0)"
fact_perm="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$STAGING_DB" -tAc "SELECT count(*) FROM role_permissions WHERE \"permissionKey\" LIKE 'facturacion%';" 2>/dev/null || echo 0)"

echo "Verificación staging: usuarios=$users contratos=$contracts permisos_facturacion=$fact_perm"

if [ "${users:-0}" -lt 10 ]; then
  echo "ERROR: el respaldo no tiene suficientes usuarios. Abortando." >&2
  docker start alfa_one_app 2>/dev/null || true
  exit 1
fi

echo "== 4) Activar BD restaurada =="
docker exec "$DB_CONTAINER" psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$DB_NAME', '${DB_NAME}_old_jun9') AND pid <> pg_backend_pid();" || true
docker exec "$DB_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}_old_jun9\";"
docker exec "$DB_CONTAINER" psql -U postgres -c "ALTER DATABASE \"$DB_NAME\" RENAME TO \"${DB_NAME}_old_jun9\";"
docker exec "$DB_CONTAINER" psql -U postgres -c "ALTER DATABASE \"$STAGING_DB\" RENAME TO \"$DB_NAME\";"

echo "== 5) Reiniciar app =="
docker start alfa_one_app
sleep 15

final_users="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -tAc 'SELECT count(*) FROM users;')"
echo ""
echo "Listo. Usuarios en producción: $final_users"
echo "BD anterior conservada como: ${DB_NAME}_old_jun9"
echo "Respaldo pre-restore: $SAFETY_BACKUP"
