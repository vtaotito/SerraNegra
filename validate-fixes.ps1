# Script de Validação das Correções
# Valida que todas as correções foram aplicadas corretamente

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Validação das Correções - WMS + SAP  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

# 1. Verificar se rotas duplicadas foram removidas do index.ts
Write-Host "1. Verificando remoção de rotas duplicadas..." -ForegroundColor Yellow
$indexContent = Get-Content "gateway/src/index.ts" -Raw
if ($indexContent -match 'app\.get\("/api/sap/') {
    Write-Host "   ❌ ERRO: Rotas SAP ainda estão inline no index.ts!" -ForegroundColor Red
    $errors++
} else {
    Write-Host "   ✅ Rotas SAP não estão mais inline no index.ts" -ForegroundColor Green
}

# 2. Verificar se registerSapRoutes está sendo chamado
Write-Host "2. Verificando chamada para registerSapRoutes..." -ForegroundColor Yellow
if ($indexContent -match "registerSapRoutes\(app\)") {
    Write-Host "   ✅ registerSapRoutes() está sendo chamado" -ForegroundColor Green
} else {
    Write-Host "   ❌ ERRO: registerSapRoutes() não está sendo chamado!" -ForegroundColor Red
    $errors++
}

# 3. Verificar se imports desnecessários foram removidos
Write-Host "3. Verificando remoção de imports desnecessários..." -ForegroundColor Yellow
if ($indexContent -match "getSapService|SapOrdersFilter|SapOrderStatusUpdate") {
    Write-Host "   ❌ ERRO: Imports desnecessários ainda presentes no index.ts!" -ForegroundColor Red
    $errors++
} else {
    Write-Host "   ✅ Imports desnecessários foram removidos" -ForegroundColor Green
}

# 4. Verificar se sapService.ts usa types.ts corretos
Write-Host "4. Verificando tipos em sapService.ts..." -ForegroundColor Yellow
$sapServiceContent = Get-Content "gateway/src/sapService.ts" -Raw
if ($sapServiceContent -match 'from ".*sapTypes\.js"') {
    Write-Host "   ❌ ERRO: sapService.ts ainda importa de sapTypes.ts!" -ForegroundColor Red
    $errors++
} elseif ($sapServiceContent -match 'from ".*types\.js"') {
    Write-Host "   ✅ sapService.ts usa types.ts corretamente" -ForegroundColor Green
} else {
    Write-Host "   ⚠ WARNING: Não foi possível verificar imports" -ForegroundColor Yellow
    $warnings++
}

# 5. Verificar se endpoint /api/sap/sync existe
Write-Host "5. Verificando endpoint /api/sap/sync..." -ForegroundColor Yellow
$sapRoutesContent = Get-Content "gateway/src/routes/sap.ts" -Raw
if ($sapRoutesContent -match 'app\.post\("/api/sap/sync"') {
    Write-Host "   ✅ Endpoint /api/sap/sync está implementado" -ForegroundColor Green
} else {
    Write-Host "   ❌ ERRO: Endpoint /api/sap/sync não encontrado!" -ForegroundColor Red
    $errors++
}

# 6. Verificar se SapOrder tem campos DocTotal e DocCurrency
Write-Host "6. Verificando campos em SapOrder..." -ForegroundColor Yellow
$typesContent = Get-Content "sap-connector/src/types.ts" -Raw
$hasDocTotal = $typesContent -match "DocTotal\?"
$hasDocCurrency = $typesContent -match "DocCurrency\?"
if ($hasDocTotal -and $hasDocCurrency) {
    Write-Host "   ✅ SapOrder tem DocTotal e DocCurrency" -ForegroundColor Green
} else {
    Write-Host "   ❌ ERRO: SapOrder está faltando campos!" -ForegroundColor Red
    if (-not $hasDocTotal) { Write-Host "      - Falta DocTotal" -ForegroundColor Red }
    if (-not $hasDocCurrency) { Write-Host "      - Falta DocCurrency" -ForegroundColor Red }
    $errors++
}

# 7. Verificar se .env está no .gitignore
Write-Host "7. Verificando .gitignore..." -ForegroundColor Yellow
$gitignoreContent = Get-Content ".gitignore" -Raw
if ($gitignoreContent -match "^\.env$" -or $gitignoreContent -match "\n\.env\n" -or $gitignoreContent -match "\n\.env$") {
    Write-Host "   ✅ .env está no .gitignore" -ForegroundColor Green
} else {
    Write-Host "   ⚠ WARNING: .env pode não estar corretamente no .gitignore" -ForegroundColor Yellow
    $warnings++
}

# 8. Verificar se sapTypes.ts ainda existe (deprecado)
Write-Host "8. Verificando arquivo deprecado sapTypes.ts..." -ForegroundColor Yellow
if (Test-Path "sap-connector/src/sapTypes.ts") {
    Write-Host "   ⚠ WARNING: sapTypes.ts ainda existe (deprecado)" -ForegroundColor Yellow
    Write-Host "      Recomendação: Remover após validar que não é usado" -ForegroundColor Yellow
    $warnings++
} else {
    Write-Host "   ✅ sapTypes.ts foi removido (ou nunca existiu)" -ForegroundColor Green
}

# 9. Verificar estrutura de pastas
Write-Host "9. Verificando estrutura de pastas..." -ForegroundColor Yellow
$requiredDirs = @(
    "gateway/src/config",
    "gateway/src/services",
    "gateway/src/routes",
    "sap-connector/src",
    "web/src/api",
    "web/src/pages"
)
$allDirsExist = $true
foreach ($dir in $requiredDirs) {
    if (-not (Test-Path $dir)) {
        Write-Host "   ❌ ERRO: Diretório $dir não encontrado!" -ForegroundColor Red
        $allDirsExist = $false
        $errors++
    }
}
if ($allDirsExist) {
    Write-Host "   ✅ Todas as pastas necessárias existem" -ForegroundColor Green
}

# 10. Verificar arquivos principais
Write-Host "10. Verificando arquivos principais..." -ForegroundColor Yellow
$requiredFiles = @(
    "gateway/src/index.ts",
    "gateway/src/config/sap.ts",
    "gateway/src/services/sapOrdersService.ts",
    "gateway/src/routes/sap.ts",
    "sap-connector/src/types.ts",
    "sap-connector/src/serviceLayerClient.ts",
    "web/src/api/sap.ts",
    "web/src/pages/OrdersDashboard.tsx"
)
$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "   ❌ ERRO: Arquivo $file não encontrado!" -ForegroundColor Red
        $allFilesExist = $false
        $errors++
    }
}
if ($allFilesExist) {
    Write-Host "   ✅ Todos os arquivos principais existem" -ForegroundColor Green
}

# Resumo
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "           RESUMO DA VALIDAÇÃO          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "✅ SUCESSO: Todas as validações passaram!" -ForegroundColor Green
    Write-Host "   O código está pronto para testes." -ForegroundColor Green
    exit 0
} elseif ($errors -eq 0) {
    Write-Host "✅ SUCESSO COM AVISOS: $warnings aviso(s)" -ForegroundColor Yellow
    Write-Host "   As correções principais foram aplicadas." -ForegroundColor Yellow
    Write-Host "   Revise os avisos acima." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ FALHA: $errors erro(s), $warnings aviso(s)" -ForegroundColor Red
    Write-Host "   Corrija os erros acima antes de prosseguir." -ForegroundColor Red
    exit 1
}
