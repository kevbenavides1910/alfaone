#!/usr/bin/env bash
# Build imagen GHCR local con BuildKit cache mount (sin COPY/export 1.4G).
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
BUILD_LOCK="${ALFAONE_BUILD_LOCK_FILE:-/tmp/presupuestos-alfa-build.lock}"
BUILD_WAIT_SECS="${ALFAONE_BUILD_WAIT_SECONDS:-420}"
SHA="$(git rev-parse HEAD)"; SHORT_SHA="$(git rev-parse --short HEAD)"
IMAGE_SHA="${DEFAULT_IMAGE_REPO}:${SHA}"
section(){ echo ""; echo "== $1 =="; }
CACHE_HIT=0
if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
  echo "OK: imagen local ya existe ($IMAGE_SHA) — omito build"
  echo "deploy_path=cursor_build"; echo "cache_hit=1"; echo "elapsed_build=0"; exit 0
fi
if [ "${ALFAONE_USE_DISK_CACHE:-0}" = "1" ] || [ "${ALFAONE_USE_DISK_CACHE:-0}" = "true" ]; then
  section "Restaurar cache webpack (disco → contexto)"
  bash "$ROOT/scripts/ops/sync-build-cache.sh" pull
fi
section "Build imagen GHCR (local, BuildKit cache)"
START=$(date +%s)
_build_once(){
  DOCKER_BUILDKIT=1 docker buildx build --builder default -f Dockerfile     -t "$IMAGE_SHA" -t "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" -t "${DEFAULT_IMAGE_REPO}:latest" --load .
}
if [ "${ALFAONE_BUILD_SKIP_LOCK:-0}" = "1" ]; then _build_once
else
  mkdir -p "$(dirname "$BUILD_LOCK")"; exec 8>"$BUILD_LOCK"
  if flock -n 8; then
    if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then echo "OK: otro proceso terminó el build"; CACHE_HIT=1
    else _build_once; fi
  else
    echo "Build en curso — espero hasta ${BUILD_WAIT_SECS}s…"
    waited=0
    while [ "$waited" -lt "$BUILD_WAIT_SECS" ]; do
      if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then echo "OK: imagen lista tras ${waited}s"; CACHE_HIT=1; break; fi
      sleep 2; waited=$((waited+2))
    done
    flock 8
    if ! docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then _build_once; else CACHE_HIT=1; fi
  fi
fi
ELAPSED_BUILD=$(( $(date +%s) - START ))
echo "elapsed_build=${ELAPSED_BUILD}"; echo "build_local_seconds=${ELAPSED_BUILD}"
echo "cache_hit=${CACHE_HIT}"; echo "deploy_path=cursor_build"
if [ "${DEPLOY_GHCR_PUSH:-1}" = "1" ] || [ "${DEPLOY_GHCR_PUSH:-1}" = "true" ]; then
  section "Push GHCR (background)"
  ( docker push "$IMAGE_SHA" || true; docker push "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" || true; docker push "${DEFAULT_IMAGE_REPO}:latest" || true ) >/tmp/alfaone-ghcr-push.log 2>&1 &
  echo "OK: push en background (log /tmp/alfaone-ghcr-push.log)"
fi
echo "OK: imagen local $IMAGE_SHA"
