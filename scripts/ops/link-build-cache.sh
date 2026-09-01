#!/usr/bin/env bash
# Enlaza .build-cache/next-cache al almacenamiento persistente (pull incluido).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
bash "$ROOT/scripts/ops/sync-build-cache.sh" pull
