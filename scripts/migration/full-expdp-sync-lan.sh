#!/usr/bin/env bash
# Sincronización completa expdp Oracle→alfaia en LAN (pre-mudanza).
# Ejecutar en .229 o vía: ssh soporte-ti@10.1.1.229 bash scripts/migration/full-expdp-sync-lan.sh
set -euo pipefail

LOG="/var/log/alfa-one/full-expdp-sync-lan_$(date +%Y%m%d_%H%M).log"
mkdir -p /var/log/alfa-one

{
  echo "========== Inicio: $(date -Is) =========="
  echo "Origen: oracle@10.1.1.6:/backups/expdp/"
  echo "Destino: soporte-ti@10.1.1.229:/mnt/data/backups/oracle/expdp/"

  ssh -o BatchMode=yes oracle@10.1.1.6 bash -s <<'ORACLE_EOF'
set -euo pipefail
LOCK_FILE=/home/oracle/rms/logrsync/rsync_oracle.lock
RSYNC_OPTS=(-av --partial --timeout=600 --info=progress2)
SSH_CMD="ssh -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=20"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "ERROR: rsync Oracle ya en curso (lock $LOCK_FILE)"
  exit 1
fi

echo "Origen antes:"
du -sh /backups/expdp
ls -1 /backups/expdp/*.dmp.gz 2>/dev/null | wc -l

echo "==>> Rsync completo LAN =="
START=$(date +%s)
rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" --delete \
  /backups/expdp/ soporte-ti@10.1.1.229:/mnt/data/backups/oracle/expdp/
END=$(date +%s)
echo "Duración rsync: $((END - START))s"
ORACLE_EOF

  echo ""
  echo "Destino después:"
  du -sh /mnt/data/backups/oracle/expdp
  ls -1 /mnt/data/backups/oracle/expdp/*.dmp.gz 2>/dev/null | wc -l

  echo "==>> Dry-run post-sync (debe ser ~0 bytes nuevos) =="
  ssh -o BatchMode=yes oracle@10.1.1.6 \
    "rsync -av --dry-run --stats -e 'ssh -o BatchMode=yes -o StrictHostKeyChecking=no' --delete \
      /backups/expdp/ soporte-ti@10.1.1.229:/mnt/data/backups/oracle/expdp/ 2>&1 | tail -8"

  echo "========== Fin: $(date -Is) =========="
} >> "$LOG" 2>&1

echo "Log: $LOG"
tail -20 "$LOG"
