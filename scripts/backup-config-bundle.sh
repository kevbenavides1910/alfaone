#!/usr/bin/env bash
# Empaqueta configs, Docker, n8n, crontabs → config_${FECHA}.tar.gz
# Uso: backup-config-bundle.sh [FECHA_RESP]
# Imprime la ruta del .tar.gz creado en stdout.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FECHA_RESP="${1:-$(date +%Y%m%d_%H%M)}"
N8N_CONTAINER="${N8N_CONTAINER:-n8n}"
N8N_HOME="${N8N_HOME:-/home/soporte-ti/n8n}"
ETC_ALFA_ONE="${ETC_ALFA_ONE:-/etc/alfa-one}"

STAGING="$(mktemp -d "/tmp/alfa-one-config-${FECHA_RESP}.XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT

mkdir -p "$STAGING/crontabs" "$STAGING/n8n/workflows"

{
  echo "host=$(hostname -f 2>/dev/null || hostname)"
  echo "created=$(date -Is)"
  echo "project=$ROOT"
  echo "fecha=$FECHA_RESP"
} > "$STAGING/manifest.txt"

if [ -d "$ETC_ALFA_ONE" ]; then
  cp -a "$ETC_ALFA_ONE" "$STAGING/etc-alfa-one"
fi

mkdir -p "$STAGING/project"
for f in .env .env.production; do
  [ -f "$ROOT/$f" ] && cp -a "$ROOT/$f" "$STAGING/project/$f"
done
for f in docker-compose.yml docker-compose.prod.yml Dockerfile .dockerignore; do
  [ -f "$ROOT/$f" ] && cp -a "$ROOT/$f" "$STAGING/project/$f"
done
if [ -d "$ROOT/deploy/nginx" ]; then
  cp -a "$ROOT/deploy/nginx" "$STAGING/project/deploy-nginx"
fi

if [ -f "$N8N_HOME/docker-compose.yml" ]; then
  cp -a "$N8N_HOME/docker-compose.yml" "$STAGING/n8n/docker-compose.yml"
fi

if docker ps --format '{{.Names}}' | grep -qx "$N8N_CONTAINER"; then
  docker exec "$N8N_CONTAINER" rm -rf /tmp/n8n-export-"$FECHA_RESP" 2>/dev/null || true
  docker exec "$N8N_CONTAINER" n8n export:workflow --backup --output="/tmp/n8n-export-${FECHA_RESP}" >&2
  docker cp "${N8N_CONTAINER}:/tmp/n8n-export-${FECHA_RESP}/." "$STAGING/n8n/workflows/"
  docker exec "$N8N_CONTAINER" rm -rf "/tmp/n8n-export-${FECHA_RESP}" 2>/dev/null || true
else
  echo "WARN: contenedor $N8N_CONTAINER no activo; sin export n8n" >> "$STAGING/manifest.txt"
fi

crontab -l > "$STAGING/crontabs/soporte-ti.crontab" 2>/dev/null || true
if crontab -l -u root > "$STAGING/crontabs/root.crontab" 2>/dev/null; then
  :
elif sudo crontab -l -u root > "$STAGING/crontabs/root.crontab" 2>/dev/null; then
  :
else
  echo "(no acceso root crontab)" > "$STAGING/crontabs/root.crontab"
fi
for f in /etc/cron.d/alfa-one /etc/cron.d/*alfa* /etc/cron.d/*n8n*; do
  [ -f "$f" ] && cp -a "$f" "$STAGING/crontabs/$(basename "$f")"
done

OUT="/tmp/config_${FECHA_RESP}.tar.gz"
tar -czf "$OUT" -C "$STAGING" .
echo "$OUT"
