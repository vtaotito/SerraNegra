#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/opt/wms}"
ENV_FILE="${ENV_FILE:-$BASE_DIR/shared/.env}"
CURRENT_LINK="$BASE_DIR/current"
TARGET_RELEASE="${1:-}"

if [ -z "$TARGET_RELEASE" ]; then
  if [ -L "$CURRENT_LINK" ]; then
    CURRENT_RELEASE="$(readlink "$CURRENT_LINK")"
    TARGET_RELEASE="$CURRENT_RELEASE"
  else
    echo "Nenhum release atual encontrado."
    exit 1
  fi
fi

if [ ! -d "$TARGET_RELEASE" ]; then
  echo "Release alvo nao existe: $TARGET_RELEASE"
  exit 1
fi

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wms}"

docker compose -f "$TARGET_RELEASE/deploy/docker-compose.yml" --env-file "$ENV_FILE" up -d --build
ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK"

echo "Rollback concluido para $TARGET_RELEASE"
