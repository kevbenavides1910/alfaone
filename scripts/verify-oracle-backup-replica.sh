#!/usr/bin/env bash
# Verifica la réplica local de expdp Oracle/Codisa desde 10.1.1.6
set -euo pipefail

BASE="${ORACLE_BACKUP_LOCAL:-/mnt/data/backups/oracle/expdp}"
RETENTION_DAYS="${EXPDP_RETENTION_DAYS:-7}"

echo "=== Réplica expdp Oracle → Ubuntu ==="
echo "Carpeta: $BASE (retención objetivo: ${RETENTION_DAYS} días)"
df -h /mnt/data | tail -1

if [ -d "$BASE" ]; then
  dumps=$(find "$BASE" -name 'Expdp_Full_*.dmp.gz' 2>/dev/null | wc -l)
  size=$(du -sh "$BASE" 2>/dev/null | awk '{print $1}')
  latest=$(ls -t "$BASE"/Expdp_Full_*.dmp.gz 2>/dev/null | head -1)
  latest_name=""
  [ -n "$latest" ] && latest_name=$(basename "$latest")
  echo "Dumps: $dumps archivos, $size total, último: ${latest_name:-(ninguno)}"
  echo ""
  echo "Archivos .dmp.gz:"
  ls -lh "$BASE"/Expdp_Full_*.dmp.gz 2>/dev/null | awk '{print $6, $7, $8, $9}' || echo "(ninguno)"
else
  echo "Carpeta no existe"
fi

echo ""
echo "=== Origen 10.1.1.6 ==="
ssh -o BatchMode=yes -o ConnectTimeout=10 oracle@10.1.1.6 \
  "du -sh /backups/expdp; ls -t /backups/expdp/*.dmp.gz 2>/dev/null | wc -l | xargs echo dumps:" \
  2>/dev/null || echo "No se pudo consultar Oracle"

echo ""
echo "=== Último log rsync ==="
ssh -o BatchMode=yes oracle@10.1.1.6 \
  "f=\$(ls -t /home/oracle/rms/logrsync/rsync_oracle_*.log 2>/dev/null | head -1); [ -n \"\$f\" ] && tail -8 \"\$f\"" \
  2>/dev/null || true
