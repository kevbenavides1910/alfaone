#!/usr/bin/env bash
# Deploy estricto por GHCR: NUNCA hace build local en el VPS.
# Uso: npm run ops:deploy:ghcr
#      APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:<sha> npm run ops:deploy:ghcr
#
# Si la imagen del SHA aún no está, espera (poll local + GHCR) en lugar de fallar al instante.
# El runner Publish GHCR corre en el mismo daemon Docker → a menudo la imagen local
# aparece antes de que el push a ghcr.io termine.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
ALLOW_LATEST="${DEPLOY_GHCR_ALLOW_LATEST:-0}"
# Espera por Publish GHCR (build ~2–5 min). 0 = no esperar (comportamiento antiguo).
WAIT_SECS="${DEPLOY_GHCR_WAIT_SECONDS:-900}"
POLL_SECS="${DEPLOY_GHCR_POLL_SECONDS:-5}"

section() {
  echo ""
  echo "== $1 =="
}

die() {
  echo "ERROR: $*" >&2
  echo "Hint: push a main → npm run ops:deploy:ghcr (espera Publish GHCR solo). Login: npm run ops:ghcr-login" >&2
  echo "Build local solo con confirmación explícita del usuario: npm run ops:deploy" >&2
  exit 1
}

image_present() {
  local img="$1"
  # Mismo host que el self-hosted runner: la imagen local basta (no esperar push).
  if docker image inspect "$img" >/dev/null 2>&1; then
    return 0
  fi
  if docker manifest inspect "$img" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

section "Deploy GHCR-only (sin build local)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "no es un repo git"
fi

DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  echo "Árbol sucio (muestra):"
  echo "$DIRTY" | head -20
  die "hay cambios locales sin commit. Commit + push a main antes de desplegar por GHCR."
fi

SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Aviso si no está en main (sigue permitido si la imagen del SHA existe)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
  echo "WARN: rama actual=$BRANCH (lo normal es main tras push)."
fi

# ¿Está el SHA en remoto?
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  AHEAD="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
  if [ "${AHEAD:-0}" -gt 0 ]; then
    die "HEAD está $AHEAD commit(s) por delante del remoto. Haz git push antes del pull GHCR."
  fi
fi

RESOLVED="${APP_IMAGE:-}"
if [ -z "$RESOLVED" ]; then
  CANDIDATES=(
    "${DEFAULT_IMAGE_REPO}:${SHA}"
    "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}"
    "${DEFAULT_IMAGE_REPO}:sha-${SHORT_SHA}"
  )
  if [ "$ALLOW_LATEST" = "1" ] || [ "$ALLOW_LATEST" = "true" ]; then
    CANDIDATES+=("${DEFAULT_IMAGE_REPO}:latest")
  fi

  section "Buscando imagen para ${SHORT_SHA} (espera hasta ${WAIT_SECS}s)"
  START_TS="$(date +%s)"
  while true; do
    for img in "${CANDIDATES[@]}"; do
      if image_present "$img"; then
        RESOLVED="$img"
        echo "OK: $img"
        break 2
      fi
    done

    NOW="$(date +%s)"
    ELAPSED=$((NOW - START_TS))
    if [ "$WAIT_SECS" -le 0 ] || [ "$ELAPSED" -ge "$WAIT_SECS" ]; then
      break
    fi
    REMAIN=$((WAIT_SECS - ELAPSED))
    echo "… imagen aún no lista (${ELAPSED}s). Reintento en ${POLL_SECS}s (queda ~${REMAIN}s)"
    sleep "$POLL_SECS"
  done
fi

if [ -z "$RESOLVED" ]; then
  die "no hay imagen GHCR/local para $SHORT_SHA (ni APP_IMAGE). Revise workflow Publish GHCR."
fi

section "Pull + recreate: $RESOLVED"
export APP_IMAGE="$RESOLVED"
exec bash "$ROOT/scripts/deploy-from-image.sh"
