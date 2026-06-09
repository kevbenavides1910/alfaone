#!/usr/bin/env bash
# Permisos seguros en .env y rotación de Postgres si aplica.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

for f in "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.production"; do
  if [ -f "$f" ]; then
    chmod 600 "$f"
    echo "chmod 600 $f"
  fi
done

bash "$PROJECT_DIR/scripts/rotate-postgres-password.sh"
