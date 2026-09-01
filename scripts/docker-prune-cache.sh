#!/usr/bin/env bash
# Libera caché de build Docker antigua y recorta tags de rollback viejos.
# NO toca ALFAONE_BUILD_CACHE_ROOT (cache Next.js/webpack en host).
set -euo pipefail

KEEP_ROLLBACK="${KEEP_ROLLBACK_TAGS:-5}"
HOST_CACHE="${ALFAONE_BUILD_CACHE_ROOT:-/mnt/data/projects/alfa-one/build-cache}"

echo "=== Antes ==="
docker system df 2>/dev/null || true
if [ -d "$HOST_CACHE" ]; then
  echo "Host build cache (preservado): $(du -sh "$HOST_CACHE" 2>/dev/null | awk '{print $1}') at $HOST_CACHE"
fi

echo "=== Prune builder cache (>7d) — NO afecta $HOST_CACHE ==="
docker builder prune -af --filter 'until=168h' 2>/dev/null || docker builder prune -af

echo "=== Recortar alfa-one-app-rollback:* (mantener últimas ${KEEP_ROLLBACK}) ==="
# Orden: más reciente primero. Conservar N; borrar el resto (dangling tags pueden
# seguir referenciando las mismas capas si la imagen activa las usa).
mapfile -t ROLLBACKS < <(docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' \
  | awk '$1 ~ /^alfa-one-app-rollback:/ {print $0}' \
  | sort -k2,3r \
  | awk '{print $1}')

if [ "${#ROLLBACKS[@]}" -gt "$KEEP_ROLLBACK" ]; then
  TO_DELETE=("${ROLLBACKS[@]:$KEEP_ROLLBACK}")
  echo "Eliminando ${#TO_DELETE[@]} tags de rollback..."
  for tag in "${TO_DELETE[@]}"; do
    docker rmi "$tag" 2>/dev/null || true
  done
else
  echo "Solo ${#ROLLBACKS[@]} rollback(s); nada que borrar (keep=$KEEP_ROLLBACK)."
fi

echo "=== Después ==="
docker system df 2>/dev/null || true
