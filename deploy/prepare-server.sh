#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-/opt/wms}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
WITH_UFW="${WITH_UFW:-false}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root (ex: sudo $0)"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
    tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi

usermod -aG docker "$DEPLOY_USER"

mkdir -p "$BASE_DIR/releases" "$BASE_DIR/shared"
touch "$BASE_DIR/shared/.env"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$BASE_DIR"

if [ "$WITH_UFW" = "true" ]; then
  apt-get install -y ufw
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

echo "Servidor pronto. Edite $BASE_DIR/shared/.env antes do deploy."
