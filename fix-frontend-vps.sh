#!/bin/bash
# 🔧 Script para corrigir e reconstruir frontend no VPS
# Uso: bash fix-frontend-vps.sh

set -e

echo "🔧 Corrigindo configuração do Frontend no VPS..."
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="/home/wms/wms"
FRONTEND_DIR="$PROJECT_DIR/web-next"

# Verificar se está no VPS
if [ ! -d "$PROJECT_DIR" ]; then
  echo -e "${RED}❌ Diretório $PROJECT_DIR não encontrado${NC}"
  echo -e "${YELLOW}💡 Execute este script no VPS como usuário wms${NC}"
  exit 1
fi

cd "$FRONTEND_DIR" || exit 1

echo -e "${BLUE}📝 Criando .env.production...${NC}"
cat > .env.production <<EOF
# API (PRODUÇÃO - VPS)
# API Core rodando no mesmo VPS (localhost para o servidor)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000

# Auth (produção)
NEXT_PUBLIC_DEV_USER_ID=dev-user
NEXT_PUBLIC_DEV_USER_ROLE=SUPERVISOR
NEXT_PUBLIC_DEV_USER_NAME=Usuário Dev

# Features
NEXT_PUBLIC_ENABLE_MOCK=false
NEXT_PUBLIC_ENABLE_DEVTOOLS=false
EOF

echo -e "${GREEN}✅ .env.production criado${NC}"
echo ""

echo -e "${BLUE}🔍 Verificando status da API...${NC}"
if curl -s http://localhost:8000/health > /dev/null; then
  echo -e "${GREEN}✅ API está rodando na porta 8000${NC}"
else
  echo -e "${RED}❌ API não está respondendo em localhost:8000${NC}"
  echo -e "${YELLOW}💡 Inicie a API primeiro:${NC}"
  echo "   cd $PROJECT_DIR/api && npm run dev"
  echo "   ou"
  echo "   pm2 start ecosystem.config.js"
  exit 1
fi
echo ""

echo -e "${BLUE}🔧 Limpando build anterior...${NC}"
rm -rf .next
rm -rf node_modules/.cache
echo -e "${GREEN}✅ Cache limpo${NC}"
echo ""

echo -e "${BLUE}📦 Instalando dependências...${NC}"
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"
echo ""

echo -e "${BLUE}🏗️  Buildando aplicação...${NC}"
npm run build
echo -e "${GREEN}✅ Build concluído${NC}"
echo ""

echo -e "${BLUE}🔄 Verificando PM2...${NC}"
if pm2 list | grep -q "web-next"; then
  echo -e "${YELLOW}♻️  Reiniciando web-next no PM2...${NC}"
  pm2 restart web-next
  pm2 save
else
  echo -e "${YELLOW}💡 web-next não está no PM2. Iniciando manualmente:${NC}"
  echo "   npm start"
  echo "   ou adicione ao ecosystem.config.js"
fi
echo ""

echo -e "${GREEN}✅ Frontend corrigido e atualizado!${NC}"
echo ""
echo -e "${BLUE}🧪 Testes:${NC}"
echo ""
echo "1️⃣  Testar API diretamente:"
echo "   curl -H 'X-User-Id: dev-user' -H 'X-User-Role: SUPERVISOR' \\"
echo "     http://localhost:8000/api/v1/catalog/items?limit=5"
echo ""
echo "2️⃣  Testar Frontend:"
echo "   - Navegador: http://REDACTED_VPS_IP:8080/produtos"
echo "   - DevTools (F12) > Network"
echo "   - Verificar URL das requisições (sem /api/api)"
echo ""
echo "3️⃣  Ver logs PM2:"
echo "   pm2 logs web-next"
echo ""
echo -e "${BLUE}📊 Status:${NC}"
pm2 status
