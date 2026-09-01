#!/usr/bin/env bash
# Sincroniza cache webpack entre disco persistente y .build-cache/next-cache (contexto Docker).
#
#   pull — antes del build (restaura cache en el checkout)
#   push — después del build (export-next-cache → disco persistente)
#
# Uso:
#   bash scripts/ops/sync-build-cache.sh pull
#   bash scripts/ops/sync-build-cache.sh push
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PERSIST="${ALFAONE_BUILD_CACHE_ROOT:-/mnt/data/projects/alfa-one/build-cache}"
CTX="$ROOT/.build-cache/next-cache"
EXPORT="${ALFAONE_CACHE_EXPORT_DIR:-/tmp/alfaone-next-cache-export}"

cmd="${1:-pull}"

mkdir -p "$PERSIST/next-cache" "$CTX"

case "$cmd" in
  pull)
    if [ -n "$(ls -A "$PERSIST/next-cache" 2>/dev/null || true)" ]; then
      rsync -a --delete "$PERSIST/next-cache/" "$CTX/"
      echo "OK: cache pull $(du -sh "$CTX" | awk '{print $1}') → $CTX"
    else
      echo "OK: sin cache previa en $PERSIST/next-cache (cold build)"
    fi
    ;;
  push)
    if [ ! -d "$EXPORT" ] || [ -z "$(ls -A "$EXPORT" 2>/dev/null || true)" ]; then
      echo "WARN: export vacío ($EXPORT); omito push" >&2
      exit 0
    fi
    rsync -a --delete "$EXPORT/" "$PERSIST/next-cache/"
    echo "OK: cache push $(du -sh "$PERSIST/next-cache" | awk '{print $1}') → $PERSIST/next-cache"
    ;;
  *)
    echo "Uso: $0 pull|push" >&2
    exit 1
    ;;
esac
