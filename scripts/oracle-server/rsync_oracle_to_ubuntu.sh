#!/usr/bin/env bash
# Réplica expdp Codisa/Oracle (10.1.1.6) → Ubuntu Alfa One (10.1.1.229)
# Solo respaldos lógicos Data Pump; RMAN/archives omitidos (no útiles en Ubuntu).
# Instalado en: /home/oracle/rms/rsync_oracle_to_ubuntu.sh
set -euo pipefail

LOCK_FILE=/home/oracle/rms/logrsync/rsync_oracle.lock
FECHA_RESP=$(date +%Y%m%d_%H%M)
LOGFILE=/home/oracle/rms/logrsync/rsync_oracle_${FECHA_RESP}.log
UBUNTU_IP="${UBUNTU_IP:-10.1.1.229}"
# Tras mudanza a Alajuela: UBUNTU_IP=10.2.2.50 (ver scripts/migration/update-ubuntu-ip-oracle.sh)
UBUNTU_USER=soporte-ti
UBUNTU_PATH=/mnt/data/backups/oracle
# Retención local de seguridad (días); Oracle borra .dmp.gz > 5 días
EXPDP_RETENTION_DAYS="${EXPDP_RETENTION_DAYS:-7}"

RSYNC_OPTS=(-av --partial --timeout=600)
SSH_CMD="ssh -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=60 -o ServerAliveCountMax=20"

mkdir -p "$(dirname "$LOGFILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) SKIP: otra sincronización Oracle→Ubuntu en curso" >> "${LOGFILE}.skip" 2>/dev/null || true
  exit 0
fi

{
  echo "**********"
  echo "* Inicio: $(date -Is)"
  echo "* Modo: solo expdp (retención local ${EXPDP_RETENTION_DAYS}d)"
  echo "**********"

  echo "==>> Verificando destino ${UBUNTU_USER}@${UBUNTU_IP} =="
  ${SSH_CMD} "${UBUNTU_USER}@${UBUNTU_IP}" "mkdir -p '${UBUNTU_PATH}/expdp'"

  echo "==>> Data Pump (expdp) =="
  rsync "${RSYNC_OPTS[@]}" -e "$SSH_CMD" --delete \
    /backups/expdp/ "${UBUNTU_USER}@${UBUNTU_IP}:${UBUNTU_PATH}/expdp/"

  echo "==>> Limpieza local en Ubuntu (>${EXPDP_RETENTION_DAYS}d) =="
  ${SSH_CMD} "${UBUNTU_USER}@${UBUNTU_IP}" bash -s <<EOF
set -euo pipefail
BASE='${UBUNTU_PATH}/expdp'
find "\$BASE" -name 'Expdp_Full_*.dmp.gz' -mtime +${EXPDP_RETENTION_DAYS} -print -delete 2>/dev/null || true
find "\$BASE" -name 'Expdp_Full_*.log' -mtime +15 -print -delete 2>/dev/null || true
echo "OK limpieza expdp"
EOF

  echo "**********"
  echo "* Final: $(date -Is)"
  echo "**********"
} >> "$LOGFILE" 2>&1

find /home/oracle/rms/logrsync -name 'rsync_oracle_*.log' -mtime +30 -delete 2>/dev/null || true
find /home/oracle/rms/logrsync -name 'rsync_oracle_*.log.skip' -mtime +7 -delete 2>/dev/null || true
