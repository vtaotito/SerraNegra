# Guia para Iniciar os Servidores WMS

## Servidores Disponíveis

1. **API Core** (porta 8000) - API REST principal
2. **Gateway** (porta 3000) - Gateway com SSE/WebSocket e proxy

## 1. Iniciar API Core (Porta 8000)

### Terminal 1:

```bash
# Na raiz do projeto
cd api
npm install  # Se ainda não instalou

# Iniciar servidor em modo dev
npm run dev
```

Ou com configuração customizada:

```bash
API_PORT=8000 \
LOG_LEVEL=info \
JWT_SECRET=dev-secret-dev-secret-dev-secret-dev-secret \
npm run dev
```

### Verificar se está rodando:

```bash
curl http://localhost:8000/health
# Resposta esperada: {"ok":true,"service":"wms-core-api"}
```

## 2. Iniciar Gateway (Porta 3000) - Opcional

### Terminal 2:

```bash
cd gateway
npm install  # Se ainda não instalou

# Iniciar gateway em modo dev
npm run dev
```

Ou com configuração customizada:

```bash
GATEWAY_PORT=3000 \
CORE_BASE_URL=http://localhost:8000 \
LOG_LEVEL=info \
npm run dev
```

### Verificar se está rodando:

```bash
curl http://localhost:3000/health
# Resposta esperada: {"ok":true}
```

## 3. Testar CORS

### No Windows (PowerShell):

```powershell
.\TEST-CORS.ps1
```

### No Linux/Mac (Bash):

```bash
chmod +x TEST-CORS.sh
./TEST-CORS.sh
```

### Ou manualmente:

```bash
# Teste OPTIONS (preflight)
curl -X OPTIONS "http://localhost:8000/orders?limit=50" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: x-user-id,x-user-role,x-user-name" \
  -H "Origin: http://YOUR_VPS_IP:8080" \
  -v

# Teste GET com headers customizados
curl "http://localhost:8000/orders?limit=50" \
  -H "X-User-Id: dev-user" \
  -H "X-User-Role: SUPERVISOR" \
  -H "X-User-Name: Usuário Dev" \
  -H "Origin: http://YOUR_VPS_IP:8080" \
  -v
```

## 4. Testar no Navegador

1. Abrir DevTools (F12)
2. Ir para aba Network
3. No frontend, fazer requisição para `http://localhost:8000/orders`
4. Verificar:
   - Requisição OPTIONS (preflight) - Status 204
   - Requisição GET/POST real - Status 200/201
   - Headers CORS presentes na resposta

## Variáveis de Ambiente

### API Core (.env)

```bash
# API Core
API_PORT=8000
LOG_LEVEL=info
SERVICE_NAME=wms-core-api

# JWT
JWT_SECRET=dev-secret-dev-secret-dev-secret-dev-secret
JWT_EXPIRES_IN=8h
JWT_ISSUER=wms-api
JWT_AUDIENCE=wms-clients

# CORS (produção)
# CORS_ORIGINS=https://wms.exemplo.com,https://dashboard.exemplo.com
```

### Gateway (.env)

```bash
# Gateway
GATEWAY_PORT=3000
CORE_BASE_URL=http://localhost:8000
LOG_LEVEL=info
SERVICE_NAME=wms-gateway

# Segredos
INTERNAL_SHARED_SECRET=dev-internal-secret
```

## Troubleshooting

### Erro: "EADDRINUSE" (porta já em uso)

```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8000 | xargs kill -9
```

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
npm install

# Limpar cache
rm -rf node_modules package-lock.json
npm install
```

### CORS ainda não funciona

1. Verificar que o servidor foi reiniciado após mudanças
2. Confirmar que `@fastify/cors` está instalado
3. Verificar ordem de registro: CORS antes das rotas
4. Limpar cache do navegador (Ctrl+Shift+Del)
5. Testar com curl primeiro (elimina problemas do navegador)

### Headers customizados não aceitos

1. Verificar `allowedHeaders` no CORS
2. Confirmar que OPTIONS retorna 204
3. Verificar DevTools > Network > Headers > Request Headers

### Response headers não visíveis no frontend

1. Adicionar em `exposedHeaders` no CORS
2. Confirmar que headers estão sendo enviados (curl -v)
3. Reiniciar servidor após mudanças

## Logs

### API Core

```bash
# Logs em tempo real
npm run dev

# Com mais detalhes
LOG_LEVEL=debug npm run dev
```

### Gateway

```bash
# Logs em tempo real
npm run dev

# Com mais detalhes
LOG_LEVEL=debug npm run dev
```

## Comandos Úteis

```bash
# Verificar servidores rodando
netstat -ano | findstr "8000 3000"  # Windows
lsof -i :8000,3000                   # Linux/Mac

# Testar conectividade
curl -v http://localhost:8000/health
curl -v http://localhost:3000/health

# Ver logs em tempo real (se rodando como serviço)
# Linux/Mac
tail -f logs/api.log
tail -f logs/gateway.log

# Verificar versão Node.js
node --version  # Deve ser >= 18.0.0

# Instalar dependências em todos os projetos
npm install && cd api && npm install && cd ../gateway && npm install && cd ..
```

## Produção

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      - API_PORT=8000
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGINS=https://wms.exemplo.com
    
  gateway:
    build: ./gateway
    ports:
      - "3000:3000"
    environment:
      - GATEWAY_PORT=3000
      - CORE_BASE_URL=http://api:8000
    depends_on:
      - api
```

### Iniciar com Docker

```bash
docker-compose up -d
docker-compose logs -f
```

---

**Última atualização**: 2026-02-03  
**Pronto para uso!** ✅
