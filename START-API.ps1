# Script para iniciar a API WMS automaticamente

$API_DIR = Join-Path $PSScriptRoot "api"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Iniciando WMS Core API" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se diretório existe
if (!(Test-Path $API_DIR)) {
    Write-Host "ERRO: Diretório 'api' não encontrado!" -ForegroundColor Red
    Write-Host "Caminho esperado: $API_DIR" -ForegroundColor Yellow
    exit 1
}

# Navegar para diretório da API
Set-Location $API_DIR
Write-Host "Diretório: $API_DIR" -ForegroundColor Gray
Write-Host ""

# Verificar Node.js
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js não encontrado!" -ForegroundColor Red
    Write-Host "Instale Node.js >= 18.0.0 de https://nodejs.org" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Verificar se dependências estão instaladas
if (!(Test-Path "node_modules")) {
    Write-Host "Instalando dependências..." -ForegroundColor Yellow
    Write-Host "Isso pode levar alguns minutos..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Erro ao instalar dependências!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependências instaladas" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "✓ Dependências já instaladas" -ForegroundColor Green
    Write-Host ""
}

# Verificar se porta 8000 está livre
Write-Host "Verificando porta 8000..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠ Porta 8000 já está em uso!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Processos usando porta 8000:" -ForegroundColor Yellow
    Get-NetTCPConnection -LocalPort 8000 | ForEach-Object {
        $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "  PID: $($_.OwningProcess) - $($process.ProcessName)" -ForegroundColor Gray
    }
    Write-Host ""
    
    $kill = Read-Host "Deseja matar esses processos? (S/N)"
    if ($kill -eq "S" -or $kill -eq "s") {
        Get-NetTCPConnection -LocalPort 8000 | ForEach-Object {
            Write-Host "Matando PID $($_.OwningProcess)..." -ForegroundColor Yellow
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
        Write-Host "✓ Processos finalizados" -ForegroundColor Green
    } else {
        Write-Host "Saindo..." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✓ Porta 8000 está livre" -ForegroundColor Green
}
Write-Host ""

# Configurar variáveis de ambiente
Write-Host "Configurando variáveis de ambiente..." -ForegroundColor Yellow
$env:API_PORT = "8000"
$env:LOG_LEVEL = "info"
$env:SERVICE_NAME = "wms-core-api"
$env:JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"
Write-Host "✓ Variáveis configuradas" -ForegroundColor Green
Write-Host ""

# Iniciar API
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Iniciando servidor..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "API estará disponível em: http://localhost:8000" -ForegroundColor Green
Write-Host "Health check: http://localhost:8000/health" -ForegroundColor Gray
Write-Host ""
Write-Host "Pressione Ctrl+C para parar o servidor" -ForegroundColor Yellow
Write-Host ""

# Executar em modo dev (com watch)
npm run dev
