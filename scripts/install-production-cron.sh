#!/usr/bin/env bash
# Instala tareas cron de respaldo, salud y limpieza Docker.
# Uso: sudo bash scripts/install-production-cron.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecute con sudo." >&2
  exit 1
fi

PROJECT_DIR="${PROJECT_DIR:-/mnt/data/projects/alfa-one/code/presupuestos-alfa}"
ODOO_BACKUP_SCRIPT="/mnt/data/projects/odoo18-alfa/scripts/odoo-backup.sh"
RUN_USER="${RUN_USER:-soporte-ti}"
LOG_DIR="/var/log/alfa-one"
BACKUP_DIR="/mnt/data/backups/postgres"
ODOO_BACKUP_DIR="/mnt/data/backups/odoo"
EXPEDIENTE_BACKUP_DIR="/mnt/data/backups/expediente-digital"
EXPEDIENTE_BACKUP_ENV="/etc/alfa-one/expediente-backup.env"
HEALTH_ENV="/etc/alfa-one/health-alert.env"

mkdir -p "$LOG_DIR" "$BACKUP_DIR" "$ODOO_BACKUP_DIR" "$EXPEDIENTE_BACKUP_DIR"
chown "$RUN_USER:$RUN_USER" "$LOG_DIR" 2>/dev/null || true
if [ ! -f "$EXPEDIENTE_BACKUP_ENV" ] && [ -f "$PROJECT_DIR/config/expediente-backup.env.example" ]; then
  install -m 640 -o "$RUN_USER" -g root \
    "$PROJECT_DIR/config/expediente-backup.env.example" "$EXPEDIENTE_BACKUP_ENV"
fi

CRON_FILE="/etc/cron.d/alfa-one"
cat > "$CRON_FILE" <<EOF
# Alfa One — mantenimiento automático
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Salud HTTP cada 5 minutos (alerta por correo si falla)
*/5 * * * * $RUN_USER HEALTH_ALERT_ENV=$HEALTH_ENV BASE_URL=http://127.0.0.1:3000 LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/vps-health-monitor.sh >> $LOG_DIR/cron-health.log 2>&1

# Reporte diario por correo 07:00 Costa Rica (13:00 UTC)
0 13 * * * $RUN_USER HEALTH_ALERT_ENV=$HEALTH_ENV LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/vps-health-daily-report.sh >> $LOG_DIR/cron-daily-report.log 2>&1

# Respaldo PostgreSQL diario 02:15 UTC (+ sync remoto si backup-remote.env está activo)
15 2 * * * root BACKUP_DIR=$BACKUP_DIR BACKUP_REMOTE_ENV=/etc/alfa-one/backup-remote.env GZIP_LEVEL=9 $PROJECT_DIR/scripts/postgres-backup.sh >> $LOG_DIR/cron-backup.log 2>&1

# Respaldo Odoo 18 diario 02:25 UTC
25 2 * * * $RUN_USER BACKUP_DIR=$ODOO_BACKUP_DIR $ODOO_BACKUP_SCRIPT >> $LOG_DIR/cron-odoo-backup.log 2>&1

# Limpieza caché Docker (domingo 04:30 UTC)
30 4 * * 0 root $PROJECT_DIR/scripts/docker-prune-cache.sh >> $LOG_DIR/cron-docker-prune.log 2>&1

# Sincronización empleados NAF cada hora (Costa Rica UTC-6 → minuto 5 de cada hora UTC)
5 * * * * $RUN_USER NAF_ORACLE_CLIENT_DIR=${NAF_ORACLE_CLIENT_DIR:-/opt/oracle/instantclient_19_23} $PROJECT_DIR/scripts/naf-employees-sync.sh >> $LOG_DIR/cron-naf-sync.log 2>&1

# Facturación Electrónica: consultas Hacienda, reintentos, correos e IMAP (cada 2 min)
*/2 * * * * $RUN_USER BASE_URL=http://127.0.0.1:3000 LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/cron-fe-jobs.sh >> $LOG_DIR/fe-jobs.log 2>&1

# Facturación Electrónica: buzón IMAP dedicado (cada 5 min, respaldo si fe-jobs falla)
*/5 * * * * $RUN_USER BASE_URL=http://127.0.0.1:3000 LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/cron-fe-imap.sh >> $LOG_DIR/fe-imap.log 2>&1

# Facturación cobro mensual: correos de recordatorio (08:00 Costa Rica = 14:00 UTC)
0 14 * * * $RUN_USER BASE_URL=http://127.0.0.1:3000 LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/cron-facturacion-cobro-emails.sh >> $LOG_DIR/cobro-emails.log 2>&1

# Respaldo Expediente Digital diario 03:30 UTC (21:30 CR) — SSH pull 10.1.1.6 → disco local
30 3 * * * $RUN_USER EXPEDIENTE_BACKUP_ENV=$EXPEDIENTE_BACKUP_ENV LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/expediente-digital-backup.sh

# Archivo automático de notificaciones (>3 días → historial) diario 05:00 UTC
0 5 * * * $RUN_USER BASE_URL=http://127.0.0.1:3000 $PROJECT_DIR/scripts/cron/notifications-archive.sh >> $LOG_DIR/cron-notifications-archive.log 2>&1

# Finger System: sync automática biométrica (cada 5 min; intervalo interno en settings)
*/5 * * * * $RUN_USER BASE_URL=http://127.0.0.1:3000 LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/cron-finger-sync.sh >> $LOG_DIR/finger-sync.log 2>&1
EOF

chmod 644 "$CRON_FILE"
chmod +x "$PROJECT_DIR/scripts/vps-health-monitor.sh" \
  "$PROJECT_DIR/scripts/vps-health-daily-report.sh" \
  "$PROJECT_DIR/scripts/send-health-alert-email.py" \
  "$PROJECT_DIR/scripts/postgres-backup.sh" \
  "$PROJECT_DIR/scripts/postgres-backup-remote-sync.sh" \
  "$PROJECT_DIR/scripts/setup-backup-remote.sh" \
  "$PROJECT_DIR/scripts/docker-prune-cache.sh" \
  "$PROJECT_DIR/scripts/naf-employees-sync.sh" \
  "$PROJECT_DIR/scripts/cron-fe-jobs.sh" \
  "$PROJECT_DIR/scripts/cron-fe-imap.sh" \
  "$PROJECT_DIR/scripts/cron-facturacion-cobro-emails.sh" \
  "$PROJECT_DIR/scripts/cron-finger-sync.sh" \
  "$PROJECT_DIR/scripts/cron/notifications-archive.sh" \
  "$PROJECT_DIR/scripts/expediente-digital-backup.sh" \
  "$PROJECT_DIR/scripts/verify-expediente-digital-backup.sh" \
  "$PROJECT_DIR/scripts/ops/guard-cifs-path.sh" \
  "$ODOO_BACKUP_SCRIPT" \
  "$PROJECT_DIR/scripts/rotate-postgres-password.sh" \
  "$PROJECT_DIR/scripts/harden-production-env.sh" \
  "$PROJECT_DIR/scripts/setup-health-alert-email.sh"

echo "Instalado: $CRON_FILE"
if [ ! -f "$HEALTH_ENV" ]; then
  echo ""
  echo "AVISO: configure SMTP antes de recibir correos:"
  echo "  sudo bash $PROJECT_DIR/scripts/setup-health-alert-email.sh"
  echo "  sudo nano $HEALTH_ENV"
fi
cat "$CRON_FILE"
