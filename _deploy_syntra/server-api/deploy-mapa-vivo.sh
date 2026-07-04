#!/usr/bin/env bash
# Despliega pantalla Mapa en vivo + API tracking + historial GPS en presupuestos-alfa (servidor)
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

cp "$DEPLOY/patrol-live-tracking-service.ts" "$ROOT/src/modules/syntra/services/patrol-live-tracking-service.ts"
cp "$DEPLOY/patrol-reports-service.ts" "$ROOT/src/modules/syntra/services/patrol-reports-service.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/tracking/live"
cp "$DEPLOY/admin/patrol/tracking/live/route.ts" "$ROOT/src/app/api/admin/patrol/tracking/live/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/tracking/history"
cp "$DEPLOY/admin/patrol/tracking/history/route.ts" "$ROOT/src/app/api/admin/patrol/tracking/history/route.ts"

mkdir -p "$ROOT/src/components/recorridos"
cp "$DEPLOY/components/recorridos/PatrolLiveMap.tsx" "$ROOT/src/components/recorridos/PatrolLiveMap.tsx"
cp "$DEPLOY/components/recorridos/RecorridosShell.tsx" "$ROOT/src/components/recorridos/RecorridosShell.tsx"

mkdir -p "$ROOT/src/app/(app)/recorridos/mapa"
cp "$DEPLOY/recorridos/mapa/page.tsx" "$ROOT/src/app/(app)/recorridos/mapa/page.tsx"
cp "$DEPLOY/next.config.ts" "$ROOT/next.config.ts"

run_migration "20260524150000_patrol_gps_history_index"

cd "$ROOT"
if ! grep -q '"leaflet"' package.json; then
  npm install leaflet react-leaflet@4.2.1 --save
  npm install -D @types/leaflet
fi

docker compose up -d --build
echo "Despliegue mapa en vivo completado."
