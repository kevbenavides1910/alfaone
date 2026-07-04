#!/usr/bin/env bash
# Registra Oracle Instant Client en ldconfig (requiere sudo).
# Uso: sudo bash scripts/install-oracle-instant-client-ldconfig.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecute con sudo." >&2
  exit 1
fi

CLIENT_DIR="${NAF_ORACLE_CLIENT_DIR:-/opt/oracle/instantclient_19_23}"

if [ ! -f "$CLIENT_DIR/libclntsh.so" ]; then
  echo "Oracle Instant Client no encontrado en $CLIENT_DIR" >&2
  exit 1
fi

CONF_FILE="/etc/ld.so.conf.d/oracle-instantclient.conf"
echo "$CLIENT_DIR" > "$CONF_FILE"
chmod 644 "$CONF_FILE"
ldconfig

echo "Registrado: $CLIENT_DIR"
ldconfig -p | grep -i clntsh | head -3 || true
