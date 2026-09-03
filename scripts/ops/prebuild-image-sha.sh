#!/usr/bin/env bash
# Prebuild imagen Docker del SHA (local) para que ops:deploy:cursor sea ~recreate.
#
# Uso:
#   npm run ops:prebuild              # HEAD, foreground
#   npm run ops:prebuild -- --bg      # HEAD, background
#   bash scripts/ops/prebuild-image-sha.sh <sha> [--bg]
#
# Construye desde un git worktree del SHA (no usa WIP del working tree).
#
# Env:
#   ALFAONE_PREBUILD=0          → no-op
#   DEPLOY_GHCR_PUSH=0|1        → push a GHCR (default 0 en prebuild)
#   ALFAONE_PREBUILD_LOG=path   → log en background
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ "${ALFAONE_PREBUILD:-1}" = "0" ] || [ "${ALFAONE_PREBUILD:-1}" = "false" ]; then
  echo "SKIP prebuild (ALFAONE_PREBUILD=0)"
  exit 0
fi

BG=0
SHA_ARG=""
for arg in "$@"; do
  case "$arg" in
    --bg|--background) BG=1 ;;
    -*)
      echo "Uso: $0 [sha] [--bg]" >&2
      exit 2
      ;;
    *)
      if [ -z "$SHA_ARG" ]; then SHA_ARG="$arg"; else
        echo "Arg extra: $arg" >&2
        exit 2
      fi
      ;;
  esac
done

SHA="${SHA_ARG:-$(git rev-parse HEAD)}"
SHORT_SHA="$(git rev-parse --short "$SHA")"
DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
IMAGE_SHA="${DEFAULT_IMAGE_REPO}:${SHA}"
LOG_DIR="${ALFAONE_PREBUILD_LOG_DIR:-$ROOT/.deploy-logs}"
LOG="${ALFAONE_PREBUILD_LOG:-$LOG_DIR/prebuild-${SHORT_SHA}.log}"
WT_DIR="${ALFAONE_PREBUILD_WORKTREE:-/tmp/alfaone-prebuild-wt-${SHORT_SHA}}"

if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
  echo "OK: imagen ya lista $IMAGE_SHA (prebuild no-op)"
  exit 0
fi

run_build() {
  export DEPLOY_GHCR_PUSH="${DEPLOY_GHCR_PUSH:-0}"
  echo "== Prebuild imagen $SHORT_SHA (worktree limpio) =="
  echo "image=$IMAGE_SHA"
  echo "worktree=$WT_DIR"
  echo "log=$LOG"

  # Limpiar worktree previo colgado
  if [ -d "$WT_DIR" ]; then
    git worktree remove --force "$WT_DIR" 2>/dev/null || rm -rf "$WT_DIR"
  fi
  git worktree add --detach "$WT_DIR" "$SHA"

  cleanup() {
    git -C "$ROOT" worktree remove --force "$WT_DIR" 2>/dev/null || rm -rf "$WT_DIR"
  }
  trap cleanup EXIT

  # Reutilizar lock/cache del build canónico, pero con contexto = worktree
  BUILD_LOCK="${ALFAONE_BUILD_LOCK_FILE:-/tmp/presupuestos-alfa-build.lock}"
  START=$(date +%s)
  _build_once() {
    (
      cd "$WT_DIR"
      DOCKER_BUILDKIT=1 docker buildx build --builder default -f Dockerfile \
        -t "$IMAGE_SHA" \
        -t "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" \
        -t "${DEFAULT_IMAGE_REPO}:latest" \
        --load .
    )
  }

  mkdir -p "$(dirname "$BUILD_LOCK")"
  exec 8>"$BUILD_LOCK"
  if flock -n 8; then
    if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
      echo "OK: otro proceso terminó el build"
    else
      _build_once
    fi
  else
    echo "Build en curso — espero imagen $SHORT_SHA…"
    waited=0
    while [ "$waited" -lt "${ALFAONE_BUILD_WAIT_SECONDS:-420}" ]; do
      if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
        echo "OK: imagen lista tras ${waited}s"
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

  ELAPSED=$(( $(date +%s) - START ))
  echo "elapsed_build=${ELAPSED}"

  if [ "${DEPLOY_GHCR_PUSH:-0}" = "1" ] || [ "${DEPLOY_GHCR_PUSH:-0}" = "true" ]; then
    echo "== Push GHCR (background) =="
    ( docker push "$IMAGE_SHA" || true
      docker push "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" || true
      docker push "${DEFAULT_IMAGE_REPO}:latest" || true
    ) >/tmp/alfaone-ghcr-push.log 2>&1 &
  fi

  echo "OK: prebuild listo $IMAGE_SHA"
}

mkdir -p "$(dirname "$LOG")"

if [ "$BG" = "1" ]; then
  LOCK="/tmp/alfaone-prebuild-${SHORT_SHA}.lock"
  if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
    echo "OK: prebuild ya en curso para $SHORT_SHA (pid=$(cat "$LOCK"))"
    exit 0
  fi
  (
    echo $$ >"$LOCK"
    trap 'rm -f "$LOCK"' EXIT
    {
      echo "==== prebuild start $(date -u +%Y-%m-%dT%H:%M:%SZ) sha=$SHA ===="
      run_build
      echo "==== prebuild end $(date -u +%Y-%m-%dT%H:%M:%SZ) ===="
    } >>"$LOG" 2>&1
  ) &
  disown || true
  echo "OK: prebuild en background pid=$! sha=$SHORT_SHA log=$LOG"
  exit 0
fi

run_build | tee -a "$LOG"
