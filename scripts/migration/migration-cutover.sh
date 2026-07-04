#!/usr/bin/env bash
# Checklist día de mudanza alfaia: Sabana (10.1.1.229) → Alajuela (10.2.2.50)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NEW_IP="10.2.2.50"
LOG="/var/log/alfa-one/migration-cutover_$(date +%Y%m%d_%H%M).log"
mkdir -p /var/log/alfa-one

log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }

log "=== INICIO CORTE alfaia → Alajuela ==="

log "1. Pausar crons (manual): crontab -e en .229 y oracle@10.1.1.6"
read -r -p "¿Crons pausados? [y/N] " ans
[[ "${ans,,}" == "y" ]] || { log "Abortado"; exit 1; }

log "2. Trasladar hardware y conectar LAN Alajuela"
read -r -p "¿Servidor conectado en Alajuela? [y/N] " ans
[[ "${ans,,}" == "y" ]] || { log "Abortado"; exit 1; }

log "3. Aplicar red estática ${NEW_IP}"
sudo bash "${ROOT}/scripts/migration/apply-alajuela-network.sh" | tee -a "$LOG"

log "4. Conectividad básica"
ping -c 2 -W 3 10.2.2.1 | tee -a "$LOG"
ping -c 2 -W 3 10.1.1.6 | tee -a "$LOG"

log "5. Actualizar IP en Oracle"
ssh -o BatchMode=yes oracle@10.1.1.6 "bash -s" < "${ROOT}/scripts/migration/update-ubuntu-ip-oracle.sh" | tee -a "$LOG"

log "6. Prueba rsync Oracle → ${NEW_IP} (muestra 64MB)"
ssh -o BatchMode=yes oracle@10.1.1.6 bash -s <<EOF | tee -a "$LOG"
dd if=/dev/zero of=/tmp/cutover-test.bin bs=1M count=64 status=none
rsync -av -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=no" \
  /tmp/cutover-test.bin soporte-ti@${NEW_IP}:/tmp/cutover-test.bin
rm -f /tmp/cutover-test.bin
EOF
rm -f /tmp/cutover-test.bin

log "7. Reactivar crons y verificar mañana 04:00/05:00"
log "=== FIN CORTE — log: $LOG ==="
