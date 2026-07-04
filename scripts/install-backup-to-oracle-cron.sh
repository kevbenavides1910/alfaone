#!/usr/bin/env bash
# Instala cron diario: respaldo completo Alfa One → Oracle 10.1.1.6
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/mnt/data/projects/alfa-one/code/presupuestos-alfa}"
SCRIPT="$PROJECT_DIR/scripts/backup-to-oracle.sh"
LOG_DIR="/var/log/alfa-one"

mkdir -p "$LOG_DIR"
chmod +x "$SCRIPT" "$PROJECT_DIR/scripts/verify-backup-to-oracle.sh" "$PROJECT_DIR/scripts/backup-config-bundle.sh"

# Cron 04:00 UTC = 22:00 Costa Rica (noche)
CRON_LINE="0 4 * * * $SCRIPT >> ${LOG_DIR}/backup-to-oracle-cron.log 2>&1"

( crontab -l 2>/dev/null | grep -v 'backup-to-oracle.sh' | grep -v 'backup_to_oracle.sh' || true
  echo "# Respaldo completo Alfa One → Oracle 10.1.1.6 (BD + archivos)"
  echo "$CRON_LINE"
) | crontab -

echo "Crontab instalado:"
crontab -l | grep -A1 'Respaldo completo'
