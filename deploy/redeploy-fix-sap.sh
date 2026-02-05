#!/bin/bash
set -e

# Script para redeployar serviços afetados pelas correções SAP
# Uso: bash deploy/redeploy-fix-sap.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="/opt/wms/shared/.env"
COMPOSE_FILE="$PROJECT_ROOT/deploy/docker-compose.yml"

echo "=== WMS: Redeploy para corrigir integração SAP ==="
echo "Projeto: $PROJECT_ROOT"
echo "Env: $ENV_FILE"
echo ""

# Validar que .env existe
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Erro: arquivo .env não encontrado em $ENV_FILE"
  echo "Crie o arquivo com as credenciais SAP e secrets necessários."
  exit 1
fi

# Validar que variáveis SAP estão presentes
echo "Validando variáveis SAP..."
missing=0
for var in SAP_B1_BASE_URL SAP_B1_COMPANY_DB SAP_B1_USERNAME SAP_B1_PASSWORD; do
  if ! grep -q "^${var}=" "$ENV_FILE"; then
    echo "⚠️  Variável $var não encontrada no .env"
    missing=$((missing + 1))
  fi
done

if [ $missing -gt 0 ]; then
  echo ""
  echo "⚠️  Algumas variáveis SAP estão faltando no .env."
  echo "O worker não conseguirá sincronizar pedidos sem elas."
  echo "Deseja continuar mesmo assim? (y/n)"
  read -r response
  if [ "$response" != "y" ]; then
    echo "Deploy cancelado."
    exit 1
  fi
fi

echo "✅ Validação concluída."
echo ""

# Rebuild serviços afetados
echo "🔨 Rebuilding serviços (web, gateway, worker)..."
cd "$PROJECT_ROOT"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache web gateway worker

echo ""
echo "🚀 Subindo stack atualizada..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo ""
echo "⏳ Aguardando serviços ficarem saudáveis..."
sleep 10

echo ""
echo "📋 Status dos serviços:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo ""
echo "✅ Redeploy concluído!"
echo ""
echo "📊 Validação rápida:"
echo "1. Health check:"
echo "   curl -i http://localhost:8080/health"
echo ""
echo "2. API orders:"
echo "   curl -i http://localhost:8080/api/orders?limit=5"
echo ""
echo "3. SAP health:"
echo "   curl -i http://localhost:8080/api/sap/health"
echo ""
echo "4. Frontend (navegador):"
echo "   http://31.97.174.120:8080/"
echo "   Deve mostrar 'Fonte: API' (não 'Mock local')"
echo ""
echo "5. Logs do worker (sincronização SAP):"
echo "   docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f worker"
echo ""
echo "📖 Documentação completa: docs/VALIDACAO_CADEIA_SAP.md"
