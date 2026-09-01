#!/usr/bin/env bash
# Despliega una imagen YA construida (GHCR / registry) sin compilar en el VPS.
# Flujo típico: CI publica ghcr.io/<org>/alfaone:<sha|latest> → este script hace pull + recreate.
#
# Uso:
#   APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:latest npm run ops:deploy:pull
#   APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:abc1234 bash scripts/deploy-from-image.sh
#
# Requiere: docker login a ghcr.io (una vez) con un PAT que lea packages.
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
LOG_FILE="$LOG_DIR/deploy-pull-$DEPLOY_ID.log"
ROLLBACK_TAG="alfa-one-app-rollback:$DEPLOY_ID"
PREVIOUS_IMAGE=""
SERVICE_IMAGE=""
START_EPOCH="$(date +%s)"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

DEFAULT_IMAGE="ghcr.io/kevbenavides1910/alfaone:latest"
export APP_IMAGE="${APP_IMAGE:-$DEFAULT_IMAGE}"

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

section "Objetivo: pull de imagen preconstruida (sin build en VPS)"
echo "deploy_id=$DEPLOY_ID"
echo "log=$LOG_FILE"
echo "APP_IMAGE=$APP_IMAGE"
echo "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"

# Contexto canónico (path/worktree). Anti-drop de fuentes no aplica a pull de imagen remota;
# el smoke post-recreate sí valida módulos en el contenedor nuevo.
section "Preflight: contexto de deploy"
DEPLOY_SKIP_ANTI_DROP=1 bash "$ROOT/scripts/ops/deploy-context-preflight.sh" "$ROOT"

if [ ! -f "$ROOT/.env.production" ]; then
  echo "ERROR: falta .env.production" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env.production"
set +a
# APP_IMAGE del entorno/CLI tiene prioridad sobre .env.production
export APP_IMAGE="${APP_IMAGE:-$DEFAULT_IMAGE}"

section "Preflight: protección de base de datos"
bash "$ROOT/scripts/db-safety-preflight.sh"

if docker inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  PREVIOUS_IMAGE="$(docker inspect "$APP_CONTAINER" --format '{{.Image}}')"
  SERVICE_IMAGE="$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')"
  # Si el Image ID quedó huérfano (prune), usar el tag Config.Image si existe.
  if ! docker image inspect "$PREVIOUS_IMAGE" >/dev/null 2>&1; then
    echo "WARN: Image ID actual no inspectable ($PREVIOUS_IMAGE); intento tag $SERVICE_IMAGE"
    if docker image inspect "$SERVICE_IMAGE" >/dev/null 2>&1; then
      PREVIOUS_IMAGE="$SERVICE_IMAGE"
    else
      echo "WARN: sin imagen previa etiquetable — deploy sin rollback tag"
      PREVIOUS_IMAGE=""
    fi
  fi
  if [ -n "$PREVIOUS_IMAGE" ]; then
    docker tag "$PREVIOUS_IMAGE" "$ROLLBACK_TAG"
    echo "rollback_tag=$ROLLBACK_TAG previous=$SERVICE_IMAGE"
  fi
fi

section "Respaldo PostgreSQL (security_contracts)"
BACKUP_DIR="${BACKUP_DIR:-/mnt/data/backups/postgres}"
# Evita dump en cada redeploy caliente: reutiliza backup reciente (default 30 min).
# Forzar: DEPLOY_FORCE_DB_BACKUP=1. Saltar: DEPLOY_SKIP_DB_BACKUP=1.
SKIP_BACKUP="${DEPLOY_SKIP_DB_BACKUP:-0}"
FORCE_BACKUP="${DEPLOY_FORCE_DB_BACKUP:-0}"
MAX_AGE_MIN="${DEPLOY_DB_BACKUP_MAX_AGE_MIN:-60}"
if [ "$SKIP_BACKUP" = "1" ] || [ "$SKIP_BACKUP" = "true" ]; then
  echo "SKIP backup (DEPLOY_SKIP_DB_BACKUP=1)"
elif [ "$FORCE_BACKUP" != "1" ] && [ "$FORCE_BACKUP" != "true" ]; then
  LATEST="$(ls -1t "$BACKUP_DIR"/security_contracts_*.sql.gz 2>/dev/null | head -1 || true)"
  if [ -n "$LATEST" ]; then
    AGE_SEC=$(( $(date +%s) - $(stat -c %Y "$LATEST") ))
    MAX_AGE_SEC=$((MAX_AGE_MIN * 60))
    if [ "$AGE_SEC" -lt "$MAX_AGE_SEC" ]; then
      echo "SKIP backup: reciente $LATEST (hace ${AGE_SEC}s < ${MAX_AGE_MIN}m)"
      SKIP_BACKUP=1
    fi
  fi
fi
if [ "$SKIP_BACKUP" != "1" ] && [ "$SKIP_BACKUP" != "true" ]; then
  # gzip -1 en deploy (~3s); el cron diario puede usar GZIP_LEVEL=9.
  GZIP_LEVEL="${GZIP_LEVEL:-1}" POSTGRES_DB=security_contracts bash "$ROOT/scripts/postgres-backup.sh"
fi

section "Pull imagen"
# Si la imagen ya está local (Publish en el mismo daemon), no esperar a GHCR.
if docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  echo "OK: imagen local presente — omito docker pull ($APP_IMAGE)"
else
  docker pull "$APP_IMAGE"
fi

section "Recrear SOLO app (sin build)"
"${COMPOSE[@]}" up -d --no-build --no-deps --force-recreate --pull never "$APP_SERVICE"

section "Esperando arranque"
wait_for_container_health

section "Verificación"
docker inspect "$APP_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^DATABASE_URL='
echo "DATABASE_URL:present"
http_check "session" "/api/auth/session"
http_check "login" "/login"
# Baseline = imagen previa etiquetada como rollback; exige 0 drops de rutas.
if [ -n "$ROLLBACK_TAG" ] && docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1; then
  export DEPLOY_BASELINE_IMAGE="$ROLLBACK_TAG"
  bash "$ROOT/scripts/ops/deploy-module-smoke.sh" "$APP_CONTAINER" "$ROLLBACK_TAG"
else
  echo "WARN: sin rollback tag — smoke solo valida anclas/deps"
  bash "$ROOT/scripts/ops/deploy-module-smoke.sh" "$APP_CONTAINER"
fi
"${COMPOSE[@]}" ps

section "DEPLOY OK (pull)"
echo "elapsed=$(elapsed)"
echo "image=$APP_IMAGE"
echo "log=$LOG_FILE"
echo "PostgreSQL intacto — solo se recreó el contenedor app"
