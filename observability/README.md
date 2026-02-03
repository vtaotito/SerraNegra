# Observability (logging + metrics + traces)

Este módulo entrega um “kit” de observabilidade para o WMS Orchestrator:

- **Logging estruturado**: `pino` com correlação por `requestId`/`correlationId` (e opcionalmente `orderId`/`taskId`).
- **Tracing**: OpenTelemetry (OTLP HTTP) com spans por request e por chamadas ao SAP.
- **Métricas**: OpenTelemetry metrics com exportador Prometheus (pull) por padrão.

## Quickstart (API)

1) Inicialize tracing/métricas no bootstrap do seu servidor (uma vez):

```ts
import { initTracing, initMetrics } from "../observability/index.js";

await initTracing({ serviceName: "wms-api", serviceVersion: "0.1.0" });
initMetrics({ prometheusPort: 9464, prometheusEndpoint: "/metrics" });
```

2) As rotas já estão com o middleware `createApiObservabilityMiddleware()` aplicado em `api/routes.ts`.

## Quickstart (SAP connector)

```ts
import { SapServiceLayerClient } from "../sap-connector/src/index.js";
import { createLogger, toSapConnectorLogger, instrumentSapClient } from "../observability/index.js";

const logger = createLogger({ name: "wms-sync" });
const sap = new SapServiceLayerClient({
  baseUrl: "https://sap:50000/b1s/v1",
  credentials: { companyDb: "SBODEMO", username: "manager", password: "secret" },
  logger: toSapConnectorLogger(logger)
});

const sapObs = instrumentSapClient(sap, { logger, componentName: "sap" });

await sapObs.get("/Items", { correlationId: "corr-123" });
```

## Variáveis de ambiente úteis

- `LOG_LEVEL`: `debug|info|warn|error` (default `info`)
- `LOG_PRETTY`: `true|false` (default: `true` fora de produção)
- `OTEL_SERVICE_NAME`: nome do serviço
- `OTEL_EXPORTER_OTLP_ENDPOINT`: ex.: `http://localhost:4318`
- `METRICS_PORT`: porta do endpoint Prometheus (default 9464)

