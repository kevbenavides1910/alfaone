#!/usr/bin/env bash
# Instala scripts SICOP en el host (n8n /scripts) desde el repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="${SICOP_HOST_DIR:-/home/soporte-ti/n8n/scripts}"

mkdir -p "$TARGET"
install -m 755 "$ROOT/scripts/sicop/run-sync.sh" "$TARGET/run-sync.sh"
install -m 644 "$ROOT/scripts/sicop/sicop_search.py" "$TARGET/sicop_search.py"

# Compat: run_sicop.sh delega al script unificado.
cat > "$TARGET/run_sicop.sh" << 'EOF'
#!/bin/sh
exec sh "$(dirname "$0")/run-sync.sh"
EOF
chmod +x "$TARGET/run_sicop.sh"

chown -R soporte-ti:soporte-ti "$TARGET"
chmod 775 "$TARGET"

echo "OK: SICOP scripts → $TARGET"
