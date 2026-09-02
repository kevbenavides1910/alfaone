#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
APP_CONTAINER="${APP_CONTAINER:-security_contracts_app}"
LOG_DIR="${DEPLOY_LOG_DIR:-$ROOT/.deploy-logs}"; mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/full-smoke-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$LOG") 2>&1
echo "deploy_path=full_smoke_cron"; echo "container=$APP_CONTAINER"
docker inspect "$APP_CONTAINER" >/dev/null 2>&1 || { echo "ERROR: no container" >&2; exit 1; }
export DEPLOY_FAST_SMOKE=0
bash "$ROOT/scripts/ops/deploy-module-smoke.sh" "$APP_CONTAINER"
echo "FULL SMOKE OK log=$LOG"
