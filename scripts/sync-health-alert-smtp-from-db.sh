#!/usr/bin/env bash
# Copia SMTP del módulo disciplinario (BD) a /etc/alfa-one/health-alert.env
# Uso: sudo bash scripts/sync-health-alert-smtp-from-db.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecute con sudo." >&2
  exit 1
fi

TARGET="/etc/alfa-one/health-alert.env"
DB_CONTAINER="${DB_CONTAINER:-security_contracts_db}"
TO_EMAIL="${HEALTH_ALERT_TO:-kevbenavides@gmail.com}"

row="$(docker exec "$DB_CONTAINER" psql -U postgres -d security_contracts -t -A -F $'\t' -c \
  "SELECT COALESCE(\"smtpHost\",''), COALESCE(\"smtpPort\"::text,'587'), COALESCE(\"smtpSecure\"::text,'false'), COALESCE(\"smtpUser\",''), COALESCE(\"smtpPass\",''), COALESCE(\"smtpFrom\",'') FROM app_disciplinary_settings ORDER BY id LIMIT 1;" 2>/dev/null || true)"

if [ -z "$row" ]; then
  echo "No hay configuración SMTP en app_disciplinary_settings." >&2
  exit 1
fi

IFS=$'\t' read -r host port secure user pass from <<< "$row"

if [ -z "$host" ] || [ -z "$user" ] || [ -z "$pass" ]; then
  echo "SMTP incompleto en BD (host/user/pass). Configure en Disciplinario → Ajustes." >&2
  exit 1
fi

tls=1
if [ "$secure" = "t" ] || [ "$secure" = "true" ]; then
  tls=0
fi
from="${from:-$user}"

mkdir -p /etc/alfa-one
cat > "$TARGET" <<EOF
# Generado por sync-health-alert-smtp-from-db.sh — no commitear
HEALTH_ALERT_TO=$TO_EMAIL
HEALTH_ALERT_FROM=$from
SMTP_HOST=$host
SMTP_PORT=${port:-587}
SMTP_TLS=$tls
SMTP_USER=$user
SMTP_PASS=$pass
HEALTH_ALERT_COOLDOWN_MINUTES=30
HEALTH_ALERT_HOSTNAME=alfa-one
EOF

chmod 640 "$TARGET"
chown "${SUDO_USER:-soporte-ti}:root" "$TARGET"
echo "OK: $TARGET actualizado (SMTP desde disciplinario, destino $TO_EMAIL)"

