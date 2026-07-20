#!/usr/bin/env bash
# Instala:
#   1) Config /etc/alfa-one/expediente-backup.env
#   2) Cron diario: réplica Expediente Digital → /mnt/data/backups/expediente-digital
#   3) Políticas anti-rm sobre CIFS / expediente (profile.d + helper)
#
# Uso: sudo bash scripts/install-expediente-policies.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecute con sudo." >&2
  exit 1
fi

PROJECT_DIR="${PROJECT_DIR:-/mnt/data/projects/alfa-one/code/presupuestos-alfa}"
RUN_USER="${RUN_USER:-soporte-ti}"
LOG_DIR="/var/log/alfa-one"
BACKUP_ROOT="/mnt/data/backups/expediente-digital"
ENV_DST="/etc/alfa-one/expediente-backup.env"
ENV_SRC="$PROJECT_DIR/config/expediente-backup.env.example"
CRON_FILE="/etc/cron.d/alfa-one"
PROFILE_D="/etc/profile.d/alfa-one-cifs-safety.sh"
HELPER_DST="/usr/local/bin/alfa-one-guard-cifs"
RM_SAFE_DST="/usr/local/bin/alfa-one-rm-safe"

mkdir -p /etc/alfa-one "$LOG_DIR" "$BACKUP_ROOT/current" "$BACKUP_ROOT/snapshots" "$BACKUP_ROOT/logs"
chown -R "$RUN_USER:$RUN_USER" "$BACKUP_ROOT" "$LOG_DIR" 2>/dev/null || true

if [ ! -f "$ENV_DST" ]; then
  install -m 640 -o "$RUN_USER" -g root "$ENV_SRC" "$ENV_DST"
  echo "Creado $ENV_DST"
else
  echo "Conservado $ENV_DST (ya existía)"
fi

install -m 755 "$PROJECT_DIR/scripts/ops/guard-cifs-path.sh" "$HELPER_DST"
chmod +x \
  "$PROJECT_DIR/scripts/expediente-digital-backup.sh" \
  "$PROJECT_DIR/scripts/verify-expediente-digital-backup.sh" \
  "$PROJECT_DIR/scripts/ops/guard-cifs-path.sh"

# Wrapper explícito (no reemplaza /bin/rm del sistema)
cat > "$RM_SAFE_DST" <<'EOF'
#!/usr/bin/env bash
# rm con guardia CIFS/expediente. Uso: alfa-one-rm-safe [opts] PATH...
set -euo pipefail
GUARD="${ALFA_ONE_CIFS_GUARD:-/usr/local/bin/alfa-one-guard-cifs}"
args=()
paths=()
for a in "$@"; do
  case "$a" in
    -*) args+=("$a") ;;
    *) paths+=("$a") ;;
  esac
done
for p in "${paths[@]}"; do
  "$GUARD" "$p" || exit 2
done
exec /bin/rm "${args[@]}" "${paths[@]}"
EOF
chmod 755 "$RM_SAFE_DST"

# Perfil interactivo: bloquea rm -r/-rf sobre CIFS/expediente
cat > "$PROFILE_D" <<EOF
# Alfa One — políticas expediente / CIFS (incidente 15-jul-2026)
# Solo shells interactivos. No altera /bin/rm para cron/systemd.
if [[ \$- == *i* ]]; then
  alfa_one_cifs_guard() {
    local g="\${ALFA_ONE_CIFS_GUARD:-$HELPER_DST}"
    [ -x "\$g" ] || return 0
    "\$g" "\$1"
  }

  rm() {
    local recursive=0
    local -a paths=()
    local a
    for a in "\$@"; do
      if [[ "\$a" == -* ]]; then
        if [[ "\$a" == *r* || "\$a" == *R* || "\$a" == --recursive ]]; then
          recursive=1
        fi
      else
        paths+=("\$a")
      fi
    done
    if [ "\$recursive" -eq 1 ]; then
      for a in "\${paths[@]}"; do
        if ! alfa_one_cifs_guard "\$a"; then
          echo "Use: findmnt -T '\$a' ; o borre solo paths locales bajo /tmp o /mnt/data/backups/" >&2
          return 2
        fi
      done
    fi
    command rm "\$@"
  }
fi
EOF
chmod 644 "$PROFILE_D"

# Asegurar línea de cron en /etc/cron.d/alfa-one (idempotente)
CRON_MARKER="# Respaldo Expediente Digital"
CRON_LINE="30 3 * * * $RUN_USER EXPEDIENTE_BACKUP_ENV=$ENV_DST LOG_DIR=$LOG_DIR $PROJECT_DIR/scripts/expediente-digital-backup.sh"

if [ -f "$CRON_FILE" ] && grep -qF "expediente-digital-backup.sh" "$CRON_FILE"; then
  echo "Cron expediente ya presente en $CRON_FILE"
else
  if [ ! -f "$CRON_FILE" ]; then
    # Si no existe, instalar cron base primero
    bash "$PROJECT_DIR/scripts/install-production-cron.sh"
  fi
  {
    echo ""
    echo "$CRON_MARKER diario 03:30 UTC (21:30 CR) — pull SSH desde 10.1.1.6 → $BACKUP_ROOT"
    echo "$CRON_LINE"
  } >> "$CRON_FILE"
  chmod 644 "$CRON_FILE"
  echo "Añadido cron expediente a $CRON_FILE"
fi

# Recordatorio fstab / mount: no montar bajo code/
MOUNT_NOTE="$BACKUP_ROOT/README.txt"
cat > "$MOUNT_NOTE" <<'NOTE'
Expediente Digital — réplica en este servidor (.229)
====================================================

Fuente viva: 10.1.1.6:/u01/EXPEDIENTE_DIGITAL  (Samba //10.1.1.6/Expediente Digital)
Réplica:     /mnt/data/backups/expediente-digital/current/
Snapshots:   /mnt/data/backups/expediente-digital/snapshots/YYYYMMDD/  (hardlinks, 7d)

POLÍTICAS:
1. Nunca rm -rf sobre /mnt/data/projects/alfa-one/app/expediente-digital (CIFS montado).
2. El backup NO usa CIFS: solo SSH+rsync desde el disco Oracle.
3. Verificar: bash scripts/verify-expediente-digital-backup.sh
4. Restaurar: rsync -aH current/ hacia un staging LOCAL; no empujar a producción sin plan.

Incidente 15-jul-2026: rm con CIFS montado borró PDFs remotos.
NOTE
chown "$RUN_USER:$RUN_USER" "$MOUNT_NOTE"

echo ""
echo "Listo."
echo "  Config:  $ENV_DST"
echo "  Backup:  $BACKUP_ROOT"
echo "  Cron:    03:30 UTC diario ($CRON_FILE)"
echo "  Guard:   $HELPER_DST + profile $PROFILE_D"
echo "  rm-safe: $RM_SAFE_DST"
echo ""
echo "Probar guardia:"
echo "  $HELPER_DST /mnt/data/projects/alfa-one/app/expediente-digital && echo FAIL || echo OK bloquea"
echo "Dry-run backup:"
echo "  sudo -u $RUN_USER DRY_RUN=1 EXPEDIENTE_BACKUP_ENV=$ENV_DST $PROJECT_DIR/scripts/expediente-digital-backup.sh"
echo "Primer sync real (largo, ~250GB):"
echo "  sudo -u $RUN_USER EXPEDIENTE_BACKUP_ENV=$ENV_DST $PROJECT_DIR/scripts/expediente-digital-backup.sh"
