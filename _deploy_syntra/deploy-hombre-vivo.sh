#!/usr/bin/env bash
# Despliega sistema de hombre vivo (servidor 10.1.1.229 + UI de ruta + historial)
set -euo pipefail
ROOT="${1:-/home/soporte-ti/presupuestos-alfa}"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"

run_migration() {
  local migration_file="$DEPLOY/migrations/$1/migration.sql"
  if [[ ! -f "$migration_file" ]]; then
    echo "WARN: migracion no encontrada: $migration_file" >&2
    return 0
  fi
  echo "Aplicando migracion: $1"
  docker compose -f "$ROOT/docker-compose.yml" exec -T postgres psql -U postgres -d security_contracts -f - < "$migration_file" || true
}

cp "$DEPLOY/patrol-welfare-service.ts" "$ROOT/src/modules/syntra/services/patrol-welfare-service.ts"
cp "$DEPLOY/patrol-routes-service.ts" "$ROOT/src/modules/syntra/services/patrol-routes-service.ts"
cp "$DEPLOY/admin/patrol/routes-id-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/routes/[id]/welfare"
cp "$DEPLOY/admin/patrol/routes-id-welfare-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/welfare/route.ts"

mkdir -p "$ROOT/src/app/api/syntra/reports/welfare-ack"
cp "$DEPLOY/reports/welfare-ack/route.ts" "$ROOT/src/app/api/syntra/reports/welfare-ack/route.ts"

mkdir -p "$ROOT/src/app/(app)/recorridos/rutas/[id]"
cp "$DEPLOY/recorridos/rutas-id-page.tsx" "$ROOT/src/app/(app)/recorridos/rutas/[id]/page.tsx"

mkdir -p "$ROOT/src/app/api/admin/patrol/reports/welfare-history"
cp "$DEPLOY/admin/patrol/reports/welfare-history/route.ts" \
  "$ROOT/src/app/api/admin/patrol/reports/welfare-history/route.ts"

mkdir -p "$ROOT/src/app/(app)/recorridos/hombre-vivo"
cp "$DEPLOY/recorridos/hombre-vivo/page.tsx" "$ROOT/src/app/(app)/recorridos/hombre-vivo/page.tsx"

cp "$DEPLOY/components/recorridos/RecorridosShell.tsx" "$ROOT/src/components/recorridos/RecorridosShell.tsx"

python3 "$DEPLOY/patch-route-welfare-schema.py" "$ROOT/prisma/schema.prisma"

run_migration "20260609120000_patrol_welfare"

cd "$ROOT"
docker compose up -d --build
echo "Despliegue hombre vivo completado."

if [[ "$DEPLOY" == "$ROOT/_syntra_deploy" || "$DEPLOY" == "$ROOT/_syntra_deploy/"* ]]; then
  rm -rf "$ROOT/_syntra_deploy"
fi
