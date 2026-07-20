#!/usr/bin/env bash
# Guardia contra borrados peligrosos sobre montajes CIFS / expediente.
# Usado por el wrapper interactivo y puede llamarse desde scripts:
#   bash scripts/ops/guard-cifs-path.sh /ruta/a/borrar
#
# Exit 0 = seguro (o sin path). Exit 2 = BLOQUEADO.
set -euo pipefail

PATH_ARG="${1:-}"
if [ -z "$PATH_ARG" ]; then
  exit 0
fi

# Resolver lo más posible sin exigir que exista
RESOLVED="$(realpath -m "$PATH_ARG" 2>/dev/null || echo "$PATH_ARG")"

# Paths canónicos prohibidos para rm -rf agresivo
BLOCK_PREFIXES=(
  /mnt/data/projects/alfa-one/app/expediente-digital
  /u01/EXPEDIENTE_DIGITAL
)

for p in "${BLOCK_PREFIXES[@]}"; do
  case "$RESOLVED" in
    "$p"|"$p"/*)
      echo "BLOQUEADO: '$PATH_ARG' resuelve a ruta de expediente ($RESOLVED)." >&2
      echo "El share CIFS o el disco Oracle no deben limpiarse con rm -rf desde este VPS." >&2
      echo "Para limpiar staging local use /mnt/data/backups/ o /tmp, nunca el mount vivo." >&2
      exit 2
      ;;
  esac
done

# Si el path cae sobre un filesystem CIFS/SMB, bloquear borrados recursivos
if [ -e "$RESOLVED" ] || [ -L "$PATH_ARG" ]; then
  fstype="$(findmnt -no FSTYPE -T "$RESOLVED" 2>/dev/null || true)"
  if [ "$fstype" = "cifs" ] || [ "$fstype" = "smb3" ] || [ "$fstype" = "fuse.sshfs" ]; then
    echo "BLOQUEADO: '$PATH_ARG' está sobre filesystem remoto ($fstype → $RESOLVED)." >&2
    echo "Antes de borrar: findmnt -T '$RESOLVED' && sudo umount '$RESOLVED' (umount completo, no lazy)." >&2
    echo "Incidente 15-jul-2026: rm -rf con CIFS montado borró PDFs en 10.1.1.6." >&2
    exit 2
  fi
fi

exit 0
