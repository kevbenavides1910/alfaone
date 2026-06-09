#!/usr/bin/env bash
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

cp "$DEPLOY/costa-rica-time-fix.ts" "$ROOT/src/modules/syntra/utils/costa-rica-time.ts"
cp "$DEPLOY/patrol-inventory-phone-service.ts" "$ROOT/src/modules/syntra/services/patrol-inventory-phone-service.ts"
cp "$DEPLOY/patrol-route-phone-service.ts" "$ROOT/src/modules/syntra/services/patrol-route-phone-service.ts"
cp "$DEPLOY/patrol-device-sync-service.ts" "$ROOT/src/modules/syntra/services/patrol-device-sync-service.ts"
cp "$DEPLOY/patrol-route-schedule-service.ts" "$ROOT/src/modules/syntra/services/patrol-route-schedule-service.ts"
cp "$DEPLOY/patrol-routes-service.ts" "$ROOT/src/modules/syntra/services/patrol-routes-service.ts"
cp "$DEPLOY/patrol-marks-compliance-service.ts" "$ROOT/src/modules/syntra/services/patrol-marks-compliance-service.ts"

if ! grep -q '_deploy_syntra' "$ROOT/.dockerignore" 2>/dev/null; then
  echo "_deploy_syntra" >> "$ROOT/.dockerignore"
fi

cp "$DEPLOY/admin/patrol/routes-route.ts" "$ROOT/src/app/api/admin/patrol/routes/route.ts"
cp "$DEPLOY/admin/patrol/routes-id-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/routes/[id]/phones/[phoneId]"
cp "$DEPLOY/admin/patrol/routes-id-phones-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/phones/route.ts"
cp "$DEPLOY/admin/patrol/routes-id-phones-id-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/phones/[phoneId]/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/contracts/[contractId]/locations"
cp "$DEPLOY/admin/patrol/contract-locations-route.ts" "$ROOT/src/app/api/admin/patrol/contracts/[contractId]/locations/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/locations/[locationId]/positions"
cp "$DEPLOY/admin/patrol/location-positions-route.ts" "$ROOT/src/app/api/admin/patrol/locations/[locationId]/positions/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/contracts"
cp "$DEPLOY/admin/patrol/contracts-route.ts" "$ROOT/src/app/api/admin/patrol/contracts/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/routes/[id]/schedules"
cp "$DEPLOY/admin/patrol/routes-id-schedules-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/schedules/route.ts"

mkdir -p "$ROOT/src/components/ui"
cp "$DEPLOY/components/ui/searchable-select.tsx" "$ROOT/src/components/ui/searchable-select.tsx"

mkdir -p "$ROOT/src/app/(app)/recorridos/rutas/[id]"
cp "$DEPLOY/recorridos/rutas-id-page.tsx" "$ROOT/src/app/(app)/recorridos/rutas/[id]/page.tsx"

mkdir -p "$ROOT/src/app/api/admin/patrol/routes/[id]/points/[pointId]"
cp "$DEPLOY/admin/patrol/routes-id-points-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/points/route.ts"
cp "$DEPLOY/admin/patrol/routes-id-points-id-route.ts" "$ROOT/src/app/api/admin/patrol/routes/[id]/points/[pointId]/route.ts"

python3 "$DEPLOY/patch-route-location-schema.py" "$ROOT/prisma/schema.prisma" || true
python3 "$DEPLOY/patch-route-schedule-schema.py" "$ROOT/prisma/schema.prisma"

run_migration "20260524170000_patrol_route_phones"
run_migration "20260524180000_patrol_route_location_position"
run_migration "20260524190000_patrol_route_schedules"
run_migration "20260525200000_sync_point_nfc_code"

cd "$ROOT"
docker compose up -d --build
echo "Deploy route-schedules completado."
