#!/usr/bin/env bash
# Rota contraseña de PostgreSQL si sigue siendo la por defecto (postgres).
# Uso: bash scripts/rotate-postgres-password.sh
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
DB_CONTAINER="${DB_CONTAINER:-security_contracts_db}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-security_contracts}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi

current="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'" || true)"
if [ -z "$current" ]; then
  echo "ERROR: POSTGRES_PASSWORD no definido en $ENV_FILE" >&2
  exit 1
fi

if [ "$current" != "postgres" ]; then
  echo "POSTGRES_PASSWORD ya no es la por defecto; no se rota automáticamente."
  exit 0
fi

new_pass="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
echo "Rotando contraseña de PostgreSQL..."

docker exec "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '$new_pass';"

tmp="$(mktemp)"
awk -v pwd="$new_pass" -v user="$POSTGRES_USER" -v db="$POSTGRES_DB" '
/^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pwd; next }
/^DATABASE_URL=/ {
  print "DATABASE_URL=\"postgresql://" user ":" pwd "@postgres:5432/" db "?schema=public\""
  next
}
{ print }
' "$ENV_FILE" > "$tmp"
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Docker Compose interpola ${DATABASE_URL} desde .env del host; mantener sincronizado
host_env="$PROJECT_DIR/.env"
if [ -f "$host_env" ]; then
  tmp2="$(mktemp)"
  awk -v pwd="$new_pass" -v user="$POSTGRES_USER" -v db="$POSTGRES_DB" '
/^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pwd; next }
/^DATABASE_URL=/ {
  print "DATABASE_URL=postgresql://" user ":" pwd "@postgres:5432/" db "?schema=public"
  next
}
{ print }
' "$host_env" > "$tmp2"
  mv "$tmp2" "$host_env"
  chmod 600 "$host_env"
fi

cd "$PROJECT_DIR"
docker compose -f docker-compose.prod.yml up -d --force-recreate app

echo "OK: contraseña rotada y app reiniciada. Guarde el valor en su gestor de secretos."
