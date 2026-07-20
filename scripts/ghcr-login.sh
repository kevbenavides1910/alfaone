#!/usr/bin/env bash
# Login a GHCR para pull de imagenes (ops:deploy:pull).
# Requiere un PAT con scope read:packages (o write:packages) en GHCR_TOKEN o se pide por prompt.
set -euo pipefail

REGISTRY="${GHCR_REGISTRY:-ghcr.io}"
USER_NAME="${GHCR_USER:-${GITHUB_USER:-kevbenavides1910}}"

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login "$REGISTRY" -u "$USER_NAME" --password-stdin
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "$GITHUB_TOKEN" | docker login "$REGISTRY" -u "$USER_NAME" --password-stdin
else
  echo "Exporta GHCR_TOKEN (PAT con read:packages) o introduce el token cuando Docker lo pida."
  docker login "$REGISTRY" -u "$USER_NAME"
fi

echo "OK: login a $REGISTRY como $USER_NAME"
