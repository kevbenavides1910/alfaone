#!/usr/bin/env bash
# Deploy estricto por GHCR: NUNCA hace build local en el VPS.
# Uso: npm run ops:deploy:ghcr
#      APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:<sha> npm run ops:deploy:ghcr
#
# Si la imagen del SHA aún no está, espera (poll local + GHCR) en lugar de fallar al instante.
# El runner Publish GHCR corre en el mismo daemon Docker → la imagen local
# aparece al terminar el build (antes del push a ghcr.io).
#
# Aborta temprano si `gh` reporta que Publish GHCR falló/canceló para este commit
# (evita esperar el timeout completo cuando el build rompe).
# Si no hay run activo/exitoso, dispara workflow_dispatch una vez (push a veces no dispara).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Auth para `gh` / docker pull (mismo archivo que ops:ghcr-login).
if [ -f /etc/alfa-one/ghcr.env ]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  . /etc/alfa-one/ghcr.env
  set +a
fi
if [ -z "${GH_TOKEN:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  export GH_TOKEN="$GHCR_TOKEN"
fi
if [ -z "${GITHUB_TOKEN:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  export GITHUB_TOKEN="$GHCR_TOKEN"
fi

DEFAULT_IMAGE_REPO="${GHCR_IMAGE_REPO:-ghcr.io/kevbenavides1910/alfaone}"
ALLOW_LATEST="${DEPLOY_GHCR_ALLOW_LATEST:-0}"
# Publish GHCR suele estar listo en ~2–5 min. Default 6 min; override con DEPLOY_GHCR_WAIT_SECONDS.
# 0 = no esperar (comportamiento antiguo).
WAIT_SECS="${DEPLOY_GHCR_WAIT_SECONDS:-360}"
# Poll local rápido (docker image inspect ~0.1s). Manifest remoto es caro (~1.5s).
POLL_SECS="${DEPLOY_GHCR_POLL_SECONDS:-1}"
MANIFEST_EVERY="${DEPLOY_GHCR_MANIFEST_EVERY:-10}"
AUTO_DISPATCH="${DEPLOY_GHCR_AUTO_DISPATCH:-1}"
APP_CONTAINER="${APP_CONTAINER:-security_contracts_app}"

section() {
  echo ""
  echo "== $1 =="
}

die() {
  echo "ERROR: $*" >&2
  echo "Hint: push a main → npm run ops:deploy:ghcr (espera Publish GHCR solo). Login: npm run ops:ghcr-login" >&2
  echo "Build local solo con confirmación explícita del usuario: npm run ops:deploy" >&2
  exit 1
}

# Solo daemon local (rápido). Preferido: runner Publish y deploy comparten Docker.
image_present_local() {
  docker image inspect "$1" >/dev/null 2>&1
}

# Registry remoto (lento). Usar con poca frecuencia.
image_present_remote() {
  docker manifest inspect "$1" >/dev/null 2>&1
}

image_present() {
  local img="$1"
  local allow_remote="${2:-1}"
  if image_present_local "$img"; then
    return 0
  fi
  if [ "$allow_remote" = "1" ] && image_present_remote "$img"; then
    return 0
  fi
  return 1
}

# JSON del run Publish más reciente para este SHA (o vacío).
# Prefiere push/in_progress sobre workflow_dispatch queued (evita ruido en logs).
publish_run_json() {
  local sha="$1"
  command -v gh >/dev/null 2>&1 || return 0
  gh run list --workflow=publish-ghcr.yml --commit "$sha" --limit 5 \
    --json status,conclusion,url,databaseId,event \
    --jq '
      (map(select(.status == "in_progress" or .status == "queued" or .status == "pending" or .status == "waiting" or .status == "requested")) | .[0])
      // (map(select(.conclusion == "success")) | .[0])
      // .[0]
      // empty
    ' 2>/dev/null || true
}

# Devuelve 0 si el workflow Publish GHCR ya terminó en failure/cancelled para este SHA
# y NO hay otro run queued/in_progress más reciente (limit 1 ya es el más reciente).
publish_ghcr_failed() {
  local sha="$1"
  local json conclusion url
  json="$(publish_run_json "$sha")"
  [ -n "$json" ] || return 1
  conclusion="$(printf '%s' "$json" | jq -r 'select(.status == "completed") | .conclusion // empty' 2>/dev/null || true)"
  case "$conclusion" in
    failure|cancelled|timed_out)
      url="$(printf '%s' "$json" | jq -r '.url // empty' 2>/dev/null || true)"
      echo "Publish GHCR terminó en ${conclusion}${url:+ — $url}" >&2
      return 0
      ;;
  esac
  return 1
}

# Estado legible del Publish para logs de espera.
publish_status_line() {
  local sha="$1"
  local json status conclusion url event
  json="$(publish_run_json "$sha")"
  if [ -z "$json" ]; then
    echo "sin run Publish GHCR"
    return
  fi
  status="$(printf '%s' "$json" | jq -r '.status // "?"' 2>/dev/null || echo '?')"
  conclusion="$(printf '%s' "$json" | jq -r '.conclusion // empty' 2>/dev/null || true)"
  url="$(printf '%s' "$json" | jq -r '.url // empty' 2>/dev/null || true)"
  event="$(printf '%s' "$json" | jq -r '.event // empty' 2>/dev/null || true)"
  if [ -n "$conclusion" ]; then
    echo "Publish=${status}/${conclusion} event=${event}${url:+ — $url}"
  else
    echo "Publish=${status} event=${event}${url:+ — $url}"
  fi
}

# Si no hay run activo ni success para el SHA, dispara workflow_dispatch una vez.
ensure_publish_triggered() {
  local sha="$1"
  local short="$2"
  [ "$AUTO_DISPATCH" = "1" ] || [ "$AUTO_DISPATCH" = "true" ] || return 0
  command -v gh >/dev/null 2>&1 || {
    echo "WARN: gh no disponible; no se puede auto-disparar Publish GHCR." >&2
    return 0
  }
  [ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ] || {
    echo "WARN: sin GH_TOKEN/GHCR_TOKEN; no se auto-dispara Publish (cargue /etc/alfa-one/ghcr.env)." >&2
    return 0
  }

  # Tras un push fresco, Actions tarda unos segundos en registrar el run.
  # Esperar evita un workflow_dispatch duplicado que se encola detrás del push.
  local json status conclusion attempt
  for attempt in 1 2 3 4 5; do
    json="$(publish_run_json "$sha")"
    if [ -n "$json" ]; then
      status="$(printf '%s' "$json" | jq -r '.status // empty' 2>/dev/null || true)"
      conclusion="$(printf '%s' "$json" | jq -r '.conclusion // empty' 2>/dev/null || true)"
      case "$status" in
        queued|in_progress|waiting|requested|pending)
          echo "Publish ya en curso ($status) — no se re-dispara."
          return 0
          ;;
      esac
      if [ "$status" = "completed" ] && [ "$conclusion" = "success" ]; then
        echo "Publish ya success para $short."
        return 0
      fi
      # completed failure/cancelled → caer al dispatch abajo
      break
    fi
    echo "Esperando registro del run Publish en Actions (${attempt}/5)…"
    sleep 2
  done

  section "Auto-disparo Publish GHCR (no hay run usable para $short)"
  if gh workflow run publish-ghcr.yml --ref "$(git rev-parse --abbrev-ref HEAD)" 2>&1; then
    echo "OK: workflow_dispatch enviado. Esperando imagen…"
    # Dar tiempo a que aparezca el run en la API.
    sleep 3
  else
    echo "WARN: no se pudo disparar Publish GHCR (API Actions a veces 502). Se sigue esperando imagen." >&2
  fi
}

resolve_candidate() {
  local allow_remote="$1"
  local img
  for img in "${CANDIDATES[@]}"; do
    if image_present "$img" "$allow_remote"; then
      RESOLVED="$img"
      echo "OK: $img"
      return 0
    fi
  done
  return 1
}

# Si la app ya corre esta imagen y está healthy, no redeploy ni espera.
app_already_on_image() {
  local img="$1"
  [ -n "$img" ] || return 1
  docker inspect "$APP_CONTAINER" >/dev/null 2>&1 || return 1
  local current
  current="$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || true)"
  [ "$current" = "$img" ] || return 1
  local health
  health="$(docker inspect "$APP_CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' 2>/dev/null || true)"
  case "$health" in
    healthy|no-healthcheck) return 0 ;;
    *) return 1 ;;
  esac
}

finish_if_already_deployed() {
  local img="$1"
  if app_already_on_image "$img"; then
    section "Ya desplegado"
    echo "OK: $APP_CONTAINER ya usa $img (healthy) — omito pull/recreate."
    echo "Tip: Publish GHCR en push ya despliega automático; no hace falta ops:deploy:ghcr manual."
    echo "deploy_path=${DEPLOY_PATH_LABEL:-already}"
    echo "elapsed_build=0"
    echo "elapsed_recreate=0"
    echo "cache_hit=1"
    echo "elapsed=0s"
    exit 0
  fi
}

section "Deploy GHCR-only (sin build local)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "no es un repo git"
fi

DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  echo "Árbol sucio (muestra):"
  echo "$DIRTY" | head -20
  die "hay cambios locales sin commit. Commit + push a main antes de desplegar por GHCR."
fi

SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Aviso si no está en main (sigue permitido si la imagen del SHA existe)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
  echo "WARN: rama actual=$BRANCH (lo normal es main tras push)."
fi

# ¿Está el SHA en remoto?
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  AHEAD="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
  if [ "${AHEAD:-0}" -gt 0 ]; then
    die "HEAD está $AHEAD commit(s) por delante del remoto. Haz git push antes del pull GHCR."
  fi
fi

RESOLVED="${APP_IMAGE:-}"
CANDIDATES=()
if [ -n "$RESOLVED" ]; then
  finish_if_already_deployed "$RESOLVED"
fi
if [ -z "$RESOLVED" ]; then
  CANDIDATES=(
    "${DEFAULT_IMAGE_REPO}:${SHA}"
    "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}"
    "${DEFAULT_IMAGE_REPO}:sha-${SHORT_SHA}"
  )
  if [ "$ALLOW_LATEST" = "1" ] || [ "$ALLOW_LATEST" = "true" ]; then
    CANDIDATES+=("${DEFAULT_IMAGE_REPO}:latest")
  fi

  # Publish GHCR suele haber desplegado ya en push — salida instantánea si coincide SHA.
  for img in "${CANDIDATES[@]}"; do
    finish_if_already_deployed "$img"
  done

  # Agente Cursor (self-hosted): build local de inmediato, sin esperar Actions.
  if [ "${DEPLOY_CURSOR_FAST:-0}" = "1" ] || [ "${DEPLOY_CURSOR_FAST:-0}" = "true" ]; then
    if ! image_present_local "${DEFAULT_IMAGE_REPO}:${SHA}"; then
      section "Cursor fast: build local (sin esperar Publish GHCR)"
      BUILD_LOG="$(mktemp)"
      bash "$ROOT/scripts/ops/build-ghcr-image-local.sh" | tee "$BUILD_LOG"
      export ELAPSED_BUILD="$(grep -E '^elapsed_build=' "$BUILD_LOG" | tail -1 | cut -d= -f2 || echo 0)"
      export CACHE_HIT="$(grep -E '^cache_hit=' "$BUILD_LOG" | tail -1 | cut -d= -f2 || echo 0)"
      rm -f "$BUILD_LOG"
    else
      echo "OK: imagen local ya presente para $SHORT_SHA"
      export ELAPSED_BUILD=0
      export CACHE_HIT=1
    fi
    RESOLVED="${DEFAULT_IMAGE_REPO}:${SHA}"
    export DEPLOY_PATH_LABEL="${DEPLOY_PATH_LABEL:-cursor}"
  fi

  if [ -z "${RESOLVED:-}" ]; then
  # Disparar Publish si push no lo hizo (o el run previo fue cancelado/zombie).
  if ! image_present_local "${DEFAULT_IMAGE_REPO}:${SHA}" \
    && ! image_present_local "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" \
    && ! image_present_local "${DEFAULT_IMAGE_REPO}:sha-${SHORT_SHA}"; then
    ensure_publish_triggered "$SHA" "$SHORT_SHA"
  fi

  section "Buscando imagen para ${SHORT_SHA} (espera hasta ${WAIT_SECS}s; poll local ${POLL_SECS}s)"
  START_TS="$(date +%s)"
  POLL_N=0
  while true; do
    # Remoto solo cada N polls o cuando el publish ya terminó OK (ahorra ~1.5s×3 por ciclo).
    ALLOW_REMOTE=0
    POLL_N=$((POLL_N + 1))
    if [ $((POLL_N % MANIFEST_EVERY)) -eq 0 ]; then
      ALLOW_REMOTE=1
    else
      json="$(publish_run_json "$SHA")"
      if [ -n "$json" ]; then
        st="$(printf '%s' "$json" | jq -r '.status // empty' 2>/dev/null || true)"
        cj="$(printf '%s' "$json" | jq -r '.conclusion // empty' 2>/dev/null || true)"
        if [ "$st" = "completed" ] && [ "$cj" = "success" ]; then
          ALLOW_REMOTE=1
        fi
      fi
    fi

    if resolve_candidate "$ALLOW_REMOTE"; then
      break
    fi

    if publish_ghcr_failed "$SHA"; then
      # Un cancel/zombie previo no debe tumbar el deploy: un re-dispatch y seguir esperando.
      if [ "${_DEPLOY_GHCR_REDISPATCHED:-0}" != "1" ] \
        && { [ "$AUTO_DISPATCH" = "1" ] || [ "$AUTO_DISPATCH" = "true" ]; }; then
        _DEPLOY_GHCR_REDISPATCHED=1
        echo "Reintentando Publish tras fallo/cancel del run anterior…"
        if gh workflow run publish-ghcr.yml --ref "$BRANCH" 2>&1; then
          sleep 3
          continue
        fi
      fi
      die "Publish GHCR fallo para $SHORT_SHA; no se espera mas la imagen."
    fi

    NOW="$(date +%s)"
    ELAPSED=$((NOW - START_TS))
    if [ "$WAIT_SECS" -le 0 ] || [ "$ELAPSED" -ge "$WAIT_SECS" ]; then
      break
    fi
    REMAIN=$((WAIT_SECS - ELAPSED))
    echo "... imagen aun no lista (${ELAPSED}s). $(publish_status_line "$SHA") - reintento en ${POLL_SECS}s (queda ~${REMAIN}s)"
    sleep "$POLL_SECS"
  done
  fi
fi

if [ -z "${RESOLVED:-}" ]; then
  status_extra="$(publish_status_line "$SHA")"
  die "no hay imagen GHCR/local para $SHORT_SHA ni APP_IMAGE. Revise workflow Publish GHCR. ${status_extra}"
fi

finish_if_already_deployed "$RESOLVED"

section "Pull + recreate: $RESOLVED"
export APP_IMAGE="$RESOLVED"
export DEPLOY_SKIP_DB_BACKUP="${DEPLOY_SKIP_DB_BACKUP:-0}"
export DEPLOY_FAST_SMOKE="${DEPLOY_FAST_SMOKE:-0}"
exec bash "$ROOT/scripts/deploy-from-image.sh"
