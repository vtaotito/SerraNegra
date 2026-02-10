#!/bin/bash

# Script de Deploy com Correção do Erro de Frontend
# Uso: ./FIX_DEPLOY.sh

set -e  # Parar em caso de erro

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Deploy Corrigido - WMS Frontend + Gateway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Funções auxiliares
function success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function error() {
    echo -e "${RED}❌ $1${NC}"
}

function step() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

# Verificar se está no diretório correto
if [ ! -f "deploy/docker-compose.yml" ]; then
    error "Erro: docker-compose.yml não encontrado!"
    echo "Execute este script no diretório raiz do projeto (wms/)"
    exit 1
fi

step "1/8 - Verificando arquivos necessários..."
if [ ! -d "web-next/features/integration" ]; then
    error "Arquivos de integração não encontrados!"
    echo "Execute: git pull origin main"
    exit 1
fi
success "Arquivos de integração encontrados"

if ! grep -q "@radix-ui/react-tabs" web-next/package.json; then
    error "Dependências Radix UI não encontradas no package.json!"
    echo "Execute: cd web-next && npm install @radix-ui/react-tabs @radix-ui/react-label"
    exit 1
fi
success "Dependências corretas no package.json"

step "2/8 - Parando serviços..."
docker-compose -f deploy/docker-compose.yml down web gateway 2>/dev/null || true
success "Serviços parados"

step "3/8 - Limpando cache de build..."
docker builder prune -f >/dev/null 2>&1
success "Cache limpo"

step "4/8 - Fazendo backup das imagens antigas..."
docker tag wms-web:latest wms-web:backup 2>/dev/null || true
docker tag wms-gateway:latest wms-gateway:backup 2>/dev/null || true
success "Backup criado"

step "5/8 - Reconstruindo imagens (sem cache)..."
echo "   Isso pode levar 3-5 minutos..."
if docker-compose -f deploy/docker-compose.yml build --no-cache web gateway; then
    success "Build concluído com sucesso"
else
    error "Erro no build!"
    echo "Restaurando backup..."
    docker tag wms-web:backup wms-web:latest 2>/dev/null || true
    docker tag wms-gateway:backup wms-gateway:latest 2>/dev/null || true
    exit 1
fi

step "6/8 - Iniciando serviços..."
docker-compose -f deploy/docker-compose.yml up -d web gateway
success "Serviços iniciados"

step "7/8 - Aguardando inicialização..."
echo "   Aguardando 30 segundos..."
sleep 30

step "8/8 - Verificando status..."
if docker ps | grep -q wms-web; then
    success "Frontend está rodando"
else
    error "Frontend não iniciou!"
    echo "Logs:"
    docker logs wms-web --tail 20
    exit 1
fi

if docker ps | grep -q wms-gateway; then
    success "Gateway está rodando"
else
    warning "Gateway não está rodando (verificar logs)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Verificação Final"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar logs
echo ""
echo "📝 Últimas linhas do log do frontend:"
docker logs wms-web --tail 10

# Testar endpoint
echo ""
echo "🌐 Testando endpoint..."
if curl -f -s -I http://localhost:3000/ >/dev/null 2>&1; then
    success "Frontend respondendo (HTTP 200)"
else
    warning "Frontend não está respondendo em localhost:3000"
    echo "   Isso pode ser normal se o Nginx está roteando"
fi

# Informações finais
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deploy Concluído!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 URLs de Acesso:"
echo "   Frontend:    http://YOUR_VPS_IP:8080"
echo "   Integração:  http://YOUR_VPS_IP:8080/integracao"
echo "   API Gateway: http://YOUR_VPS_IP:8080/api"
echo ""
echo "📋 Comandos úteis:"
echo "   Ver logs:         docker logs -f wms-web"
echo "   Verificar status: docker ps | grep wms"
echo "   Reiniciar:        docker-compose -f deploy/docker-compose.yml restart web"
echo ""
echo "🔍 Se houver erro no navegador:"
echo "   1. Pressione F12 (DevTools)"
echo "   2. Veja a aba Console"
echo "   3. Verifique o erro completo"
echo "   4. Execute: docker logs wms-web --tail 50"
echo ""

# Perguntar se quer ver logs completos
read -p "Deseja ver os logs completos do frontend? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    docker logs wms-web --tail 100
fi

echo ""
success "Script finalizado!"
echo ""
