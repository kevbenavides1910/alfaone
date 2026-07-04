#!/usr/bin/env bash
# Activa red estática Alajuela (10.2.2.50) en alfaia. Ejecutar EN sitio, tras conectar cable LAN.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETPLAN_SRC="${ROOT}/scripts/migration/51-alfaia-alajuela.yaml"
NETPLAN_DST="/etc/netplan/51-alfaia-alajuela.yaml"
CLOUD_INIT="/etc/netplan/50-cloud-init.yaml"

if [[ $(id -u) -ne 0 ]]; then
  echo "Ejecutar con sudo"
  exit 1
fi

if [[ ! -f "$NETPLAN_SRC" ]]; then
  echo "No se encuentra $NETPLAN_SRC"
  exit 1
fi

cp -a "$NETPLAN_SRC" "$NETPLAN_DST"
chmod 600 "$NETPLAN_DST"

if [[ -f "$CLOUD_INIT" ]]; then
  mv "$CLOUD_INIT" "${CLOUD_INIT}.sabana.bak"
fi

netplan generate
netplan apply

echo "Red Alajuela aplicada: $(ip -4 addr show eno1 | grep -oP 'inet \K[0-9./]+')"
echo "Gateway: 10.2.2.1 — probar: ping -c2 10.2.2.1 && ping -c2 10.1.1.6"
