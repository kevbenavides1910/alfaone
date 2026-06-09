#!/usr/bin/env bash
# Instala tareas cron de respaldo, salud y limpieza Docker.
# Uso: sudo bash scripts/install-production-cron.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecute con sudo." >&2
  exit 1
fi

PROJECT_DIR="${PROJECT_DIR:-/mnt/data/projects/alfa-one/code/presupuestos-alfa}"
RUN_USER="${RUN_USER:-soporte-ti}"
LOG_DIR="/var/log/alfa-one"
BACKUP_DIR="/mnt/data/backups/postgres"
HEALTH_ENV="/etc/alfa-one/health-alert.env"

mkdir -p "$LOG_DIR" "$BACKUP_DIR"
chown "$RUN_USER:$RUN_USER" "$LOG_DIR" 2>/dev/null || true

CRON_FILE="/etc/cron.d/alfa-one"
cat > "$CRON_FILE" <<EOF
# Presupuestos-Alfa — mantenimiento automático
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Salud HTTP cada 5 minutos (alerta por correo si falla)
*/5 * * * * $RUN_USER HEALTH_ALERT_ENV=$HEALTH_ENV BASE_URL=http://127.0.0.1:3000 LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/vps-health-monitor.sh >> $LOG_DIR/cron-health.log 2>&1

# Reporte diario por correo 07:00 Costa Rica (13:00 UTC)
0 13 * * * $RUN_USER HEALTH_ALERT_ENV=$HEALTH_ENV LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/vps-health-daily-report.sh >> $LOG_DIR/cron-daily-report.log 2>&1

# Respaldo PostgreSQL diario 02:15 UTC (+ sync remoto si backup-remote.env está activo)
15 2 * * * root BACKUP_DIR=$BACKUP_DIR BACKUP_REMOTE_ENV=/etc/alfa-one/backup-remote.env $PROJECT_DIR/scripts/postgres-backup.sh >> $LOG_DIR/cron-backup.log 2>&1

# Limpieza caché Docker (domingo 04:30 UTC)
30 4 * * 0 root $PROJECT_DIR/scripts/docker-prune-cache.sh >> $LOG_DIR/cron-docker-prune.log 2>&1
EOF

chmod 644 "$CRON_FILE"
chmod +x "$PROJECT_DIR/scripts/vps-health-monitor.sh" \
  "$PROJECT_DIR/scripts/vps-health-daily-report.sh" \
  "$PROJECT_DIR/scripts/send-health-alert-email.py" \
  "$PROJECT_DIR/scripts/postgres-backup.sh" \
  "$PROJECT_DIR/scripts/postgres-backup-remote-sync.sh" \
  "$PROJECT_DIR/scripts/setup-backup-remote.sh" \
  "$PROJECT_DIR/scripts/docker-prune-cache.sh" \
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

