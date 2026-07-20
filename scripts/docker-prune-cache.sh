#!/usr/bin/env bash
# Libera caché de build Docker antigua y recorta tags de rollback viejos.
set -euo pipefail

KEEP_ROLLBACK="${KEEP_ROLLBACK_TAGS:-5}"

echo "=== Antes ==="
docker system df 2>/dev/null || true

echo "=== Prune builder cache (>7d) ==="
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
