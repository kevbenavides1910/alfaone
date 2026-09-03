#!/usr/bin/env bash
# Prebuild imagen Docker del SHA (local) para que ops:deploy:cursor sea ~recreate.
#
# Uso:
#   npm run ops:prebuild              # HEAD, foreground
#   npm run ops:prebuild -- --bg      # HEAD, background
#   bash scripts/ops/prebuild-image-sha.sh <sha> [--bg]
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

if docker image inspect "$IMAGE_SHA" >/dev/null 2>&1; then
  echo "OK: imagen ya lista $IMAGE_SHA (prebuild no-op)"
  exit 0
fi

run_build() {
  export DEPLOY_GHCR_PUSH="${DEPLOY_GHCR_PUSH:-0}"
  HEAD="$(git rev-parse HEAD)"
  if [ "$SHA" != "$HEAD" ]; then
    echo "SKIP: prebuild solo aplica a HEAD (pedido=$SHORT_SHA head=$(git rev-parse --short HEAD))."
    exit 0
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "WARN: árbol sucio — prebuild usa el árbol de trabajo; preferible commit limpio."
  fi
  echo "== Prebuild imagen $SHORT_SHA =="
  echo "image=$IMAGE_SHA"
  echo "log=$LOG"
  bash "$ROOT/scripts/ops/build-ghcr-image-local.sh"
  echo "OK: prebuild listo $IMAGE_SHA"
}

mkdir -p "$(dirname "$LOG")"

if [ "$BG" = "1" ]; then
  # Evitar dos prebuilds simultáneos del mismo SHA
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
