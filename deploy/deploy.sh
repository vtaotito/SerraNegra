#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/opt/wms}"
ENV_FILE="${ENV_FILE:-$BASE_DIR/shared/.env}"
RELEASE_TS="${RELEASE_TS:-$(date +%Y%m%d%H%M%S)}"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_TS"
CURRENT_LINK="$BASE_DIR/current"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente nao encontrado: $ENV_FILE"
  exit 1
fi

mkdir -p "$RELEASE_DIR"

rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "dist" \
  --exclude "web/dist" \
  --exclude "deploy/.env" \
  --exclude "releases" \
  --exclude "current" \
  --exclude ".next" \
  ./ "$RELEASE_DIR/"

# IMPORTANTE: o stack em producao roda no projeto Compose "deploy" (volume de
# dados = deploy_postgres_data). Se usarmos outro nome (ex.: "wms"), o Compose
# criaria/usaria um volume DIFERENTE e VAZIO (wms_postgres_data) e ainda colidiria
# com os container_name fixos ja em uso. Mantenha "deploy" para apontar para o
# banco correto e recriar os containers existentes no lugar.
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-deploy}"

PREVIOUS_RELEASE=""
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_RELEASE="$(readlink "$CURRENT_LINK")"
fi

docker compose -f "$RELEASE_DIR/deploy/docker-compose.yml" --env-file "$ENV_FILE" up -d --build

if "$RELEASE_DIR/deploy/healthcheck.sh"; then
  ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
  echo "Deploy ok: $RELEASE_DIR"
  exit 0
fi

echo "Deploy falhou. Iniciando rollback..."
if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
  "$RELEASE_DIR/deploy/rollback.sh" "$PREVIOUS_RELEASE"
  exit 1
fi

echo "Nenhum release anterior encontrado para rollback."
exit 1
