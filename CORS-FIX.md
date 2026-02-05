# Correção de CORS - WMS API

## Problema Identificado

As requisições do frontend (`http://REDACTED_VPS_IP:8080`) para a API (`http://localhost:8000`) estavam falhando devido a:

1. **Headers customizados não permitidos**: `X-User-Id`, `X-User-Role`, `X-User-Name`
2. **Configuração CORS incompleta** nos servidores

## Correções Aplicadas

### 1. API Core (porta 8000) - `api/server.ts`

**Antes:**
```typescript
await app.register(cors, {
  origin: true,
  credentials: true
});
```

**Depois:**
```typescript
await app.register(cors, {
  origin: true, // Em produção, especificar origens permitidas
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-Id",
    "X-User-Name",
    "X-User-Role",
    "X-Correlation-Id",
    "X-Request-Id",
    "Idempotency-Key",
    "Accept",
    "Accept-Version"
  ],
  exposedHeaders: [
    "X-Correlation-Id",
    "X-Request-Id",
    "X-Api-Version"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
});
```

### 2. Gateway (porta 3000) - `gateway/src/index.ts`

Adicionado CORS completo:

```typescript
import cors from "@fastify/cors";

await app.register(cors, {
  origin: true,
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-Id",
    "X-User-Name",
    "X-User-Role",
    "X-Correlation-Id",
    "X-Request-Id",
    "X-Internal-Secret",
    "Idempotency-Key",
    "Accept"
  ],
  exposedHeaders: [
    "X-Correlation-Id",
    "X-Request-Id"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
});
```

## Headers Permitidos

### Request Headers (Enviados pelo Frontend)

- `Content-Type` - Tipo do conteúdo (application/json)
- `Authorization` - Token JWT Bearer
- `X-User-Id` - ID do usuário logado
- `X-User-Name` - Nome do usuário
- `X-User-Role` - Role do usuário (SUPERVISOR, OPERADOR, etc)
- `X-Correlation-Id` - ID de correlação para rastreamento
- `X-Request-Id` - ID único da requisição
- `Idempotency-Key` - Chave de idempotência (POSTs)
- `Accept` - Tipos de resposta aceitos
- `Accept-Version` - Versão da API solicitada

### Response Headers (Expostos ao Frontend)

- `X-Correlation-Id` - ID de correlação (eco do request)
- `X-Request-Id` - ID único da requisição
- `X-Api-Version` - Versão da API (v1, v2, etc)

## Testando

### 1. Requisição OPTIONS (Preflight)

```bash
curl 'http://localhost:8000/orders?limit=50' \
  -X 'OPTIONS' \
  -H 'Accept: */*' \
  -H 'Access-Control-Request-Headers: x-user-id,x-user-name,x-user-role' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Origin: http://REDACTED_VPS_IP:8080' \
  -v
```

**Resposta esperada:**
```
< HTTP/1.1 204 No Content
< access-control-allow-origin: http://REDACTED_VPS_IP:8080
< access-control-allow-credentials: true
< access-control-allow-headers: Content-Type,Authorization,X-User-Id,X-User-Name,X-User-Role,...
< access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
```

### 2. Requisição GET com Headers Customizados

```bash
curl 'http://localhost:8000/orders?limit=50' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR' \
  -H 'X-User-Name: Usuário Dev' \
  -H 'Origin: http://REDACTED_VPS_IP:8080' \
  -v
```

**Resposta esperada:**
```
< HTTP/1.1 200 OK
< access-control-allow-origin: http://REDACTED_VPS_IP:8080
< access-control-allow-credentials: true
< x-correlation-id: <uuid>
< x-request-id: <uuid>
< content-type: application/json

{
  "items": [...],
  "pagination": {...}
}
```

## Configuração de Produção

⚠️ **IMPORTANTE**: Em produção, substitua `origin: true` por lista de origens permitidas:

```typescript
await app.register(cors, {
  origin: [
    "https://wms.exemplo.com",
    "https://dashboard.wms.exemplo.com",
    "http://localhost:3000" // Apenas em dev
  ],
  credentials: true,
  // ... resto da config
});
```

## Variáveis de Ambiente

Para configurar origens CORS via env:

```bash
# .env
CORS_ORIGINS=https://wms.exemplo.com,https://dashboard.wms.exemplo.com
```

```typescript
// No código
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') ?? true;

await app.register(cors, {
  origin: allowedOrigins,
  // ...
});
```

## Troubleshooting

### Erro: "CORS header 'Access-Control-Allow-Origin' missing"

- Verifique se o servidor está rodando
- Verifique se o CORS foi registrado ANTES das rotas
- Confirme que `origin: true` ou a origem está na lista

### Erro: "Request header field X-User-Id is not allowed"

- Adicione o header em `allowedHeaders`
- Reinicie o servidor após alterar a config

### Erro: "Preflight OPTIONS retorna 404"

- Fastify responde automaticamente OPTIONS com CORS ativo
- Verifique se não há rota conflitante
- Confirme que `methods` inclui "OPTIONS"

### Frontend não recebe X-Correlation-Id

- Adicione o header em `exposedHeaders`
- Verifique DevTools > Network > Headers > Response Headers

## Checklist

- [x] CORS configurado no API Core (porta 8000)
- [x] CORS configurado no Gateway (porta 3000)
- [x] Headers customizados permitidos
- [x] Headers de resposta expostos
- [x] Métodos HTTP permitidos
- [x] @fastify/cors instalado em ambos projetos
- [ ] Testar requisição OPTIONS (preflight)
- [ ] Testar requisição GET com headers
- [ ] Testar no navegador com DevTools
- [ ] Configurar origens específicas em produção

## Próximos Passos

1. Reiniciar servidores:
   ```bash
   # API Core
   cd api
   npm run dev
   
   # Gateway
   cd gateway
   npm run dev
   ```

2. Testar no navegador:
   - Abrir DevTools > Network
   - Fazer requisição do frontend
   - Verificar requisição OPTIONS (preflight)
   - Verificar requisição real (GET/POST)
   - Confirmar headers CORS na resposta

3. Se ainda houver problemas:
   - Verificar firewall/proxy
   - Confirmar porta do servidor
   - Testar com `curl -v` para ver headers
   - Verificar logs do servidor

---

**Última atualização**: 2026-02-03  
**Status**: ✅ Corrigido
