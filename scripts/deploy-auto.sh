#!/usr/bin/env bash
# Elige el camino de deploy más rápido:
# - Árbol limpio + imagen GHCR para el SHA → ops:deploy:pull
# - WIP / dirty / sin imagen remota → ops:deploy (build local)
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"

section() {
  echo ""
  echo "== $1 =="
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "WARN: no es un repo git — fallback a build local"
  exec bash "$ROOT/scripts/deploy-production.sh"
fi

DIRTY="$(git status --porcelain)"
SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"

if [ -n "$DIRTY" ]; then
  section "Deploy auto: árbol sucio → build local"
  echo "Cambios locales detectados; no se puede confiar en una imagen GHCR remota."
  exec bash "$ROOT/scripts/deploy-production.sh"
fi

# Preferir tag por SHA (exactitud); fallback a short sha.
CANDIDATES=(
  "${DEFAULT_IMAGE_REPO}:${SHA}"
  "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}"
)

RESOLVED=""
section "Deploy auto: buscando imagen GHCR para ${SHORT_SHA}"
for img in "${CANDIDATES[@]}"; do
  echo "probe: $img"
  if docker image inspect "$img" >/dev/null 2>&1; then
    RESOLVED="$img"
    break
  fi
  if docker manifest inspect "$img" >/dev/null 2>&1; then
    RESOLVED="$img"
    break
  fi
done

if [ -z "$RESOLVED" ]; then
  echo "No hay imagen GHCR para este SHA — fallback a build local."
  echo "Tip: tras push a main, espere el workflow Publish GHCR o dispare workflow_dispatch."
  exec bash "$ROOT/scripts/deploy-production.sh"
fi

section "Deploy auto: pull $RESOLVED"
export APP_IMAGE="$RESOLVED"
exec bash "$ROOT/scripts/deploy-from-image.sh"
