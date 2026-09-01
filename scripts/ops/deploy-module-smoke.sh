#!/usr/bin/env bash
# Smoke post-deploy: inventario COMPLETO de rutas + deps XAdES.
#
# Si se pasa BASELINE_IMAGE (rollback tag creado ANTES del recreate), compara
# cada página/API del baseline contra el contenedor nuevo: 0 drops permitidos.
#
# Uso:
#   bash scripts/ops/deploy-module-smoke.sh [APP_CONTAINER] [BASELINE_IMAGE]
#   DEPLOY_BASELINE_IMAGE=alfa-one-app-rollback:... bash scripts/ops/deploy-module-smoke.sh
set -Eeuo pipefail

APP_CONTAINER="${1:-${APP_CONTAINER:-security_contracts_app}}"
BASELINE_IMAGE="${2:-${DEPLOY_BASELINE_IMAGE:-}}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INVENTORY="$ROOT/scripts/ops/inventory-next-routes.sh"

section() {
  echo "== $1 =="
}

section "Smoke: módulos en contenedor ($APP_CONTAINER)"

if ! docker inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: contenedor $APP_CONTAINER no existe" >&2
  exit 1
fi

if [ ! -f "$INVENTORY" ]; then
  echo "ERROR: falta $INVENTORY" >&2
  exit 1
fi
chmod +x "$INVENTORY" 2>/dev/null || true

# Listado de auditoría
echo "-- módulos .next/server/app/(app) --"
docker exec "$APP_CONTAINER" sh -c 'ls -1 .next/server/app/\(app\) 2>/dev/null | sort' || true

# Deps firma FE (siempre)
REQUIRED_DEPS=(
  "node_modules/xpath"
  "node_modules/tslib"
  "node_modules/xadesjs"
  "node_modules/bytestreamjs"
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  "node_modules/@napi-rs/canvas"
)
missing=0
for rel in "${REQUIRED_DEPS[@]}"; do
  if docker exec "$APP_CONTAINER" sh -c "test -e \"$rel\""; then
    echo "OK: $rel"
  else
    echo "MISSING: $rel" >&2
    missing=1
  fi
done

# Anclas mínimas (defensa en profundidad además del inventario)
REQUIRED_ANCHORS=(
  ".next/server/app/(app)/naf-operaciones"
  ".next/server/app/(app)/audits"
  ".next/server/app/(app)/facturacion-electronica"
  ".next/server/app/(app)/empleados-naf/nomina"
  ".next/server/app/(app)/empleados-naf/cargas-sociales"
  ".next/server/app/(app)/tickets-ti/visualizador"
)
for rel in "${REQUIRED_ANCHORS[@]}"; do
  if docker exec "$APP_CONTAINER" sh -c "test -e \"$rel\""; then
    echo "OK: $rel"
  else
    echo "MISSING: $rel" >&2
    missing=1
  fi
done

# --- Inventario total vs baseline (imagen anterior) ---
if [ -n "$BASELINE_IMAGE" ]; then
  section "Smoke: anti-drop total vs baseline ($BASELINE_IMAGE)"
  if ! docker image inspect "$BASELINE_IMAGE" >/dev/null 2>&1; then
    echo "ERROR: baseline image no existe: $BASELINE_IMAGE" >&2
    exit 1
  fi
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' RETURN
  cache_dir="${DEPLOY_INVENTORY_CACHE_DIR:-$ROOT/.deploy-logs/inventory-cache}"
  mkdir -p "$cache_dir"
  cache_key="$(echo "$BASELINE_IMAGE" | tr '/:' '__')"
  cache_file="$cache_dir/${cache_key}.txt"

  if [ -f "$cache_file" ]; then
    cp "$cache_file" "$tmpdir/before.txt"
    echo "baseline inventario desde cache ($cache_file)"
  else
    bash "$INVENTORY" image "$BASELINE_IMAGE" all | tee "$cache_file" >"$tmpdir/before.txt"
  fi
  bash "$INVENTORY" container "$APP_CONTAINER" all >"$tmpdir/after.txt"
  before_n=$(wc -l <"$tmpdir/before.txt")
  after_n=$(wc -l <"$tmpdir/after.txt")
  echo "rutas_antes=$before_n rutas_despues=$after_n"

  comm -23 "$tmpdir/before.txt" "$tmpdir/after.txt" >"$tmpdir/dropped.txt" || true
  drop_n=$(wc -l <"$tmpdir/dropped.txt")
  if [ "$drop_n" -gt 0 ]; then
    echo "DROP: $drop_n rutas existían en la imagen anterior y YA NO están en la nueva:" >&2
    head -100 "$tmpdir/dropped.txt" >&2
    if [ "$drop_n" -gt 100 ]; then
      echo "... y $((drop_n - 100)) más" >&2
    fi
    missing=1
  else
    echo "OK: 0 drops de rutas vs imagen anterior"
  fi
else
  echo "WARN: sin BASELINE_IMAGE — solo se validan anclas/deps (pase DEPLOY_BASELINE_IMAGE en deploy)"
fi

if [ "$missing" -ne 0 ]; then
  echo "ERROR: imagen incompleta — faltan módulos/deps o se dropearon rutas. Activando rollback vía trap." >&2
  exit 1
fi

echo "OK: smoke de módulos pasado"
