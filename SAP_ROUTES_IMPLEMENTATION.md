# Implementação das Rotas SAP no Gateway

## ✅ Alterações Realizadas

### 1. **Logger com Mascaramento de Segredos**

**Arquivo:** `observability/logger.ts`

**Alterações:**
- ✅ Adicionado suporte para `redactPaths` nas options
- ✅ Mascaramento automático de campos sensíveis:
  - `password`, `Password`, `PASSWORD`
  - `token`, `Token`, `TOKEN`
  - `secret`, `Secret`, `SECRET`
  - `apiKey`, `api_key`
  - `authorization`, `Authorization`
  - `credentials.password`
- ✅ Usa recurso nativo do Pino `redact` com `[REDACTED]` como censor

**Exemplo de uso:**
```typescript
const logger = createLogger({ 
  name: "sap-service",
  redactPaths: ["credentials.password", "password"]
});

// Logs automaticamente mascaram segredos
logger.info("Login SAP", { 
  credentials: { username: "user", password: "secret123" }
});
// Output: { credentials: { username: "user", password: "[REDACTED]" } }
```

### 2. **SAP Service com Instrumentação**

**Arquivo:** `gateway/src/sapService.ts`

**Alterações:**
- ✅ Importado `instrumentSapClient` da observability
- ✅ Logger configurado com mascaramento automático
- ✅ Client SAP instrumentado antes do uso:
  ```typescript
  const rawClient = new SapServiceLayerClient({ ... });
  this.client = instrumentSapClient(rawClient, {
    logger,
    componentName: "sap-gateway"
  });
  ```
- ✅ Todas as requisições SAP agora geram:
  - Traces (OpenTelemetry spans)
  - Métricas (duração, contadores)
  - Logs estruturados

### 3. **Rotas SAP no Gateway**

**Arquivo:** `gateway/src/index.ts`

#### 3.1 GET `/api/sap/health`

**Funcionalidade:** Testa conexão com SAP  
**Formato de resposta (conforme `web/src/api/sap.ts`):**
```typescript
{
  ok: boolean,
  message: string,
  timestamp: string
}
```

**Melhorias implementadas:**
- ✅ Propagação de `X-Correlation-Id` para SapService
- ✅ Logs estruturados com `action: "sap.health.check"`
- ✅ Status code correto: 200 (ok) ou 503 (falha de conexão)
- ✅ Tratamento de erros com mascaramento de stacktraces sensíveis

**Exemplo de log:**
```json
{
  "level": "info",
  "correlationId": "corr_abc123",
  "action": "sap.health.check",
  "message": "Testando conexão SAP"
}
```

#### 3.2 GET `/api/sap/orders`

**Funcionalidade:** Lista pedidos do SAP com filtros  
**Query params:** `status`, `cardCode`, `fromDate`, `toDate`, `limit`, `skip`  
**Formato de resposta:**
```typescript
{
  orders: SapOrder[],
  count: number,
  timestamp: string
}
```

**Melhorias implementadas:**
- ✅ Propagação de `X-Correlation-Id`
- ✅ Logs com `action: "sap.orders.list"` e `"sap.orders.list.success"`
- ✅ Mascaramento de `cardCode` nos logs (sensível)
- ✅ Log de contagem de pedidos retornados
- ✅ Tratamento de erros estruturado

**Exemplo de log:**
```json
{
  "level": "info",
  "filter": { "status": "open", "limit": 100, "skip": 0 },
  "correlationId": "corr_abc123",
  "action": "sap.orders.list",
  "message": "Buscando pedidos do SAP"
}
```

#### 3.3 GET `/api/sap/orders/:docEntry`

**Funcionalidade:** Busca pedido específico pelo DocEntry  
**Formato de resposta:**
```typescript
{
  order: SapOrder,
  timestamp: string
}
```

**Melhorias implementadas:**
- ✅ Validação de `docEntry` numérico
- ✅ Log de warning para DocEntry inválido
- ✅ Propagação de `X-Correlation-Id`
- ✅ Actions estruturadas: `"sap.order.get"`, `"sap.order.get.success"`, `"sap.order.get.error"`
- ✅ Status code 404 quando pedido não encontrado
- ✅ Status code 400 para DocEntry inválido

#### 3.4 PATCH `/api/sap/orders/:docEntry/status`

**Funcionalidade:** Atualiza status WMS de pedido no SAP (UDFs)  
**Body:**
```typescript
{
  status: string,        // obrigatório
  orderId?: string,
  lastEvent?: string
}
```

**Formato de resposta:**
```typescript
{
  ok: boolean,
  message: string,
  docEntry: number,
  status: string,
  timestamp: string
}
```

**Melhorias implementadas:**
- ✅ Validação de body e DocEntry
- ✅ Auto-preenchimento de `U_WMS_LAST_TS` e `U_WMS_CORR_ID`
- ✅ Propagação de `X-Correlation-Id` para o SAP
- ✅ Logs estruturados com `action: "sap.order.status.update"`
- ✅ Status code 404 quando pedido não encontrado
- ✅ Status code 400 para body/DocEntry inválido

**Exemplo de atualização:**
```json
{
  "U_WMS_STATUS": "CONFERIDO",
  "U_WMS_ORDERID": "ord_123",
  "U_WMS_LAST_EVENT": "FINALIZAR_SEPARACAO",
  "U_WMS_LAST_TS": "2026-02-03T10:30:00Z",
  "U_WMS_CORR_ID": "corr_xyz"
}
```

## 🔄 Fluxo de Propagação do Correlation ID

```
Frontend
  │ X-Correlation-Id: corr_abc123
  ↓
Gateway (Fastify)
  │ onRequest hook adiciona correlationId
  │ req.log = req.log.child({ correlationId })
  ↓
SapService
  │ getSapService(req.log)
  │ healthCheck(correlationId) ou getOrders(filter, correlationId)
  ↓
Instrumented SAP Client
  │ instrumentSapClient wrapper
  │ createObsContext({ correlationId })
  ↓
SAP Service Layer Client
  │ request headers: { "x-correlation-id": correlationId }
  ↓
SAP Business One
```

## 📊 Observabilidade Implementada

### Logs Estruturados

Todos os logs seguem formato estruturado com campos:
- `correlationId` - Rastreamento end-to-end
- `action` - Ação sendo executada (ex: `sap.orders.list`)
- `message` - Descrição humana
- Metadados relevantes (docEntry, filter, status, etc.)

### Métricas (OpenTelemetry)

Via `instrumentSapClient`:
- `sap_requests_total` - Contador de requisições (tags: method, path, status)
- `sap_request_duration_ms` - Histograma de duração

### Traces (OpenTelemetry)

Cada chamada SAP gera span com:
- Nome: `SAP {METHOD} {path}`
- Atributos:
  - `rpc.system: "sap-b1-service-layer"`
  - `rpc.method: "GET"|"POST"|"PATCH"`
  - `url.path: "/Orders"`
  - `correlation.id: "corr_xyz"`
- Kind: `CLIENT`

### Mascaramento de Segredos

Automático via logger Pino:
- Campos de senha, token, secret são mascarados com `[REDACTED]`
- CardCode (opcional) mascarado em logs quando sensível
- Credenciais SAP nunca aparecem em logs

## 🧪 Como Testar

### 1. Health Check

```bash
# Via Gateway
curl -H "X-Correlation-Id: test-123" \
  http://localhost:3000/api/sap/health

# Resposta esperada:
{
  "ok": true,
  "message": "Conexão com SAP OK",
  "timestamp": "2026-02-03T10:30:00Z"
}
```

### 2. Listar Pedidos

```bash
# Pedidos abertos (padrão)
curl -H "X-Correlation-Id: test-456" \
  "http://localhost:3000/api/sap/orders?status=open&limit=10"

# Com filtros
curl -H "X-Correlation-Id: test-456" \
  "http://localhost:3000/api/sap/orders?status=all&fromDate=2026-01-01&limit=50"

# Resposta esperada:
{
  "orders": [ /* SapOrder[] */ ],
  "count": 10,
  "timestamp": "2026-02-03T10:30:00Z"
}
```

### 3. Buscar Pedido Específico

```bash
curl -H "X-Correlation-Id: test-789" \
  http://localhost:3000/api/sap/orders/10000

# Resposta esperada:
{
  "order": { /* SapOrder */ },
  "timestamp": "2026-02-03T10:30:00Z"
}
```

### 4. Atualizar Status

```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: test-999" \
  -d '{"status": "CONFERIDO", "orderId": "ord_123", "lastEvent": "FINALIZAR_SEPARACAO"}' \
  http://localhost:3000/api/sap/orders/10000/status

# Resposta esperada:
{
  "ok": true,
  "message": "Status atualizado com sucesso",
  "docEntry": 10000,
  "status": "CONFERIDO",
  "timestamp": "2026-02-03T10:30:00Z"
}
```

## 📝 Verificação de Logs

### Logs Mascarados

```bash
# Iniciar gateway com logs pretty
cd gateway
LOG_PRETTY=true npm run dev
```

**Exemplo de log mascarado:**
```
INFO: SAP request OK.
  correlationId: "corr_abc123"
  component: "sap-gateway"
  sap: {
    method: "GET",
    path: "/Orders"
  }
  credentials: {
    username: "lorenzo.naves",
    password: "[REDACTED]"
  }
  status: 200
  durationMs: 1234
```

### Rastreamento de Correlation ID

```bash
# Buscar todos os logs de uma requisição específica
grep "corr_abc123" gateway.log

# Deve aparecer em todos os pontos:
# - Gateway onRequest
# - SapService
# - instrumentSapClient
# - SAP request/response
```

## ✅ Conformidade com Frontend

Todas as rotas retornam exatamente o formato esperado por `web/src/api/sap.ts`:

| Endpoint | Tipo de Resposta | Status Codes |
|----------|------------------|--------------|
| GET `/api/sap/health` | `SapHealthResponse` | 200, 503, 500 |
| GET `/api/sap/orders` | `SapOrdersResponse` | 200, 500 |
| GET `/api/sap/orders/:docEntry` | `SapOrderResponse` | 200, 404, 400, 500 |
| PATCH `/api/sap/orders/:docEntry/status` | `{ ok, message, docEntry, status, timestamp }` | 200, 404, 400, 500 |

## 🎯 Benefícios Implementados

1. **Rastreabilidade Completa**
   - Correlation ID propagado de ponta a ponta
   - Logs estruturados com actions consistentes
   - Traces OpenTelemetry para análise de latência

2. **Segurança**
   - Credenciais SAP mascaradas automaticamente
   - Tokens, secrets e passwords nunca aparecem em logs
   - Validação de entrada em todos os endpoints

3. **Observabilidade**
   - Métricas de performance (duração, taxa de sucesso)
   - Logs com contexto completo
   - Traces distribuídos para debugging

4. **Manutenibilidade**
   - Código instrumentado e testável
   - Formato de resposta consistente
   - Error handling padronizado

5. **Integração Frontend-Backend**
   - Tipos TypeScript alinhados
   - Formato de resposta exatamente como esperado
   - Headers de correlação preservados

## 🚀 Próximos Passos (Opcional)

- [ ] Adicionar cache Redis para pedidos SAP (TTL 30s)
- [ ] Implementar rate limiting por IP no Gateway
- [ ] Adicionar testes automatizados para rotas SAP
- [ ] Configurar alertas baseados em métricas (latência > 5s, taxa de erro > 5%)
- [ ] Adicionar compressão gzip nas respostas grandes

## 📚 Documentação Relacionada

- `web/src/api/sap.ts` - Client frontend com tipos
- `observability/sapInstrumentation.ts` - Instrumentação do SAP client
- `sap-connector/src/sapTypes.ts` - Tipos SAP B1
- `API_CONTRACTS/sap-b1-integration-contract.md` - Contrato de integração
