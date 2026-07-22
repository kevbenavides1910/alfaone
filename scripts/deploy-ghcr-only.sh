#!/usr/bin/env bash
# Deploy estricto por GHCR: NUNCA hace build local en el VPS.
# Uso: npm run ops:deploy:ghcr
#      APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:<sha> npm run ops:deploy:ghcr
#
# Si la imagen del SHA aún no está, espera (poll local + GHCR) en lugar de fallar al instante.
# El runner Publish GHCR corre en el mismo daemon Docker → a menudo la imagen local
# aparece antes de que el push a ghcr.io termine.
#
# Aborta temprano si `gh` reporta que Publish GHCR falló/canceló para este commit
# (evita esperar el timeout completo cuando el build rompe).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
ALLOW_LATEST="${DEPLOY_GHCR_ALLOW_LATEST:-0}"
# Publish GHCR suele estar listo en ~2–5 min. Default 6 min; override con DEPLOY_GHCR_WAIT_SECONDS.
# 0 = no esperar (comportamiento antiguo).
WAIT_SECS="${DEPLOY_GHCR_WAIT_SECONDS:-360}"
POLL_SECS="${DEPLOY_GHCR_POLL_SECONDS:-8}"

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

# Devuelve 0 si el workflow Publish GHCR ya terminó en failure/cancelled para este SHA.
publish_ghcr_failed() {
  local sha="$1"
  command -v gh >/dev/null 2>&1 || return 1
  local conclusion url
  conclusion="$(
    gh run list --workflow=publish-ghcr.yml --commit "$sha" --limit 1 \
      --json status,conclusion,url \
      --jq '.[0] | select(.status == "completed") | .conclusion // empty' \
      2>/dev/null || true
  )"
  case "$conclusion" in
    failure|cancelled|timed_out)
      url="$(
        gh run list --workflow=publish-ghcr.yml --commit "$sha" --limit 1 \
          --json url --jq '.[0].url // empty' 2>/dev/null || true
      )"
      echo "Publish GHCR terminó en ${conclusion}${url:+ — $url}" >&2
      return 0
      ;;
  esac
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

    if publish_ghcr_failed "$SHA"; then
      die "Publish GHCR falló para $SHORT_SHA; no se espera más la imagen."
    fi

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
