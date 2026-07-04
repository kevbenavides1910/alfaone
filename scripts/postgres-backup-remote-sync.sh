#!/usr/bin/env bash
# Sincroniza respaldos locales de PostgreSQL a otro servidor (rsync por SSH).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${BACKUP_REMOTE_ENV:-/etc/alfa-one/backup-remote.env}"

load_env() {
  if [ ! -f "$ENV_FILE" ]; then
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  return 0
}

if ! load_env; then
  echo "SKIP: no existe $ENV_FILE (copie config/backup-remote.env.example)"
  exit 0
fi

enabled="${BACKUP_REMOTE_ENABLED:-0}"
if [ "$enabled" != "1" ] && [ "$enabled" != "true" ] && [ "$enabled" != "yes" ]; then
  echo "SKIP: BACKUP_REMOTE_ENABLED no activo"
  exit 0
fi

REMOTE_HOST="${BACKUP_REMOTE_HOST:-}"
REMOTE_USER="${BACKUP_REMOTE_USER:-}"
REMOTE_PORT="${BACKUP_REMOTE_PORT:-22}"
REMOTE_PATH="${BACKUP_REMOTE_PATH:-}"
SSH_KEY="${BACKUP_REMOTE_SSH_KEY:-}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/mnt/data/backups/postgres}"
RETENTION="${BACKUP_REMOTE_RETENTION_DAYS:-30}"

if [ -z "$REMOTE_HOST" ] || [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_PATH" ]; then
  echo "ERROR: BACKUP_REMOTE_HOST, BACKUP_REMOTE_USER y BACKUP_REMOTE_PATH son obligatorios" >&2
  exit 1
fi

if [ ! -d "$LOCAL_DIR" ]; then
  echo "ERROR: no existe carpeta local $LOCAL_DIR" >&2
  exit 1
fi

if [ -z "$(ls -A "$LOCAL_DIR" 2>/dev/null || true)" ]; then
  echo "ERROR: $LOCAL_DIR está vacío; ejecute primero scripts/postgres-backup.sh" >&2
  exit 1
fi

SSH_OPTS=(-p "$REMOTE_PORT" -o BatchMode=yes -o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new)
if [ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

RSYNC_SSH="ssh ${SSH_OPTS[*]}"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "Sincronizando $LOCAL_DIR → $REMOTE (puerto $REMOTE_PORT)..."

ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p '$REMOTE_PATH'"

rsync -az --partial --delete-after -e "$RSYNC_SSH" "$LOCAL_DIR/" "$REMOTE"

if [ -n "$RETENTION" ] && [ "$RETENTION" -gt 0 ] 2>/dev/null; then
  ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
    "find '$REMOTE_PATH' -name 'security_contracts_*.sql.gz' -type f -mtime +$RETENTION -delete 2>/dev/null || true"
fi

echo "OK remote sync → ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
