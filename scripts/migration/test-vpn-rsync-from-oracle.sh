#!/usr/bin/env bash
# Prueba rsync Oracle→alfaia simulando destino Alajuela (10.2.2.50 vía NAT VPN).
# Ejecutar desde alfaia (.229): bash scripts/migration/test-vpn-rsync-from-oracle.sh [MB]
set -euo pipefail

MB="${1:-512}"
DEST_IP="${UBUNTU_IP:-10.2.2.50}"
ORACLE="oracle@10.1.1.6"
UBUNTU_USER="soporte-ti"
TEST_DIR="/tmp/vpn-rsync-test-$$"
SSH_CMD="ssh -o BatchMode=yes -o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=60"

mkdir -p "$TEST_DIR"

echo "==>> 1. SSH Oracle → ${DEST_IP} (vía VPN)"
${SSH_CMD} "${UBUNTU_USER}@${DEST_IP}" "hostname; mkdir -p ${TEST_DIR}" || {
  echo "FALLO SSH a ${DEST_IP}"
  exit 1
}

echo "==>> 2. MTU (ping -M do -s 1372) Oracle → 10.2.2.8"
ssh -o BatchMode=yes "$ORACLE" "ping -c 2 -M do -s 1372 10.2.2.8 2>&1 | tail -3" || true

echo "==>> 3. Crear muestra ${MB}MB en Oracle"
ssh -o BatchMode=yes "$ORACLE" "dd if=/dev/zero of=/tmp/vpn-rsync-sample.bin bs=1M count=${MB} status=none && ls -lh /tmp/vpn-rsync-sample.bin"

echo "==>> 4. Rsync muestra Oracle → ${DEST_IP} (cronometrado, como cron 05:00)"
START=$(date +%s)
ssh -o BatchMode=yes "$ORACLE" bash -s <<EOF
set -euo pipefail
RSYNC_OPTS=(-av --partial --timeout=600)
SSH_CMD="ssh -o BatchMode=yes -o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=60"
rsync "\${RSYNC_OPTS[@]}" -e "\$SSH_CMD" \
  /tmp/vpn-rsync-sample.bin \
  ${UBUNTU_USER}@${DEST_IP}:${TEST_DIR}/
EOF
END=$(date +%s)
ELAPSED=$((END - START))
MBPS=$(awk "BEGIN {printf \"%.2f\", ${MB}*8/${ELAPSED}}")

echo "Tiempo: ${ELAPSED}s (~${MBPS} Mbps para ${MB}MB)"
ssh -o BatchMode=yes "$ORACLE" "rm -f /tmp/vpn-rsync-sample.bin"
${SSH_CMD} "${UBUNTU_USER}@${DEST_IP}" "rm -rf ${TEST_DIR}"

echo "==>> 5. Dry-run expdp completo (Oracle → ${DEST_IP})"
ssh -o BatchMode=yes "$ORACLE" \
  "rsync -av --dry-run --stats -e '$SSH_CMD' --delete /backups/expdp/ ${UBUNTU_USER}@${DEST_IP}:/mnt/data/backups/oracle/expdp/ 2>&1 | tail -20"

echo "OK prueba VPN rsync"
