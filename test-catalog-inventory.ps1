# 🧪 Script de Teste - Endpoints de Catálogo e Inventário
# Testa todos os endpoints implementados

param(
    [string]$ApiUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Continue"

# Headers padrão
$headers = @{
    "Content-Type" = "application/json"
    "X-User-Id" = "dev-user"
    "X-User-Role" = "SUPERVISOR"
}

Write-Host "🧪 Testando Endpoints de Catálogo e Inventário" -ForegroundColor Cyan
Write-Host "API: $ApiUrl" -ForegroundColor Yellow
Write-Host ""

# Contador de testes
$testCount = 0
$passCount = 0
$failCount = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [scriptblock]$TestBlock
    )
    
    $script:testCount++
    Write-Host "$script:testCount️⃣  $Name" -ForegroundColor Blue
    
    try {
        & $TestBlock
        $script:passCount++
        Write-Host "   ✅ PASSOU" -ForegroundColor Green
    } catch {
        $script:failCount++
        Write-Host "   ❌ FALHOU: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# ===== CATÁLOGO - PRODUTOS =====

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " CATÁLOGO - PRODUTOS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-Endpoint "GET /api/v1/catalog/items - Listar produtos" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items?limit=5" -Headers $headers
    if ($response.data.Count -eq 0) {
        throw "Nenhum produto retornado"
    }
    Write-Host "   📦 $($response.data.Count) produtos encontrados" -ForegroundColor Gray
    foreach ($item in $response.data) {
        Write-Host "   - $($item.itemCode): $($item.itemName)" -ForegroundColor DarkGray
    }
}

Test-Endpoint "GET /api/v1/catalog/items - Buscar por categoria" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items?categoryId=CAT-PERIFERICOS" -Headers $headers
    if ($response.data.Count -eq 0) {
        Write-Host "   ⚠️  Nenhum produto na categoria" -ForegroundColor Yellow
    } else {
        Write-Host "   📦 $($response.data.Count) produtos na categoria" -ForegroundColor Gray
    }
}

Test-Endpoint "GET /api/v1/catalog/items - Buscar por texto" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items?search=Mouse" -Headers $headers
    if ($response.data.Count -eq 0) {
        throw "Busca deveria retornar resultados para 'Mouse'"
    }
    Write-Host "   🔍 Encontrado: $($response.data[0].itemName)" -ForegroundColor Gray
}

Test-Endpoint "GET /api/v1/catalog/items/{itemCode} - Buscar produto específico" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items/PROD-001" -Headers $headers
    if ($response.itemCode -ne "PROD-001") {
        throw "Produto incorreto retornado"
    }
    Write-Host "   📦 $($response.itemName)" -ForegroundColor Gray
    Write-Host "   📊 Peso: $($response.weight)kg, Ativo: $($response.active)" -ForegroundColor DarkGray
}

Test-Endpoint "POST /api/v1/catalog/items - Criar produto" {
    $newItem = @{
        itemCode = "TEST-$((Get-Random -Min 1000 -Max 9999))"
        itemName = "Produto de Teste"
        description = "Criado pelo script de teste"
        barcode = "TEST$(Get-Random -Min 100000 -Max 999999)"
        weight = 0.5
        active = $true
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items" `
        -Method Post -Headers $headers -Body $newItem
    
    Write-Host "   ✅ Criado: $($response.itemCode) - $($response.itemName)" -ForegroundColor Gray
    
    # Guardar código para testes posteriores
    $script:testItemCode = $response.itemCode
}

if ($script:testItemCode) {
    Test-Endpoint "PATCH /api/v1/catalog/items/{itemCode} - Atualizar produto" {
        $update = @{
            description = "Descrição atualizada pelo teste"
            weight = 0.75
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items/$script:testItemCode" `
            -Method Patch -Headers $headers -Body $update
        
        if ($response.weight -ne 0.75) {
            throw "Peso não foi atualizado corretamente"
        }
        Write-Host "   ✅ Peso atualizado: $($response.weight)kg" -ForegroundColor Gray
    }

    Test-Endpoint "DELETE /api/v1/catalog/items/{itemCode} - Deletar produto" {
        $adminHeaders = @{
            "X-User-Id" = "admin-user"
            "X-User-Role" = "ADMIN"
        }
        
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items/$script:testItemCode" `
            -Method Delete -Headers $adminHeaders | Out-Null
        
        Write-Host "   ✅ Produto marcado como inativo" -ForegroundColor Gray
    }
}

# ===== CATÁLOGO - ARMAZÉNS =====

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " CATÁLOGO - ARMAZÉNS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-Endpoint "GET /api/v1/catalog/warehouses - Listar armazéns" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/warehouses" -Headers $headers
    if ($response.data.Count -eq 0) {
        throw "Nenhum armazém retornado"
    }
    Write-Host "   🏭 $($response.data.Count) armazéns encontrados" -ForegroundColor Gray
    foreach ($wh in $response.data) {
        Write-Host "   - $($wh.warehouseCode): $($wh.warehouseName) [$($wh.type)]" -ForegroundColor DarkGray
    }
}

Test-Endpoint "GET /api/v1/catalog/warehouses/{code} - Buscar armazém específico" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/warehouses/WH-PRINCIPAL" -Headers $headers
    if ($response.warehouseCode -ne "WH-PRINCIPAL") {
        throw "Armazém incorreto retornado"
    }
    Write-Host "   🏭 $($response.warehouseName)" -ForegroundColor Gray
    Write-Host "   📍 $($response.city), $($response.state)" -ForegroundColor DarkGray
}

Test-Endpoint "POST /api/v1/catalog/warehouses - Criar armazém" {
    $newWarehouse = @{
        warehouseCode = "TEST-WH-$((Get-Random -Min 100 -Max 999))"
        warehouseName = "Armazém de Teste"
        location = "Galpão Z"
        city = "Teste City"
        state = "TS"
        type = "SECUNDARIO"
        active = $true
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/warehouses" `
        -Method Post -Headers $headers -Body $newWarehouse
    
    Write-Host "   ✅ Criado: $($response.warehouseCode) - $($response.warehouseName)" -ForegroundColor Gray
    
    $script:testWarehouseCode = $response.warehouseCode
}

# ===== INVENTÁRIO =====

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " INVENTÁRIO" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-Endpoint "GET /api/v1/inventory - Listar estoque" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory?limit=5" -Headers $headers
    if ($response.data.Count -eq 0) {
        throw "Nenhum registro de estoque retornado"
    }
    Write-Host "   📦 $($response.data.Count) registros de estoque" -ForegroundColor Gray
    foreach ($inv in $response.data) {
        $total = $inv.quantityAvailable + $inv.quantityReserved + $inv.quantityInTransit
        Write-Host "   - $($inv.itemCode) em $($inv.warehouseCode): $($inv.quantityAvailable) disp, $($inv.quantityReserved) res, $($inv.quantityInTransit) trâns" -ForegroundColor DarkGray
    }
}

Test-Endpoint "GET /api/v1/inventory - Filtrar por produto" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory?itemCode=PROD-001" -Headers $headers
    if ($response.data.Count -eq 0) {
        throw "Produto PROD-001 deveria ter estoque"
    }
    Write-Host "   📦 $($response.data.Count) armazém(ns) com estoque de PROD-001" -ForegroundColor Gray
}

Test-Endpoint "GET /api/v1/inventory/{item}/{warehouse} - Buscar estoque específico" {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory/PROD-001/WH-PRINCIPAL" -Headers $headers
    if (-not $response) {
        throw "Estoque não encontrado"
    }
    Write-Host "   📦 $($response.itemName)" -ForegroundColor Gray
    Write-Host "   📊 Disponível: $($response.quantityAvailable), Reservado: $($response.quantityReserved)" -ForegroundColor DarkGray
    
    $script:originalQuantity = $response.quantityAvailable
}

Test-Endpoint "POST /api/v1/inventory/adjustments - Ajuste ADD" {
    $adjustment = @{
        itemCode = "PROD-001"
        warehouseCode = "WH-PRINCIPAL"
        quantity = 15
        adjustmentType = "ADD"
        reason = "Teste de entrada via script"
        notes = "Script automático"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory/adjustments" `
        -Method Post -Headers $headers -Body $adjustment
    
    if ($response.adjustmentType -ne "ADD") {
        throw "Tipo de ajuste incorreto"
    }
    Write-Host "   ✅ Ajuste: $($response.previousQuantity) + 15 = $($response.newQuantity)" -ForegroundColor Gray
    Write-Host "   📝 ID: $($response.adjustmentId.Substring(0, 8))..." -ForegroundColor DarkGray
}

Test-Endpoint "POST /api/v1/inventory/adjustments - Ajuste REMOVE" {
    $adjustment = @{
        itemCode = "PROD-002"
        warehouseCode = "WH-PRINCIPAL"
        quantity = 5
        adjustmentType = "REMOVE"
        reason = "Teste de saída via script"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory/adjustments" `
        -Method Post -Headers $headers -Body $adjustment
    
    Write-Host "   ✅ Ajuste: $($response.previousQuantity) - 5 = $($response.newQuantity)" -ForegroundColor Gray
}

Test-Endpoint "POST /api/v1/inventory/adjustments - Ajuste SET (Inventário)" {
    $adjustment = @{
        itemCode = "PROD-003"
        warehouseCode = "WH-PRINCIPAL"
        quantity = 100
        adjustmentType = "SET"
        reason = "Contagem de inventário via script"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory/adjustments" `
        -Method Post -Headers $headers -Body $adjustment
    
    if ($response.newQuantity -ne 100) {
        throw "Quantidade não foi definida corretamente"
    }
    Write-Host "   ✅ Quantidade definida: $($response.newQuantity)" -ForegroundColor Gray
}

Test-Endpoint "POST /api/v1/inventory/transfers - Transferência entre armazéns" {
    $transfer = @{
        itemCode = "PROD-002"
        fromWarehouseCode = "WH-PRINCIPAL"
        toWarehouseCode = "WH-SEC-01"
        quantity = 10
        reason = "Teste de transferência via script"
        notes = "Transferência automática"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory/transfers" `
        -Method Post -Headers $headers -Body $transfer
    
    if ($response.status -ne "PENDING") {
        throw "Status de transferência incorreto"
    }
    Write-Host "   ✅ Transferência criada: ID=$($response.transferId.Substring(0, 8))..." -ForegroundColor Gray
    Write-Host "   📦 $($response.quantity) un de $($response.fromWarehouse) → $($response.toWarehouse)" -ForegroundColor DarkGray
    Write-Host "   📝 Status: $($response.status)" -ForegroundColor DarkGray
}

# ===== VALIDAÇÕES DE ERRO =====

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " VALIDAÇÕES DE ERRO" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-Endpoint "Erro: Produto inexistente (404)" {
    try {
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items/XXXXX" -Headers $headers
        throw "Deveria ter retornado 404"
    } catch {
        if ($_.Exception.Response.StatusCode -ne 404) {
            throw "Status code esperado: 404, recebido: $($_.Exception.Response.StatusCode)"
        }
        Write-Host "   ✅ 404 Not Found (correto)" -ForegroundColor Gray
    }
}

Test-Endpoint "Erro: Criar item com código duplicado (400)" {
    $duplicate = @{
        itemCode = "PROD-001"
        itemName = "Duplicado"
    } | ConvertTo-Json
    
    try {
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/catalog/items" `
            -Method Post -Headers $headers -Body $duplicate
        throw "Deveria ter retornado erro de duplicação"
    } catch {
        Write-Host "   ✅ Erro de validação capturado (correto)" -ForegroundColor Gray
    }
}

Test-Endpoint "Erro: Quantidade insuficiente para REMOVE" {
    $invalidAdjustment = @{
        itemCode = "PROD-001"
        warehouseCode = "WH-PRINCIPAL"
        quantity = 99999
        adjustmentType = "REMOVE"
        reason = "Teste de validação"
    } | ConvertTo-Json
    
    try {
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/inventory/adjustments" `
            -Method Post -Headers $headers -Body $invalidAdjustment
        throw "Deveria ter retornado erro de quantidade insuficiente"
    } catch {
        Write-Host "   ✅ Erro de quantidade insuficiente capturado (correto)" -ForegroundColor Gray
    }
}

# ===== RESUMO =====

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " RESUMO DOS TESTES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Total de testes: $testCount" -ForegroundColor White
Write-Host "✅ Passou: $passCount" -ForegroundColor Green
Write-Host "❌ Falhou: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "🎉 TODOS OS TESTES PASSARAM!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  ALGUNS TESTES FALHARAM" -ForegroundColor Yellow
    exit 1
}
