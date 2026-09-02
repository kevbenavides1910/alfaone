#!/usr/bin/env bash
# Deploy rápido para agente Cursor en self-hosted alfaia:
#   si HEAD va adelante del remoto → git push en paralelo
#   build local inmediato (cache webpack) → recreate app (~16s)
# Sin esperar GitHub Actions / Publish GHCR (ahorra cola API + latencia de arranque).
#
# Uso: npm run ops:deploy:cursor
#      (no hace falta `git push` previo: el script lo lanza en background si aplica)
set -Eeuo pipefail

export DEPLOY_CURSOR_FAST=1
export DEPLOY_SKIP_DB_BACKUP="${DEPLOY_SKIP_DB_BACKUP:-1}"
export DEPLOY_FAST_SMOKE="${DEPLOY_FAST_SMOKE:-1}"
export DEPLOY_GHCR_AUTO_DISPATCH=0
export DEPLOY_PATH_LABEL="${DEPLOY_PATH_LABEL:-cursor}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/deploy-ghcr-only.sh"
