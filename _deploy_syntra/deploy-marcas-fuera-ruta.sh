#!/usr/bin/env bash
# Pestaña Marcas fuera de ruta + API reporte
set -euo pipefail
ROOT="${1:-/home/soporte-ti/presupuestos-alfa}"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"

cp "$DEPLOY/patrol-out-of-route-marks-service.ts" "$ROOT/src/modules/syntra/services/patrol-out-of-route-marks-service.ts"

mkdir -p "$ROOT/src/app/api/admin/patrol/reports/marcas-fuera-ruta"
cp "$DEPLOY/admin/patrol/reports/marcas-fuera-ruta/route.ts" \
  "$ROOT/src/app/api/admin/patrol/reports/marcas-fuera-ruta/route.ts"

mkdir -p "$ROOT/src/app/(app)/recorridos/marcas-fuera-ruta"
cp "$DEPLOY/recorridos/marcas-fuera-ruta/page.tsx" \
  "$ROOT/src/app/(app)/recorridos/marcas-fuera-ruta/page.tsx"

cp "$DEPLOY/components/recorridos/RecorridosShell.tsx" "$ROOT/src/components/recorridos/RecorridosShell.tsx"

cd "$ROOT"
docker compose up -d --build
echo "Despliegue marcas fuera de ruta completado."
