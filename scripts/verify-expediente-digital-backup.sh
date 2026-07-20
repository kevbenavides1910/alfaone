#!/usr/bin/env bash
# Verifica la réplica local del Expediente Digital (Oracle → Ubuntu .229)
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
CURRENT_DIR="$BACKUP_ROOT/current"
SNAPSHOTS_DIR="$BACKUP_ROOT/snapshots"

echo "=== Réplica Expediente Digital → Ubuntu (.229) ==="
echo "Mirror: $CURRENT_DIR"
df -h /mnt/data | tail -1
echo ""

if [ -f "$BACKUP_ROOT/LAST_OK" ]; then
  echo "LAST_OK: $(cat "$BACKUP_ROOT/LAST_OK")"
else
  echo "LAST_OK: (aún no hay sync exitoso)"
fi
echo ""

if [ -d "$CURRENT_DIR" ]; then
  files=$(find "$CURRENT_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
  size=$(du -sh "$CURRENT_DIR" 2>/dev/null | awk '{print $1}')
  echo "Mirror local: $files archivos, $size"
  echo "Muestra EMPLEADOS:"
  ls "$CURRENT_DIR/EMPLEADOS" 2>/dev/null | head -8 || echo "(sin EMPLEADOS)"
else
  echo "Mirror local: carpeta no existe"
fi

echo ""
echo "Snapshots:"
if [ -d "$SNAPSHOTS_DIR" ]; then
  ls -1d "$SNAPSHOTS_DIR"/*/ 2>/dev/null | tail -10 || echo "(ninguno)"
else
  echo "(ninguno)"
fi

echo ""
echo "=== Origen ${ORACLE_HOST} ==="
ssh -o BatchMode=yes -o ConnectTimeout=10 "${ORACLE_USER}@${ORACLE_HOST}" \
  "du -sh '${ORACLE_EXPEDIENTE_PATH}'; find '${ORACLE_EXPEDIENTE_PATH}' -type f 2>/dev/null | wc -l | xargs echo files:" \
  2>/dev/null || echo "No se pudo consultar Oracle"

echo ""
echo "=== Mount CIFS app (solo lectura ops; NO es el backup) ==="
findmnt -T /mnt/data/projects/alfa-one/app/expediente-digital -o TARGET,SOURCE,FSTYPE,OPTIONS 2>/dev/null \
  || echo "(no montado)"

echo ""
echo "=== Último log backup ==="
latest=$(ls -t "$BACKUP_ROOT"/logs/expediente-backup_*.log 2>/dev/null | head -1 || true)
if [ -n "${latest:-}" ]; then
  echo "$latest"
  tail -12 "$latest"
else
  echo "(sin logs aún)"
fi
