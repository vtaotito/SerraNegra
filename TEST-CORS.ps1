# Script PowerShell para testar CORS na API WMS

$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:8000" }
$ORIGIN = if ($env:ORIGIN) { $env:ORIGIN } else { "http://REDACTED_VPS_IP:8080" }

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Teste de CORS - WMS API" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "API URL: $API_URL"
Write-Host "Origin: $ORIGIN"
Write-Host ""

# Teste 1: Health Check
Write-Host "[1] Testando /health (sem CORS)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/health" -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Teste 2: OPTIONS Preflight
Write-Host "[2] Testando OPTIONS preflight..." -ForegroundColor Yellow
Write-Host "Endpoint: $API_URL/orders"
Write-Host "Request headers: x-user-id, x-user-name, x-user-role"
Write-Host ""
try {
    $headers = @{
        "Accept" = "*/*"
        "Access-Control-Request-Headers" = "x-user-id,x-user-name,x-user-role"
        "Access-Control-Request-Method" = "GET"
        "Origin" = $ORIGIN
    }
    $response = Invoke-WebRequest -Uri "$API_URL/orders?limit=50" -Method OPTIONS -Headers $headers -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Headers CORS:"
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -match "access-control|x-" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)"
    }
} catch {
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Teste 3: GET com headers customizados
Write-Host "[3] Testando GET /orders com headers customizados..." -ForegroundColor Yellow
try {
    $headers = @{
        "X-User-Id" = "dev-user"
        "X-User-Role" = "SUPERVISOR"
        "X-User-Name" = "Usuário Dev"
        "Origin" = $ORIGIN
        "Accept" = "application/json"
    }
    $response = Invoke-WebRequest -Uri "$API_URL/orders?limit=50" -Method GET -Headers $headers -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Headers CORS e Custom:"
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -match "access-control|x-|content-type" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)"
    }
} catch {
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Teste 4: POST com Idempotency-Key
Write-Host "[4] Testando POST /orders com Idempotency-Key..." -ForegroundColor Yellow
$idempotencyKey = [guid]::NewGuid().ToString()
try {
    $headers = @{
        "X-User-Id" = "dev-user"
        "X-User-Role" = "SUPERVISOR"
        "X-User-Name" = "Usuário Dev"
        "Origin" = $ORIGIN
        "Content-Type" = "application/json"
        "Idempotency-Key" = $idempotencyKey
    }
    $body = @{
        customerId = "C001"
        items = @(
            @{ sku = "TEST001"; quantity = 10 }
        )
        priority = "NORMAL"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$API_URL/orders" -Method POST -Headers $headers -Body $body -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Headers:"
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -match "access-control|x-|content-type" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)"
    }
} catch {
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Resumo
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Testes concluídos!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verificações:"
Write-Host "  ✓ Status 204 no OPTIONS = Preflight OK"
Write-Host "  ✓ access-control-allow-origin = CORS configurado"
Write-Host "  ✓ access-control-allow-headers = Headers customizados permitidos"
Write-Host "  ✓ x-correlation-id na resposta = Header exposto"
Write-Host ""
Write-Host "Se algum teste falhou, verifique:"
Write-Host "  1. Servidor está rodando na porta correta"
Write-Host "  2. CORS está configurado antes das rotas"
Write-Host "  3. @fastify/cors está instalado"
Write-Host ""
