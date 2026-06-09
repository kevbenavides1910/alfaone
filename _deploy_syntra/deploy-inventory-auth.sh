#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/home/soporte-ti/presupuestos-alfa}"
DEPLOY="$(dirname "$0")"

cp "$DEPLOY/patrol-inventory-phone-service.ts" "$ROOT/src/modules/syntra/services/patrol-inventory-phone-service.ts"
cp "$DEPLOY/patrol-device-sync-service.ts" "$ROOT/src/modules/syntra/services/patrol-device-sync-service.ts"
cp "$DEPLOY/patrol-auth-service.ts" "$ROOT/src/modules/syntra/services/patrol-auth-service.ts"
cp "$DEPLOY/patrol-routes-service.ts" "$ROOT/src/modules/syntra/services/patrol-routes-service.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/inventory-positions"
cp "$DEPLOY/admin/patrol/inventory-positions/route.ts" "$ROOT/src/app/api/admin/patrol/inventory-positions/route.ts"
mkdir -p "$ROOT/src/app/api/admin/patrol/assignments"
cp "$DEPLOY/admin/patrol/assignments/route.ts" "$ROOT/src/app/api/admin/patrol/assignments/route.ts"

cp "$DEPLOY/components/recorridos/RecorridosShell.tsx" "$ROOT/src/components/recorridos/RecorridosShell.tsx"
mkdir -p "$ROOT/src/app/(app)/recorridos/asignaciones"
cp "$DEPLOY/recorridos/asignaciones/page.tsx" "$ROOT/src/app/(app)/recorridos/asignaciones/page.tsx"
mkdir -p "$ROOT/src/app/(app)/recorridos/dispositivos"
cp "$DEPLOY/recorridos/dispositivos/page.tsx" "$ROOT/src/app/(app)/recorridos/dispositivos/page.tsx"

python3 <<PY
from pathlib import Path
schema = Path("$ROOT/prisma/schema.prisma")
text = schema.read_text(encoding="utf-8")
needle = "  label        String?\n  isActive     Boolean   @default(true)"
repl = """  label        String?
  locationDesc String?
  positionId   String?
  assetId      String?
  isActive     Boolean   @default(true)"""
if "positionId" not in text and needle in text:
    schema.write_text(text.replace(needle, repl), encoding="utf-8")
    print("schema.prisma patched")
else:
    print("schema.prisma already has positionId or pattern missing")
PY

cd "$ROOT"
docker compose exec -T postgres psql -U postgres -d security_contracts -f - < "$DEPLOY/migrations/20260524160000_patrol_inventory_link/migration.sql" || true
docker compose up -d --build
echo "Deploy inventario-auth completado."
