#!/usr/bin/env bash
# Réplica diaria Expediente Digital (10.1.1.6) → Ubuntu Alfa One (10.1.1.229)
#
# Origen preferido: SSH + rsync desde /u01/EXPEDIENTE_DIGITAL (disco nativo Oracle).
# NO escribe al origen. NO usa el montaje CIFS de la app (evita riesgos del incidente 15-jul-2026).
#
# Destino:
#   $BACKUP_ROOT/current/              — espejo actual
#   $BACKUP_ROOT/snapshots/YYYYMMDD/   — snapshots hardlink (retención)
#   $BACKUP_ROOT/logs/                 — logs locales
#
# Uso:
#   bash scripts/expediente-digital-backup.sh
#   DRY_RUN=1 bash scripts/expediente-digital-backup.sh
#   sudo bash scripts/install-expediente-policies.sh   # cron + políticas
set -euo pipefail

ENV_FILE="${EXPEDIENTE_BACKUP_ENV:-/etc/alfa-one/expediente-backup.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi

ORACLE_HOST="${ORACLE_HOST:-10.1.1.6}"
ORACLE_USER="${ORACLE_USER:-oracle}"
ORACLE_EXPEDIENTE_PATH="${ORACLE_EXPEDIENTE_PATH:-/u01/EXPEDIENTE_DIGITAL}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/data/backups/expediente-digital}"
SNAPSHOT_RETENTION_DAYS="${SNAPSHOT_RETENTION_DAYS:-7}"
RSYNC_DELETE="${RSYNC_DELETE:-true}"
DRY_RUN="${DRY_RUN:-0}"
LOG_DIR="${LOG_DIR:-/var/log/alfa-one}"
LOCK_FILE="${LOCK_FILE:-/tmp/expediente-digital-backup.lock}"

CURRENT_DIR="$BACKUP_ROOT/current"
SNAPSHOTS_DIR="$BACKUP_ROOT/snapshots"
LOCAL_LOG_DIR="$BACKUP_ROOT/logs"
stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
day_stamp="$(date -u +"%Y%m%d")"
logfile="$LOCAL_LOG_DIR/expediente-backup_${stamp}.log"
cron_logfile="$LOG_DIR/cron-expediente-backup.log"

mkdir -p "$CURRENT_DIR" "$SNAPSHOTS_DIR" "$LOCAL_LOG_DIR" "$LOG_DIR"

SSH_CMD=(ssh -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=20)
RSYNC_OPTS=(-aH --info=stats2 --partial --timeout=600 --numeric-ids
  --exclude='lost+found/'
  --exclude='.Trash*/'
  --exclude='Thumbs.db'
  --exclude='desktop.ini')

if [ "$RSYNC_DELETE" = "true" ] || [ "$RSYNC_DELETE" = "1" ]; then
  RSYNC_OPTS+=(--delete --delete-delay)
fi

if [ "$DRY_RUN" = "1" ] || [ "$DRY_RUN" = "true" ]; then
  RSYNC_OPTS+=(-n)
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) SKIP: otra réplica de expediente en curso" | tee -a "$cron_logfile"
  exit 0
fi

log() {
  # stdout lo captura el cron; archivo local para detalle + rsync stats
  echo "$(date -Is) $*" | tee -a "$logfile"
}

fail() {
  log "ERROR: $*"
  exit 1
}

# Seguridad: nunca permitir que el destino sea el mount CIFS vivo ni rutas bajo el share remoto.
assert_safe_destination() {
  local dest="$1"
  local real
  real="$(realpath -m "$dest")"

  case "$real" in
    /mnt/data/backups/expediente-digital|/*|/mnt/data/backups/expediente-digital)
      ;;
    *)
      fail "destino fuera de /mnt/data/backups/expediente-digital: $real"
      ;;
  esac

  if findmnt -T "$real" >/dev/null 2>&1; then
    local fstype
    fstype="$(findmnt -no FSTYPE -T "$real" 2>/dev/null || true)"
    if [ "$fstype" = "cifs" ] || [ "$fstype" = "smb3" ]; then
      fail "destino está sobre CIFS ($real) — abortado"
    fi
  fi
}

assert_safe_destination "$CURRENT_DIR"
assert_safe_destination "$SNAPSHOTS_DIR"

log "========== Inicio réplica expediente digital =========="
log "Origen: ${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_EXPEDIENTE_PATH}/"
log "Destino mirror: $CURRENT_DIR/"
log "DRY_RUN=$DRY_RUN RSYNC_DELETE=$RSYNC_DELETE"

# Preflight SSH + tamaño origen
if ! "${SSH_CMD[@]}" "${ORACLE_USER}@${ORACLE_HOST}" "test -d '${ORACLE_EXPEDIENTE_PATH}' && test -r '${ORACLE_EXPEDIENTE_PATH}'"; then
  fail "no se puede leer ${ORACLE_EXPEDIENTE_PATH} en ${ORACLE_HOST}"
fi

src_du="$("${SSH_CMD[@]}" "${ORACLE_USER}@${ORACLE_HOST}" "du -sb '${ORACLE_EXPEDIENTE_PATH}' 2>/dev/null | awk '{print \$1}'" || echo 0)"
avail_kb="$(df -Pk /mnt/data | awk 'NR==2 {print $4}')"
avail_b=$((avail_kb * 1024))
log "Origen ~${src_du} bytes; libre /mnt/data ~${avail_b} bytes"

if [ "${src_du:-0}" -gt 0 ] && [ "$avail_b" -lt "$src_du" ]; then
  # Con hardlinks el crecimiento incremental es menor; solo fallar si current está vacío
  if [ ! "$(ls -A "$CURRENT_DIR" 2>/dev/null || true)" ]; then
    fail "espacio insuficiente en /mnt/data para el primer sync (~$((src_du / 1024 / 1024 / 1024)) GiB)"
  fi
  log "WARN: libre < tamaño origen (OK si current ya tiene datos; sync incremental)"
fi

SRC="${ORACLE_USER}@${ORACLE_HOST}:${ORACLE_EXPEDIENTE_PATH}/"

log "==>> rsync → current =="
# shellcheck disable=SC2086
rsync "${RSYNC_OPTS[@]}" -e "${SSH_CMD[*]}" "$SRC" "$CURRENT_DIR/" >>"$logfile" 2>&1 \
  || fail "rsync mirror falló (ver $logfile)"

# Snapshot hardlink del día (solo si no es dry-run)
snap_dir="$SNAPSHOTS_DIR/$day_stamp"
if [ "$DRY_RUN" != "1" ] && [ "$DRY_RUN" != "true" ]; then
  if [ -d "$snap_dir" ]; then
    log "Snapshot del día ya existe: $snap_dir (se actualiza)"
  else
    log "==>> creando snapshot hardlink $snap_dir =="
  fi
  mkdir -p "$snap_dir"
  rsync -aH --delete --link-dest="$CURRENT_DIR" "$CURRENT_DIR/" "$snap_dir/" >>"$logfile" 2>&1 \
    || fail "falló snapshot hardlink"

  # Retención
  log "==>> retención snapshots >${SNAPSHOT_RETENTION_DAYS}d =="
  find "$SNAPSHOTS_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$SNAPSHOT_RETENTION_DAYS" -print \
    | while read -r old; do
        log "borrando snapshot antiguo: $old"
        rm -rf "$old"
      done
fi

# Manifest rápido
file_count="$(find "$CURRENT_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')"
dir_size="$(du -sh "$CURRENT_DIR" 2>/dev/null | awk '{print $1}')"
if [ "$DRY_RUN" != "1" ] && [ "$DRY_RUN" != "true" ]; then
  echo "$stamp files=$file_count size=$dir_size src_bytes=$src_du" >"$BACKUP_ROOT/LAST_OK"
fi
log "OK mirror files=$file_count size=$dir_size"
log "========== Fin réplica expediente digital =========="

# Limpieza logs locales >30d
find "$LOCAL_LOG_DIR" -name 'expediente-backup_*.log' -mtime +30 -delete 2>/dev/null || true
