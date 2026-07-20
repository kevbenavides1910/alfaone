#!/usr/bin/env bash
# Preflight de contexto de deploy Alfa One.
# Garantiza path canónico, compose project correcto, manifiesto mínimo en disco
# y que el build NO elimine NINGUNA ruta (página UI o API) ya presente en producción.
#
# Causa raíz (jul-2026): el anti-drop miraba solo carpetas padre / allowlist.
# Existía `empleados-naf/` en disco pero faltaban `nomina/`, `cargas-sociales/`, etc.;
# el build pasó smoke y borró pantallas en prod. Este script compara inventario COMPLETO.
#
# Uso: bash scripts/ops/deploy-context-preflight.sh <ROOT>
set -Eeuo pipefail

ROOT="${1:-}"
if [ -z "$ROOT" ]; then
  echo "ERROR: deploy-context-preflight.sh requiere ROOT como argumento" >&2
  exit 1
fi
ROOT="$(cd "$ROOT" && pwd)"

CANONICAL_ROOT="${DEPLOY_CANONICAL_ROOT:-/mnt/data/projects/alfa-one/code/presupuestos-alfa}"
APP_CONTAINER="${APP_CONTAINER:-security_contracts_app}"
OPS_DIR="$ROOT/scripts/ops"
INVENTORY="$OPS_DIR/inventory-next-routes.sh"

section() {
  echo "== $1 =="
}

section "Preflight: contexto de deploy"
echo "root=$ROOT"
echo "canonical=$CANONICAL_ROOT"

# --- Path canónico (override solo con flag explícito) ---
if [ "$ROOT" != "$CANONICAL_ROOT" ]; then
  if [ "${DEPLOY_ALLOW_FOREIGN_ROOT:-0}" = "1" ]; then
    echo "WARN: ROOT fuera del path canónico (DEPLOY_ALLOW_FOREIGN_ROOT=1)"
  else
    echo "ERROR: deploy solo desde el path canónico de Alfa One:" >&2
    echo "       $CANONICAL_ROOT" >&2
    echo "       Actual: $ROOT" >&2
    echo "       Override peligroso: DEPLOY_ALLOW_FOREIGN_ROOT=1" >&2
    exit 1
  fi
fi

case "$ROOT" in
  /tmp|/tmp/*)
    echo "ERROR: deploy desde /tmp está prohibido (worktrees incompletos)." >&2
    exit 1
    ;;
esac

# worktree enlazado: .git es un archivo, no un directorio
if [ -f "$ROOT/.git" ] && [ "${DEPLOY_ALLOW_FOREIGN_ROOT:-0}" != "1" ]; then
  echo "ERROR: este directorio es un git worktree; deploy solo desde $CANONICAL_ROOT" >&2
  echo "       worktree=$ROOT" >&2
  exit 1
fi

# --- Compose project (export para el caller) ---
export COMPOSE_PROJECT_NAME=presupuestos-alfa
echo "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"

if [ ! -x "$INVENTORY" ]; then
  chmod +x "$INVENTORY" 2>/dev/null || true
fi
if [ ! -f "$INVENTORY" ]; then
  echo "ERROR: falta $INVENTORY" >&2
  exit 1
fi

# --- Manifiesto mínimo de fuentes (módulos core que deben existir siempre) ---
section "Preflight: manifiesto mínimo de fuentes"
REQUIRED_PATHS=(
  "src/app/(app)/naf-operaciones"
  "src/app/(app)/audits"
  "src/app/(app)/facturacion-electronica"
  "src/app/(app)/empleados-naf"
  "src/app/(app)/empleados-naf/nomina"
  "src/app/(app)/empleados-naf/cargas-sociales"
  "src/app/(app)/tickets-ti/visualizador"
  "src/app/(app)/ventas"
  "src/app/(app)/facturacion"
  "src/app/(app)/disciplinario"
  "src/modules/naf-operaciones"
  "src/lib/modules/registry.ts"
)

missing=0
for rel in "${REQUIRED_PATHS[@]}"; do
  if [ -e "$ROOT/$rel" ]; then
    echo "OK: $rel"
  else
    echo "MISSING: $rel" >&2
    missing=1
  fi
done

if [ -f "$ROOT/scripts/fe-xades-bootstrap.cjs" ]; then
  echo "OK: scripts/fe-xades-bootstrap.cjs"
elif [ -f "$ROOT/scripts/db/fe-xades-bootstrap.cjs" ]; then
  echo "OK: scripts/db/fe-xades-bootstrap.cjs"
else
  echo "MISSING: scripts/fe-xades-bootstrap.cjs o scripts/db/fe-xades-bootstrap.cjs" >&2
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  echo "ERROR: árbol incompleto — faltan rutas críticas. Abortando deploy." >&2
  exit 1
fi

# --- Anti-regresión TOTAL: cada ruta en prod debe existir en fuentes ---
# Omitir con DEPLOY_SKIP_ANTI_DROP=1 (p. ej. pull GHCR: el smoke post-deploy valida).
if [ "${DEPLOY_SKIP_ANTI_DROP:-0}" = "1" ]; then
  echo "Preflight anti-drop omitido (DEPLOY_SKIP_ANTI_DROP=1)"
else
  section "Preflight: anti-drop TOTAL (inventario prod vs fuentes)"
  if docker inspect "$APP_CONTAINER" >/dev/null 2>&1; then
    tmpdir=$(mktemp -d)
    trap 'rm -rf "$tmpdir"' RETURN
    bash "$INVENTORY" container "$APP_CONTAINER" all >"$tmpdir/prod.txt"
    bash "$INVENTORY" source "$ROOT" all >"$tmpdir/src.txt"
    prod_n=$(wc -l <"$tmpdir/prod.txt")
    src_n=$(wc -l <"$tmpdir/src.txt")
    echo "inventario_prod=$prod_n inventario_fuentes=$src_n"

    # Rutas en prod que NO están en fuentes = se perderían al rebuild
    comm -23 "$tmpdir/prod.txt" "$tmpdir/src.txt" >"$tmpdir/drops.txt" || true
    drop_n=$(wc -l <"$tmpdir/drops.txt")

    if [ "$drop_n" -gt 0 ]; then
      echo "DROP-RISK: $drop_n rutas presentes en producción NO existen en fuentes:" >&2
      head -80 "$tmpdir/drops.txt" >&2
      if [ "$drop_n" -gt 80 ]; then
        echo "... y $((drop_n - 80)) más" >&2
      fi
      if [ "${DEPLOY_ALLOW_MODULE_DROP:-0}" = "1" ]; then
        echo "WARN: DEPLOY_ALLOW_MODULE_DROP=1 — se permite perder rutas (PELIGROSO)"
      else
        echo "ERROR: rebuild desde este árbol eliminaría rutas de producción." >&2
        echo "       Restaure fuentes (p. ej. desde stash/commit completo) o abortar." >&2
        echo "       Override peligroso: DEPLOY_ALLOW_MODULE_DROP=1" >&2
        exit 1
      fi
    else
      echo "OK: 0 drops — todas las rutas de prod tienen fuente en disco"
    fi
  else
    echo "WARN: contenedor $APP_CONTAINER no existe — se omite anti-drop total"
  fi
fi

echo "OK: contexto y manifiesto de fuentes válidos"
