#!/usr/bin/env bash
# Verifica respaldo Alfa One en Oracle 10.1.1.6
set -euo pipefail

ORACLE_HOST="${BACKUP_ORACLE_HOST:-10.1.1.6}"
ORACLE_USER="${BACKUP_ORACLE_USER:-oracle}"
ORACLE_PATH="${BACKUP_ORACLE_PATH:-/backups/alfa-one}"
APP_DATA="${APP_DATA_HOST:-/mnt/data/projects/alfa-one/app}"
LOG_DIR="${BACKUP_ORACLE_LOG_DIR:-/var/log/alfa-one}"

echo "=== Respaldo Alfa One → Oracle (${ORACLE_USER}@${ORACLE_HOST}) ==="
echo ""
echo "Local APP_DATA: $APP_DATA ($(du -sh "$APP_DATA" 2>/dev/null | awk '{print $1}'), $(find "$APP_DATA" -type f 2>/dev/null | wc -l) archivos)"
echo "Local Odoo: ${ODOO_BACKUP_DIR:-/mnt/data/backups/odoo} ($(du -sh "${ODOO_BACKUP_DIR:-/mnt/data/backups/odoo}" 2>/dev/null | awk '{print $1}'))"
ls -lht "${ODOO_BACKUP_DIR:-/mnt/data/backups/odoo}/"*.dump 2>/dev/null | head -2 || echo "  (sin dumps odoo locales)"

ssh -o BatchMode=yes -o ConnectTimeout=15 "${ORACLE_USER}@${ORACLE_HOST}" bash -s <<EOF
set -euo pipefail
echo "=== En Oracle ==="
du -sh '${ORACLE_PATH}/postgres' '${ORACLE_PATH}/app' '${ORACLE_PATH}/odoo' 2>/dev/null || true
echo ""
echo "Dumps PostgreSQL (Alfa One):"
ls -lht '${ORACLE_PATH}/postgres/'*.dump 2>/dev/null | head -5 || echo "(ninguno)"
echo ""
echo "Odoo (Oracle):"
du -sh '${ORACLE_PATH}/odoo' '${ORACLE_PATH}/odoo/extra-addons' 2>/dev/null || true
ls -lht '${ORACLE_PATH}/odoo/'*.dump 2>/dev/null | head -3 || echo "(ningún dump odoo)"
echo ""
echo "Bundle configuración:"
ls -lht '${ORACLE_PATH}/postgres'/config_*.tar.gz 2>/dev/null | head -3 || echo "(ninguno)"
echo ""
echo "App (subcarpetas):"
for d in branding expense-uploads sig-documents facturacion-uploads patrol-uploads exports; do
  if [ -d '${ORACLE_PATH}/app/'"\$d" ]; then
    du -sh '${ORACLE_PATH}/app/'"\$d" 2>/dev/null
  fi
done
EOF

echo ""
echo "=== Último log local ==="
f="$(ls -t "$LOG_DIR"/backup-to-oracle_*.log 2>/dev/null | head -1)"
if [ -n "$f" ]; then
  tail -12 "$f"
else
  echo "(sin logs en $LOG_DIR)"
fi

echo ""
echo "=== Cron soporte-ti ==="
crontab -l 2>/dev/null | grep -i backup || echo "(no configurado)"
