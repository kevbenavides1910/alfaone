#!/usr/bin/env bash
# Cron diario: sincroniza nómina NAF (año en curso).
# Programar en crontab, por ejemplo:
#   15 2 * * * /ruta/presupuestos-alfa/scripts/naf-nomina-sync-cron.sh >> /var/log/naf-nomina-sync.log 2>&1
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$ROOT/scripts/naf-nomina-sync.sh"
