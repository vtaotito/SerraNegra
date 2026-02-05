# Guia de Integração - WMS REST API

## Cenários de Uso Práticos

### 1. Cliente Externo - Portal Web

Cliente acessa portal para consultar seus pedidos e remessas.

#### Autenticação

```typescript
// Cliente recebe token JWT ao fazer login
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// Token contém:
{
  "userId": "client_789",
  "role": "comercial",
  "userType": "CLIENT",
  "customerId": "C00001",
  "displayName": "Empresa XYZ Ltda"
}
```

#### Consultar Pedidos do Cliente

```bash
GET /api/v1/orders?customerId=C00001&status=EM_SEPARACAO
Authorization: Bearer <token>
```

Response:

```json
{
  "data": [
    {
      "id": "ord_123",
      "externalOrderId": "SAP-456789",
      "customerId": "C00001",
      "customerName": "Empresa XYZ Ltda",
      "status": "EM_SEPARACAO",
      "items": [
        { "sku": "PARAF001", "quantity": 100 },
        { "sku": "PORCA002", "quantity": 50 }
      ],
      "totalItems": 150,
      "priority": "NORMAL",
      "createdAt": "2026-02-03T10:00:00Z",
      "updatedAt": "2026-02-03T11:30:00Z"
    }
  ],
  "nextCursor": "cursor_abc123"
}
```

#### Rastrear Remessa

```bash
GET /api/v1/shipments?orderId=ord_123
Authorization: Bearer <token>
```

Response:

```json
{
  "data": [
    {
      "id": "ship_456",
      "orderId": "ord_123",
      "customerId": "C00001",
      "carrier": "Transportadora ABC",
      "trackingCode": "BR123456789",
      "status": "IN_TRANSIT",
      "estimatedDeliveryDate": "2026-02-05",
      "createdAt": "2026-02-03T14:00:00Z"
    }
  ]
}
```

---

### 2. Sistema Interno - Coletor (Scanner)

Operador de armazém usa dispositivo móvel para registrar scans.

#### Autenticação

```typescript
// Operador faz login no coletor
const token = generateAccessToken({
  userId: "usr_operador_42",
  role: "operador",
  userType: "INTERNAL",
  displayName: "João Silva",
  tenantId: "tenant_abc"
}, jwtConfig);
```

#### Registrar Scan de Produto

```bash
POST /api/v1/scans
Authorization: Bearer <token>
Idempotency-Key: scan_12345
Content-Type: application/json

{
  "orderId": "ord_123",
  "taskId": "task_picking_789",
  "type": "PRODUCT_SCAN",
  "value": "7891234567890",
  "quantity": 1,
  "occurredAt": "2026-02-03T11:45:00Z"
}
```

Response:

```json
{
  "event": {
    "id": "evt_scan_999",
    "orderId": "ord_123",
    "taskId": "task_picking_789",
    "type": "PRODUCT_SCAN",
    "value": "7891234567890",
    "quantity": 1,
    "occurredAt": "2026-02-03T11:45:00Z",
    "actorId": "usr_operador_42",
    "actorRole": "operador"
  },
  "requestId": "req_xyz789"
}
```

---

### 3. Sistema Interno - Supervisor

Supervisor ajusta inventário manualmente.

#### Autenticação

```typescript
const token = generateAccessToken({
  userId: "usr_supervisor_10",
  role: "supervisor",
  userType: "INTERNAL",
  displayName: "Maria Santos"
}, jwtConfig);
```

#### Ajustar Inventário (Adição Manual)

```bash
POST /api/v1/inventory/adjustments
Authorization: Bearer <token>
Idempotency-Key: adj_20260203_001
Content-Type: application/json

{
  "itemCode": "PARAF001",
  "warehouseCode": "WH01",
  "quantity": 500,
  "adjustmentType": "ADD",
  "reason": "Recebimento de fornecedor",
  "batchNumber": "LOTE2026-001",
  "notes": "NF-e 12345 - Fornecedor ABC"
}
```

Response:

```json
{
  "adjustmentId": "adj_20260203_001",
  "itemCode": "PARAF001",
  "warehouseCode": "WH01",
  "previousQuantity": 1500,
  "newQuantity": 2000,
  "adjustmentType": "ADD",
  "adjustedAt": "2026-02-03T15:30:00Z",
  "actorId": "usr_supervisor_10"
}
```

#### Transferir Inventário Entre Armazéns

```bash
POST /api/v1/inventory/transfers
Authorization: Bearer <token>
Idempotency-Key: transfer_20260203_002
Content-Type: application/json

{
  "itemCode": "PORCA002",
  "fromWarehouseCode": "WH01",
  "toWarehouseCode": "WH02",
  "quantity": 200,
  "reason": "Reposição de estoque WH02",
  "notes": "Transferência planejada semanal"
}
```

Response:

```json
{
  "transferId": "transfer_20260203_002",
  "status": "PENDING",
  "itemCode": "PORCA002",
  "fromWarehouse": "WH01",
  "toWarehouse": "WH02",
  "quantity": 200,
  "createdAt": "2026-02-03T16:00:00Z"
}
```

---

### 4. Sistema ERP/SAP - Integração

Sistema externo cria pedido automaticamente.

#### Autenticação (Service Account)

```typescript
const token = generateAccessToken({
  userId: "service_sap_integration",
  role: "comercial",
  userType: "INTERNAL",
  displayName: "SAP B1 Integration",
  tenantId: "tenant_abc"
}, jwtConfig);
```

#### Criar Pedido via Integração

```bash
POST /api/v1/orders
Authorization: Bearer <token>
Idempotency-Key: sap_order_456789
Content-Type: application/json

{
  "externalOrderId": "SAP-456789",
  "customerId": "C00001",
  "shipToAddress": "Rua das Flores, 123 - São Paulo/SP - 01234-567",
  "items": [
    {
      "sku": "PARAF001",
      "quantity": 100
    },
    {
      "sku": "PORCA002",
      "quantity": 50
    },
    {
      "sku": "ARRUELA003",
      "quantity": 200
    }
  ],
  "priority": "HIGH",
  "notes": "Cliente VIP - Prazo de entrega reduzido"
}
```

Response:

```json
{
  "id": "ord_999",
  "externalOrderId": "SAP-456789",
  "customerId": "C00001",
  "customerName": "Empresa XYZ Ltda",
  "shipToAddress": "Rua das Flores, 123 - São Paulo/SP - 01234-567",
  "status": "A_SEPARAR",
  "items": [
    { "sku": "PARAF001", "quantity": 100 },
    { "sku": "PORCA002", "quantity": 50 },
    { "sku": "ARRUELA003", "quantity": 200 }
  ],
  "totalItems": 350,
  "priority": "HIGH",
  "notes": "Cliente VIP - Prazo de entrega reduzido",
  "createdAt": "2026-02-03T16:30:00Z",
  "updatedAt": "2026-02-03T16:30:00Z",
  "version": 1
}
```

#### Consultar Status do Pedido

```bash
GET /api/v1/orders/ord_999
Authorization: Bearer <token>
```

Response (com detalhes):

```json
{
  "id": "ord_999",
  "externalOrderId": "SAP-456789",
  "customerId": "C00001",
  "status": "EM_SEPARACAO",
  "items": [...],
  "tasks": [
    {
      "id": "task_picking_999",
      "type": "PICKING",
      "status": "IN_PROGRESS",
      "assignedTo": "usr_operador_42",
      "progress": 0.65
    },
    {
      "id": "task_packing_999",
      "type": "PACKING",
      "status": "PENDING",
      "progress": 0
    }
  ],
  "timeline": [
    {
      "eventType": "INICIAR_SEPARACAO",
      "occurredAt": "2026-02-03T16:45:00Z",
      "actorId": "usr_operador_42",
      "actorRole": "operador"
    }
  ],
  "createdAt": "2026-02-03T16:30:00Z",
  "updatedAt": "2026-02-03T16:45:00Z",
  "version": 2
}
```

---

### 5. Dashboard Web - Comercial

Visualizar métricas e KPIs.

#### Autenticação

```typescript
const token = generateAccessToken({
  userId: "usr_comercial_5",
  role: "comercial",
  userType: "INTERNAL",
  displayName: "Pedro Costa"
}, jwtConfig);
```

#### Obter Métricas do Dashboard

```bash
GET /api/v1/dashboard/metrics
Authorization: Bearer <token>
```

Response:

```json
{
  "totalOrders": 152,
  "ordersByStatus": {
    "A_SEPARAR": 12,
    "EM_SEPARACAO": 25,
    "CONFERIDO": 8,
    "AGUARDANDO_COLETA": 15,
    "DESPACHADO": 92
  },
  "openTasks": 45,
  "tasksByType": {
    "PICKING": 20,
    "PACKING": 15,
    "SHIPPING": 10
  },
  "lastUpdatedAt": "2026-02-03T17:00:00Z"
}
```

#### Listar Pedidos Recentes

```bash
GET /api/v1/dashboard/orders?from=2026-02-03T00:00:00Z&limit=20
Authorization: Bearer <token>
```

---

### 6. Webhook - Notificações Externas

Sistema externo registra webhook para receber notificações.

#### Registrar Webhook

```bash
POST /api/v1/integrations/webhooks
Authorization: Bearer <token>
Idempotency-Key: webhook_partner_001
Content-Type: application/json

{
  "url": "https://partner.com/webhooks/wms-events",
  "eventTypes": [
    "order.created",
    "order.status_changed",
    "shipment.dispatched"
  ],
  "secret": "webhook_secret_xyz123",
  "headers": {
    "X-Partner-ID": "partner_001"
  }
}
```

Response:

```json
{
  "id": "webhook_001",
  "url": "https://partner.com/webhooks/wms-events",
  "eventTypes": [
    "order.created",
    "order.status_changed",
    "shipment.dispatched"
  ],
  "status": "ACTIVE",
  "createdAt": "2026-02-03T17:15:00Z"
}
```

---

## Tratamento de Erros

### Erro de Autenticação

```json
{
  "error": {
    "code": "WMS-AUTH-001",
    "message": "Token expirado.",
    "requestId": "req_abc123"
  }
}
```

### Erro de Validação

```json
{
  "error": {
    "code": "WMS-VAL-001",
    "message": "Campo customerId obrigatorio.",
    "details": {
      "field": "customerId"
    },
    "requestId": "req_xyz789"
  }
}
```

### Erro de Permissão

```json
{
  "error": {
    "code": "WMS-AUTH-001",
    "message": "Permissao insuficiente.",
    "details": {
      "allowedRoles": ["comercial", "admin"]
    },
    "requestId": "req_def456"
  }
}
```

---

## Best Practices

### 1. Sempre use Idempotency-Key

Para operações POST/PUT críticas:

```bash
Idempotency-Key: <uuid-v4>
```

### 2. Implemente Retry com Exponential Backoff

```typescript
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### 3. Use Correlation ID para Rastreamento

```bash
X-Correlation-ID: <uuid>
```

### 4. Valide JWT no Cliente

```typescript
import { verifyJwtToken } from "./api/auth/jwt.js";

try {
  const payload = verifyJwtToken(token, jwtConfig);
  console.log("Token válido:", payload);
} catch (error) {
  console.error("Token inválido:", error.message);
}
```

### 5. Cache de Catálogo

Itens e armazéns mudam raramente - use cache local:

```typescript
// Refresh a cada 1h
const CACHE_TTL = 3600000;
let catalogCache = { items: [], lastFetch: 0 };

async function getCatalogItems() {
  if (Date.now() - catalogCache.lastFetch > CACHE_TTL) {
    catalogCache.items = await api.get("/api/v1/catalog/items?limit=1000");
    catalogCache.lastFetch = Date.now();
  }
  return catalogCache.items;
}
```
