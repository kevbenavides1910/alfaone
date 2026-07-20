#!/usr/bin/env bash
# Inventario canónico de rutas Next (páginas UI + API handlers).
#
# Uso:
#   bash scripts/ops/inventory-next-routes.sh source <ROOT> [app|api|all]
#   bash scripts/ops/inventory-next-routes.sh container <NAME> [app|api|all]
#   bash scripts/ops/inventory-next-routes.sh image <IMAGE> [app|api|all]
#
# Salida: una ruta relativa por línea, ordenada, sin prefijos.
#   app  → empleados-naf/nomina , tickets-ti/visualizador , ...
#   api  → empleados-naf/nomina , fe/facturas/[id]/pdf , ...
set -Eeuo pipefail

MODE="${1:-}"
TARGET="${2:-}"
SCOPE="${3:-all}"

if [ -z "$MODE" ] || [ -z "$TARGET" ]; then
  echo "Uso: $0 source|container|image <target> [app|api|all]" >&2
  exit 2
fi

normalize_app_from_source() {
  # …/src/app/(app)/foo/bar/page.tsx → foo/bar
  # Delimitador # (no |): la alternación de extensiones usa |.
  # Acepta path absoluto o relativo (find desde ROOT absoluto).
  sed -E 's#^.*/src/app/\(app\)/##; s#^src/app/\(app\)/##; s#/page\.(tsx|ts|jsx|js)$##'
}

normalize_api_from_source() {
  # …/src/app/api/foo/bar/route.ts → foo/bar
  sed -E 's#^.*/src/app/api/##; s#^src/app/api/##; s#/route\.(tsx|ts|js)$##'
}

normalize_app_from_built() {
  # .next/server/app/(app)/foo/bar/page.js → foo/bar
  sed -E 's#^\./?\.next/server/app/\(app\)/##; s#^\.next/server/app/\(app\)/##; s#/page\.js$##'
}

normalize_api_from_built() {
  sed -E 's#^\./?\.next/server/app/api/##; s#^\.next/server/app/api/##; s#/route\.js$##'
}

list_source() {
  local root="$1"
  if [ "$SCOPE" = "app" ] || [ "$SCOPE" = "all" ]; then
    find "$root/src/app/(app)" \( -name 'page.tsx' -o -name 'page.ts' -o -name 'page.jsx' -o -name 'page.js' \) -type f 2>/dev/null \
      | normalize_app_from_source | sed 's|^|app:|'
  fi
  if [ "$SCOPE" = "api" ] || [ "$SCOPE" = "all" ]; then
    find "$root/src/app/api" \( -name 'route.ts' -o -name 'route.js' -o -name 'route.tsx' \) -type f 2>/dev/null \
      | normalize_api_from_source | sed 's|^|api:|'
  fi
}

list_container() {
  local name="$1"
  if [ "$SCOPE" = "app" ] || [ "$SCOPE" = "all" ]; then
    docker exec "$name" sh -c 'find .next/server/app/\(app\) -name page.js -type f 2>/dev/null' \
      | normalize_app_from_built | sed 's|^|app:|'
  fi
  if [ "$SCOPE" = "api" ] || [ "$SCOPE" = "all" ]; then
    docker exec "$name" sh -c 'find .next/server/app/api -name route.js -type f 2>/dev/null' \
      | normalize_api_from_built | sed 's|^|api:|'
  fi
}

list_image() {
  local image="$1"
  if [ "$SCOPE" = "app" ] || [ "$SCOPE" = "all" ]; then
    docker run --rm --entrypoint sh "$image" -c 'find .next/server/app/\(app\) -name page.js -type f 2>/dev/null' \
      | normalize_app_from_built | sed 's|^|app:|'
  fi
  if [ "$SCOPE" = "api" ] || [ "$SCOPE" = "all" ]; then
    docker run --rm --entrypoint sh "$image" -c 'find .next/server/app/api -name route.js -type f 2>/dev/null' \
      | normalize_api_from_built | sed 's|^|api:|'
  fi
}

case "$MODE" in
  source) list_source "$TARGET" | sort -u ;;
  container) list_container "$TARGET" | sort -u ;;
  image) list_image "$TARGET" | sort -u ;;
  *)
    echo "MODE inválido: $MODE (source|container|image)" >&2
    exit 2
    ;;
esac
