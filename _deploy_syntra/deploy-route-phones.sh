#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/home/soporte-ti/presupuestos-alfa}"
DEPLOY="$(dirname "$0")"

cp "$DEPLOY/patrol-inventory-phone-service.ts" "$ROOT/src/modules/syntra/services/patrol-inventory-phone-service.ts"
cp "$DEPLOY/patrol-route-phone-service.ts" "$ROOT/src/modules/syntra/services/patrol-route-phone-service.ts"
cp "$DEPLOY/patrol-route-schedule-service.ts" "$ROOT/src/modules/syntra/services/patrol-route-schedule-service.ts"
cp "$DEPLOY/patrol-routes-service.ts" "$ROOT/src/modules/syntra/services/patrol-routes-service.ts"

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

mkdir -p "$ROOT/src/app/(app)/recorridos/rutas/[id]"
cp "$DEPLOY/recorridos/rutas-id-page.tsx" "$ROOT/src/app/(app)/recorridos/rutas/[id]/page.tsx"

python3 "$DEPLOY/patch-route-location-schema.py" "$ROOT/prisma/schema.prisma" || true
python3 "$DEPLOY/patch-route-schedule-schema.py" "$ROOT/prisma/schema.prisma"

cd "$ROOT"
docker compose exec -T postgres psql -U postgres -d security_contracts -f - < "$DEPLOY/migrations/20260524170000_patrol_route_phones/migration.sql" || true
docker compose exec -T postgres psql -U postgres -d security_contracts -f - < "$DEPLOY/migrations/20260524180000_patrol_route_location_position/migration.sql" || true
docker compose exec -T postgres psql -U postgres -d security_contracts -f - < "$DEPLOY/migrations/20260524190000_patrol_route_schedules/migration.sql" || true
docker compose up -d --build
echo "Deploy route-schedules completado."
