#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/opt/wms}"
ENV_FILE="${ENV_FILE:-$BASE_DIR/shared/.env}"
WEB_PORT="${WEB_PORT:-}"
MAX_RETRIES="${MAX_RETRIES:-10}"
SLEEP_SECONDS="${SLEEP_SECONDS:-3}"

if [ -z "$WEB_PORT" ] && [ -f "$ENV_FILE" ]; then
  WEB_PORT="$(grep -E '^WEB_PORT=' "$ENV_FILE" | tail -n 1 | cut -d= -f2-)"
fi

WEB_PORT="${WEB_PORT:-8080}"

for i in $(seq 1 "$MAX_RETRIES"); do
  if curl -fsS "http://localhost:${WEB_PORT}/healthz" >/dev/null 2>&1; then
    echo "Healthcheck ok."
    exit 0
  fi
  echo "Healthcheck falhou ($i/$MAX_RETRIES). Tentando novamente..."
  sleep "$SLEEP_SECONDS"
done

echo "Healthcheck falhou."
exit 1
