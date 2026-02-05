#!/bin/bash
# Script de setup inicial do VPS
# Execute como root: bash setup-vps.sh

set -e

echo "==========================================="
echo "🛠️  WMS - Setup Inicial VPS"
echo "==========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Execute como root: sudo bash setup-vps.sh${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Este script irá:${NC}"
echo "  1. Atualizar sistema Ubuntu"
echo "  2. Instalar Node.js 18.x"
echo "  3. Instalar PM2, Nginx, Git"
echo "  4. Criar usuário 'wms'"
echo "  5. Configurar firewall"
echo ""
read -p "Continuar? (S/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]] && [[ ! -z $REPLY ]]; then
    echo "Cancelado."
    exit 0
fi
echo ""

# 1. Atualizar sistema
echo -e "${YELLOW}[1/6] Atualizando sistema...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✅ Sistema atualizado${NC}"
echo ""

# 2. Instalar Node.js 18.x
echo -e "${YELLOW}[2/6] Instalando Node.js 18.x...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "Node.js já instalado: $NODE_VERSION"
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js instalado: $NODE_VERSION${NC}"
fi
echo ""

# 3. Instalar ferramentas
echo -e "${YELLOW}[3/6] Instalando PM2, Nginx, Git...${NC}"
npm install -g pm2
apt install -y nginx git curl wget
echo -e "${GREEN}✅ Ferramentas instaladas${NC}"
echo ""

# 4. Criar usuário wms
echo -e "${YELLOW}[4/6] Criando usuário 'wms'...${NC}"
if id "wms" &>/dev/null; then
    echo "Usuário 'wms' já existe"
else
    adduser wms --disabled-password --gecos ""
    echo -e "${GREEN}✅ Usuário 'wms' criado${NC}"
fi

# Criar estrutura de diretórios
mkdir -p /home/wms/wms
mkdir -p /home/wms/logs
chown -R wms:wms /home/wms
echo -e "${GREEN}✅ Diretórios criados${NC}"
echo ""

# 5. Configurar firewall
echo -e "${YELLOW}[5/6] Configurando firewall...${NC}"
ufw --force enable
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
echo -e "${GREEN}✅ Firewall configurado${NC}"
echo ""

# 6. Instalar certbot (SSL)
echo -e "${YELLOW}[6/6] Instalando certbot (SSL)...${NC}"
apt install -y certbot python3-certbot-nginx
echo -e "${GREEN}✅ Certbot instalado${NC}"
echo ""

# Resumo
echo "==========================================="
echo -e "${GREEN}✅ Setup VPS concluído!${NC}"
echo "==========================================="
echo ""
echo -e "${BLUE}Informações:${NC}"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  PM2: $(pm2 --version)"
echo "  Nginx: $(nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+')"
echo ""
echo -e "${BLUE}Usuário criado:${NC}"
echo "  Username: wms"
echo "  Home: /home/wms"
echo "  App dir: /home/wms/wms"
echo "  Logs: /home/wms/logs"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "  1. Configurar DNS:"
echo "     api.seudominio.com → $( hostname -I | awk '{print $1}')"
echo "     gateway.seudominio.com → $( hostname -I | awk '{print $1}')"
echo ""
echo "  2. Transferir código:"
echo "     # No Windows:"
echo "     scp wms-deploy.tar.gz wms@SEU_VPS_IP:/home/wms/"
echo ""
echo "  3. Como usuário 'wms', executar:"
echo "     su - wms"
echo "     cd /home/wms"
echo "     tar -xzf wms-deploy.tar.gz"
echo "     cd wms"
echo "     bash deploy-vps.sh"
echo ""
echo "  4. Configurar SSL:"
echo "     sudo certbot --nginx -d api.seudominio.com -d gateway.seudominio.com"
echo ""
echo -e "${GREEN}Setup completo! VPS está pronto para receber a aplicação.${NC}"
