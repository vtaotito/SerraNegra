#!/bin/bash
# Quick Start — Integração SAP B1
# Script para validar setup inicial

set -e

echo "=========================================="
echo "🚀 Quick Start — Integração SAP B1"
echo "=========================================="
echo ""

# 1. Verificar Node.js
echo "1️⃣  Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js >= 18.0"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "   ✅ Node.js $NODE_VERSION"
echo ""

# 2. Instalar dependências
echo "2️⃣  Instalando dependências..."
npm install
echo "   ✅ Dependências instaladas"
echo ""

# 3. Typecheck
echo "3️⃣  Validando TypeScript..."
npm run typecheck
echo "   ✅ TypeScript OK"
echo ""

# 4. Build
echo "4️⃣  Compilando..."
npm run build
echo "   ✅ Build concluído (dist/)"
echo ""

# 5. Verificar .env
echo "5️⃣  Verificando configuração..."
if [ ! -f .env ]; then
    echo "   ⚠️  Arquivo .env não encontrado."
    echo "   📝 Copie .env.example para .env e preencha as credenciais:"
    echo "      cp .env.example .env"
    echo ""
else
    echo "   ✅ Arquivo .env encontrado"
    echo ""
fi

# 6. Testar conectividade
echo "6️⃣  Testando conectividade SAP..."
echo "   (Executando: node dist/sap-connector/examples/test-connection.js)"
echo ""
node dist/sap-connector/examples/test-connection.js
echo ""

echo "=========================================="
echo "✅ Quick Start concluído!"
echo ""
echo "Próximos passos:"
echo "  1. Se o teste de conectividade passou, rode:"
echo "     node dist/sap-connector/examples/basic-usage.js"
echo ""
echo "  2. Consulte a documentação:"
echo "     - INTEGRATION_SUMMARY.md (overview)"
echo "     - sap-connector/SETUP.md (setup detalhado)"
echo "     - API_CONTRACTS/sap-b1-integration-contract.md (contrato)"
echo "=========================================="
