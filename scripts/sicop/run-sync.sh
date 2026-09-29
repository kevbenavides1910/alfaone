#!/bin/sh
# SICOP → Alfa One: búsqueda + ingest + last-run.json (cron y n8n Telegram).
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMEOUT_SECS="${SICOP_TIMEOUT_SECS:-180}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ALFA_ONE_URL="${ALFA_ONE_URL:-${BASE_URL}/api/ventas/oportunidades/ingest}"
ALFA_ONE_SECRET="${ALFA_ONE_SECRET:-${SYNTRA_CRON_SECRET:-}}"

LOG_DIR="${LOG_DIR:-/var/log/alfa-one}"
export SICOP_LAST_RUN_FILE="${SICOP_LAST_RUN_FILE:-${LOG_DIR}/sicop-last-run.json}"
export SICOP_LAST_RUN_N8N="${SICOP_LAST_RUN_N8N:-/home/soporte-ti/n8n/scripts/last-run.json}"

if [ -z "$ALFA_ONE_SECRET" ]; then
  echo "ERROR: ALFA_ONE_SECRET o SYNTRA_CRON_SECRET requerido" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

combined="$(
  docker run --rm --network host \
    -v "$SCRIPT_DIR:/scripts:ro" \
    -e "ALFA_ONE_URL=$ALFA_ONE_URL" \
    -e "ALFA_ONE_SECRET=$ALFA_ONE_SECRET" \
    python:3-alpine \
    timeout "$TIMEOUT_SECS" python3 /scripts/sicop_search.py 2>&1
)" || {
  echo "$combined" >&2
  exit 1
}

printf '%s' "$combined" | python3 -c '
import json, os, sys

text = sys.stdin.read()
anchor = text.rfind("\"search_date\"")
if anchor < 0:
    print("ERROR: no JSON SICOP in output", file=sys.stderr)
    sys.exit(1)
brace = text.rfind("{", 0, anchor)
if brace < 0:
    sys.exit(1)
chunk = text[brace:]
depth = 0
end = None
for i, ch in enumerate(chunk):
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
if not end:
    sys.exit(1)
data = json.loads(chunk[:end])
payload = json.dumps(data, ensure_ascii=False, indent=2)
paths = [os.environ.get("SICOP_LAST_RUN_FILE", ""), os.environ.get("SICOP_LAST_RUN_N8N", "")]
for path in paths:
    if not path:
        continue
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(payload)
            f.write("\n")
    except OSError as e:
        print(f"WARN: no se pudo escribir {path}: {e}", file=sys.stderr)
print(payload)
'
