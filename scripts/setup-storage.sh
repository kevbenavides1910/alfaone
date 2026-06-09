#!/usr/bin/env bash
# Crea la estructura de archivos en el disco de datos para Presupuestos-Alfa.
# Ejecutar una vez en el servidor (o tras añadir un nuevo módulo con adjuntos):
#   bash scripts/setup-storage.sh
#   bash scripts/setup-storage.sh --user soporte-ti

set -euo pipefail

STORAGE_ROOT="${APP_DATA_HOST:-/mnt/data/projects/alfa-one/app}"
# UID 1001 = usuario nextjs dentro del contenedor Docker (ver Dockerfile)
RUN_USER="${STORAGE_USER:-1001}"
RUN_GROUP="${STORAGE_GROUP:-1001}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      STORAGE_ROOT="$2"
      shift 2
      ;;
    --user)
      RUN_USER="$2"
      shift 2
      ;;
    --group)
      RUN_GROUP="$2"
      shift 2
      ;;
    -h|--help)
      echo "Uso: $0 [--root /mnt/data/projects/alfa-one/app] [--user 1001]"
      exit 0
      ;;
    *)
      echo "Opción desconocida: $1" >&2
      exit 1
      ;;
  esac
done

if ! mountpoint -q /mnt/data 2>/dev/null && ! mountpoint -q /mnt/storage 2>/dev/null; then
  echo "AVISO: ni /mnt/data ni /mnt/storage están montados. Verifique el disco de datos." >&2
fi

DIRS=(
  "$STORAGE_ROOT"
  "$STORAGE_ROOT/expense-uploads"
  "$STORAGE_ROOT/branding"
  "$STORAGE_ROOT/sig-documents"
  "$STORAGE_ROOT/exports"
  "$STORAGE_ROOT/facturacion-uploads"
)

echo "Creando directorios bajo $STORAGE_ROOT ..."
sudo mkdir -p "${DIRS[@]}"
sudo chown -R "$RUN_USER:$RUN_GROUP" "$STORAGE_ROOT"
sudo chmod -R 755 "$STORAGE_ROOT"

touch "$STORAGE_ROOT/.gitkeep" 2>/dev/null || true

cat <<EOF

Listo. Estructura:
  $STORAGE_ROOT/expense-uploads  → adjuntos de gastos (PDF, imágenes, Excel)
  $STORAGE_ROOT/branding         → logos y firma disciplinaria
  $STORAGE_ROOT/sig-documents    → documentos SIG (DMS)
  $STORAGE_ROOT/exports        → exportaciones / temporales (futuro)
  $STORAGE_ROOT/backups        → respaldos opcionales de archivos

En .env del proyecto defina:
  APP_DATA_HOST=$STORAGE_ROOT

Luego reinicie la app:
  docker compose up -d --build

Documentación: docs/STORAGE.md

EOF

