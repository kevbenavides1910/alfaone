#!/usr/bin/env bash
# Libera caché de build Docker antigua (no elimina imágenes en uso).
set -euo pipefail

echo "=== Antes ==="
docker system df 2>/dev/null || true

docker builder prune -af --filter 'until=168h' 2>/dev/null || docker builder prune -af

echo "=== Después ==="
docker system df 2>/dev/null || true
