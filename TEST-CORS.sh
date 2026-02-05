#!/bin/bash

# Script para testar CORS na API WMS
# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:8000}"
ORIGIN="${ORIGIN:-http://REDACTED_VPS_IP:8080}"

echo "========================================="
echo "Teste de CORS - WMS API"
echo "========================================="
echo "API URL: $API_URL"
echo "Origin: $ORIGIN"
echo ""

# Teste 1: Health Check (sem CORS)
echo -e "${YELLOW}[1] Testando /health (sem CORS)...${NC}"
curl -s -o /dev/null -w "Status: %{http_code}\n" "$API_URL/health"
echo ""

# Teste 2: OPTIONS Preflight
echo -e "${YELLOW}[2] Testando OPTIONS preflight com headers customizados...${NC}"
echo "Endpoint: $API_URL/orders"
echo "Request headers: x-user-id, x-user-name, x-user-role"
echo ""
curl -v -X OPTIONS "$API_URL/orders?limit=50" \
  -H "Accept: */*" \
  -H "Access-Control-Request-Headers: x-user-id,x-user-name,x-user-role" \
  -H "Access-Control-Request-Method: GET" \
  -H "Origin: $ORIGIN" \
  2>&1 | grep -E "(< HTTP|< access-control|< x-)"
echo ""

# Teste 3: GET com headers customizados
echo -e "${YELLOW}[3] Testando GET /orders com headers customizados...${NC}"
curl -v "$API_URL/orders?limit=50" \
  -H "X-User-Id: dev-user" \
  -H "X-User-Role: SUPERVISOR" \
  -H "X-User-Name: Usuário Dev" \
  -H "Origin: $ORIGIN" \
  -H "Accept: application/json" \
  2>&1 | grep -E "(< HTTP|< access-control|< x-|< content-type)"
echo ""

# Teste 4: POST com Idempotency-Key
echo -e "${YELLOW}[4] Testando POST /orders com Idempotency-Key...${NC}"
IDEMPOTENCY_KEY=$(uuidgen 2>/dev/null || echo "test-$(date +%s)")
curl -v -X POST "$API_URL/orders" \
  -H "X-User-Id: dev-user" \
  -H "X-User-Role: SUPERVISOR" \
  -H "X-User-Name: Usuário Dev" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "customerId": "C001",
    "items": [{"sku": "TEST001", "quantity": 10}],
    "priority": "NORMAL"
  }' \
  2>&1 | grep -E "(< HTTP|< access-control|< x-|< content-type)"
echo ""

# Resumo
echo "========================================="
echo -e "${GREEN}Testes concluídos!${NC}"
echo "========================================="
echo ""
echo "Verificações:"
echo "  ✓ Status 204 no OPTIONS = Preflight OK"
echo "  ✓ access-control-allow-origin = CORS configurado"
echo "  ✓ access-control-allow-headers = Headers customizados permitidos"
echo "  ✓ x-correlation-id na resposta = Header exposto"
echo ""
echo "Se algum teste falhou, verifique:"
echo "  1. Servidor está rodando na porta correta"
echo "  2. CORS está configurado antes das rotas"
echo "  3. @fastify/cors está instalado"
echo ""
