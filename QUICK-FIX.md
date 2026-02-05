# Fix Rápido - API não está rodando

## Problema

A API na porta 8000 não está respondendo. As requisições do frontend estão falhando.

## Solução Rápida

### 1. Verificar se API está rodando

```powershell
# Verificar processos na porta 8000
netstat -ano | findstr :8000
```

Se não mostrar nada = API **não está rodando**.

### 2. Iniciar a API

**Abra um novo terminal PowerShell:**

```powershell
# Navegar para pasta da API
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms\api"

# Verificar se dependências estão instaladas
if (!(Test-Path "node_modules")) {
    Write-Host "Instalando dependências..." -ForegroundColor Yellow
    npm install
}

# Iniciar API
npm run dev
```

A API deve iniciar e mostrar:

```
Core API online em :8000
```

### 3. Testar API

**Em OUTRO terminal:**

```powershell
# Navegar para raiz do projeto
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# Executar testes
.\test-dashboard.ps1
```

Deve mostrar:
- ✓ API está online
- ✓ Métricas obtidas
- ✓ Pedidos obtidos

## Problemas Comuns

### Erro: "EADDRINUSE" (porta 8000 já em uso)

```powershell
# Encontrar processo usando porta 8000
netstat -ano | findstr :8000

# Resultado exemplo:
# TCP    0.0.0.0:8000    0.0.0.0:0    LISTENING    12345

# Matar processo (substitua 12345 pelo PID real)
taskkill /F /PID 12345

# Tentar novamente
npm run dev
```

### Erro: "Cannot find module"

```powershell
# Limpar e reinstalar
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```

### API inicia mas frontend não conecta

1. **Verificar CORS:**
   - Arquivo `api/server.ts` deve ter configuração CORS
   - Deve incluir headers: X-User-Id, X-User-Role, X-User-Name

2. **Verificar URL do frontend:**
   - Frontend deve fazer requisições para `http://localhost:8000`
   - Verificar DevTools > Network para ver erros

3. **Limpar cache do navegador:**
   - Ctrl+Shift+Del
   - Limpar cache e cookies
   - Recarregar página (F5)

## Checklist Rápido

- [ ] API está rodando? (`netstat -ano | findstr :8000`)
- [ ] Health check funciona? (`curl http://localhost:8000/health`)
- [ ] CORS configurado? (ver `api/server.ts`)
- [ ] Headers permitidos? (X-User-Id, X-User-Role, X-User-Name)
- [ ] Frontend usa URL correta? (`http://localhost:8000`)

## Teste Manual

### PowerShell:

```powershell
# Teste 1: Health
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET

# Teste 2: Dashboard Metrics
$headers = @{
    "X-User-Id" = "dev-user"
    "X-User-Role" = "SUPERVISOR"
    "X-User-Name" = "Usuário Dev"
}
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/dashboard/metrics" -Headers $headers

# Teste 3: Orders
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/orders?limit=10" -Headers $headers
```

## Se Nada Funcionar

1. **Verificar Node.js:**
   ```powershell
   node --version
   # Deve ser >= 18.0.0
   ```

2. **Verificar estrutura de arquivos:**
   ```powershell
   # Deve existir:
   Test-Path api/server.ts          # True
   Test-Path api/package.json       # True
   Test-Path api/services/stubServices.ts  # True
   ```

3. **Reinstalar tudo:**
   ```powershell
   cd api
   Remove-Item -Recurse -Force node_modules, package-lock.json
   npm install
   npm run dev
   ```

4. **Ver logs de erro:**
   - Ao executar `npm run dev`, verificar mensagens de erro
   - Anotar erros e corrigir dependências faltantes

## Contato de Emergência

Se nada resolver:

1. Capturar screenshot do erro em `npm run dev`
2. Capturar saída de `npm list` na pasta `api/`
3. Verificar se há firewall bloqueando porta 8000

---

**Status**: API configurada e pronta  
**Porta**: 8000  
**CORS**: ✅ Configurado  
**Stubs**: ✅ Implementados
