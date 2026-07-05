#!/usr/bin/env bash
# Despliega pestaña Rutas permitidas + fix incidentes Android (copiar APK aparte)
set -euo pipefail
ROOT="${1:-/home/soporte-ti/presupuestos-alfa}"
DEPLOY="$(cd "$(dirname "$0")" && pwd)"

cp "$DEPLOY/components/recorridos/RecorridosShell.tsx" "$ROOT/src/components/recorridos/RecorridosShell.tsx"
cp "$DEPLOY/components/recorridos/RoutePhonesPanel.tsx" "$ROOT/src/components/recorridos/RoutePhonesPanel.tsx"
cp "$DEPLOY/recorridos/rutas-id-page.tsx" "$ROOT/src/app/(app)/recorridos/rutas/[id]/page.tsx"
cp "$DEPLOY/recorridos/asignaciones/page.tsx" "$ROOT/src/app/(app)/recorridos/asignaciones/page.tsx"

mkdir -p "$ROOT/src/app/(app)/recorridos/rutas-permitidas/[id]"
cp "$DEPLOY/recorridos/rutas-permitidas/page.tsx" "$ROOT/src/app/(app)/recorridos/rutas-permitidas/page.tsx"
cp "$DEPLOY/recorridos/rutas-permitidas-id-page.tsx" "$ROOT/src/app/(app)/recorridos/rutas-permitidas/[id]/page.tsx"

cd "$ROOT"
docker compose up -d --build
echo "Despliegue rutas permitidas completado."
