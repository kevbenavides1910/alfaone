#!/usr/bin/env bash
# Comprueba que los datos de PostgreSQL existen ANTES de cualquier deploy o migración.
# No modifica la base de datos.
set -euo pipefail

POSTGRES_VOLUME="${POSTGRES_VOLUME:-presupuestos-alfa_postgres_data}"
DB_CONTAINER="${DB_CONTAINER:-security_contracts_db}"
PROD_DATABASE="${PROD_DATABASE:-security_contracts}"

echo "== Preflight: protección de base de datos =="

if ! docker volume inspect "$POSTGRES_VOLUME" >/dev/null 2>&1; then
  echo "ERROR: no existe el volumen Docker $POSTGRES_VOLUME" >&2
  echo "No continúe hasta ubicar los datos reales. NUNCA cree un volumen vacío." >&2
  exit 1
fi

POSTGRES_DATA_DIR="$(docker volume inspect "$POSTGRES_VOLUME" --format '{{.Mountpoint}}')"
echo "OK: volumen PostgreSQL: $POSTGRES_VOLUME ($POSTGRES_DATA_DIR)"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB_CONTAINER"; then
  if docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    echo "OK: contenedor $DB_CONTAINER responde pg_isready"
    rows="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$PROD_DATABASE" -tAc "SELECT count(*) FROM users;" 2>/dev/null || echo 0)"
    echo "OK: base de producción $PROD_DATABASE — usuarios=$rows"
    if [ "${rows:-0}" -lt 1 ]; then
      echo "ERROR: $PROD_DATABASE no tiene usuarios. No desplegar hasta confirmar la BD correcta." >&2
      exit 1
    fi
  else
    echo "AVISO: $DB_CONTAINER existe pero pg_isready falló (puede estar iniciando)." >&2
  fi
else
  echo "AVISO: $DB_CONTAINER no está en ejecución (normal antes del primer up)." >&2
fi

echo ""
echo "Reglas de seguridad:"
echo "  - NO usar: docker compose down -v"
echo "  - NO usar: docker volume rm"
echo "  - NO usar: npm run db:reset / prisma migrate reset"
echo "  - NO cambiar POSTGRES_DATA_DIR ni el volumen en docker-compose.prod.yml"
echo ""
