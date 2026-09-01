#!/usr/bin/env bash
# Construye y etiqueta la imagen GHCR en el daemon local (self-hosted alfaia).
# Usa la misma Dockerfile + cache persistente que Publish GHCR, pero arranca
# de inmediato cuando el agente Cursor pide deploy (sin esperar Actions).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
BUILD_LOCK="${ALFAONE_BUILD_LOCK_FILE:-/tmp/presupuestos-alfa-build.lock}"
BUILD_WAIT_SECS="${ALFAONE_BUILD_WAIT_SECONDS:-420}"

SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
IMAGE_SHA="${DEFAULT_IMAGE_REPO}:${SHA}"

section() {
  echo ""
  echo "== $1 =="
}

if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
  echo "OK: imagen local ya existe ($IMAGE_SHA) — omito build"
  exit 0
fi

section "Restaurar cache webpack"
bash "$ROOT/scripts/ops/sync-build-cache.sh" pull

section "Build imagen GHCR (local, cache caliente)"
START=$(date +%s)

_build_once() {
  docker buildx build --builder default \
    -f Dockerfile \
    -t "$IMAGE_SHA" \
    -t "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" \
    -t "${DEFAULT_IMAGE_REPO}:latest" \
    --load \
    .
}

if [ "${ALFAONE_BUILD_SKIP_LOCK:-0}" = "1" ]; then
  _build_once
else
  mkdir -p "$(dirname "$BUILD_LOCK")"
  exec 8>"$BUILD_LOCK"
  if flock -n 8; then
    if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
      echo "OK: otro proceso terminó el build mientras tomábamos lock"
    else
      _build_once
    fi
  else
    echo "Build en curso (lock $BUILD_LOCK) — espero imagen hasta ${BUILD_WAIT_SECS}s…"
    waited=0
    while [ "$waited" -lt "$BUILD_WAIT_SECS" ]; do
      if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
        echo "OK: imagen lista tras esperar ${waited}s"
        break
      fi
      sleep 2
      waited=$((waited + 2))
    done
    flock 8
    if ! docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
      _build_once
    fi
  fi
fi

echo "build_local_seconds=$(( $(date +%s) - START ))"

section "Persistir cache webpack"
rm -rf /tmp/alfaone-next-cache-export
docker buildx build --builder default \
  --target export-next-cache \
  -o /tmp/alfaone-next-cache-export \
  -f Dockerfile \
  . >/dev/null
ALFAONE_CACHE_EXPORT_DIR=/tmp/alfaone-next-cache-export \
  bash "$ROOT/scripts/ops/sync-build-cache.sh" push

if [ "${DEPLOY_GHCR_PUSH:-1}" = "1" ] || [ "${DEPLOY_GHCR_PUSH:-1}" = "true" ]; then
  section "Push GHCR (background)"
  (
    docker push "$IMAGE_SHA" || true
    docker push "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" || true
    docker push "${DEFAULT_IMAGE_REPO}:latest" || true
  ) >/tmp/alfaone-ghcr-push.log 2>&1 &
  echo "OK: push en background (log /tmp/alfaone-ghcr-push.log)"
fi

echo "OK: imagen local $IMAGE_SHA"
