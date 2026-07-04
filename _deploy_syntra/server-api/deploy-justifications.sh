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

if ! grep -q '_deploy_syntra' "$ROOT/.dockerignore" 2>/dev/null; then
  echo "_deploy_syntra" >> "$ROOT/.dockerignore"
fi

cp "$DEPLOY/patrol-image-store.ts" "$ROOT/src/modules/syntra/services/patrol-image-store.ts"
cp "$DEPLOY/patrol-bitacora-service.ts" "$ROOT/src/modules/syntra/services/patrol-bitacora-service.ts"
cp "$DEPLOY/patrol-justification-service.ts" "$ROOT/src/modules/syntra/services/patrol-justification-service.ts"
cp "$DEPLOY/patrol-marks-compliance-service.ts" "$ROOT/src/modules/syntra/services/patrol-marks-compliance-service.ts"
cp "$DEPLOY/patrol-reports-service.ts" "$ROOT/src/modules/syntra/services/patrol-reports-service.ts"
cp "$DEPLOY/costa-rica-time-fix.ts" "$ROOT/src/modules/syntra/utils/costa-rica-time.ts"
cp "$DEPLOY/patrol-route-schedule-service.ts" "$ROOT/src/modules/syntra/services/patrol-route-schedule-service.ts"
cp "$DEPLOY/patrol-routes-service.ts" "$ROOT/src/modules/syntra/services/patrol-routes-service.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/uploads/[fileName]"
cp "$DEPLOY/admin/patrol/uploads-filename-route.ts" "$ROOT/src/app/api/admin/patrol/uploads/[fileName]/route.ts"

if ! grep -q 'PATROL_UPLOAD_DIR' "$ROOT/docker-compose.yml" 2>/dev/null; then
  sed -i '/BRANDING_UPLOAD_DIR/a\      PATROL_UPLOAD_DIR: /data/patrol-uploads' "$ROOT/docker-compose.yml"
fi

mkdir -p /mnt/storage/apps/presupuestos-alfa/patrol-uploads 2>/dev/null || true

mkdir -p "$ROOT/src/app/api/admin/patrol/justifications/link"
cp "$DEPLOY/admin/patrol/justifications-route.ts" "$ROOT/src/app/api/admin/patrol/justifications/route.ts"
cp "$DEPLOY/admin/patrol/justifications-link-route.ts" "$ROOT/src/app/api/admin/patrol/justifications/link/route.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/bitacora"
cp "$DEPLOY/admin/patrol/bitacora-route.ts" "$ROOT/src/app/api/admin/patrol/bitacora/route.ts"

mkdir -p "$ROOT/src/app/api/syntra/reports/incident"
cp "$DEPLOY/reports/incident/route.ts" "$ROOT/src/app/api/syntra/reports/incident/route.ts"

mkdir -p "$ROOT/src/app/(app)/recorridos/bitacora"
cp "$DEPLOY/recorridos/bitacora/page.tsx" "$ROOT/src/app/(app)/recorridos/bitacora/page.tsx"
cp "$DEPLOY/recorridos-reportes-page.tsx" "$ROOT/src/app/(app)/recorridos/reportes/page.tsx"
cp "$DEPLOY/components/recorridos/RecorridosShell.tsx" "$ROOT/src/components/recorridos/RecorridosShell.tsx"
cp "$DEPLOY/components/recorridos/PatrolMarksMap.tsx" "$ROOT/src/components/recorridos/PatrolMarksMap.tsx"

python3 "$DEPLOY/patch-justifications-schema.py" "$ROOT/prisma/schema.prisma"

run_migration "20260524200000_patrol_justifications_bitacora"

cd "$ROOT"
docker compose up -d --build
echo "Deploy justifications-bitacora completado."
