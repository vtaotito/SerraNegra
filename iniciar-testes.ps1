# Script para Iniciar Serviços e Testar
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando Serviços WMS + SAP         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar .env
if (-not (Test-Path ".env")) {
    Write-Host "ERRO: Arquivo .env não encontrado!" -ForegroundColor Red
    Write-Host "Execute: cp .env.example .env" -ForegroundColor Yellow
    Write-Host "E configure suas credenciais SAP." -ForegroundColor Yellow
    exit 1
}

Write-Host "Verificando portas..." -ForegroundColor Yellow

# 2. Verificar se portas estão em uso
$gatewayPort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$frontendPort = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($gatewayPort) {
    Write-Host "Porta 3000 já está em uso (Gateway pode estar rodando)" -ForegroundColor Green
} else {
    Write-Host "Porta 3000 livre - Gateway precisa ser iniciado" -ForegroundColor Yellow
}

if ($frontendPort) {
    Write-Host "Porta 5173 já está em uso (Frontend pode estar rodando)" -ForegroundColor Green
} else {
    Write-Host "Porta 5173 livre - Frontend precisa ser iniciado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instruções:                          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Iniciar Gateway:" -ForegroundColor Yellow
Write-Host "   cd gateway" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "2. Iniciar Frontend (novo terminal):" -ForegroundColor Yellow
Write-Host "   cd web" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. Abrir no navegador:" -ForegroundColor Yellow
Write-Host "   http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "4. Testar funcionalidades:" -ForegroundColor Yellow
Write-Host "   - Botão 'Importar do SAP' (canto superior direito)" -ForegroundColor White
Write-Host "   - Drag & drop de pedidos" -ForegroundColor White
Write-Host "   - Detalhes do pedido (clicar em um card)" -ForegroundColor White
Write-Host ""
Write-Host "Consulte GUIA_DE_TESTES.md para detalhes completos." -ForegroundColor Cyan
Write-Host ""
