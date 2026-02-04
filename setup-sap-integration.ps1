# ==============================================================================
# Script de Setup - Integração SAP Business One
# ==============================================================================
# Este script automatiza a configuração inicial da integração SAP
# Execute: .\setup-sap-integration.ps1
# ==============================================================================

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Setup - Integração SAP Business One" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se .env existe
Write-Host "[1/6] Verificando arquivo .env..." -ForegroundColor Yellow

if (Test-Path ".env") {
    Write-Host "✓ Arquivo .env encontrado" -ForegroundColor Green
    
    $resposta = Read-Host "Deseja sobrescrever com .env.example? (s/N)"
    if ($resposta -eq "s" -or $resposta -eq "S") {
        Copy-Item ".env.example" ".env" -Force
        Write-Host "✓ Arquivo .env atualizado" -ForegroundColor Green
    } else {
        Write-Host "✓ Mantendo .env atual" -ForegroundColor Green
    }
} else {
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Arquivo .env criado a partir de .env.example" -ForegroundColor Green
}
Write-Host ""

# 2. Instalar dependências raiz
Write-Host "[2/6] Instalando dependências raiz..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Erro ao instalar dependências raiz" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependências raiz instaladas" -ForegroundColor Green
Write-Host ""

# 3. Instalar dependências do gateway
Write-Host "[3/6] Instalando dependências do gateway..." -ForegroundColor Yellow
Set-Location gateway
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Erro ao instalar dependências do gateway" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Host "✓ Dependências do gateway instaladas" -ForegroundColor Green
Write-Host ""

# 4. Instalar dependências do frontend
Write-Host "[4/6] Instalando dependências do frontend..." -ForegroundColor Yellow
Set-Location web
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Erro ao instalar dependências do frontend" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Host "✓ Dependências do frontend instaladas" -ForegroundColor Green
Write-Host ""

# 5. Compilar TypeScript
Write-Host "[5/6] Compilando TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Aviso: Erro na compilação (pode ser normal se faltam configurações)" -ForegroundColor Yellow
} else {
    Write-Host "✓ TypeScript compilado com sucesso" -ForegroundColor Green
}
Write-Host ""

# 6. Instruções finais
Write-Host "[6/6] Configuração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  PRÓXIMOS PASSOS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. CONFIGURE AS CREDENCIAIS SAP:" -ForegroundColor Yellow
Write-Host "   Edite o arquivo .env e preencha:" -ForegroundColor White
Write-Host "   - SAP_B1_BASE_URL" -ForegroundColor Gray
Write-Host "   - SAP_B1_COMPANY_DB" -ForegroundColor Gray
Write-Host "   - SAP_B1_USERNAME" -ForegroundColor Gray
Write-Host "   - SAP_B1_PASSWORD" -ForegroundColor Gray
Write-Host ""
Write-Host "2. CRIE OS UDFs NO SAP:" -ForegroundColor Yellow
Write-Host "   Execute o script SQL em:" -ForegroundColor White
Write-Host "   sap-connector\SQL_CREATE_UDFS.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "3. TESTE A CONEXÃO:" -ForegroundColor Yellow
Write-Host "   tsx sap-connector/examples/quick-test.ts" -ForegroundColor White
Write-Host ""
Write-Host "4. INICIE OS SERVIÇOS:" -ForegroundColor Yellow
Write-Host "   Terminal 1: cd gateway && npm run dev" -ForegroundColor White
Write-Host "   Terminal 2: cd web && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "5. ACESSE O DASHBOARD:" -ForegroundColor Yellow
Write-Host "   http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  DOCUMENTAÇÃO COMPLETA" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Leia: SAP_INTEGRATION_QUICKSTART.md" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  SEGURANÇA:" -ForegroundColor Red
Write-Host "   - NUNCA commite o arquivo .env" -ForegroundColor White
Write-Host "   - Use placeholders em exemplos" -ForegroundColor White
Write-Host "   - Não logue senhas ou tokens" -ForegroundColor White
Write-Host ""
Write-Host "✓ Setup completo!" -ForegroundColor Green
Write-Host ""
