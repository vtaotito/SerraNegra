# Script de inicialização rápida para desenvolvimento
# USO: .\start-dev.ps1

Write-Host "=== WMS Orchestrator - Inicialização ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se .env existe
if (-not (Test-Path ".env")) {
    Write-Host "⚠ Arquivo .env não encontrado!" -ForegroundColor Yellow
    Write-Host "Copiando .env.example para .env..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "✓ .env criado. EDITE o arquivo com suas credenciais SAP antes de continuar!" -ForegroundColor Green
    Write-Host "  Pressione qualquer tecla após editar o .env..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Verificar variáveis SAP
Write-Host "Verificando configuração SAP..." -ForegroundColor Cyan
$envContent = Get-Content ".env" -Raw

$hasUrl = $envContent -match "SAP_B1_BASE_URL=https://"
$hasDb = $envContent -match "SAP_B1_COMPANY_DB=\w+"
$hasUser = $envContent -match "SAP_B1_USERNAME=\w+"
$hasPass = $envContent -match "SAP_B1_PASSWORD=.+" -and $envContent -notmatch "SAP_B1_PASSWORD=\*+"

if (-not ($hasUrl -and $hasDb -and $hasUser -and $hasPass)) {
    Write-Host "❌ Configuração SAP incompleta no .env!" -ForegroundColor Red
    Write-Host "   Verifique: SAP_B1_BASE_URL, SAP_B1_COMPANY_DB, SAP_B1_USERNAME, SAP_B1_PASSWORD" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "✓ Configuração SAP OK" -ForegroundColor Green
Write-Host ""

# Testar conexão SAP
Write-Host "Testando conexão SAP..." -ForegroundColor Cyan
Set-Location gateway
npm run test:sap

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Falha no teste de conexão SAP!" -ForegroundColor Red
    Write-Host "   Verifique as credenciais no .env e a conectividade de rede." -ForegroundColor Red
    Write-Host ""
    Set-Location ..
    exit 1
}

Set-Location ..
Write-Host ""
Write-Host "✓ Conexão SAP OK" -ForegroundColor Green
Write-Host ""

# Iniciar serviços
Write-Host "Iniciando serviços..." -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Gateway: http://localhost:3000" -ForegroundColor Yellow
Write-Host "🌐 Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pressione Ctrl+C para parar todos os serviços." -ForegroundColor Gray
Write-Host ""

# Criar jobs para rodar em paralelo
$gateway = Start-Job -ScriptBlock {
    Set-Location $using:PWD\gateway
    npm run dev
}

$web = Start-Job -ScriptBlock {
    Set-Location $using:PWD\web
    npm run dev
}

Write-Host "✓ Serviços iniciados!" -ForegroundColor Green
Write-Host ""

# Monitorar jobs
try {
    while ($true) {
        # Mostrar output do gateway
        Receive-Job -Job $gateway

        # Mostrar output do web
        Receive-Job -Job $web

        # Verificar se algum job falhou
        if ($gateway.State -eq "Failed" -or $web.State -eq "Failed") {
            Write-Host ""
            Write-Host "❌ Um dos serviços falhou!" -ForegroundColor Red
            break
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host ""
    Write-Host "Parando serviços..." -ForegroundColor Yellow
    Stop-Job -Job $gateway, $web
    Remove-Job -Job $gateway, $web
    Write-Host "✓ Serviços parados." -ForegroundColor Green
}
