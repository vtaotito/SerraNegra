# Guia de Integração: SAP B1 → WMS → Frontend

Este documento descreve o fluxo completo de integração entre SAP Business One, o backend WMS e o frontend do dashboard Kanban.

## Visão Geral

```
SAP B1 (Sales Orders) → WMS Core (Domain + State Machine) → Frontend (Kanban)
        ↓                           ↓                              ↓
   Service Layer            PostgreSQL + API              React + DnD Kit
```

## 1. Entrada de Pedidos (SAP B1 → WMS)

### 1.1 Leitura de Pedidos do SAP

O WMS consulta pedidos do SAP B1 via Service Layer:

```typescript
// Endpoint SAP B1
GET /b1s/v1/Orders?$select=DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate
  &$expand=DocumentLines($select=ItemCode,Quantity)
  &$filter=DocStatus eq 'O' and U_WMS_STATUS eq null
```

**Campos mapeados:**
- `DocEntry` → `sapDocEntry` (chave interna SAP)
- `DocNum` → `externalOrderId` (número visual do pedido)
- `CardCode` → `customerId`
- `CardName` → `customerName`
- `DocumentLines[].ItemCode` → `items[].sku`
- `DocumentLines[].Quantity` → `items[].quantity`

**UDFs do SAP (User Defined Fields):**
- `U_Carrier` → `carrier` (transportadora)
- `U_Priority` → `priority` (P1/P2/P3)
- `U_SLA_DueAt` → `slaDueAt` (prazo de entrega)

### 1.2 Transformação e Enriquecimento

O serviço `sapIntegrationService` converte dados do SAP para o domínio WMS:

```typescript
import { createOrderFromSap } from 'wms-core';

const order = createOrderFromSap({
  orderId: generateId(),
  sapOrder: sapData
});
```

**Enriquecimento automático:**
- Se `priority` não vem do SAP → calcula baseado em `slaDueAt`
- Se `slaDueAt` não vem do SAP → calcula baseado em `priority` e `carrier`
- `pendingIssues` são extraídos de validações (endereço, transportadora, etc.)

## 2. Persistência e State Machine

### 2.1 Schema do Banco

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  external_order_id TEXT,
  sap_doc_entry INTEGER,          -- DocEntry do SAP
  sap_doc_num INTEGER,            -- DocNum do SAP
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  ship_to_address TEXT,
  status TEXT NOT NULL,           -- A_SEPARAR, EM_SEPARACAO, etc.
  carrier TEXT,
  priority TEXT,                  -- P1, P2, P3
  sla_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL,
  metadata JSONB
);
```

### 2.2 Transições de Estado

Todas as mudanças de status passam pela state machine:

```typescript
import { applyOrderEvent } from 'wms-core';

const result = applyOrderEvent(order, {
  eventType: 'INICIAR_SEPARACAO',
  actorId: 'user-123',
  actorRole: 'PICKER',
  idempotencyKey: 'idem_abc123'
});

// result.order → pedido atualizado
// result.transition → registro de auditoria
```

**Eventos disponíveis:**
- `INICIAR_SEPARACAO` (A_SEPARAR → EM_SEPARACAO)
- `FINALIZAR_SEPARACAO` (EM_SEPARACAO → CONFERIDO)
- `SOLICITAR_COTACAO` (CONFERIDO → AGUARDANDO_COTACAO)
- `CONFIRMAR_COTACAO` (AGUARDANDO_COTACAO → AGUARDANDO_COLETA)
- `DESPACHAR` (AGUARDANDO_COLETA → DESPACHADO)

## 3. Sincronização de Status (WMS → SAP)

### 3.1 Atualização de UDFs no SAP

Quando um pedido muda de status no WMS, atualizamos os UDFs do SAP:

```typescript
import { buildSapStatusUpdate } from 'wms-core';

const update = buildSapStatusUpdate({
  order,
  eventType: 'DESPACHAR',
  correlationId: 'corr_xyz'
});

// PATCH /b1s/v1/Orders(10000)
// Body: {
//   "U_WMS_STATUS": "DESPACHADO",
//   "U_WMS_ORDERID": "ord_0001",
//   "U_WMS_LAST_EVENT": "DESPACHAR",
//   "U_WMS_LAST_TS": "2026-02-03T10:30:00Z",
//   "U_WMS_CORR_ID": "corr_xyz"
// }
```

**UDFs recomendados no SAP:**
- `U_WMS_STATUS` (string) - status canônico do WMS
- `U_WMS_ORDERID` (string) - ID interno do WMS
- `U_WMS_LAST_EVENT` (string) - último evento aplicado
- `U_WMS_LAST_TS` (datetime) - timestamp da última atualização
- `U_WMS_CORR_ID` (string) - ID de correlação para rastreabilidade

### 3.2 Pattern Outbox (Assíncrono)

Para evitar lentidão na UX, a sincronização SAP é feita via worker:

1. WMS grava intenção em `outbox` table (transacional)
2. Worker consome outbox e chama SAP
3. Worker atualiza status da sincronização
4. Retry automático em caso de falha

## 4. API REST do WMS

### 4.1 Endpoints Principais

**Listar Pedidos:**
```
GET /orders?status=A_SEPARAR&carrier=Jadlog&priority=P1
→ { items: Order[], nextCursor: string | null }
```

**Obter Pedido:**
```
GET /orders/{orderId}
→ Order (com todos os campos enriquecidos)
```

**Aplicar Evento:**
```
POST /orders/{orderId}/events
Headers: Idempotency-Key: idem_abc123
Body: {
  "type": "INICIAR_SEPARACAO",
  "actor": { "kind": "USER", "id": "user-123" },
  "reason": "Iniciando separação manual"
}
→ { orderId, previousStatus, currentStatus, applied: true, event }
```

**Histórico de Eventos:**
```
GET /orders/{orderId}/history
→ { orderId, events: OrderEvent[] }
```

## 5. Frontend (Dashboard Kanban)

### 5.1 Estrutura de Dados

O frontend consome os dados diretamente da API WMS:

```typescript
type UiOrder = Order & {
  pendingIssues?: string[];      // calculado no frontend
  scanHistory?: ScanEvent[];     // obtido via API separada
};
```

**Campos exibidos no card:**
- `orderId` - ID visual
- `externalOrderId` - número ERP/SAP
- `customerId` - código do cliente
- `carrier` - transportadora
- `priority` - badge P1/P2/P3
- `slaDueAt` - SLA com indicador visual (atrasado/no prazo)
- `items.length` - quantidade de itens
- `pendingIssues` - avisos/alertas

### 5.2 Kanban Board

O dashboard usa `@dnd-kit` para drag & drop entre colunas:

**Colunas (status):**
1. A_SEPARAR
2. EM_SEPARACAO
3. CONFERIDO
4. AGUARDANDO_COTACAO
5. AGUARDANDO_COLETA
6. DESPACHADO

**Ações:**
- Arrastar card entre colunas → POST `/orders/{id}/events` com evento correspondente
- Clicar no card → abre drawer com detalhes completos
- Filtros: busca, transportadora, prioridade, SLA

### 5.3 Atualização em Tempo Real

O frontend usa polling (15s) para atualizar dados:

```typescript
const ordersQuery = useQuery({
  queryKey: ['orders', filters],
  queryFn: () => listOrders(filters),
  refetchInterval: 15_000
});
```

**Futuro:** substituir por SSE (Server-Sent Events) para push real-time.

## 6. Fluxo Completo (Exemplo)

### Cenário: Pedido do SAP → Separação → Despacho

1. **SAP B1:** Pedido criado (DocNum: 5001, Status: Open)

2. **Worker WMS:** 
   - Consulta SAP via Service Layer
   - Cria pedido no WMS com status `A_SEPARAR`
   - Enriquece com prioridade e SLA

3. **Frontend:**
   - Lista pedidos via `GET /orders`
   - Exibe no Kanban na coluna "A Separar"

4. **Operador:**
   - Arrasta card para "Em Separação"
   - Frontend chama `POST /orders/{id}/events` com `INICIAR_SEPARACAO`

5. **WMS Core:**
   - Valida permissões (role `PICKER`)
   - Aplica transição na state machine
   - Grava auditoria em `order_transitions`
   - Retorna sucesso

6. **Worker WMS:**
   - Lê outbox
   - Atualiza SAP: `PATCH /Orders(10000)` com `U_WMS_STATUS = "EM_SEPARACAO"`

7. **Operador:**
   - Escaneia produtos (double-check: endereço → SKU → quantidade)
   - Finaliza separação → `FINALIZAR_SEPARACAO`
   - Pedido vai para "Conferido"

8. **Supervisor:**
   - Solicita cotação → `SOLICITAR_COTACAO`
   - Confirma transportadora → `CONFIRMAR_COTACAO`
   - Aguarda coleta → status `AGUARDANDO_COLETA`

9. **Expedição:**
   - Despacha pedido → `DESPACHAR`
   - Status final: `DESPACHADO`
   - SAP atualizado com `U_WMS_STATUS = "DESPACHADO"`

## 7. Validações e Regras Críticas

### Double-Check (Scan Validation)

Sequência obrigatória para conferência:
1. Scan de endereço (validação: endereço esperado)
2. Scan de SKU (validação: SKU esperado no pedido)
3. Scan de quantidade (validação: quantidade esperada)

```typescript
import { validateDoubleCheckSequence } from 'wms-core';

const result = validateDoubleCheckSequence(
  {
    expectedAddress: 'ADDR-01',
    items: [{ sku: 'SKU-100', expectedQuantity: 5 }]
  },
  scanEvents
);

// result.ok: true/false
// result.isComplete: true se todos itens conferidos
// result.errors: lista de erros
// result.remainingBySku: quantidade faltante por SKU
```

### Permissões por Evento

```typescript
const permissions = {
  INICIAR_SEPARACAO: ['PICKER', 'SUPERVISOR'],
  FINALIZAR_SEPARACAO: ['PICKER', 'SUPERVISOR'],
  CONFERIR: ['CHECKER', 'SUPERVISOR'],
  SOLICITAR_COTACAO: ['SUPERVISOR'],
  CONFIRMAR_COTACAO: ['SUPERVISOR'],
  AGUARDAR_COLETA: ['SUPERVISOR'],
  DESPACHAR: ['SHIPPER', 'SUPERVISOR']
};
```

## 8. Observabilidade e Rastreabilidade

### Correlação de IDs

Todos os requests propagam headers:
- `X-Correlation-Id` - rastreamento end-to-end
- `X-Request-Id` - identificação única da requisição
- `Idempotency-Key` - garantia de idempotência

### Audit Trail

Cada transição de status gera registro em `order_transitions`:
- `orderId`, `from`, `to`, `eventType`
- `actorId`, `actorRole`
- `occurredAt`, `idempotencyKey`
- `reason`, `metadata`

### Logs Estruturados

```json
{
  "timestamp": "2026-02-03T10:30:00Z",
  "level": "info",
  "service": "wms-core",
  "correlationId": "corr_xyz",
  "orderId": "ord_0001",
  "eventType": "DESPACHAR",
  "actorId": "user-123",
  "message": "Order dispatched successfully"
}
```

## 9. Próximos Passos

### Backend
- [ ] Implementar API REST (FastAPI ou Express)
- [ ] Criar worker assíncrono para integração SAP
- [ ] Implementar autenticação e RBAC
- [ ] Adicionar SSE para real-time updates

### Frontend
- [ ] Conectar com API real (substituir mock)
- [ ] Implementar autenticação (JWT/OIDC)
- [ ] Adicionar tela de scan/bipagem para coletores
- [ ] Melhorar filtros e busca

### Integração SAP
- [ ] Criar UDFs no SAP B1
- [ ] Configurar polling/webhooks
- [ ] Implementar retry e circuit breaker
- [ ] Testar com ambiente SAP real

## 10. Referências

- `SPEC.md` - Especificação do MVP
- `STATE_MACHINE.json` - Máquina de estados completa
- `API_CONTRACTS/openapi.yaml` - Contrato OpenAPI
- `API_CONTRACTS/sap-b1-integration-contract.md` - Integração SAP B1
- `ARCHITECTURE.md` - Arquitetura do sistema
