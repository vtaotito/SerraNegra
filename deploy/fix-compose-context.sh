#!/bin/bash
# Corrige docker-compose.yml no VPS quando o clone do GitHub tem
# context: ./gateway ou ./worker (build não vê sap-connector na raiz).
# Uso no VPS: cd /docker/wms-stack && bash -c "$(cat fix-compose-context.sh)" ou copie e rode.

set -e
COMPOSE="docker-compose.yml"
[ -f "$COMPOSE" ] || { echo "Erro: $COMPOSE não encontrado. Rode em /docker/wms-stack"; exit 1; }

# Gateway: context ./gateway -> context . + dockerfile (uma linha vira duas)
sed -i 's|context: ./gateway|context: .\n      dockerfile: gateway/Dockerfile|' "$COMPOSE"
# Worker: idem
sed -i 's|context: ./worker|context: .\n      dockerfile: worker/Dockerfile|' "$COMPOSE"

echo "Compose corrigido. Trecho gateway:"
grep -A4 "container_name: wms-gateway" "$COMPOSE" | head -6
echo ""
echo "Rode: docker compose -f $COMPOSE up -d --build"
