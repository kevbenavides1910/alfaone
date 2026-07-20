#!/usr/bin/env bash
# Lock exclusivo de deploy Alfa One (evita dos ops:deploy / compose up --build a la vez).
# Debe hacerse SOURCE desde deploy-production.sh / deploy-from-image.sh:
#   # shellcheck source=scripts/ops/acquire-deploy-lock.sh
#   source "$ROOT/scripts/ops/acquire-deploy-lock.sh"
#
# Override emergencia: DEPLOY_LOCK_FILE=/otra/ruta
# Forzar (NO recomendado): DEPLOY_SKIP_LOCK=1
set -Eeuo pipefail

if [ "${DEPLOY_SKIP_LOCK:-0}" = "1" ]; then
  echo "WARN: DEPLOY_SKIP_LOCK=1 — lock de deploy omitido"
  return 0 2>/dev/null || exit 0
fi

DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/presupuestos-alfa-deploy.lock}"
mkdir -p "$(dirname "$DEPLOY_LOCK_FILE")"

# FD 9 vive en el proceso de deploy hasta que termina.
exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -n 9; then
  holder=""
  if command -v fuser >/dev/null 2>&1; then
    holder="$(fuser "$DEPLOY_LOCK_FILE" 2>/dev/null | head -5 | tr '\n' ' ' || true)"
  fi
  echo "ERROR: ya hay un deploy de Alfa One en curso." >&2
  echo "       Lock: $DEPLOY_LOCK_FILE" >&2
  if [ -n "$holder" ]; then
    echo "       Procesos con el lock: $holder" >&2
  fi
  echo "       Espere a que termine o mate el deploy rival. NO lance dos ops:deploy a la vez" >&2
  echo "       (distintas sesiones de Cursor / agentes pueden pisarse y dropear módulos)." >&2
  exit 1
fi

echo "OK: lock de deploy adquirido ($DEPLOY_LOCK_FILE)"
# Anotar pid para diagnóstico
printf '%s\n' "pid=$$ started=$(date -u +%Y-%m-%dT%H:%M:%SZ) cwd=$(pwd)" >&9 || true
