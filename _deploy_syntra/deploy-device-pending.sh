#!/usr/bin/env bash
# API auditoria marcas pendientes por IMEI + snapshot desde app SICTRA
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

cp "$DEPLOY/patrol-device-pending-service.ts" "$ROOT/src/modules/syntra/services/patrol-device-pending-service.ts"

mkdir -p "$ROOT/src/app/api/syntra/reports/device-pending"
cp "$DEPLOY/reports/device-pending/route.ts" "$ROOT/src/app/api/syntra/reports/device-pending/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/reports/device-pending-audit"
cp "$DEPLOY/admin/patrol/reports/device-pending-audit/route.ts" \
  "$ROOT/src/app/api/admin/patrol/reports/device-pending-audit/route.ts"

mkdir -p "$ROOT/src/app/(app)/recorridos/auditoria-pendientes"
cp "$DEPLOY/recorridos/auditoria-pendientes/page.tsx" \
  "$ROOT/src/app/(app)/recorridos/auditoria-pendientes/page.tsx"

cp "$DEPLOY/components/recorridos/RecorridosShell.tsx" "$ROOT/src/components/recorridos/RecorridosShell.tsx"

python3 <<PY
from pathlib import Path
schema = Path("$ROOT/prisma/schema.prisma")
text = schema.read_text(encoding="utf-8")
block = '''
/// Snapshot de marcas pendientes reportadas por la app (auditoria IMEI).
model PatrolDevicePendingSnapshot {
  id           String   @id @default(cuid())
  deviceId     String?
  imei         String
  employeeCode String?
  pendingCount Int      @default(0)
  staleCount   Int      @default(0)
  appVersion   String?
  payload      Json
  createdAt    DateTime @default(now())

  @@index([imei, createdAt])
  @@map("patrol_device_pending_snapshots")
}
'''
anchor = "/// Punto GPS enviado desde app SYNTRA."
if "PatrolDevicePendingSnapshot" in text:
    print("schema.prisma already has PatrolDevicePendingSnapshot")
elif anchor in text:
    schema.write_text(text.replace(anchor, block + "\n" + anchor), encoding="utf-8")
    print("schema.prisma patched")
else:
    print("WARN: anchor not found in schema.prisma")
PY

run_migration "20260523120000_patrol_device_pending_snapshots"

cd "$ROOT"
docker compose up -d --build
echo "Despliegue auditoria marcas pendientes completado."
