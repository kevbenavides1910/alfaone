#!/usr/bin/env bash
# Reinstala / repara el GitHub Actions runner self-hosted en alfaia (.229).
# Requiere GHCR_TOKEN (o GITHUB_TOKEN) con permiso para registration-token del repo.
# Uso: bash scripts/ops/install-github-runner.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/kevbenavides1910/alfaone}"
REPO_API="${REPO_API:-kevbenavides1910/alfaone}"
RUNNER_DIR="${RUNNER_DIR:-/opt/actions-runner-alfaone}"
RUNNER_NAME="${RUNNER_NAME:-alfaia-229}"
LABELS="${LABELS:-self-hosted,linux,x64,alfaia}"
ENV_FILE="${ENV_FILE:-/etc/alfa-one/ghcr.env}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
TOKEN="${GHCR_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "Defina GHCR_TOKEN en $ENV_FILE" >&2
  exit 1
fi

LATEST=$(curl -sS -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/actions/runner/releases/latest \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["tag_name"].lstrip("v"))')

sudo mkdir -p "$RUNNER_DIR"
sudo chown "$(id -u):$(id -g)" "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -f ./config.sh ]; then
  curl -fsSL -o actions-runner-linux-x64.tar.gz \
    "https://github.com/actions/runner/releases/download/v${LATEST}/actions-runner-linux-x64-${LATEST}.tar.gz"
  tar xzf actions-runner-linux-x64.tar.gz
  rm -f actions-runner-linux-x64.tar.gz
fi

reg_token() {
  curl -sS -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${REPO_API}/actions/runners/registration-token" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])'
}

REG=$(reg_token)
if [ -f .runner ]; then
  ./config.sh remove --token "$REG" || true
  REG=$(reg_token)
fi

./config.sh --unattended \
  --url "$REPO_URL" \
  --token "$REG" \
  --name "$RUNNER_NAME" \
  --labels "$LABELS" \
  --work _work \
  --replace

sudo ./svc.sh install "$(id -un)" || true
sudo ./svc.sh start
sudo ./svc.sh status
echo "OK: runner $RUNNER_NAME en $RUNNER_DIR"
