#!/usr/bin/env bash
# Actualiza UBUNTU_IP en Oracle tras mudanza de alfaia a Alajuela (10.2.2.50).
# Ejecutar en 10.1.1.6 como oracle: bash update-ubuntu-ip-oracle.sh
set -euo pipefail

SCRIPT="/home/oracle/rms/rsync_oracle_to_ubuntu.sh"
NEW_IP="${UBUNTU_IP:-10.2.2.50}"
OLD_IP="${OLD_UBUNTU_IP:-10.1.1.229}"

if [[ ! -f "$SCRIPT" ]]; then
  echo "No se encuentra $SCRIPT"
  exit 1
fi

cp -a "$SCRIPT" "${SCRIPT}.bak.$(date +%Y%m%d_%H%M)"

sed -i "s/^UBUNTU_IP=${OLD_IP}/UBUNTU_IP=${NEW_IP}/" "$SCRIPT"
grep '^UBUNTU_IP=' "$SCRIPT"

ssh-keygen -R "$NEW_IP" 2>/dev/null || true
ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new \
  "soporte-ti@${NEW_IP}" "hostname && echo SSH_OK"

echo "Listo. Probar: EXPDP_RETENTION_DAYS=7 $SCRIPT"
