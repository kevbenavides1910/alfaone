#!/usr/bin/env bash
# Prepara copia de respaldos a otro servidor (plantilla + clave SSH).
# Uso: sudo bash scripts/setup-backup-remote.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecute con sudo." >&2
  exit 1
fi

PROJECT_DIR="${PROJECT_DIR:-/mnt/data/projects/alfa-one/code/presupuestos-alfa}"
TARGET="/etc/alfa-one/backup-remote.env"
EXAMPLE="$PROJECT_DIR/config/backup-remote.env.example"
RUN_USER="${SUDO_USER:-soporte-ti}"
KEY_PATH="/home/$RUN_USER/.ssh/presupuestos_alfa_backup"

mkdir -p /etc/alfa-one
if [ ! -f "$TARGET" ]; then
  cp "$EXAMPLE" "$TARGET"
  sed -i "s|BACKUP_REMOTE_SSH_KEY=.*|BACKUP_REMOTE_SSH_KEY=$KEY_PATH|" "$TARGET"
fi
chmod 640 "$TARGET"
chown "$RUN_USER:root" "$TARGET"

chmod +x "$PROJECT_DIR/scripts/postgres-backup-remote-sync.sh"

if [ ! -f "$KEY_PATH" ]; then
  sudo -u "$RUN_USER" mkdir -p "$(dirname "$KEY_PATH")"
  sudo -u "$RUN_USER" ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "alfa-one-backup@$(hostname -s)"
  echo ""
  echo "Clave pública (agréguela en el servidor remoto → ~/.ssh/authorized_keys del usuario backup):"
  echo "---"
  cat "${KEY_PATH}.pub"
  echo "---"
else
  echo "Clave SSH ya existe: $KEY_PATH"
fi

cat <<EOF

Archivo de configuración: $TARGET
Edite BACKUP_REMOTE_HOST, BACKUP_REMOTE_USER y BACKUP_REMOTE_PATH.

En el SERVIDOR REMOTO:
  sudo mkdir -p /backups/alfa-one/postgres
  sudo chown -R USUARIO_BACKUP:USUARIO_BACKUP /backups/alfa-one
  # Pegar la clave pública en ~USUARIO_BACKUP/.ssh/authorized_keys

Prueba desde este servidor (como $RUN_USER):
  BACKUP_REMOTE_ENV=$TARGET bash $PROJECT_DIR/scripts/postgres-backup-remote-sync.sh

Tras configurar, reinstale cron:
  sudo bash $PROJECT_DIR/scripts/install-production-cron.sh

EOF
