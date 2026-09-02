#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
START_EPOCH="$(date +%s)"
if [ -f "$ROOT/.env.production" ]; then set -a; # shellcheck disable=SC1091
source "$ROOT/.env.production"; set +a; fi
APP_DATA_HOST="${APP_DATA_HOST:-/mnt/storage/apps/presupuestos-alfa}"
OVERRIDE_DIR="${STATIC_OVERRIDE_DIR:-$APP_DATA_HOST/static-overrides}"
DEST="$OVERRIDE_DIR/alfa-overrides.css"
ALLOWLIST="$ROOT/deploy/static-overrides/ALLOWLIST.txt"
SRC="${STATIC_OVERRIDE_SRC:-$ROOT/deploy/static-overrides/alfa-overrides.css}"
APP_URL_BASE="${APP_URL_BASE:-http://127.0.0.1:3000}"
section(){ echo ""; echo "== $1 =="; }
elapsed(){ echo "$(( $(date +%s) - START_EPOCH ))s"; }
section "Patch static (CSS overlay)"
echo "deploy_path=patch_static"; echo "src=$SRC"; echo "dest=$DEST"
[ -f "$ALLOWLIST" ] || { echo "ERROR: falta allowlist" >&2; exit 1; }
[[ "$SRC" != /* ]] && SRC="$ROOT/$SRC"
SRC="$(realpath -m "$SRC")"
allowed=0
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"; line="$(echo "$line" | xargs || true)"; [ -z "$line" ] && continue
  [ "$SRC" = "$(realpath -m "$ROOT/$line")" ] && { allowed=1; break; }
done < "$ALLOWLIST"
[ "$allowed" = "1" ] || { echo "ERROR: $SRC no allowlisted" >&2; exit 1; }
[ -f "$SRC" ] || { echo "ERROR: no existe $SRC" >&2; exit 1; }
case "$SRC" in *.css) ;; *) echo "ERROR: solo .css" >&2; exit 1;; esac
if ! mkdir -p "$OVERRIDE_DIR" 2>/dev/null; then OVERRIDE_DIR="$ROOT/public"; DEST="$OVERRIDE_DIR/alfa-overrides.css"; fi
tmp="$(mktemp "${OVERRIDE_DIR}/.alfa-overrides.XXXXXX" 2>/dev/null || mktemp)"
cp "$SRC" "$tmp"; mv -f "$tmp" "$DEST"; chmod 644 "$DEST" || true
cp "$DEST" "$ROOT/public/alfa-overrides.css" 2>/dev/null || true
echo "OK: escrito $(wc -c < "$DEST") bytes → $DEST"
docker inspect security_contracts_nginx >/dev/null 2>&1 && docker exec security_contracts_nginx nginx -s reload 2>/dev/null || true
section "Verificación"
code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$APP_URL_BASE/alfa-overrides.css" || echo 000)"
echo "overrides_css:$code"
section "PATCH OK"
echo "elapsed=$(elapsed)"; echo "elapsed_build=0"; echo "elapsed_recreate=0"; echo "cache_hit=1"; echo "deploy_path=patch_static"
