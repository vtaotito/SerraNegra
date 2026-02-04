# Script Simplificado de Validação
Write-Host "=== Validação das Correções ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se index.ts não tem rotas duplicadas
Write-Host "1. Verificando index.ts..." -ForegroundColor Yellow
$index = Get-Content "gateway/src/index.ts" -Raw
if ($index -like '*app.get("/api/sap/*') {
    Write-Host "   ERRO: Rotas duplicadas encontradas!" -ForegroundColor Red
} else {
    Write-Host "   OK: Sem rotas duplicadas" -ForegroundColor Green
}

# 2. Verificar se registerSapRoutes é chamado
if ($index -like '*registerSapRoutes(app)*') {
    Write-Host "   OK: registerSapRoutes() presente" -ForegroundColor Green
} else {
    Write-Host "   ERRO: registerSapRoutes() ausente!" -ForegroundColor Red
}

# 3. Verificar endpoint /api/sap/sync
Write-Host ""
Write-Host "2. Verificando endpoint /api/sap/sync..." -ForegroundColor Yellow
$routes = Get-Content "gateway/src/routes/sap.ts" -Raw
if ($routes -like '*app.post("/api/sap/sync*') {
    Write-Host "   OK: Endpoint /api/sap/sync existe" -ForegroundColor Green
} else {
    Write-Host "   ERRO: Endpoint faltando!" -ForegroundColor Red
}

# 4. Verificar tipos
Write-Host ""
Write-Host "3. Verificando tipos SAP..." -ForegroundColor Yellow
$types = Get-Content "sap-connector/src/types.ts" -Raw
if ($types -like '*DocTotal?:*' -and $types -like '*DocCurrency?:*') {
    Write-Host "   OK: Tipos completos" -ForegroundColor Green
} else {
    Write-Host "   ERRO: Tipos incompletos!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Validação Concluída ===" -ForegroundColor Cyan
