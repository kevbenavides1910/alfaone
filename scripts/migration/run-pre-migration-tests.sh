#!/usr/bin/env bash
# Pruebas pre-mudanza alfaia → Alajuela (10.2.2.50).
# Ejecutar en .229: bash scripts/migration/run-pre-migration-tests.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ORACLE="oracle@10.1.1.6"
ALAJUELA_GW="10.2.2.1"
ALAJUELA_HOST="10.2.2.8"
NEW_IP="10.2.2.50"
MB="${1:-512}"
SSH_ORACLE="ssh -o BatchMode=yes -o ConnectTimeout=30 oracle@10.1.1.6"
RSYNC_SSH="ssh -o BatchMode=yes -o ConnectTimeout=30 -o StrictHostKeyChecking=no -o ServerAliveInterval=60"
TEST_DIR="/tmp/pre-migration-rsync-$$"

cleanup() {
  $SSH_ORACLE "rm -f /tmp/pre-migration-sample.bin" 2>/dev/null || true
  rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$TEST_DIR"

echo "========== A. Conectividad VPN (desde Oracle) =========="
$SSH_ORACLE "ping -c 2 -W 2 ${ALAJUELA_GW} && ping -c 2 -W 2 ${ALAJUELA_HOST}" || true
echo "-- MTU (1372 bytes, no fragmentar) --"
$SSH_ORACLE "ping -c 2 -M do -s 1372 ${ALAJUELA_HOST} 2>&1 | tail -4" || echo "WARN: MTU 1372 falló — revisar MSS clamping en MikroTik"

echo ""
echo "========== B. Rsync Oracle → .229 (LAN, referencia ~${MB}MB) =========="
$SSH_ORACLE "dd if=/dev/zero of=/tmp/pre-migration-sample.bin bs=1M count=${MB} status=none"
START=$(date +%s)
$SSH_ORACLE "rsync -av --partial -e '$RSYNC_SSH' /tmp/pre-migration-sample.bin soporte-ti@10.1.1.229:${TEST_DIR}/"
END=$(date +%s)
ELAPSED=$((END - START))
MBPS=$(awk "BEGIN {printf \"%.1f\", ${MB}*8/${ELAPSED}}")
echo "LAN: ${ELAPSED}s (~${MBPS} Mbps) para ${MB}MB"
echo "Estimado ~30GB dump diario en LAN: ~$(awk "BEGIN {printf \"%.0f\", 30000*${ELAPSED}/${MB}/60}") min"

echo ""
echo "========== C. Dry-run expdp Oracle → .229 (LAN) =========="
$SSH_ORACLE "rsync -av --dry-run --stats -e '$RSYNC_SSH' --delete /backups/expdp/ soporte-ti@10.1.1.229:/mnt/data/backups/oracle/expdp/ 2>&1 | tail -15"

echo ""
echo "========== D. Respaldo .229 → Oracle (simula ruta post-mudanza) =========="
$SSH_ORACLE "mkdir -p /tmp/pre-migration-ubuntu-test"
START=$(date +%s)
dd if=/dev/zero of="${TEST_DIR}/to-oracle.bin" bs=1M count=64 status=none
rsync -av --partial -e "$RSYNC_SSH" "${TEST_DIR}/to-oracle.bin" "oracle@10.1.1.6:/tmp/pre-migration-ubuntu-test/"
END=$(date +%s)
ELAPSED=$((END - START))
echo "Sabana→Oracle (${MB}MB muestra 64MB): ${ELAPSED}s"
$SSH_ORACLE "rm -f /tmp/pre-migration-ubuntu-test/to-oracle.bin"

echo ""
echo "========== E. IP fija preparada =========="
echo "Nueva IP: ${NEW_IP} | MAC: 18:66:da:f1:2f:98"
echo "Netplan: ${ROOT}/scripts/migration/51-alfaia-alajuela.yaml"
echo "Aplicar en mudanza: sudo bash ${ROOT}/scripts/migration/apply-alajuela-network.sh"
echo "Oracle post-mudanza: bash ${ROOT}/scripts/migration/update-ubuntu-ip-oracle.sh"
echo ""
echo "NOTA: Rsync Oracle→${NEW_IP} por VPN se valida el día del corte (sin NAT hairpin)."
echo "OK pruebas pre-mudanza"
