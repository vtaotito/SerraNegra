# SAP B1 Service Layer Connector

Cliente TypeScript para integração com o SAP Business One Service Layer, incluindo:

- **Autenticação automática** (login/logout via cookies)
- **Retry com backoff exponencial** (408/429/5xx/timeouts)
- **Circuit breaker** (evita "thundering herd" em falhas)
- **Rate limiting** (RPS + concorrência)
- **Propagação de correlationId** para rastreabilidade

## Uso básico

```typescript
import { SapServiceLayerClient } from "./sap-connector/src/serviceLayerClient.js";

const client = new SapServiceLayerClient({
  baseUrl: "https://seu-sap:50000/b1s/v1",
  credentials: {
    companyDb: "SuaEmpresaDB",
    username: "manager",
    password: "senha"
  },
  logger: console, // opcional
  timeoutMs: 20_000,
  retry: {
    maxAttempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 10_000,
    jitterRatio: 0.2
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    openStateTimeoutMs: 30_000
  },
  rateLimit: {
    maxConcurrent: 8,
    maxRps: 10
  }
});

// Login automático no primeiro request
const orders = await client.get("/Orders?$top=10", { correlationId: "req-123" });

// PATCH para atualizar UDF
await client.patch(`/Orders(123)`, {
  U_WMS_STATUS: "CONFERIDO"
}, { correlationId: "req-456" });

// Logout (opcional)
await client.logout();
```

## Exemplo completo

Ver `examples/basic-usage.ts`.

Para rodar:

```bash
# 1. Configure .env (raiz do projeto)
cp ../.env.example ../.env
# edite .env com suas credenciais

# 2. Build
npm run build

# 3. Execute
node dist/sap-connector/examples/basic-usage.js
```

## Resiliência

- **Retry**: erros transitórios (timeout, 5xx, 429) → até `maxAttempts` com backoff exponencial
- **Circuit breaker**: após `failureThreshold` falhas consecutivas → abre e bloqueia chamadas por `openStateTimeoutMs`
- **Rate limit**: limita concorrência (`maxConcurrent`) e RPS (`maxRps`)

## Observabilidade

- Propaga `X-Correlation-Id` (padrão do SPEC)
- Logs estruturados (debug/info/warn/error) quando `logger` fornecido
- Headers de resposta SAP (`x-request-id`, se disponível) capturados em `SapResponse`

## Segurança

- Credenciais via variáveis de ambiente (`.env` no `.gitignore`)
- Não loga senhas; mascarar PII no logger de produção

## Referências

- [SAP Service Layer (OData)](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/4f29c31a98894a1b83fed5308b0cd42b.html)
- Contrato de integração: `../API_CONTRACTS/sap-b1-integration-contract.md`
