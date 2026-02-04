#!/bin/bash
# Script de deploy completo no Hostinger VPS
# Uso: ./deploy-hostinger.sh

set -e

echo "🚀 Deploy WMS Stack Completo no Hostinger VPS"
echo "=============================================="
echo ""

# Variáveis
VPS_HOST="root@31.97.174.120"
DEPLOY_DIR="/opt/wms"
REPO_URL="https://github.com/vtaotito/SerraNegra.git"

echo "📡 Conectando ao VPS $VPS_HOST..."
echo ""

# Executar comandos no servidor
ssh $VPS_HOST << 'ENDSSH'
set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}✓ Conectado ao VPS${NC}"
echo ""

# 1. Criar diretório de deploy
echo -e "${YELLOW}📁 Criando diretório de deploy...${NC}"
mkdir -p /opt/wms
cd /opt/wms

# 2. Clonar ou atualizar repositório
if [ -d ".git" ]; then
    echo -e "${YELLOW}🔄 Atualizando repositório existente...${NC}"
    git fetch origin
    git reset --hard origin/master
else
    echo -e "${YELLOW}📥 Clonando repositório...${NC}"
    git clone https://github.com/vtaotito/SerraNegra.git .
fi

echo -e "${GREEN}✓ Repositório atualizado${NC}"
echo ""

# 3. Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Criando arquivo .env...${NC}"
    cat > .env << 'EOF'
# Portas
WEB_PORT=8080

# Segurança
INTERNAL_SHARED_SECRET=wms-prod-secret-2026-change-me
POSTGRES_PASSWORD=wms_postgres_prod_2026

# Logs
LOG_LEVEL=info

# Credenciais SAP Business One
SAP_B1_BASE_URL=https://sap-garrafariasnegra-sl.skyinone.net:50000
SAP_B1_COMPANY_DB=SBO_GARRAFARIA_TST
SAP_B1_USERNAME=lorenzo.naves
SAP_B1_PASSWORD=382105

# Configurações SAP opcionais
SAP_B1_TIMEOUT_MS=20000
SAP_B1_MAX_ATTEMPTS=5
SAP_B1_MAX_CONCURRENT=8
SAP_B1_MAX_RPS=10
EOF
    echo -e "${GREEN}✓ Arquivo .env criado${NC}"
else
    echo -e "${GREEN}✓ Arquivo .env já existe${NC}"
fi
echo ""

# 4. Parar containers existentes (se houver)
echo -e "${YELLOW}🛑 Parando containers existentes...${NC}"
docker-compose down 2>/dev/null || true
echo -e "${GREEN}✓ Containers parados${NC}"
echo ""

# 5. Remover containers antigos do MCP se existirem
echo -e "${YELLOW}🧹 Limpando containers antigos do MCP...${NC}"
docker stop wms-web 2>/dev/null || true
docker rm wms-web 2>/dev/null || true
echo -e "${GREEN}✓ Limpeza concluída${NC}"
echo ""

# 6. Build e start da stack completa
echo -e "${YELLOW}🏗️  Construindo e iniciando stack completa...${NC}"
docker-compose up -d --build

echo ""
echo -e "${GREEN}✓ Build concluído, aguardando healthchecks...${NC}"
echo ""

# 7. Aguardar healthchecks
echo -e "${YELLOW}⏳ Aguardando serviços ficarem healthy...${NC}"
sleep 30

# 8. Verificar status
echo ""
echo -e "${GREEN}📊 Status dos containers:${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo ""
echo "🌐 URLs:"
echo "   Frontend: http://31.97.174.120:8080/"
echo "   API: http://31.97.174.120:8080/api/"
echo "   Health: http://31.97.174.120:8080/health"
echo ""
echo "📝 Para ver logs:"
echo "   docker-compose logs -f"
echo ""
echo "🔍 Para verificar status:"
echo "   docker-compose ps"

ENDSSH

echo ""
echo "✅ Deploy remoto concluído!"
