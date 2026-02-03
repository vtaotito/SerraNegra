# Changelog - Integração SAP B1 e Frontend Kanban

Data: 2026-02-03

## Resumo das Alterações

Este documento descreve as alterações realizadas para integrar completamente o SAP Business One com o backend WMS e o frontend do dashboard Kanban.

## 1. Backend (wms-core)

### 1.1 Domain Layer

**Arquivo:** `wms-core/src/domain/order.ts`

**Alterações:**
- ✅ Adicionado tipo `Priority` (P1, P2, P3)
- ✅ Estendido tipo `Order` com campos:
  - `sapDocEntry` - DocEntry do SAP B1
  - `sapDocNum` - DocNum do SAP B1 (número visual)
  - `customerName` - Nome do cliente (vem do SAP)
  - `carrier` - Transportadora
  - `priority` - Prioridade (P1/P2/P3)
  - `slaDueAt` - Prazo de entrega (SLA)
  - `metadata` - Metadados genéricos (JSONB)

### 1.2 Services Layer

**Novo arquivo:** `wms-core/src/services/sapEnrichmentService.ts`

**Funções criadas:**
- `enrichOrderWithSapData()` - Enriquece pedido WMS com dados do SAP
- `calculatePriority()` - Calcula prioridade baseada em SLA e regras de negócio
- `calculateSla()` - Calcula SLA baseado em prioridade e transportadora
- `extractPendingIssues()` - Extrai pendências do pedido (endereço, transportadora, etc.)

**Novo arquivo:** `wms-core/src/services/sapIntegrationService.ts`

**Funções criadas:**
- `createOrderFromSap()` - Cria pedido WMS a partir de Sales Order do SAP B1
- `buildSapStatusUpdate()` - Monta payload para atualizar UDFs do SAP B1 com status WMS

**Arquivo atualizado:** `wms-core/src/services/orderService.ts`

**Alterações:**
- ✅ Função `createOrder()` agora aceita todos os novos campos opcionais
- ✅ Mantém validações obrigatórias (customerId, items)

### 1.3 Database Schema

**Arquivo:** `wms-core/migrations/0001_init.sql`

**Alterações na tabela `orders`:**
```sql
-- Campos SAP
sap_doc_entry INTEGER
sap_doc_num INTEGER

-- Dados do cliente
customer_name TEXT

-- Campos operacionais
carrier TEXT
priority TEXT CHECK (priority IN ('P1', 'P2', 'P3'))
sla_due_at TIMESTAMPTZ

-- Metadados
metadata JSONB
```

### 1.4 Exports

**Arquivo:** `wms-core/src/index.ts`

**Novos exports:**
- Todos os tipos e funções de `sapEnrichmentService`
- Todos os tipos e funções de `sapIntegrationService`

## 2. Frontend (web)

### 2.1 Type Definitions

**Arquivo:** `web/src/api/types.ts`

**Alterações:**
- ✅ Movido `Priority` para dentro do tipo `Order` (alinhamento com backend)
- ✅ Estendido tipo `Order` com campos SAP:
  - `sapDocEntry`
  - `sapDocNum`
  - `customerName`
  - `shipToAddress`
  - `carrier`
  - `priority`
  - `slaDueAt`
  - `metadata`
- ✅ Simplificado tipo `UiOrder` (carrier/priority/slaDueAt agora são parte de `Order`)

### 2.2 Mock Data

**Arquivo:** `web/src/api/mock.ts`

**Alterações:**
- ✅ Mock agora gera dados completos com todos os campos SAP
- ✅ Adiciona `sapDocEntry`, `sapDocNum`, `customerName`, `shipToAddress`
- ✅ Metadata com origem SAP B1

### 2.3 UI Components

**Arquivo:** `web/src/ui/OrderDrawer.tsx`

**Alterações:**
- ✅ Exibe `customerName` (com fallback para `customerId`)
- ✅ Exibe `sapDocEntry` e `sapDocNum` quando disponíveis
- ✅ Exibe `shipToAddress` completo em seção separada
- ✅ Mantém exibição de carrier, priority e slaDueAt

**Arquivo:** `web/src/ui/OrderCard.tsx`

**Sem alterações necessárias** - já estava preparado para exibir os campos.

## 3. Documentação

### 3.1 Novo Documento

**Arquivo:** `docs/INTEGRATION_GUIDE.md`

**Conteúdo:**
- ✅ Visão geral da arquitetura de integração
- ✅ Fluxo completo: SAP B1 → WMS → Frontend
- ✅ Mapeamento de campos SAP para WMS
- ✅ Enriquecimento e cálculo de prioridade/SLA
- ✅ Sincronização WMS → SAP (UDFs)
- ✅ API REST endpoints
- ✅ Kanban Board e atualização em tempo real
- ✅ Validações (double-check, permissões)
- ✅ Observabilidade e audit trail
- ✅ Exemplo de fluxo completo end-to-end
- ✅ Próximos passos (checklist de implementação)

## 4. Integrações Implementadas

### 4.1 SAP B1 → WMS (Leitura)

**Endpoint SAP:**
```
GET /b1s/v1/Orders
  ?$select=DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate
  &$expand=DocumentLines
  &$filter=DocStatus eq 'O' and U_WMS_STATUS eq null
```

**Transformação:**
- Sales Order (SAP) → Order (WMS) via `createOrderFromSap()`
- Enriquecimento com prioridade e SLA automáticos
- Extração de pendências (validações de endereço, transportadora, etc.)

### 4.2 WMS → SAP B1 (Escrita)

**Endpoint SAP:**
```
PATCH /b1s/v1/Orders(<DocEntry>)
Body: {
  "U_WMS_STATUS": "DESPACHADO",
  "U_WMS_ORDERID": "ord_0001",
  "U_WMS_LAST_EVENT": "DESPACHAR",
  "U_WMS_LAST_TS": "2026-02-03T10:30:00Z",
  "U_WMS_CORR_ID": "corr_xyz"
}
```

**UDFs recomendados no SAP:**
- `U_WMS_STATUS` (string, 20) - Status canônico do WMS
- `U_WMS_ORDERID` (string, 50) - ID interno do WMS
- `U_WMS_LAST_EVENT` (string, 30) - Último evento aplicado
- `U_WMS_LAST_TS` (datetime) - Timestamp da última atualização
- `U_WMS_CORR_ID` (string, 50) - ID de correlação para rastreabilidade

### 4.3 Frontend → WMS (API)

**Endpoints consumidos:**
- `GET /orders` - Lista pedidos com filtros
- `GET /orders/{id}` - Obtém detalhes do pedido
- `POST /orders/{id}/events` - Aplica transição de estado
- `GET /orders/{id}/history` - Obtém histórico de eventos

**Campos exibidos no Kanban:**
- Card: orderId, externalOrderId, customerId, carrier, priority, slaDueAt, items count
- Drawer: Todos os campos + histórico + scan history + pendências

## 5. Fluxo de Dados Completo

```
┌─────────────┐
│   SAP B1    │ Sales Order criado (DocNum: 5001)
│ (ERP/Sales) │
└──────┬──────┘
       │ Service Layer API
       │ GET /Orders?$filter=...
       ↓
┌─────────────────────┐
│    Worker WMS       │ Polling (ou webhook via B1if)
│ sapIntegrationSvc   │ createOrderFromSap()
└──────┬──────────────┘
       │ INSERT INTO orders
       │ enrichOrderWithSapData()
       ↓
┌─────────────────────┐
│  PostgreSQL (WMS)   │ Pedido com status A_SEPARAR
│  + Audit Trail      │ carrier, priority, slaDueAt calculados
└──────┬──────────────┘
       │ API REST
       │ GET /orders
       ↓
┌─────────────────────┐
│ Frontend (React)    │ Kanban Board exibe pedido
│  OrdersDashboard    │ Coluna "A Separar"
└──────┬──────────────┘
       │ Operador arrasta card
       │ POST /orders/{id}/events
       ↓
┌─────────────────────┐
│   WMS Core          │ applyOrderEvent()
│ orderService        │ State Machine valida transição
└──────┬──────────────┘
       │ UPDATE orders SET status = 'EM_SEPARACAO'
       │ INSERT INTO order_transitions (audit)
       ↓
┌─────────────────────┐
│  Worker WMS         │ Outbox pattern (assíncrono)
│ sapIntegrationSvc   │ buildSapStatusUpdate()
└──────┬──────────────┘
       │ Service Layer API
       │ PATCH /Orders(<DocEntry>)
       ↓
┌─────────────┐
│   SAP B1    │ UDF U_WMS_STATUS = "EM_SEPARACAO"
│  (atualizado)│ Sync completo
└─────────────┘
```

## 6. Priorização Automática

### Regras de Prioridade

**P1 (Alta):**
- SLA < 4 horas
- Clientes VIP (pode ser adicionado no futuro)
- Pedidos com flag urgente do SAP

**P2 (Média):**
- SLA entre 4 e 12 horas
- Transportadoras expressas (Azul Cargo, etc.)

**P3 (Baixa):**
- SLA > 12 horas
- Demais casos

### Cálculo de SLA

**Padrão:**
- P1: 6 horas após criação
- P2: 12 horas após criação
- P3: 24 horas após criação

**Ajustes por transportadora:**
- Azul Cargo: máximo 8 horas (independente de prioridade)

## 7. Campos de Pendências (UI)

Calculado automaticamente no frontend ou via service:

- ✅ "Endereço incompleto" - se `shipToAddress` < 10 caracteres
- ✅ "Transportadora não definida" - se `carrier` null
- ✅ "Pedido sem itens" - se `items.length === 0`

## 8. Testes Recomendados

### Backend
```bash
cd wms-core
npm test
```

**Cenários:**
- ✅ Criação de pedido com campos SAP
- ✅ Enriquecimento com prioridade/SLA
- ✅ Transições de estado com validação de permissões
- ✅ Double-check sequence

### Frontend
```bash
cd web
npm run dev
```

**Cenários manuais:**
- ✅ Visualizar pedidos no Kanban (todos os status)
- ✅ Arrastar pedido entre colunas
- ✅ Abrir drawer e verificar todos os campos SAP
- ✅ Verificar badges de prioridade e SLA
- ✅ Filtrar por transportadora/prioridade/SLA

## 9. Próximos Passos

### Implementação Backend

- [ ] Criar API REST (FastAPI ou Express)
  - Endpoints: `/orders`, `/orders/{id}`, `/orders/{id}/events`, `/orders/{id}/history`
  - Autenticação JWT
  - Validação de permissões RBAC

- [ ] Criar Worker assíncrono
  - Polling de pedidos do SAP (ou consumer de webhook)
  - Processamento de outbox para sync WMS → SAP
  - Retry com backoff exponencial
  - Dead Letter Queue (DLQ)

- [ ] Configurar banco de dados
  - Aplicar migrations (`0001_init.sql`)
  - Criar índices de performance
  - Configurar backup e replicação

### Implementação Frontend

- [ ] Conectar com API real
  - Remover mock (`VITE_USE_MOCK=false`)
  - Configurar `VITE_API_BASE_URL`
  - Adicionar interceptor de erros

- [ ] Implementar autenticação
  - Login screen
  - Token storage (localStorage/sessionStorage)
  - Refresh token flow

- [ ] Melhorias de UX
  - SSE (Server-Sent Events) para real-time updates
  - Notificações push
  - Filtros avançados (range de datas, múltiplas transportadoras)

### Integração SAP

- [ ] Criar UDFs no SAP B1
  - Via SAP Business One SDK ou SQL
  - Adicionar campos na tabela ORDR (Orders)

- [ ] Configurar Service Layer
  - Habilitar endpoints necessários
  - Configurar autenticação (SessionID)
  - Rate limiting e circuit breaker

- [ ] Testar com ambiente SAP real
  - Validar mapeamentos de campos
  - Ajustar filtros e queries
  - Performance tuning

## 10. Observações Importantes

### Performance

- **Polling SAP:** Começar com intervalo de 30-60 segundos
- **Frontend refetch:** Atual 15 segundos, migrar para SSE
- **Índices de banco:** Criar em `status`, `sap_doc_entry`, `created_at`

### Segurança

- **Credenciais SAP:** Armazenar em secrets manager (nunca em código)
- **CORS:** Configurar whitelist de origens permitidas
- **Rate limiting:** Proteger API contra abuso

### Rastreabilidade

- **X-Correlation-Id:** Propagar em todos os requests (SAP ↔ WMS ↔ Frontend)
- **Audit Trail:** Toda transição de estado gera registro em `order_transitions`
- **Logs estruturados:** JSON com campos padronizados (timestamp, level, service, correlationId, orderId)

## Conclusão

✅ Backend core implementado com domínio WMS completo
✅ Integrações SAP B1 preparadas (enriquecimento e sync)
✅ Frontend atualizado para exibir todos os campos no Kanban
✅ Documentação completa de integração
✅ Schema de banco com todos os campos necessários

**Próximo passo crítico:** Implementar API REST e worker assíncrono para conectar frontend com backend.
