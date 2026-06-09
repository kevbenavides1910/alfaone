#!/usr/bin/env bash
# Configura correo de alertas de servidor.
# Uso: sudo bash scripts/setup-health-alert-email.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecute con sudo." >&2
  exit 1
fi

PROJECT_DIR="${PROJECT_DIR:-/mnt/data/projects/alfa-one/code/presupuestos-alfa}"
TARGET="/etc/alfa-one/health-alert.env"
EXAMPLE="$PROJECT_DIR/config/health-alert.env.example"

mkdir -p /etc/alfa-one
chmod 755 /etc/alfa-one

if [ -f "$TARGET" ]; then
  echo "Ya existe $TARGET — no se sobrescribe."
  echo "Edite SMTP_USER y SMTP_PASS (contraseña de aplicación Gmail/Outlook)."
  exit 0
fi

cp "$EXAMPLE" "$TARGET"
chmod 640 "$TARGET"
chown "${SUDO_USER:-soporte-ti}:root" "$TARGET"

chmod +x "$PROJECT_DIR/scripts/send-health-alert-email.py"

cat <<EOF

Creado: $TARGET

1. Edite el archivo y complete SMTP_USER y SMTP_PASS:
   sudo nano $TARGET

   Gmail: https://myaccount.google.com/apppasswords
   (use contraseña de aplicación, puerto 587, SMTP_TLS=1)

2. Prueba de envío:
   HEALTH_ALERT_ENV=$TARGET python3 $PROJECT_DIR/scripts/send-health-alert-email.py \\
     "[ALFA ONE] Prueba alertas" "Si recibe este correo, las alertas están configuradas."

3. Reinstale cron (incluye reporte diario):
   sudo bash $PROJECT_DIR/scripts/install-production-cron.sh

EOF

