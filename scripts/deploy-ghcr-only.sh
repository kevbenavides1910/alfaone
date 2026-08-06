#!/usr/bin/env bash
# Deploy estricto por GHCR: NUNCA hace build local en el VPS.
# Uso: npm run ops:deploy:ghcr
#      APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:<sha> npm run ops:deploy:ghcr
#
# Si la imagen del SHA aún no está, espera (poll local + GHCR) en lugar de fallar al instante.
# El runner Publish GHCR corre en el mismo daemon Docker → a menudo la imagen local
# aparece antes de que el push a ghcr.io termine.
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
POLL_SECS="${DEPLOY_GHCR_POLL_SECONDS:-5}"
AUTO_DISPATCH="${DEPLOY_GHCR_AUTO_DISPATCH:-1}"

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

image_present() {
  local img="$1"
  # Mismo host que el self-hosted runner: la imagen local basta (no esperar push).
  if docker image inspect "$img" >/dev/null 2>&1; then
    return 0
  fi
  if docker manifest inspect "$img" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# JSON del run Publish más reciente para este SHA (o vacío).
publish_run_json() {
  local sha="$1"
  command -v gh >/dev/null 2>&1 || return 0
  gh run list --workflow=publish-ghcr.yml --commit "$sha" --limit 1 \
    --json status,conclusion,url,databaseId,event \
    --jq '.[0] // empty' 2>/dev/null || true
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

  local json status conclusion
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
  fi

  section "Auto-disparo Publish GHCR (no hay run usable para $short)"
  if gh workflow run publish-ghcr.yml --ref "$(git rev-parse --abbrev-ref HEAD)" 2>&1; then
    echo "OK: workflow_dispatch enviado. Esperando imagen…"
    # Dar tiempo a que aparezca el run en la API.
    sleep 3
  else
    echo "WARN: no se pudo disparar Publish GHCR (API Actions a veces 502). Se sigue esperando imagen." >&2
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
if [ -z "$RESOLVED" ]; then
  CANDIDATES=(
    "${DEFAULT_IMAGE_REPO}:${SHA}"
    "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}"
    "${DEFAULT_IMAGE_REPO}:sha-${SHORT_SHA}"
  )
  if [ "$ALLOW_LATEST" = "1" ] || [ "$ALLOW_LATEST" = "true" ]; then
    CANDIDATES+=("${DEFAULT_IMAGE_REPO}:latest")
  fi

  # Disparar Publish si push no lo hizo (o el run previo fue cancelado/zombie).
  if ! image_present "${DEFAULT_IMAGE_REPO}:${SHA}" \
    && ! image_present "${DEFAULT_IMAGE_REPO}:${SHORT_SHA}" \
    && ! image_present "${DEFAULT_IMAGE_REPO}:sha-${SHORT_SHA}"; then
    ensure_publish_triggered "$SHA" "$SHORT_SHA"
  fi

  section "Buscando imagen para ${SHORT_SHA} (espera hasta ${WAIT_SECS}s)"
  START_TS="$(date +%s)"
  while true; do
    for img in "${CANDIDATES[@]}"; do
      if image_present "$img"; then
        RESOLVED="$img"
        echo "OK: $img"
        break 2
      fi
    done

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
      die "Publish GHCR falló para $SHORT_SHA; no se espera más la imagen."
    fi

    NOW="$(date +%s)"
    ELAPSED=$((NOW - START_TS))
    if [ "$WAIT_SECS" -le 0 ] || [ "$ELAPSED" -ge "$WAIT_SECS" ]; then
      break
    fi
    REMAIN=$((WAIT_SECS - ELAPSED))
    echo "… imagen aún no lista (${ELAPSED}s). $(publish_status_line "$SHA") — reintento en ${POLL_SECS}s (queda ~${REMAIN}s)"
    sleep "$POLL_SECS"
  done
fi

if [ -z "$RESOLVED" ]; then
  die "no hay imagen GHCR/local para $SHORT_SHA (ni APP_IMAGE). Revise workflow Publish GHCR. $(publish_status_line "$SHA")"
fi

section "Pull + recreate: $RESOLVED"
export APP_IMAGE="$RESOLVED"
exec bash "$ROOT/scripts/deploy-from-image.sh"
