# Script para testar endpoints do dashboard
$API_URL = "http://localhost:8000"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Teste dos Endpoints do Dashboard" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Headers comuns
$headers = @{
    "X-User-Id" = "dev-user"
    "X-User-Role" = "SUPERVISOR"
    "X-User-Name" = "Usuário Dev"
    "Accept" = "application/json"
}

# Teste 1: Health Check
Write-Host "[1] Testando /health..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/health" -Method GET
    Write-Host "✓ API está online" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "ATENÇÃO: A API não está rodando! Execute: cd api && npm run dev" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Teste 2: Dashboard Metrics
Write-Host "[2] Testando GET /api/v1/dashboard/metrics..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/metrics" -Method GET -Headers $headers
    Write-Host "✓ Métricas obtidas com sucesso" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Teste 3: Dashboard Orders
Write-Host "[3] Testando GET /api/v1/dashboard/orders?limit=5..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/orders?limit=5" -Method GET -Headers $headers
    Write-Host "✓ Pedidos obtidos com sucesso" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Teste 4: Dashboard Tasks
Write-Host "[4] Testando GET /api/v1/dashboard/tasks?limit=5..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/tasks?limit=5" -Method GET -Headers $headers
    Write-Host "✓ Tarefas obtidas com sucesso" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Teste 5: Catalog Items
Write-Host "[5] Testando GET /api/v1/catalog/items?limit=10..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/catalog/items?limit=10" -Method GET -Headers $headers
    Write-Host "✓ Itens do catálogo obtidos com sucesso" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Teste 6: Orders
Write-Host "[6] Testando GET /api/v1/orders?limit=10..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/orders?limit=10" -Method GET -Headers $headers
    Write-Host "✓ Pedidos obtidos com sucesso" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
} catch {
    Write-Host "✗ Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Testes concluídos!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Notas:" -ForegroundColor Yellow
Write-Host "  • API está usando stub services (dados fictícios)"
Write-Host "  • Para dados reais, implemente os services com DB"
Write-Host "  • CORS está configurado para permitir requisições do frontend"
Write-Host ""
