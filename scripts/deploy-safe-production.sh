#!/usr/bin/env bash
# Despliegue seguro en producción (VPS 10.1.1.229) — sin borrar datos.
# Uso (en el servidor, dentro del repo):
#   cd /mnt/data/projects/presupuestos-alfa/code/presupuestos-alfa
#   bash scripts/deploy-safe-production.sh
#
# Garantías:
# - Respaldo pg_dump antes de tocar la app
# - NO usa migrate reset, db push --force-reset, TRUNCATE ni DROP
# - NO recrea el volumen de Postgres (solo rebuild del contenedor app)
# - Compara conteos de tablas críticas antes/después
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_CONTAINER="${DB_CONTAINER:-alfa_one_db}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-security_contracts}"
BACKUP_DIR="${BACKUP_DIR:-/mnt/data/backups/postgres}"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Falta comando: $1"
}

require_cmd docker
require_cmd git
require_cmd gzip

if [ ! -f "$COMPOSE_FILE" ]; then
  fail "No se encontró $COMPOSE_FILE en $ROOT"
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  fail "Contenedor Postgres '$DB_CONTAINER' no está en ejecución. No se despliega sin BD activa."
fi

COUNT_SQL="
SELECT 'users' AS t, COUNT(*)::text FROM \"User\"
UNION ALL SELECT 'contracts', COUNT(*)::text FROM \"Contract\"
UNION ALL SELECT 'employees', COUNT(*)::text FROM \"Employee\"
UNION ALL SELECT 'expenses', COUNT(*)::text FROM \"Expense\";
"

snapshot_counts() {
  docker exec "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$COUNT_SQL" 2>/dev/null \
    | sort
}

log "Conteos antes del despliegue:"
BEFORE="$(snapshot_counts)"
printf '%s\n' "$BEFORE"

log "Respaldo PostgreSQL (pg_dump)…"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
backup_file="$BACKUP_DIR/${POSTGRES_DB}_pre_deploy_${stamp}.sql.gz"
docker exec "$DB_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip -9 > "$backup_file"
log "Respaldo OK: $backup_file ($(du -h "$backup_file" | awk '{print $1}'))"

log "Actualizando código (git pull --ff-only)…"
git fetch origin main
git pull --ff-only origin main

log "Rebuild y reinicio de app + nginx (Postgres sin tocar)…"
docker compose -f "$COMPOSE_FILE" up -d --build app nginx

log "Esperando healthcheck de la app…"
deadline=$((SECONDS + 180))
while [ "$SECONDS" -lt "$deadline" ]; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' alfa_one_app 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 5
done
if [ "${status:-}" != "healthy" ]; then
  fail "La app no pasó healthcheck (estado: ${status:-desconocido}). Revise: docker logs alfa_one_app --tail 80"
fi

log "Verificando /login…"
http_code="$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "$APP_URL/login" || echo 000)"
if [ "$http_code" != "200" ]; then
  fail "/login respondió HTTP $http_code"
fi

log "Conteos después del despliegue:"
AFTER="$(snapshot_counts)"
printf '%s\n' "$AFTER"

if [ "$BEFORE" != "$AFTER" ]; then
  log "ADVERTENCIA: cambiaron conteos de tablas (revisar manualmente):"
  diff <(printf '%s\n' "$BEFORE") <(printf '%s\n' "$AFTER") || true
  fail "Los conteos no coinciden. El despliegue terminó pero conviene revisar la BD."
fi

log "Despliegue completado sin pérdida de datos detectada."
log "Commit desplegado: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
