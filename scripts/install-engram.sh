#!/usr/bin/env bash
# Instala el binario Engram en .bin/ para MCP de Cursor (Linux amd64/arm64).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/.bin"
VERSION="${ENGRAM_VERSION:-1.16.3}"

arch="$(uname -m)"
case "$arch" in
  x86_64)  suffix="linux_amd64" ;;
  aarch64|arm64) suffix="linux_arm64" ;;
  *)
    echo "Arquitectura no soportada: $arch" >&2
    exit 1
    ;;
esac

mkdir -p "$BIN_DIR"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

url="https://github.com/Gentleman-Programming/engram/releases/download/v${VERSION}/engram_${VERSION}_${suffix}.tar.gz"
echo "Descargando Engram v${VERSION} (${suffix})..."
curl -fsSL "$url" -o "$tmp/engram.tgz"
tar -xzf "$tmp/engram.tgz" -C "$tmp" engram
install -m 755 "$tmp/engram" "$BIN_DIR/engram"

echo "Instalado: $BIN_DIR/engram"
"$BIN_DIR/engram" version 2>/dev/null || "$BIN_DIR/engram" --help | head -1
