#!/bin/bash
# Script de deploy automatizado para VPS
# Uso: bash deploy-vps.sh

set -e

echo "==========================================="
echo "🚀 WMS - Deploy Automatizado VPS"
echo "==========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variáveis
VPS_USER="wms"
VPS_DIR="/home/wms/wms"
LOG_DIR="/home/wms/logs"

# Função de erro
error_exit() {
    echo -e "${RED}❌ Erro: $1${NC}" 1>&2
    exit 1
}

# Função de sucesso
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Função de aviso
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Verificar se está rodando como usuário correto
if [ "$USER" != "$VPS_USER" ]; then
    error_exit "Execute este script como usuário $VPS_USER"
fi

# Ir para diretório
cd "$VPS_DIR" || error_exit "Diretório $VPS_DIR não encontrado"

echo "📍 Diretório: $VPS_DIR"
echo ""

# Atualizar código (se usando git)
if [ -d ".git" ]; then
    echo "📥 Atualizando código do git..."
    git pull origin main || warning "Erro ao atualizar git (continuando...)"
    success "Código atualizado"
else
    warning "Não é um repositório git, pulando atualização"
fi
echo ""

# Backup da build anterior
if [ -d "api/dist" ]; then
    echo "💾 Fazendo backup da build anterior..."
    cp -r api/dist api/dist.backup
    success "Backup criado"
fi
echo ""

# API Core
echo "🔨 Building API Core..."
cd api || error_exit "Pasta api não encontrada"
npm install --production || error_exit "Erro ao instalar dependências API"
npm run build || error_exit "Erro ao buildar API"
cd ..
success "API Core buildada"
echo ""

# Gateway
echo "🔨 Building Gateway..."
cd gateway || error_exit "Pasta gateway não encontrada"
npm install --production || error_exit "Erro ao instalar dependências Gateway"
npm run build || error_exit "Erro ao buildar Gateway"
cd ..
success "Gateway buildado"
echo ""

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    error_exit "PM2 não está instalado. Execute: npm install -g pm2"
fi

# Reiniciar serviços
echo "♻️  Reiniciando serviços..."
pm2 restart wms-api || pm2 start ecosystem.config.js --only wms-api
pm2 restart wms-gateway || pm2 start ecosystem.config.js --only wms-gateway
success "Serviços reiniciados"
echo ""

# Aguardar serviços estarem prontos
echo "⏳ Aguardando serviços iniciarem..."
sleep 5

# Health checks
echo "🏥 Executando health checks..."
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
GATEWAY_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ "$API_HEALTH" = "200" ]; then
    success "API Core está saudável (200)"
else
    error_exit "API Core health check falhou (HTTP $API_HEALTH)"
fi

if [ "$GATEWAY_HEALTH" = "200" ]; then
    success "Gateway está saudável (200)"
else
    warning "Gateway health check falhou (HTTP $GATEWAY_HEALTH)"
fi
echo ""

# Status PM2
echo "📊 Status dos serviços:"
pm2 status
echo ""

# Logs recentes
echo "📝 Últimas 10 linhas dos logs:"
echo "--- API Core ---"
tail -n 10 "$LOG_DIR/api-out.log" 2>/dev/null || echo "Sem logs ainda"
echo ""
echo "--- Gateway ---"
tail -n 10 "$LOG_DIR/gateway-out.log" 2>/dev/null || echo "Sem logs ainda"
echo ""

# Resumo
echo "==========================================="
echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo "==========================================="
echo ""
echo "Próximos passos:"
echo "  • Verificar logs: pm2 logs"
echo "  • Ver métricas: pm2 monit"
echo "  • Testar API: curl https://api.seudominio.com/health"
echo ""
echo "Em caso de problemas:"
echo "  • Ver logs de erro: pm2 logs --err"
echo "  • Rollback: mv api/dist.backup api/dist && pm2 restart all"
echo ""
