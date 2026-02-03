# Quick Start — Integração SAP B1 (PowerShell)
# Script para validar setup inicial

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 Quick Start — Integração SAP B1" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js
Write-Host "1️⃣  Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js não encontrado. Instale Node.js >= 18.0" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Instalar dependências
Write-Host "2️⃣  Instalando dependências..." -ForegroundColor Yellow
npm install
Write-Host "   ✅ Dependências instaladas" -ForegroundColor Green
Write-Host ""

# 3. Typecheck
Write-Host "3️⃣  Validando TypeScript..." -ForegroundColor Yellow
npm run typecheck
Write-Host "   ✅ TypeScript OK" -ForegroundColor Green
Write-Host ""

# 4. Build
Write-Host "4️⃣  Compilando..." -ForegroundColor Yellow
npm run build
Write-Host "   ✅ Build concluído (dist/)" -ForegroundColor Green
Write-Host ""

# 5. Verificar .env
Write-Host "5️⃣  Verificando configuração..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Write-Host "   ⚠️  Arquivo .env não encontrado." -ForegroundColor Yellow
    Write-Host "   📝 Copie .env.example para .env e preencha as credenciais:" -ForegroundColor Yellow
    Write-Host "      Copy-Item .env.example .env" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "   ✅ Arquivo .env encontrado" -ForegroundColor Green
    Write-Host ""
}

# 6. Testar conectividade
Write-Host "6️⃣  Testando conectividade SAP..." -ForegroundColor Yellow
Write-Host "   (Executando: node dist/sap-connector/examples/test-connection.js)" -ForegroundColor White
Write-Host ""
node dist/sap-connector/examples/test-connection.js
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Quick Start concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Se o teste de conectividade passou, rode:" -ForegroundColor White
Write-Host "     node dist/sap-connector/examples/basic-usage.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Consulte a documentação:" -ForegroundColor White
Write-Host "     - INTEGRATION_SUMMARY.md (overview)" -ForegroundColor Yellow
Write-Host "     - sap-connector/SETUP.md (setup detalhado)" -ForegroundColor Yellow
Write-Host "     - API_CONTRACTS/sap-b1-integration-contract.md (contrato)" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
