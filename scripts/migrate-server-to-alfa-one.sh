#!/usr/bin/env bash
# Migra archivos de app, config y logs del renombre presupuestos-alfa → alfa-one.
# NO toca PostgreSQL. Los datos de la BD permanecen en:
#   /mnt/data/volumes/postgres/presupuestos-alfa_postgres_data/_data
# Uso: bash scripts/migrate-server-to-alfa-one.sh
set -euo pipefail

OLD_APP="/mnt/data/projects/presupuestos-alfa/app"
NEW_APP="/mnt/data/projects/alfa-one/app"
OLD_ETC="/etc/presupuestos-alfa"
NEW_ETC="/etc/alfa-one"
OLD_LOG="/var/log/presupuestos-alfa"
NEW_LOG="/var/log/alfa-one"

echo "== Alfa One: migración de rutas en servidor =="

if [ -d "$OLD_APP" ] && [ ! -e "$NEW_APP" ]; then
  echo "Moviendo datos de app: $OLD_APP → $NEW_APP"
  mkdir -p "$(dirname "$NEW_APP")"
  mv "$OLD_APP" "$NEW_APP"
elif [ -d "$OLD_APP" ] && [ -d "$NEW_APP" ] && [ -z "$(ls -A "$NEW_APP" 2>/dev/null)" ]; then
  echo "Copiando datos de app (destino vacío)..."
  rsync -a "$OLD_APP/" "$NEW_APP/"
else
  echo "Datos de app: sin cambios (nuevo=$NEW_APP)"
  mkdir -p "$NEW_APP"
fi

bash "$(dirname "$0")/setup-storage.sh" --root "$NEW_APP" 2>/dev/null || true

if [ -d "$OLD_ETC" ] && [ ! -d "$NEW_ETC" ]; then
  echo "Moviendo config: $OLD_ETC → $NEW_ETC"
  mv "$OLD_ETC" "$NEW_ETC"
else
  mkdir -p "$NEW_ETC"
fi

if [ -d "$OLD_LOG" ] && [ ! -d "$NEW_LOG" ]; then
  echo "Moviendo logs: $OLD_LOG → $NEW_LOG"
  mv "$OLD_LOG" "$NEW_LOG"
else
  mkdir -p "$NEW_LOG"
fi

echo ""
echo "Siguiente pasos (como root si aplica):"
echo "  cd /mnt/data/projects/alfa-one/code/presupuestos-alfa"
echo "  docker compose -f docker-compose.prod.yml up -d --build"
echo "  sudo bash scripts/install-production-cron.sh"
echo ""
echo "Si la app sigue en loop de sesión: borre cookies del sitio y recargue."
