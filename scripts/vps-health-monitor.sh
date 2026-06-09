#!/usr/bin/env bash

set -u

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MAX_TIME="${MAX_TIME:-8}"
LOG_DIR="${LOG_DIR:-/var/log/alfa-one}"
APP_CONTAINER="${APP_CONTAINER:-security_contracts_app}"
DB_CONTAINER="${DB_CONTAINER:-security_contracts_db}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${HEALTH_ALERT_ENV:-/etc/alfa-one/health-alert.env}"
HOST_LABEL="${HEALTH_ALERT_HOSTNAME:-alfa-one}"
COOLDOWN_MIN="${HEALTH_ALERT_COOLDOWN_MINUTES:-30}"
ALERT_STAMP="$LOG_DIR/.health-alert-last-sent"

mkdir -p "$LOG_DIR"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
day_stamp="$(date -u +"%Y-%m-%d")"
summary_file="$LOG_DIR/health-$day_stamp.log"

check_endpoint() {
  local endpoint="$1"
  local output
  output="$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" --max-time "$MAX_TIME" "$BASE_URL$endpoint" 2>&1)"
  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    local http_code
    local total_time
    http_code="$(echo "$output" | awk '{print $1}')"
    total_time="$(echo "$output" | awk '{print $2}')"
    echo "$timestamp OK $endpoint code=$http_code time=${total_time}s" >> "$summary_file"
    if [ "$http_code" -ge 500 ]; then
      return 2
    fi
    return 0
  fi

  echo "$timestamp FAIL $endpoint curl_exit=$exit_code details=$output" >> "$summary_file"
  return 1
}

capture_snapshot() {
  local reason="$1"
  local snapshot_file="$LOG_DIR/snapshot-$(date -u +"%Y%m%dT%H%M%SZ").log"

  {
    echo "=== Snapshot UTC $timestamp ==="
    echo "reason: $reason"
    echo "base_url: $BASE_URL"
    echo

    echo "## docker compose ps"
    docker compose -f docker-compose.prod.yml ps 2>&1 || docker ps --format 'table {{.Names}}\t{{.Status}}' 2>&1 || true
    echo

    echo "## docker stats --no-stream"
    docker stats --no-stream 2>&1 || true
    echo

    echo "## free -h"
    free -h 2>&1 || true
    echo

    echo "## df -h"
    df -h 2>&1 || true
    echo

    echo "## dmesg OOM scan"
    dmesg -T 2>/dev/null | grep -Ei "killed process|out of memory|oom" | tail -n 80 || true
    echo

    echo "## app logs tail"
    docker logs --tail 200 "$APP_CONTAINER" 2>&1 || true
    echo

    echo "## db logs tail"
    docker logs --tail 200 "$DB_CONTAINER" 2>&1 || true
    echo
  } > "$snapshot_file"

  echo "$timestamp SNAPSHOT reason=$reason file=$snapshot_file" >> "$summary_file"
  echo "$snapshot_file"
}

should_send_alert() {
  if [ ! -f "$ALERT_STAMP" ]; then
    return 0
  fi
  local last now diff
  last="$(cat "$ALERT_STAMP" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  diff=$((now - last))
  if [ "$diff" -ge $((COOLDOWN_MIN * 60)) ]; then
    return 0
  fi
  return 1
}

send_failure_email() {
  local reason="$1"
  local snapshot_file="$2"

  if [ ! -f "$ENV_FILE" ]; then
    echo "$timestamp SKIP_EMAIL no config $ENV_FILE" >> "$summary_file"
    return 0
  fi

  if ! should_send_alert; then
    echo "$timestamp SKIP_EMAIL cooldown activo (${COOLDOWN_MIN}m)" >> "$summary_file"
    return 0
  fi

  local excerpt
  excerpt="$(tail -n 80 "$snapshot_file" 2>/dev/null || echo '(sin snapshot)')"
  local subject="[ALFA ONE] ALERTA $HOST_LABEL — $reason"
  local body
  body=$(cat <<EOF
Alerta automática — Alfa One

Servidor: $HOST_LABEL
Hora (UTC): $timestamp
Motivo: $reason
URL base: $BASE_URL

Revise el servidor cuanto antes. Detalle:

$excerpt

Log del día: $summary_file
Snapshot: $snapshot_file
EOF
)

  if HEALTH_ALERT_ENV="$ENV_FILE" python3 "$SCRIPT_DIR/send-health-alert-email.py" "$subject" "$body" >> "$summary_file" 2>&1; then
    date +%s > "$ALERT_STAMP"
    echo "$timestamp EMAIL_SENT reason=$reason" >> "$summary_file"
  else
    echo "$timestamp EMAIL_FAILED reason=$reason" >> "$summary_file"
  fi
}

failure_reason=""

check_endpoint "/login" || failure_reason="login_unhealthy"
check_endpoint "/api/auth/session" || failure_reason="${failure_reason:-session_unhealthy}"

if [ -n "$failure_reason" ]; then
  snap="$(capture_snapshot "$failure_reason")"
  send_failure_email "$failure_reason" "$snap"
fi

