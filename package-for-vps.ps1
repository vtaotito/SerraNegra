# Script para empacotar aplicação para enviar ao VPS

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$packageName = "wms-deploy-$timestamp.tar.gz"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📦 Empacotando WMS para VPS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se tar está disponível
if (!(Get-Command tar -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Comando 'tar' não encontrado!" -ForegroundColor Red
    Write-Host "Windows 10 1803+ tem tar nativo. Atualize seu Windows." -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Preparando arquivos..." -ForegroundColor Yellow

# Lista de arquivos/pastas para incluir
$includes = @(
    "api/src",
    "api/package.json",
    "api/tsconfig.json",
    "gateway/src",
    "gateway/package.json",
    "gateway/tsconfig.json",
    "wms-core/src",
    "sap-connector/src",
    "mappings/src",
    "observability",
    "package.json",
    "tsconfig.json",
    "ecosystem.config.js",
    "deploy-vps.sh",
    "openapi-rest.yaml"
)

# Verificar se arquivos existem
$missing = @()
foreach ($item in $includes) {
    if (!(Test-Path $item)) {
        $missing += $item
    }
}

if ($missing.Count -gt 0) {
    Write-Host "⚠️  Arquivos faltando:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    Write-Host ""
    $continue = Read-Host "Continuar mesmo assim? (S/n)"
    if ($continue -ne "S" -and $continue -ne "s" -and $continue -ne "") {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "✅ Arquivos verificados" -ForegroundColor Green
Write-Host ""

# Criar ecosystem.config.js se não existir
if (!(Test-Path "ecosystem.config.js")) {
    Write-Host "📝 Criando ecosystem.config.js..." -ForegroundColor Yellow
    @"
module.exports = {
  apps: [
    {
      name: 'wms-api',
      script: './api/dist/server.js',
      cwd: '/home/wms/wms',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production', API_PORT: 8000 },
      error_file: '/home/wms/logs/api-error.log',
      out_file: '/home/wms/logs/api-out.log',
      max_memory_restart: '500M',
      autorestart: true
    },
    {
      name: 'wms-gateway',
      script: './gateway/dist/index.js',
      cwd: '/home/wms/wms',
      instances: 1,
      env: { NODE_ENV: 'production', GATEWAY_PORT: 3000 },
      error_file: '/home/wms/logs/gateway-error.log',
      out_file: '/home/wms/logs/gateway-out.log',
      max_memory_restart: '300M',
      autorestart: true
    }
  ]
};
"@ | Out-File -FilePath "ecosystem.config.js" -Encoding UTF8
    Write-Host "✅ ecosystem.config.js criado" -ForegroundColor Green
}

Write-Host ""
Write-Host "📦 Criando pacote $packageName..." -ForegroundColor Yellow

# Criar arquivo tar.gz
$itemsToInclude = $includes | Where-Object { Test-Path $_ }
tar -czf $packageName $itemsToInclude

if (!(Test-Path $packageName)) {
    Write-Host "❌ Erro ao criar pacote!" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $packageName).Length / 1MB
Write-Host "✅ Pacote criado: $packageName ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
Write-Host ""

# Instruções
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📤 Próximos Passos" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Transferir para VPS:" -ForegroundColor Yellow
Write-Host "   scp $packageName wms@SEU_VPS_IP:/home/wms/" -ForegroundColor Gray
Write-Host ""
Write-Host "2. No VPS, executar:" -ForegroundColor Yellow
Write-Host "   ssh wms@SEU_VPS_IP" -ForegroundColor Gray
Write-Host "   cd /home/wms" -ForegroundColor Gray
Write-Host "   tar -xzf $packageName" -ForegroundColor Gray
Write-Host "   cd wms" -ForegroundColor Gray
Write-Host "   bash deploy-vps.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Configurar .env no VPS:" -ForegroundColor Yellow
Write-Host "   nano api/.env" -ForegroundColor Gray
Write-Host "   nano gateway/.env" -ForegroundColor Gray
Write-Host ""
Write-Host "Arquivo pronto: $packageName" -ForegroundColor Green
Write-Host ""
