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

# Deps firma FE + anclas mínimas — un solo docker exec (evita ~12 round-trips).
REQUIRED_DEPS=(
  "node_modules/xpath"
  "node_modules/tslib"
  "node_modules/xadesjs"
  "node_modules/bytestreamjs"
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  "node_modules/@napi-rs/canvas"
)
REQUIRED_ANCHORS=(
  ".next/server/app/(app)/naf-operaciones"
  ".next/server/app/(app)/audits"
  ".next/server/app/(app)/facturacion-electronica"
  ".next/server/app/(app)/empleados-naf/nomina"
  ".next/server/app/(app)/empleados-naf/cargas-sociales"
  ".next/server/app/(app)/tickets-ti/visualizador"
)
check_paths=("${REQUIRED_DEPS[@]}" "${REQUIRED_ANCHORS[@]}")
check_script=""
for rel in "${check_paths[@]}"; do
  check_script+="if test -e \"$rel\"; then echo OK:$rel; else echo MISSING:$rel; fi;"
done
missing=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  case "$line" in
    OK:*)
      echo "OK: ${line#OK:}"
      ;;
    MISSING:*)
      echo "MISSING: ${line#MISSING:}" >&2
      missing=1
      ;;
  esac
done < <(docker exec "$APP_CONTAINER" sh -c "$check_script" 2>/dev/null || true)

# --- Inventario total vs baseline (imagen anterior) ---
FAST_SMOKE="${DEPLOY_FAST_SMOKE:-0}"
if [ "$FAST_SMOKE" = "1" ] || [ "$FAST_SMOKE" = "true" ]; then
  echo "SKIP inventario anti-drop (DEPLOY_FAST_SMOKE=1) — solo anclas/deps"
  BASELINE_IMAGE=""
fi
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
