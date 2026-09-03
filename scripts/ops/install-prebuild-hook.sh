#!/usr/bin/env bash
# Configura core.hooksPath=.githooks para prebuild post-commit.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

chmod +x "$ROOT/.githooks/post-commit" "$ROOT/scripts/ops/prebuild-image-sha.sh" 2>/dev/null || true

git config core.hooksPath .githooks
echo "OK: core.hooksPath=.githooks"
echo "     post-commit → prebuild imagen SHA en background"
echo "     Desactivar: ALFAONE_PREBUILD=0  o  git config --unset core.hooksPath"
echo "     Manual:     npm run ops:prebuild"
echo "     Background: npm run ops:prebuild -- --bg"
