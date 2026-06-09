#!/usr/bin/env bash
# Reporte diario del estado del servidor por correo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOG_DIR="${LOG_DIR:-/var/log/alfa-one}"
ENV_FILE="${HEALTH_ALERT_ENV:-/etc/alfa-one/health-alert.env}"
HOST_LABEL="${HEALTH_ALERT_HOSTNAME:-alfa-one}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

timestamp="$(date -u +"%Y-%m-%d %H:%M UTC")"
day_stamp="$(date -u +"%Y-%m-%d")"
health_log="$LOG_DIR/health-$day_stamp.log"

login_code="—"
if login_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/login" 2>/dev/null)"; then
  :
else
  login_code="ERR"
fi

health_tail="(sin comprobaciones hoy)"
if [ -f "$health_log" ]; then
  health_tail="$(tail -n 12 "$health_log")"
fi

last_backup="(ninguno)"
f="$(ls -1t /mnt/data/backups/postgres/*.sql.gz 2>/dev/null | head -1 || true)"
if [ -n "$f" ]; then
  last_backup="$(ls -lh "$f" | awk '{print $6, $7, $8, $9}')"
fi

docker_ps="$(docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -10 || echo 'docker no disponible')"
disk_report="$(df -h / /mnt/data 2>/dev/null | tail -n +1 || df -h /)"
mem_report="$(free -h 2>/dev/null | head -2 || echo '—')"

status="OK"
if [ "$login_code" != "200" ]; then
  status="ALERTA"
fi

subject="[ALFA ONE] Reporte diario $HOST_LABEL — $status ($timestamp)"

body=$(cat <<EOF
Reporte automático de salud — Alfa One
Servidor: $HOST_LABEL
Fecha: $timestamp
Estado general: $status
Login HTTP ($BASE_URL/login): $login_code

── Contenedores ──
$docker_ps

── Disco ──
$disk_report

── Memoria ──
$mem_report

── Último respaldo PostgreSQL ──
$last_backup

── Comprobaciones de hoy (cada 5 min) ──
$health_tail

── Logs ──
$LOG_DIR

Este mensaje se envía una vez al día. Las fallas críticas generan alerta aparte (máx. cada ${HEALTH_ALERT_COOLDOWN_MINUTES:-30} min).
EOF
)

export HEALTH_ALERT_ENV="$ENV_FILE"
python3 "$SCRIPT_DIR/send-health-alert-email.py" "$subject" "$body"

