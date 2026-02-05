# WMS REST API

API REST completa para o sistema WMS com autenticação JWT e controle de permissões.

## Recursos

### Endpoints Principais

- **`/api/v1/catalog/items`** - Catálogo de itens
- **`/api/v1/catalog/warehouses`** - Catálogo de armazéns
- **`/api/v1/inventory`** - Gestão de inventário
- **`/api/v1/orders`** - Gestão de pedidos
- **`/api/v1/shipments`** - Gestão de remessas
- **`/api/v1/customers`** - Gestão de clientes

### Autenticação

A API utiliza **JWT Bearer tokens** para autenticação.

#### Obter Token

Configure as credenciais JWT e gere tokens usando o `tokenGenerator`:

```typescript
import { generateAccessToken } from "./api/auth/tokenGenerator.js";

const config = {
  secret: process.env.JWT_SECRET,
  expiresIn: "8h",
  issuer: "wms-api",
  audience: "wms-clients"
};

const token = generateAccessToken(
  {
    userId: "usr_123",
    role: "operador",
    userType: "INTERNAL",
    displayName: "João Silva"
  },
  config
);
```

#### Usar Token

Inclua o token no header `Authorization`:

```bash
curl -H "Authorization: Bearer <seu-token-jwt>" \
  https://api.exemplo.com/api/v1/catalog/items
```

### Permissões

#### Tipos de Usuário

- **INTERNAL**: Usuários internos da empresa (operador, supervisor, comercial, admin)
- **CLIENT**: Clientes externos (acesso restrito aos próprios recursos)

#### Roles (Papéis)

| Role | Permissões |
|------|-----------|
| **operador** | Scan, visualizar catálogo/inventário/pedidos |
| **supervisor** | + Gestão de tarefas, ajustes de inventário, remessas |
| **comercial** | + Gestão de pedidos, clientes, webhooks |
| **admin** | Acesso total |

#### Matriz de Permissões

| Recurso | Operador | Supervisor | Comercial | Admin | Cliente |
|---------|----------|------------|-----------|-------|---------|
| Catalog (items) read | ✓ | ✓ | ✓ | ✓ | ✓ |
| Catalog (items) write | - | - | ✓ | ✓ | - |
| Warehouses read | ✓ | ✓ | ✓ | ✓ | - |
| Warehouses write | - | - | - | ✓ | - |
| Inventory read | ✓ | ✓ | ✓ | ✓ | ✓* |
| Inventory write | - | ✓ | - | ✓ | - |
| Orders read | ✓ | ✓ | ✓ | ✓ | ✓* |
| Orders write | - | ✓ | ✓ | ✓ | ✓* |
| Shipments read | ✓ | ✓ | ✓ | ✓ | ✓* |
| Shipments write | - | ✓ | - | ✓ | - |
| Customers read | - | ✓ | ✓ | ✓ | - |
| Customers write | - | - | ✓ | ✓ | - |

\* Cliente só pode acessar seus próprios recursos

### Versionamento

A API suporta versionamento através do path:

```
/api/v1/...
```

Versões futuras: `/api/v2/...`

### Idempotência

Endpoints POST/PUT que modificam dados requerem o header `Idempotency-Key`:

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: uuid-aqui" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"C001","items":[{"sku":"SKU123","quantity":10}]}' \
  https://api.exemplo.com/api/v1/orders
```

### Paginação

Endpoints de listagem suportam paginação via cursor:

```bash
GET /api/v1/orders?limit=50&cursor=<cursor-da-pagina-anterior>
```

Response:

```json
{
  "data": [...],
  "nextCursor": "abc123"
}
```

### Auditoria

Todas as operações são auditadas automaticamente, incluindo:

- Action (tipo de operação)
- Actor (usuário que executou)
- Request ID e Correlation ID
- Timestamp
- Duração

## Estrutura do Projeto

```
api/
├── auth/
│   ├── jwt.ts                 # Geração e validação de JWT
│   ├── permissions.ts         # Sistema de permissões
│   └── tokenGenerator.ts      # Geração de tokens de acesso
├── controllers/
│   ├── catalogController.ts   # Items e Warehouses
│   ├── inventoryController.ts # Inventário e ajustes
│   ├── ordersController.ts    # Pedidos
│   ├── shipmentsController.ts # Remessas
│   ├── customersController.ts # Clientes
│   ├── scansController.ts     # Scans (coletor)
│   ├── dashboardController.ts # Dashboard
│   └── integrationsController.ts # Webhooks
├── dtos/
│   ├── catalog.ts
│   ├── inventory.ts
│   ├── orders.ts
│   ├── shipments.ts
│   ├── customers.ts
│   ├── scans.ts
│   ├── dashboard.ts
│   ├── integrations.ts
│   └── errors.ts
├── middleware/
│   ├── authentication.ts      # JWT auth
│   ├── authorization.ts       # RBAC
│   ├── audit.ts              # Auditoria
│   ├── errorHandler.ts       # Tratamento de erros
│   ├── idempotency.ts        # Idempotência
│   └── versioning.ts         # Versionamento
├── utils/
│   ├── headers.ts
│   └── validation.ts
├── http.ts                    # Tipos HTTP base
├── routesRest.ts             # Definição de rotas REST
├── index.ts                  # Exports principais
└── README.md                 # Esta documentação
```

## Exemplo de Uso

### 1. Listar Itens do Catálogo

```typescript
import { buildRestRoutes } from "./api/routesRest.js";

const routes = buildRestRoutes({
  catalogService,
  inventoryService,
  ordersService,
  shipmentsService,
  customersService,
  scansService,
  dashboardService,
  integrationsService,
  jwtConfig: {
    secret: process.env.JWT_SECRET!,
    expiresIn: "8h"
  }
});

// GET /api/v1/catalog/items?search=parafuso&limit=20
```

### 2. Criar Pedido

```typescript
// POST /api/v1/orders
{
  "externalOrderId": "SAP-123456",
  "customerId": "C00001",
  "shipToAddress": "Rua ABC, 123",
  "items": [
    { "sku": "SKU001", "quantity": 10 },
    { "sku": "SKU002", "quantity": 5 }
  ],
  "priority": "NORMAL",
  "notes": "Entrega urgente"
}
```

### 3. Ajustar Inventário

```typescript
// POST /api/v1/inventory/adjustments
{
  "itemCode": "SKU001",
  "warehouseCode": "WH01",
  "quantity": 100,
  "adjustmentType": "ADD",
  "reason": "Recebimento de fornecedor",
  "notes": "NF 12345"
}
```

### 4. Listar Remessas de um Cliente

```typescript
// GET /api/v1/shipments?customerId=C00001&status=IN_TRANSIT
```

## Especificação OpenAPI

Veja `openapi-rest.yaml` para a especificação completa da API.

## Variáveis de Ambiente

```bash
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=8h
JWT_ISSUER=wms-api
JWT_AUDIENCE=wms-clients
```

## Próximos Passos

- [ ] Implementar serviços de persistência (DB)
- [ ] Adicionar GraphQL endpoint
- [ ] Implementar rate limiting
- [ ] Adicionar cache (Redis)
- [ ] Webhook dispatcher
- [ ] Testes de integração
- [ ] Documentação interativa (Swagger UI)
