#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
if [ -z "${APP_IMAGE:-}" ]; then
  if docker inspect security_contracts_app_preview >/dev/null 2>&1; then
    APP_IMAGE="$(docker inspect security_contracts_app_preview --format '{{.Config.Image}}')"
  else APP_IMAGE="${DEFAULT_IMAGE_REPO}:$(git rev-parse HEAD)"; fi
fi
export APP_IMAGE DEPLOY_PATH_LABEL=promote
export DEPLOY_SKIP_DB_BACKUP="${DEPLOY_SKIP_DB_BACKUP:-1}"
export DEPLOY_FAST_SMOKE="${DEPLOY_FAST_SMOKE:-1}"
echo "Promote → APP_IMAGE=$APP_IMAGE"
exec bash "$ROOT/scripts/deploy-from-image.sh"
