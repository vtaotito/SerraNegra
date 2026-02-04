#!/bin/bash

# ==============================================================================
# Script de Setup - Integração SAP Business One
# ==============================================================================
# Este script automatiza a configuração inicial da integração SAP
# Execute: ./setup-sap-integration.sh
# ==============================================================================

# Cores para output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  Setup - Integração SAP Business One${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# 1. Verificar se .env existe
echo -e "${YELLOW}[1/6] Verificando arquivo .env...${NC}"

if [ -f ".env" ]; then
    echo -e "${GREEN}✓ Arquivo .env encontrado${NC}"
    
    read -p "Deseja sobrescrever com .env.example? (s/N): " resposta
    if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Arquivo .env atualizado${NC}"
    else
        echo -e "${GREEN}✓ Mantendo .env atual${NC}"
    fi
else
    cp .env.example .env
    echo -e "${GREEN}✓ Arquivo .env criado a partir de .env.example${NC}"
fi
echo ""

# 2. Instalar dependências raiz
echo -e "${YELLOW}[2/6] Instalando dependências raiz...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Erro ao instalar dependências raiz${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependências raiz instaladas${NC}"
echo ""

# 3. Instalar dependências do gateway
echo -e "${YELLOW}[3/6] Instalando dependências do gateway...${NC}"
cd gateway
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Erro ao instalar dependências do gateway${NC}"
    cd ..
    exit 1
fi
cd ..
echo -e "${GREEN}✓ Dependências do gateway instaladas${NC}"
echo ""

# 4. Instalar dependências do frontend
echo -e "${YELLOW}[4/6] Instalando dependências do frontend...${NC}"
cd web
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Erro ao instalar dependências do frontend${NC}"
    cd ..
    exit 1
fi
cd ..
echo -e "${GREEN}✓ Dependências do frontend instaladas${NC}"
echo ""

# 5. Compilar TypeScript
echo -e "${YELLOW}[5/6] Compilando TypeScript...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠ Aviso: Erro na compilação (pode ser normal se faltam configurações)${NC}"
else
    echo -e "${GREEN}✓ TypeScript compilado com sucesso${NC}"
fi
echo ""

# 6. Instruções finais
echo -e "${GREEN}[6/6] Configuração concluída!${NC}"
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  PRÓXIMOS PASSOS${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "${YELLOW}1. CONFIGURE AS CREDENCIAIS SAP:${NC}"
echo -e "${WHITE}   Edite o arquivo .env e preencha:${NC}"
echo -e "${GRAY}   - SAP_B1_BASE_URL${NC}"
echo -e "${GRAY}   - SAP_B1_COMPANY_DB${NC}"
echo -e "${GRAY}   - SAP_B1_USERNAME${NC}"
echo -e "${GRAY}   - SAP_B1_PASSWORD${NC}"
echo ""
echo -e "${YELLOW}2. CRIE OS UDFs NO SAP:${NC}"
echo -e "${WHITE}   Execute o script SQL em:${NC}"
echo -e "${GRAY}   sap-connector/SQL_CREATE_UDFS.sql${NC}"
echo ""
echo -e "${YELLOW}3. TESTE A CONEXÃO:${NC}"
echo -e "${WHITE}   tsx sap-connector/examples/quick-test.ts${NC}"
echo ""
echo -e "${YELLOW}4. INICIE OS SERVIÇOS:${NC}"
echo -e "${WHITE}   Terminal 1: cd gateway && npm run dev${NC}"
echo -e "${WHITE}   Terminal 2: cd web && npm run dev${NC}"
echo ""
echo -e "${YELLOW}5. ACESSE O DASHBOARD:${NC}"
echo -e "${WHITE}   http://localhost:5173${NC}"
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  DOCUMENTAÇÃO COMPLETA${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "${WHITE}Leia: SAP_INTEGRATION_QUICKSTART.md${NC}"
echo ""
echo -e "${RED}⚠️  SEGURANÇA:${NC}"
echo -e "${WHITE}   - NUNCA commite o arquivo .env${NC}"
echo -e "${WHITE}   - Use placeholders em exemplos${NC}"
echo -e "${WHITE}   - Não logue senhas ou tokens${NC}"
echo ""
echo -e "${GREEN}✓ Setup completo!${NC}"
echo ""
