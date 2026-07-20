#!/usr/bin/env bash
# Despliega Alfa One: backup BD + build + reinicia SOLO la app (no toca PostgreSQL).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Lock ANTES de tee/logs: dos deploys simultáneos se pisan (incidente jul-2026).
# shellcheck disable=SC1091
source "$ROOT/scripts/ops/acquire-deploy-lock.sh"

export DB_CONTAINER="${DB_CONTAINER:-security_contracts_db}"
export COMPOSE_PROJECT_NAME=presupuestos-alfa

APP_CONTAINER="${APP_CONTAINER:-security_contracts_app}"
APP_SERVICE="${APP_SERVICE:-app}"
APP_URL_BASE="${APP_URL_BASE:-http://127.0.0.1:3000}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DEPLOY_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="${DEPLOY_LOG_DIR:-$ROOT/.deploy-logs}"
LOG_FILE="$LOG_DIR/deploy-$DEPLOY_ID.log"
ROLLBACK_TAG="alfa-one-app-rollback:$DEPLOY_ID"
PREVIOUS_IMAGE=""
SERVICE_IMAGE=""
START_EPOCH="$(date +%s)"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "OK: lock de deploy activo (pid=$$ file=${DEPLOY_LOCK_FILE:-/tmp/presupuestos-alfa-deploy.lock})"

section() {
  echo ""
  echo "== $1 =="
}

elapsed() {
  echo "$(( $(date +%s) - START_EPOCH ))s"
}

capture_app_logs() {
  section "Últimos logs de $APP_CONTAINER"
  docker logs --tail "${DEPLOY_LOG_LINES:-120}" "$APP_CONTAINER" 2>&1 || true
}

rollback_app() {
  if [ -z "$PREVIOUS_IMAGE" ] || [ -z "$SERVICE_IMAGE" ]; then
    echo "Rollback omitido: no había imagen anterior etiquetada."
    return
  fi

  section "Rollback a imagen anterior"
  docker tag "$ROLLBACK_TAG" "$SERVICE_IMAGE"
  "${COMPOSE[@]}" up -d --no-build --no-deps --force-recreate "$APP_SERVICE"
  wait_for_container_health || true
}

on_error() {
  local exit_code=$?
  section "DEPLOY FAILED"
  echo "exit_code=$exit_code elapsed=$(elapsed) log=$LOG_FILE"
  capture_app_logs
  rollback_app
  exit "$exit_code"
}
trap on_error ERR

http_check() {
  local label="$1"
  local path="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$APP_URL_BASE$path")"
  echo "$label:$code"
  case "$code" in
    2*|3*) return 0 ;;
    *) return 1 ;;
  esac
}

wait_for_container_health() {
  local status
  for _ in $(seq 1 30); do
    status="$(docker inspect "$APP_CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}')"
    echo "health:$status"
    case "$status" in
      healthy|no-healthcheck) return 0 ;;
      unhealthy) return 1 ;;
    esac
    sleep 5
  done
  return 1
}

section "Objetivo: desplegar código sin perder información de la BD"
echo "deploy_id=$DEPLOY_ID"
echo "log=$LOG_FILE"
echo "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "git_sha=$(git rev-parse --short HEAD)"
  if [ -n "$(git status --porcelain)" ]; then
    echo "WARN: árbol git con cambios locales; se desplegará el estado actual del directorio."
  fi
fi

# Contexto/módulos: NUNCA se salta con DEPLOY_SKIP_CHECKS
section "Preflight: contexto y anti-drop de módulos"
bash "$ROOT/scripts/ops/deploy-context-preflight.sh" "$ROOT"

section "Preflight: UI vs stash (no pisar mejoras de otros agentes)"
bash "$ROOT/scripts/ops/deploy-ui-stash-guard.sh" "$ROOT"

section "Preflight: protección de base de datos"
bash "$ROOT/scripts/db-safety-preflight.sh"

if [ ! -f "$ROOT/.env.production" ]; then
  echo "ERROR: falta .env.production" >&2
  exit 1
fi

# Docker Compose interpola ${DATABASE_URL} desde el entorno del shell.
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.production"
set +a

# Typecheck en host es opt-in: Next ya valida tipos en el build de la imagen.
# Anti-drop / preflight de contexto SIEMPRE corren arriba.
if [ "${DEPLOY_FULL_CHECKS:-0}" = "1" ]; then
  section "Precheck de código (DEPLOY_FULL_CHECKS=1)"
  npm run deploy:check
elif [ "${DEPLOY_SKIP_CHECKS:-1}" = "1" ]; then
  section "Precheck de código omitido"
  echo "default rápido: sin tsc en host (DEPLOY_FULL_CHECKS=1 para forzar)"
else
  # Compat: DEPLOY_SKIP_CHECKS=0 todavía ejecuta el check
  section "Precheck de código"
  npm run deploy:check
fi

if docker inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  PREVIOUS_IMAGE="$(docker inspect "$APP_CONTAINER" --format '{{.Image}}')"
  SERVICE_IMAGE="$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')"
  docker tag "$PREVIOUS_IMAGE" "$ROLLBACK_TAG"
  echo "rollback_tag=$ROLLBACK_TAG service_image=$SERVICE_IMAGE"
fi

section "Respaldo PostgreSQL (security_contracts)"
POSTGRES_DB=security_contracts bash "$ROOT/scripts/postgres-backup.sh"

section "Build y reiniciar SOLO app (postgres sin recrear)"
export APP_IMAGE="${APP_IMAGE_LOCAL:-presupuestos-alfa-app:latest}"
"${COMPOSE[@]}" up -d --build --no-deps --force-recreate "$APP_SERVICE"

section "Esperando arranque"
wait_for_container_health

section "Verificación"
docker inspect "$APP_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^DATABASE_URL='
echo "DATABASE_URL:present"
http_check "session" "/api/auth/session"
http_check "login" "/login"
# Baseline = imagen etiquetada ANTES del recreate; smoke exige 0 drops de rutas.
export DEPLOY_BASELINE_IMAGE="${ROLLBACK_TAG}"
bash "$ROOT/scripts/ops/deploy-module-smoke.sh" "$APP_CONTAINER" "$ROLLBACK_TAG"
"${COMPOSE[@]}" ps

section "DEPLOY OK"
echo "elapsed=$(elapsed)"
echo "log=$LOG_FILE"
echo "PostgreSQL intacto en volumen presupuestos-alfa_postgres_data / BD security_contracts"
echo "Tip: preferir npm run ops:deploy:auto o ops:deploy:pull (GHCR) cuando el SHA esté publicado"
