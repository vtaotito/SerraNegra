# 🧪 Teste de URLs do VPS
# Verifica se as requisições estão corretas após correção

param(
    [string]$VpsIp = "31.97.174.120",
    [int]$FrontendPort = 8080,
    [int]$ApiPort = 8000
)

$ErrorActionPreference = "Continue"

Write-Host "🧪 Testando URLs do WMS no VPS..." -ForegroundColor Cyan
Write-Host ""
Write-Host "VPS IP: $VpsIp" -ForegroundColor Yellow
Write-Host "Frontend: http://${VpsIp}:${FrontendPort}" -ForegroundColor Yellow
Write-Host ""

# Headers de autenticação
$headers = @{
    "X-User-Id" = "dev-user"
    "X-User-Role" = "SUPERVISOR"
    "X-User-Name" = "Usuário Dev"
    "Accept" = "application/json"
}

# Função para testar endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers,
        [switch]$ExpectData
    )
    
    Write-Host "📍 $Name" -ForegroundColor Blue
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Headers $Headers -Method Get -TimeoutSec 10
        
        if ($ExpectData) {
            if ($response.data -or $response.items -or $response.orders) {
                Write-Host "   ✅ OK - Dados recebidos" -ForegroundColor Green
                return $true
            } else {
                Write-Host "   ⚠️  OK mas sem dados" -ForegroundColor Yellow
                return $true
            }
        } else {
            Write-Host "   ✅ OK" -ForegroundColor Green
            return $true
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode) {
            Write-Host "   ❌ ERRO $statusCode - $($_.Exception.Message)" -ForegroundColor Red
        } else {
            Write-Host "   ❌ ERRO - $($_.Exception.Message)" -ForegroundColor Red
        }
        return $false
    }
}

# Testes
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " TESTE 1: Health Check (direto na API)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Nota: Isso só funciona se você estiver no VPS ou tiver túnel SSH
Write-Host "⚠️  Nota: Health check direto só funciona se você estiver no VPS" -ForegroundColor Yellow
Write-Host ""

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " TESTE 2: Frontend Acessível" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

try {
    $frontendUrl = "http://${VpsIp}:${FrontendPort}"
    $response = Invoke-WebRequest -Uri $frontendUrl -Method Get -TimeoutSec 10
    Write-Host "✅ Frontend acessível" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Frontend não acessível" -ForegroundColor Red
    Write-Host "   Erro: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " TESTE 3: Endpoints via Frontend" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Estes testes verificam se o frontend consegue fazer proxy" -ForegroundColor Yellow
Write-Host "   Eles devem FALHAR agora (esperado), pois corrigimos o rewrite" -ForegroundColor Yellow
Write-Host ""

# Estes devem falhar agora, pois removemos o rewrite
$test1 = Test-Endpoint `
    -Name "Catálogo de Produtos (via frontend)" `
    -Url "http://${VpsIp}:${FrontendPort}/api/v1/catalog/items?limit=5" `
    -Headers $headers `
    -ExpectData

Write-Host ""

$test2 = Test-Endpoint `
    -Name "Estoque (via frontend)" `
    -Url "http://${VpsIp}:${FrontendPort}/api/v1/inventory?limit=5" `
    -Headers $headers `
    -ExpectData

Write-Host ""

$test3 = Test-Endpoint `
    -Name "Pedidos (via frontend)" `
    -Url "http://${VpsIp}:${FrontendPort}/api/v1/dashboard/orders?limit=5" `
    -Headers $headers `
    -ExpectData

Write-Host ""

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " RESUMO" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "🎯 Comportamento Esperado:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Frontend acessível: ✅ OK" -ForegroundColor Green
Write-Host "2. Endpoints via frontend: ❌ DEVEM FALHAR" -ForegroundColor Yellow
Write-Host "   (Isso é CORRETO! Frontend agora faz requisições diretas)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. No NAVEGADOR, ao acessar http://${VpsIp}:${FrontendPort}/produtos:" -ForegroundColor Cyan
Write-Host "   - DevTools > Network deve mostrar:" -ForegroundColor Gray
Write-Host "   - Requisições para: http://localhost:8000/api/v1/..." -ForegroundColor Green
Write-Host "   - Status 200" -ForegroundColor Green
Write-Host "   - Dados carregados" -ForegroundColor Green
Write-Host ""

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " PRÓXIMOS PASSOS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  Transferir código atualizado:" -ForegroundColor Cyan
Write-Host "   .\package-for-vps.ps1" -ForegroundColor White
Write-Host "   scp wms-deploy-*.tar.gz root@${VpsIp}:/home/wms/" -ForegroundColor White
Write-Host ""

Write-Host "2️⃣  No VPS, executar:" -ForegroundColor Cyan
Write-Host "   ssh root@${VpsIp}" -ForegroundColor White
Write-Host "   su - wms" -ForegroundColor White
Write-Host "   cd /home/wms && tar -xzf wms-deploy-*.tar.gz" -ForegroundColor White
Write-Host "   cd wms && bash fix-frontend-vps.sh" -ForegroundColor White
Write-Host ""

Write-Host "3️⃣  Testar no navegador:" -ForegroundColor Cyan
Write-Host "   http://${VpsIp}:${FrontendPort}/produtos" -ForegroundColor White
Write-Host ""

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Testes concluídos!" -ForegroundColor Green
Write-Host ""
