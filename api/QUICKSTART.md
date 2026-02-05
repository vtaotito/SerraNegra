# Quick Start - API REST WMS

Guia rápido para começar a usar a API REST.

## 1. Configuração Inicial

### Variáveis de Ambiente

Crie um arquivo `.env`:

```bash
# JWT
JWT_SECRET=seu-secret-super-seguro-aqui-min-32-chars
JWT_EXPIRES_IN=8h
JWT_ISSUER=wms-api
JWT_AUDIENCE=wms-clients

# Servidor
PORT=3000
NODE_ENV=development

# Database (futuro)
# DATABASE_URL=postgresql://user:pass@localhost:5432/wms
```

### Instalar Dependências

```bash
npm install jsonwebtoken @types/jsonwebtoken
```

## 2. Implementar Services (Stubs)

Para testar a API sem banco de dados, crie stubs básicos:

```typescript
// api/services/stubServices.ts
import type {
  CatalogService,
  InventoryService,
  OrdersService,
  ShipmentsService,
  CustomersService,
  ScanService,
  DashboardService,
  IntegrationService
} from "../index.js";

export const createStubCatalogService = (): CatalogService => ({
  listItems: async (query) => ({
    data: [
      {
        itemCode: "ITEM001",
        itemName: "Parafuso M6",
        barcode: "7891234567890",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    nextCursor: undefined
  }),
  getItem: async (itemCode) => ({
    itemCode,
    itemName: "Item Exemplo",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  createItem: async (input) => ({
    ...input,
    active: input.active ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  updateItem: async (itemCode, input) => ({
    itemCode,
    itemName: input.itemName ?? "Updated",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  deleteItem: async () => {},
  listWarehouses: async () => ({
    data: [
      {
        warehouseCode: "WH01",
        warehouseName: "Armazém Principal",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }),
  getWarehouse: async (code) => ({
    warehouseCode: code,
    warehouseName: "Armazém",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  createWarehouse: async (input) => ({
    ...input,
    active: input.active ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  updateWarehouse: async (code, input) => ({
    warehouseCode: code,
    warehouseName: input.warehouseName ?? "Updated",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  deleteWarehouse: async () => {}
});

// Criar stubs similares para:
// - createStubInventoryService
// - createStubOrdersService
// - createStubShipmentsService
// - createStubCustomersService
// - createStubScanService
// - createStubDashboardService
// - createStubIntegrationService
```

## 3. Servidor HTTP Simples (Node.js HTTP)

```typescript
// api/server.ts
import http from "node:http";
import { buildRestRoutes } from "./routesRest.js";
import { createStubCatalogService } from "./services/stubServices.js";
// ... importar outros stub services

const jwtConfig = {
  secret: process.env.JWT_SECRET!,
  expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  issuer: process.env.JWT_ISSUER ?? "wms-api",
  audience: process.env.JWT_AUDIENCE ?? "wms-clients"
};

const routes = buildRestRoutes({
  catalogService: createStubCatalogService(),
  inventoryService: createStubInventoryService(),
  ordersService: createStubOrdersService(),
  shipmentsService: createStubShipmentsService(),
  customersService: createStubCustomersService(),
  scansService: createStubScanService(),
  dashboardService: createStubDashboardService(),
  integrationsService: createStubIntegrationService(),
  jwtConfig
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  
  // Encontrar rota correspondente
  const route = routes.find(r => {
    if (r.method !== req.method) return false;
    const pathPattern = r.path.replace(/\{([^}]+)\}/g, "([^/]+)");
    const regex = new RegExp(`^${pathPattern}$`);
    return regex.test(url.pathname);
  });

  if (!route) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Rota não encontrada" } }));
    return;
  }

  // Extrair params da URL
  const pathPattern = route.path.replace(/\{([^}]+)\}/g, "([^/]+)");
  const regex = new RegExp(`^${pathPattern}$`);
  const match = url.pathname.match(regex);
  const params: Record<string, string> = {};
  if (match) {
    const paramNames = [...route.path.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
    paramNames.forEach((name, i) => {
      params[name!] = match[i + 1]!;
    });
  }

  // Parse body
  let body: unknown;
  if (req.method === "POST" || req.method === "PUT") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const bodyText = Buffer.concat(chunks).toString();
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = undefined;
    }
  }

  // Criar request object
  const httpReq = {
    method: req.method as any,
    path: url.pathname,
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
    body,
    params,
    query: Object.fromEntries(url.searchParams),
    requestId: Math.random().toString(36).substring(7),
    receivedAt: new Date().toISOString(),
    ip: req.socket.remoteAddress,
    userAgent: req.headers["user-agent"]
  };

  // Executar handler
  try {
    const response = await route.handler(httpReq, {});
    res.writeHead(response.status, {
      "Content-Type": "application/json",
      ...response.headers
    });
    if (response.body) {
      res.end(JSON.stringify(response.body));
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error handling request:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno do servidor"
      }
    }));
  }
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`🚀 WMS API rodando em http://localhost:${PORT}`);
  console.log(`📚 Documentação: openapi-rest.yaml`);
});
```

## 4. Gerar Token de Teste

```typescript
// scripts/generate-token.ts
import { generateAccessToken } from "../api/auth/tokenGenerator.js";

const token = generateAccessToken(
  {
    userId: "test_user_1",
    role: "admin",
    userType: "INTERNAL",
    displayName: "Admin de Teste"
  },
  {
    secret: process.env.JWT_SECRET!,
    expiresIn: "8h"
  }
);

console.log("Token JWT gerado:");
console.log(token);
```

Execute:

```bash
JWT_SECRET=seu-secret npm run tsx scripts/generate-token.ts
```

## 5. Testar a API

### Listar Items do Catálogo

```bash
TOKEN="<token-gerado>"

curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/catalog/items?limit=10
```

### Criar Pedido

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: test-001" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "C001",
    "items": [
      {"sku": "ITEM001", "quantity": 10}
    ],
    "priority": "NORMAL"
  }' \
  http://localhost:3000/api/v1/orders
```

### Consultar Inventário

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/inventory?itemCode=ITEM001
```

## 6. Próximos Passos

1. **Substituir stubs por implementações reais**
   - Conectar ao banco de dados (Postgres)
   - Implementar persistência

2. **Adicionar servidor HTTP robusto**
   - Express.js
   - Fastify
   - Hono

3. **Implementar testes**
   - Testes unitários dos controllers
   - Testes de integração com supertest

4. **Deploy**
   - Docker
   - Kubernetes
   - Cloud (AWS/Azure/GCP)

## Exemplo Completo com Express

```typescript
// api/server-express.ts
import express from "express";
import { buildRestRoutes } from "./routesRest.js";

const app = express();
app.use(express.json());

const routes = buildRestRoutes({ /* services */ });

routes.forEach(route => {
  const expressPath = route.path.replace(/\{([^}]+)\}/g, ":$1");
  const method = route.method.toLowerCase() as keyof typeof app;
  
  app[method](expressPath, async (req, res) => {
    const httpReq = {
      method: route.method,
      path: req.path,
      headers: req.headers as any,
      body: req.body,
      params: req.params,
      query: req.query as any,
      requestId: Math.random().toString(36).substring(7),
      receivedAt: new Date().toISOString()
    };
    
    try {
      const response = await route.handler(httpReq, {});
      res.status(response.status).json(response.body);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal error" });
    }
  });
});

app.listen(3000, () => {
  console.log("🚀 API rodando em http://localhost:3000");
});
```

---

**Dica**: Para desenvolvimento rápido, use ferramentas como:

- **Postman** ou **Insomnia** para testar endpoints
- **Swagger UI** para documentação interativa
- **Docker** para isolar o ambiente
