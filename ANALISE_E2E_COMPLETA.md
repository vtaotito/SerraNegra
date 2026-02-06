# 🔍 Análise End-to-End (E2E) - WMS/OMS Platform

**Data**: 2026-02-03  
**Versão**: 1.0  
**Status do Sistema**: Operacional (com gaps identificados)

---

## 📊 Sumário Executivo

### Status Atual
- ✅ **Backend Core**: FastAPI operacional com PostgreSQL
- ✅ **Gateway**: Fastify com endpoints SAP implementados
- ✅ **Worker**: Sync assíncrono SAP → WMS (recém-corrigido)
- ⚠️ **Frontend Atual (Vite/React)**: Funcional, com correção SAP aplicada
- 🚧 **Frontend Next.js**: Em desenvolvimento (setup inicial concluído)
- ✅ **Integração SAP B1**: Estrutura completa (Service Layer + Mocks)
- ⚠️ **Deploy**: Nginx + Docker Compose configurado (correções recentes)

### Métricas do Projeto
- **Linhas de código**: ~25.000+ (estimado)
- **Serviços**: 6 (nginx, web, gateway, core, worker, postgres, redis)
- **Documentação**: 107 arquivos markdown
- **Cobertura SAP Mock**: 100% (12 operações simuladas)

---

## 🏗️ 1. ARQUITETURA ATUAL

### 1.1 Visão Geral da Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        USUÁRIO (Browser)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                      │
│  - /api/* → gateway:3000                                     │
│  - /*     → web:80 (SPA)                                     │
└──────────────┬────────────────────────────┬─────────────────┘
               │                            │
               ▼ /api                       ▼ / (Frontend)
┌──────────────────────────┐    ┌──────────────────────────┐
│   GATEWAY (Node.js)       │    │   WEB (React/Vite)       │
│   - Fastify               │    │   - React 18             │
│   - JWT/Auth              │    │   - TanStack Query       │
│   - Rate Limiting         │    │   - Kanban (dnd-kit)     │
│   - SSE/WebSocket         │    │   - Toast notifications  │
│   - Proxy → Core          │    └──────────────────────────┘
│   - SAP endpoints         │
└───────────┬──────────────┘
            │ Internal API
            ▼
┌──────────────────────────────────────────────────────────────┐
│              CORE (FastAPI/Python)                            │
│   - State Machine (orders)                                   │
│   - PostgreSQL persistence                                   │
│   - Audit Trail (append-only)                                │
│   - Internal SAP endpoints (/internal/sap/orders)            │
└───────────┬────────────────────────────┬─────────────────────┘
            │                            │
            ▼                            ▼ Async Jobs
┌────────────────────┐      ┌─────────────────────────────────┐
│   PostgreSQL 16    │      │   WORKER (Node.js/TypeScript)   │
│   - Orders         │      │   - SAP polling (30s)           │
│   - Audit Events   │      │   - Push to Core                │
│   - State History  │      │   - Retry logic                 │
└────────────────────┘      └────────────┬────────────────────┘
                                         │
                                         ▼
                           ┌──────────────────────────────────┐
                           │   SAP Business One               │
                           │   - Service Layer REST API       │
                           │   - Orders (ORDR)                │
                           │   - Items (OITM)                 │
                           │   - UDFs (U_WMS_*)               │
                           └──────────────────────────────────┘
```

### 1.2 Componentes Detalhados

#### **Frontend (web/)**
- **Framework**: React 18 + Vite 5
- **State Management**: TanStack Query
- **UI**: Custom CSS + dnd-kit (drag-and-drop Kanban)
- **Features**:
  - Dashboard Kanban de pedidos
  - Filtros por status/cliente/data
  - Detalhes de pedido em modal
  - Indicador de fonte de dados (API vs Mock)
  - Botão "Importar do SAP" (a ser atualizado)
- **Porta**: 5173 (dev) / 80 (produção via nginx)
- **Ambiente**: `VITE_API_BASE_URL=/api` (path relativo)

#### **Frontend Next.js (web-next/)** 🚧
- **Framework**: Next.js 15 (App Router)
- **Estado**: Setup inicial concluído
- **Features Planejadas**:
  - Dashboard moderno com shadcn/ui
  - TanStack Table para listagens
  - Server Components + Client Components
  - Layout responsivo (mobile-first)
  - RBAC: OPERADOR, SUPERVISOR, COMERCIAL, ADMIN
- **Porta**: 3002 (dev) / TBD (produção)
- **Status**: 20% completo (estrutura base + API client)

#### **Gateway (gateway/)**
- **Framework**: Fastify (Node.js)
- **Responsabilidades**:
  - BFF (Backend-for-Frontend)
  - Autenticação/Autorização (headers X-User-*)
  - Proxy para Core (`/orders`, `/health`)
  - Endpoints SAP dedicados (`/api/sap/*`)
  - SSE/WebSocket para tempo real (planejado)
  - Rate limiting (planejado)
- **Porta**: 3000
- **Endpoints SAP**:
  - `GET /api/sap/health` → testa conexão SAP
  - `GET /api/sap/orders` → lista pedidos SAP (com filtros)
  - `GET /api/sap/orders/:docEntry` → busca pedido específico
  - `PATCH /api/sap/orders/:docEntry/status` → atualiza UDF `U_WMS_STATUS`
  - `POST /api/sap/sync` → dispara sync manual de pedidos abertos

#### **Core (core/)**
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 16
- **Responsabilidades**:
  - Máquina de estados (state machine) de pedidos
  - CRUD de orders com validação
  - Audit trail (imutável)
  - Endpoint interno: `POST /internal/sap/orders` (recebe do Worker)
- **Porta**: 8000
- **ORM**: SQLAlchemy 2.x
- **Models**:
  - `Order`: pedidos WMS
  - `OrderItem`: linhas do pedido (SKU + qty)
  - `ScanEvent`: eventos de bipagem (planejado)
  - `AuditLog`: histórico de mudanças

#### **Worker (worker/)**
- **Framework**: Node.js + TypeScript
- **Responsabilidades**:
  - Polling SAP B1 a cada 30s (configurável)
  - Buscar pedidos com status `bost_Open`
  - Mapear `SapOrder` → `WmsOrder` (via `mappings` lib)
  - POST para `http://core:8000/internal/sap/orders`
  - Retry com backoff exponencial
- **Porta**: N/A (background job)
- **Dependências**:
  - `sap-connector`: client SAP Service Layer
  - `mappings`: mapeamento de dados SAP↔WMS

#### **SAP Connector (sap-connector/)**
- **Tipo**: Biblioteca local (não publicada no npm)
- **Componentes**:
  - `SapServiceLayerClient`: client HTTP para SAP B1 Service Layer
  - `SapMockService`: mock completo (12 operações)
  - `sapClientFactory`: factory pattern (mock/real)
  - Mapeamentos de tipos: `SapOrder`, `SapItem`, `SapWarehouse`
- **Features**:
  - Login/Logout automático
  - Retry logic integrado
  - Rate limiting (max concurrent, RPS)
  - Cache de sessão (Redis planejado)
  - Suporte a UDFs (User-Defined Fields)
- **Documentação**: 18.000 palavras (~1h leitura)
- **Exemplos**: 4 scripts executáveis

#### **Nginx**
- **Imagem**: nginx:alpine
- **Config**:
  - `/api/*` → `http://gateway:3000/`
  - `/` → `http://web:80/`
  - Headers CORS gerenciados
  - Buffering desligado para SSE
- **Porta**: 8080 (exposta)

#### **PostgreSQL**
- **Versão**: 16-alpine
- **Database**: `wms`
- **User**: `wms`
- **Schema Principal**:
  - `orders`: pedidos WMS
  - `order_items`: linhas
  - `sap_sync_log`: histórico de sincronização (planejado)
  - `audit_log`: eventos de auditoria
- **Backups**: Não configurado (pendência)

#### **Redis**
- **Versão**: 7-alpine
- **Uso atual**: Mínimo (preparado para locks/cache)
- **Uso planejado**:
  - Cache de sessão SAP
  - Idempotency keys
  - Locks de tarefas (scan)
  - Cache de queries pesadas

---

## 🔗 2. INTEGRAÇÃO SAP B1

### 2.1 Estado Atual

✅ **Implementado**:
- Client SAP Service Layer completo
- Endpoints no Gateway (`/api/sap/*`)
- Worker com polling assíncrono
- Mapeamento `SapOrder` ↔ `WmsOrder`
- Mock service completo (para dev/testes)
- Suporte a UDFs (`U_WMS_STATUS`, `U_WMS_ORDER_ID`)

⚠️ **Parcialmente Implementado**:
- Sync incremental (usa `UpdateDate`, mas sem cursor persistente)
- Tratamento de erros SAP (básico)
- Reconciliação de status SAP ↔ WMS

❌ **Não Implementado**:
- Webhook SAP → WMS (requer config no SAP B1)
- Atualização SAP ao despachar no WMS (outbox pattern planejado)
- SQLQueries otimizadas (documentado, mas não criado no SAP)
- Cache de sessão SAP (Redis configurado, mas não usado)
- Métricas de sync (Prometheus/Grafana)

### 2.2 Fluxo de Dados SAP → WMS

```
┌─────────────────────┐
│   SAP B1 Orders     │ (ORDR table)
│   - DocEntry        │
│   - DocNum          │
│   - DocStatus       │
│   - DocumentLines   │
│   - U_WMS_STATUS    │ (UDF)
└──────────┬──────────┘
           │ Service Layer REST API
           │ GET /Orders?$filter=DocumentStatus eq 'bost_Open'
           ▼
┌──────────────────────────────┐
│   Worker (Node.js)           │
│   1. Login SAP               │
│   2. Fetch open orders       │
│   3. Map SapOrder → WmsOrder │
│   4. POST to Core            │
│   5. Retry on failure        │
└────────────┬─────────────────┘
             │ POST /internal/sap/orders
             ▼
┌───────────────────────────────────┐
│   Core (FastAPI)                  │
│   - Validate payload              │
│   - Upsert order (idempotent)     │
│   - Set status: A_SEPARAR         │
│   - Log audit event               │
└────────────┬──────────────────────┘
             │
             ▼
┌──────────────────────────┐
│   PostgreSQL             │
│   - orders table         │
│   - sap_doc_entry stored │
└──────────────────────────┘
```

### 2.3 Fluxo de Dados WMS → SAP (Planejado)

```
┌──────────────────────────┐
│   Core (FastAPI)         │
│   - Order status change  │
│   - Write to outbox      │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────┐
│   Outbox Table (PostgreSQL)      │
│   - event_type: ORDER_DISPATCHED │
│   - payload: { orderId, ... }    │
│   - status: PENDING              │
└──────────┬───────────────────────┘
           │ Polling (Worker)
           ▼
┌─────────────────────────────────────┐
│   Worker                            │
│   1. Read outbox (PENDING)          │
│   2. PATCH /Orders({DocEntry})      │
│      - Update U_WMS_STATUS          │
│   3. Mark outbox: PROCESSED         │
│   4. Retry on failure (DLQ)         │
└────────────┬────────────────────────┘
             │
             ▼
┌──────────────────────────┐
│   SAP B1 (via SL)        │
│   - U_WMS_STATUS updated │
└──────────────────────────┘
```

### 2.4 Mapeamento de Campos SAP ↔ WMS

| Campo SAP (ORDR) | Campo WMS | Transformação |
|------------------|-----------|---------------|
| `DocEntry` | `sap_doc_entry` | Direto (int) |
| `DocNum` | `sap_doc_num` | Direto (int) |
| `CardCode` | `customer_id` | Direto (string) |
| `CardName` | `customer_name` | Direto (string) |
| `DocDate` | `order_date` | ISO-8601 |
| `DocDueDate` | `due_date` | ISO-8601 |
| `DocTotal` | `total_value` | Decimal |
| `DocumentLines` | `items[]` | Array de linhas |
| `U_WMS_STATUS` | `status` | Enum mapping |
| `U_WMS_ORDER_ID` | `order_id` | UUID (WMS) |

**Status Mapping**:
- SAP `bost_Open` → WMS `A_SEPARAR`
- SAP `bost_Close` → WMS `DESPACHADO` (ou skip)
- WMS `DESPACHADO` → SAP `U_WMS_STATUS='DISPATCHED'`

### 2.5 SAP Mock Service

**Propósito**: Desenvolvimento e testes sem depender do SAP real.

**Features**:
- 2 clientes mock (Business Partners)
- 8 produtos mock (Items)
- 4 depósitos mock (Warehouses)
- 2 pedidos mock completos
- Gerador de pedidos aleatórios
- Filtros: status, cliente, data
- Paginação (skip/top)
- Delays simulados (100-500ms)
- Reset de dados

**Uso**:
```bash
# Rodar exemplos
npm run sap:mock              # Demo completa
npm run sap:mock:integration  # Workflow WMS + SAP
npm run sap:factory           # Factory pattern
```

**Documentação**: `SAP_MOCK_INDEX.md` (470 linhas)

---

## 🎨 3. FRONTEND

### 3.1 Frontend Atual (web/ - React/Vite)

#### **Status**: ✅ Operacional (com correção SAP aplicada)

#### **Features Implementadas**:
- ✅ Dashboard Kanban (6 colunas de status)
- ✅ Drag-and-drop de pedidos entre colunas
- ✅ Filtros: status, cliente, período
- ✅ Modal de detalhes do pedido
- ✅ Indicador de fonte de dados (API vs Mock)
- ✅ Botão "Importar do SAP" (chama `/api/sap/health`)
- ✅ Toast notifications (react-hot-toast)
- ✅ Loading states

#### **Correções Recentes** (02/02/2026):
- ✅ `VITE_API_BASE_URL` mudado para path relativo (`/api`)
- ✅ Nginx configurado para rotear `/api/*` → gateway
- ✅ Frontend agora mostra **"Fonte: API"** (não mais "Mock local")

#### **Pendências Críticas**:
1. **Botão "Importar do SAP" não faz sync real**
   - Atualmente: chama `/api/sap/health` (só testa conexão)
   - Deveria: chamar `POST /api/sap/sync` e refetch orders
   - Impacto: Usuário não consegue disparar sync manual

2. **Estado SAP separado do estado principal**
   - Existe `sapOrders` state separado de `orders`
   - Deveria: unificar após correção do sync

3. **Permissões/RBAC não implementado**
   - Todos têm acesso total
   - Deveria: respeitar headers `X-User-Role`

4. **Sem refresh automático (SSE/WebSocket)**
   - Usuário precisa F5 para ver novos pedidos
   - Deveria: SSE do gateway notificando mudanças

5. **UI/UX básica**
   - Layout funcional, mas não polido
   - Sem responsividade mobile
   - Sem tratamento de erro robusto

#### **Build e Deploy**:
```dockerfile
# Vite build multi-stage
FROM node:20-alpine as builder
ARG VITE_API_BASE_URL=/api   # ← Path relativo
ARG VITE_USE_MOCK=false
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

### 3.2 Frontend Next.js (web-next/)

#### **Status**: 🚧 20% concluído (setup inicial)

#### **Progresso**:
- ✅ Projeto Next.js 15 criado
- ✅ TailwindCSS + shadcn/ui configurado
- ✅ TanStack Query configurado
- ✅ API client base criado (`lib/api/`)
- ✅ Schemas Zod para Orders/Products
- ✅ Variáveis de ambiente (`.env.local`)
- ⬜ Layout (Sidebar/Topbar)
- ⬜ Dashboard
- ⬜ Páginas de pedidos/produtos/estoque
- ⬜ RBAC client-side
- ⬜ Testes

#### **Estrutura de Pastas**:
```
web-next/
├── app/                    # App Router (Next.js 15)
│   ├── layout.tsx
│   ├── page.tsx           # Dashboard
│   ├── pedidos/
│   ├── produtos/
│   └── estoque/
├── components/
│   ├── ui/                # shadcn/ui
│   ├── layout/            # Sidebar, Topbar
│   └── shared/
├── features/              # Features por domínio
│   ├── orders/
│   ├── products/
│   ├── inventory/
│   └── dashboard/
└── lib/
    ├── api/               # API client
    ├── schemas/           # Zod
    └── utils/
```

#### **Design System Planejado**:
- **Cores de Status**: Azul (A_SEPARAR), Âmbar (EM_SEPARACAO), Violeta (CONFERIDO), Rosa (COTACAO), Verde (COLETA), Ciano (DESPACHADO)
- **Componentes**: shadcn/ui (Button, Card, Table, Dialog, etc)
- **Ícones**: Lucide React
- **Gráficos**: Recharts
- **Responsividade**: Mobile-first (Bottom Nav) + Desktop (Sidebar)

#### **Próximos Passos (Next.js)**:
1. Implementar Layout (Sidebar + Topbar + Bottom Nav)
2. Dashboard com cards e gráficos (Recharts)
3. Página de pedidos com TanStack Table
4. CRUD de pedidos (formulários com react-hook-form)
5. Integração com SSE (tempo real)
6. RBAC (roles do backend)
7. Testes (Jest + React Testing Library)

#### **Vantagens Next.js sobre Vite**:
- ✅ SSR/SSG para SEO e performance
- ✅ Server Components (menos JS no cliente)
- ✅ App Router (nested layouts)
- ✅ shadcn/ui (design system moderno)
- ✅ Built-in optimizações (imagens, fonts)
- ✅ TypeScript first-class
- ⚠️ Curva de aprendizado maior
- ⚠️ Migração requer reescrita

### 3.3 Estratégia de Transição Frontend

**Opção A: Migração Gradual (Recomendado)**
1. Manter `web/` (Vite) em produção
2. Desenvolver `web-next/` em paralelo
3. Feature flags para habilitar Next.js por rota
4. Nginx roteia `/v2/*` para Next.js
5. Deprecar Vite após 100% de cobertura

**Opção B: Big Bang**
1. Pausar novas features no Vite
2. Focar 100% em Next.js (4-6 semanas)
3. Deploy Next.js substituindo Vite
4. Rollback plan com backup do Vite

**Recomendação**: **Opção A** (menor risco, continuidade de negócio)

---

## 💾 4. BACKEND E DADOS

### 4.1 Core (FastAPI)

#### **Arquitetura**:
- **Framework**: FastAPI 0.115+
- **ORM**: SQLAlchemy 2.x (async)
- **Migrations**: Alembic (planejado)
- **Validação**: Pydantic v2
- **Logging**: Estruturado (JSON)
- **CORS**: Configurado para `*` (dev) - **restringir em prod**

#### **Endpoints Principais**:
```
GET    /health                    → Health check
GET    /orders                    → Lista pedidos (filtros, paginação)
POST   /orders                    → Cria pedido
GET    /orders/{id}               → Detalhes do pedido
PATCH  /orders/{id}/status        → Transição de status
POST   /internal/sap/orders       → Recebe pedidos do Worker (internal)
```

#### **State Machine** (definido em `STATE_MACHINE.json`):
```
A_SEPARAR → EM_SEPARACAO → CONFERIDO → AGUARDANDO_COTACAO 
→ AGUARDANDO_COLETA → DESPACHADO
```

**Eventos/Commands**:
- `INICIAR_SEPARACAO`
- `FINALIZAR_SEPARACAO`
- `CONFERIR`
- `SOLICITAR_COTACAO`
- `CONFIRMAR_COTACAO`
- `AGUARDAR_COLETA`
- `DESPACHAR`

**Validações**:
- Transições inválidas retornam `WMS-SM-001`
- Campos obrigatórios validados (`WMS-VAL-002`)
- Idempotência via `Idempotency-Key` header

#### **Models (PostgreSQL)**:

```python
# Order
id: UUID (PK)
external_order_id: String (optional)
sap_doc_entry: Integer (optional, unique)
sap_doc_num: Integer (optional)
customer_id: String
customer_name: String
status: Enum (state machine)
order_date: DateTime
due_date: DateTime (optional)
total_value: Decimal
created_at: DateTime
updated_at: DateTime

# OrderItem
id: UUID (PK)
order_id: UUID (FK → Order)
sku: String
quantity: Decimal
price: Decimal (optional)
line_total: Decimal (optional)
warehouse_code: String (optional)

# AuditLog (planejado)
id: UUID (PK)
order_id: UUID (FK)
event_type: String (TRANSITION, SCAN, etc)
from_status: String
to_status: String
actor: String (user_id)
occurred_at: DateTime
idempotency_key: String
reason: String (optional)
```

#### **Pendências Core**:
1. **Migrations com Alembic** não configurado
   - Atualmente: schema criado no startup (via SQLAlchemy)
   - Deveria: migrations versionadas
   - Risco: perda de dados em refactor

2. **Auditoria incompleta**
   - Model `AuditLog` planejado, mas não implementado
   - Dificulta troubleshooting e compliance

3. **Validação de regras de negócio**
   - RB-03 (imutabilidade de itens após separação) não aplicada
   - RB-06, RB-07 (dependências de status) não validadas

4. **Testes unitários**
   - Apenas testes manuais
   - Cobertura: 0%
   - Deveria: >80% (pytest)

5. **Observabilidade**
   - OpenTelemetry configurado, mas sem export
   - Logs JSON estruturados, mas sem agregação (Loki)
   - Métricas não expostas (Prometheus)

6. **Segurança**
   - Endpoint `/internal/sap/orders` sem autenticação
   - CORS aberto para `*` (dev)
   - Sem rate limiting

### 4.2 Gateway (Fastify)

#### **Responsabilidades**:
- BFF (Backend-for-Frontend)
- Autenticação via headers `X-User-Id`, `X-User-Role`, `X-User-Name`
- Proxy para Core (`/orders`, `/health`)
- Endpoints SAP (`/api/sap/*`)
- Propagação de `X-Correlation-Id`

#### **Endpoints**:
```
# Proxy para Core
GET    /orders             → Core:/orders
POST   /orders             → Core:/orders
GET    /orders/:id         → Core:/orders/:id
PATCH  /orders/:id/status  → Core:/orders/:id/status

# SAP (implementado)
GET    /api/sap/health              → Testa conexão SAP
GET    /api/sap/orders              → Lista pedidos SAP
GET    /api/sap/orders/:docEntry    → Busca pedido específico
PATCH  /api/sap/orders/:docEntry/status → Atualiza UDF
POST   /api/sap/sync                → Dispara sync manual

# Health
GET    /health             → Status do gateway
```

#### **Configuração SAP**:
```typescript
// Carregado de env vars
SAP_B1_BASE_URL: string
SAP_B1_COMPANY_DB: string
SAP_B1_USERNAME: string
SAP_B1_PASSWORD: string (sensível)
SAP_B1_TIMEOUT_MS: 20000
SAP_B1_MAX_ATTEMPTS: 5
SAP_B1_MAX_CONCURRENT: 8  // Rate limiting
SAP_B1_MAX_RPS: 10         // Requests/segundo
```

#### **Pendências Gateway**:
1. **SSE/WebSocket não implementado**
   - Dependência: `@fastify/websocket` instalada
   - Falta: lógica de pub/sub (Redis)
   - Impacto: frontend sem tempo real

2. **Rate Limiting não ativo**
   - Código preparado, mas não aplicado
   - Risco: DDoS / abuse

3. **CORS hardcoded**
   - Permitido para qualquer origem em dev
   - Deveria: lista de origens permitidas (env var)

4. **Logs sem correlação completa**
   - `X-Correlation-Id` gerado, mas não propagado consistentemente
   - Dificulta troubleshooting cross-service

5. **Cache SAP não implementado**
   - Sessões SAP reautenticam a cada request
   - Deveria: cache em Redis (TTL 30min)
   - Impacto: latência e load no SAP

### 4.3 Worker (Node.js)

#### **Responsabilidades**:
- Polling SAP B1 a cada 30s (configurável via `POLL_INTERVAL_SECONDS`)
- Buscar pedidos com `DocumentStatus='bost_Open'`
- Mapear `SapOrder` → `WmsOrder`
- POST para Core: `http://core:8000/internal/sap/orders`
- Retry com backoff exponencial (3 tentativas)
- Log estruturado (JSON)

#### **Fluxo de Execução**:
```typescript
while (true) {
  try {
    // 1. Login SAP
    await sapClient.login();
    
    // 2. Fetch open orders
    const sapOrders = await sapClient.getOrders({
      documentStatus: 'bost_Open',
      updateDate: lastSyncDate // Incremental
    });
    
    // 3. Map to WMS format
    const wmsOrders = sapOrders.map(mapSapOrderToWms);
    
    // 4. Push to Core
    for (const order of wmsOrders) {
      await coreClient.createOrUpdateOrder(order);
    }
    
    // 5. Update cursor
    lastSyncDate = new Date();
    
  } catch (error) {
    logger.error({ error }, 'Sync failed');
    // Retry after backoff
  }
  
  await sleep(POLL_INTERVAL_SECONDS * 1000);
}
```

#### **Pendências Worker**:
1. **Cursor de sincronização não persistente**
   - `lastSyncDate` em memória (perde ao reiniciar)
   - Deveria: salvar no Core (tabela `sap_sync_cursor`)
   - Impacto: re-sync desnecessário ao restart

2. **DLQ (Dead Letter Queue) não implementado**
   - Pedidos com erro infinito são retentados indefinidamente
   - Deveria: após N falhas, mover para DLQ (Redis/Postgres)

3. **Sem métricas de sync**
   - Não expõe: pedidos/min, latência, erros
   - Deveria: Prometheus metrics endpoint

4. **Sem alertas**
   - Falhas silenciosas (só em logs)
   - Deveria: alertar se sync falha > 5min

5. **Polling fixo (30s)**
   - Não ajusta dinamicamente
   - Deveria: backoff se SAP estiver lento

6. **Sem limite de batch**
   - Pode buscar 10.000 pedidos de uma vez
   - Deveria: paginar (ex: 100 pedidos/batch)

### 4.4 PostgreSQL

#### **Schema Atual**:
```sql
-- orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  external_order_id VARCHAR(255),
  sap_doc_entry INTEGER UNIQUE,
  sap_doc_num INTEGER,
  customer_id VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  status VARCHAR(50) NOT NULL, -- Enum
  order_date TIMESTAMP,
  due_date TIMESTAMP,
  total_value DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- order_items
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sku VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  price DECIMAL(10, 2),
  line_total DECIMAL(10, 2),
  warehouse_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_sap_doc_entry ON orders(sap_doc_entry);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

#### **Schemas Planejados** (não implementados):
```sql
-- audit_log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  event_type VARCHAR(50) NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  actor VARCHAR(255),
  occurred_at TIMESTAMP NOT NULL,
  idempotency_key VARCHAR(255),
  reason TEXT,
  metadata JSONB
);

-- sap_sync_cursor
CREATE TABLE sap_sync_cursor (
  id SERIAL PRIMARY KEY,
  last_sync_date TIMESTAMP NOT NULL,
  last_sync_doc_entry INTEGER,
  sync_status VARCHAR(20), -- SUCCESS, FAILED
  error_message TEXT,
  synced_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- sap_sync_errors (DLQ)
CREATE TABLE sap_sync_errors (
  id UUID PRIMARY KEY,
  sap_doc_entry INTEGER NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  status VARCHAR(20), -- PENDING, RESOLVED, ABANDONED
  created_at TIMESTAMP DEFAULT NOW()
);

-- scan_events (para bipagem)
CREATE TABLE scan_events (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  task_id UUID,
  operator_id VARCHAR(255),
  event_type VARCHAR(50), -- SCAN_START, SCAN_ITEM, SCAN_COMPLETE
  sku VARCHAR(255),
  location VARCHAR(50),
  quantity DECIMAL(10, 2),
  scanned_at TIMESTAMP NOT NULL,
  device_id VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE
);
```

#### **Pendências PostgreSQL**:
1. **Migrations não versionadas**
   - Schema criado via SQLAlchemy `create_all()`
   - Deveria: Alembic migrations
   - Risco: drift entre ambientes

2. **Backups não configurados**
   - Sem backup automático
   - Deveria: pg_dump diário + S3/volume
   - Risco crítico: perda de dados

3. **Sem replicação**
   - Instância única (SPOF)
   - Deveria: standby read replica

4. **Conexões não pooladas**
   - SQLAlchemy pool default (5 conns)
   - Deveria: PgBouncer ou pool maior

5. **Sem monitoring de queries lentas**
   - Deveria: pg_stat_statements + alertas

### 4.5 Redis

#### **Status**: Configurado, mas subutilizado

#### **Uso Atual**:
- Health check (gateway verifica conectividade)
- Nenhum cache implementado

#### **Uso Planejado**:
1. **Cache de sessão SAP**
   - Key: `sap:session:{companyDB}`
   - Value: `{ sessionId, cookie, expiresAt }`
   - TTL: 30min

2. **Idempotency keys**
   - Key: `idem:{scope}:{key}`
   - Value: `{ requestHash, responseSnapshot }`
   - TTL: 24h

3. **Locks de tarefas**
   - Key: `lock:task:{taskId}`
   - Value: `{ operatorId, lockedAt }`
   - TTL: 15min

4. **Cache de queries pesadas**
   - Ex: lista de clientes, produtos
   - TTL: 5-10min

5. **Pub/Sub para SSE**
   - Channel: `orders:updates`
   - Message: `{ orderId, status, event }`

#### **Pendências Redis**:
- Implementar todos os casos de uso acima

---

## 🚧 5. PENDÊNCIAS CRÍTICAS (PRIORIDADE ALTA)

### 5.1 Funcionalidade

1. **✅ CONCLUÍDO: Frontend mostra API real (não Mock)**
   - Correção aplicada: `VITE_API_BASE_URL=/api`, nginx roteado
   - **Status**: Deployed em produção (aguardando validação no servidor)

2. **❌ Botão "Importar do SAP" não funciona**
   - **Problema**: Chama `/api/sap/health` (só testa conexão)
   - **Solução**: Mudar para `POST /api/sap/sync` + refetch orders
   - **Impacto**: Usuários não conseguem sincronizar manualmente
   - **Esforço**: 2h (frontend + teste)
   - **Prioridade**: 🔴 ALTA

3. **❌ Sync incremental sem cursor persistente**
   - **Problema**: Worker perde `lastSyncDate` ao reiniciar
   - **Solução**: Salvar cursor no Core (tabela `sap_sync_cursor`)
   - **Impacto**: Re-sync desnecessário (load no SAP)
   - **Esforço**: 4h (migration + worker + core)
   - **Prioridade**: 🔴 ALTA

4. **❌ Auditoria não implementada**
   - **Problema**: Sem rastreabilidade de mudanças
   - **Solução**: Implementar `AuditLog` table + middleware
   - **Impacto**: Compliance / troubleshooting impossível
   - **Esforço**: 8h (model + migrations + testes)
   - **Prioridade**: 🔴 ALTA

5. **❌ Outbox pattern para WMS → SAP**
   - **Problema**: Despacho no WMS não atualiza SAP
   - **Solução**: Implementar outbox + worker consumer
   - **Impacto**: SAP fica desatualizado
   - **Esforço**: 12h (outbox + worker + retry)
   - **Prioridade**: 🟡 MÉDIA

### 5.2 Segurança

1. **❌ Endpoint `/internal/sap/orders` sem auth**
   - **Risco**: Worker pode ser forjado
   - **Solução**: Shared secret via header `X-Internal-Secret`
   - **Esforço**: 2h
   - **Prioridade**: 🔴 ALTA

2. **❌ CORS aberto (`*`)**
   - **Risco**: XSS / CSRF
   - **Solução**: Whitelist de origens (env var)
   - **Esforço**: 1h
   - **Prioridade**: 🔴 ALTA

3. **❌ Credenciais SAP em plain text**
   - **Risco**: Exposição de senha
   - **Solução**: Usar secrets manager (Docker Secrets / AWS Secrets)
   - **Esforço**: 4h (setup + refactor)
   - **Prioridade**: 🟡 MÉDIA

4. **❌ Sem rate limiting**
   - **Risco**: DDoS / abuse
   - **Solução**: Ativar rate limiting no gateway
   - **Esforço**: 2h
   - **Prioridade**: 🟡 MÉDIA

### 5.3 Operação

1. **❌ Sem backups PostgreSQL**
   - **Risco**: Perda catastrófica de dados
   - **Solução**: Cron job com `pg_dump` → S3/volume
   - **Esforço**: 3h (script + teste restore)
   - **Prioridade**: 🔴 CRÍTICA

2. **❌ Logs não agregados**
   - **Problema**: Logs em cada container (difícil troubleshooting)
   - **Solução**: Loki + Promtail ou ELK
   - **Esforço**: 8h (setup + dashboards)
   - **Prioridade**: 🟡 MÉDIA

3. **❌ Sem métricas (Prometheus)**
   - **Problema**: Sem visibilidade de performance/erros
   - **Solução**: Exporters + Grafana dashboards
   - **Esforço**: 12h (setup + dashboards)
   - **Prioridade**: 🟡 MÉDIA

4. **❌ Sem alertas (Alertmanager)**
   - **Problema**: Falhas silenciosas
   - **Solução**: Alertas críticos (sync failure, DB down, etc)
   - **Esforço**: 4h (config + integração Slack/email)
   - **Prioridade**: 🟡 MÉDIA

5. **❌ Migrations manuais**
   - **Problema**: Schema drift, perda de dados
   - **Solução**: Alembic migrations
   - **Esforço**: 6h (setup + migrations iniciais)
   - **Prioridade**: 🟡 MÉDIA

### 5.4 Testes

1. **❌ Cobertura de testes: 0%**
   - **Problema**: Sem testes automatizados
   - **Solução**: Testes unitários (pytest + Jest)
   - **Esforço**: 40h (setup + casos de teste)
   - **Prioridade**: 🟡 MÉDIA

2. **❌ Sem testes E2E**
   - **Problema**: Regressões não detectadas
   - **Solução**: Playwright ou Cypress
   - **Esforço**: 16h (setup + cenários)
   - **Prioridade**: 🟢 BAIXA

3. **❌ Sem testes de integração SAP**
   - **Problema**: Mudanças no SAP quebram prod
   - **Solução**: Suite de testes contra SAP Sandbox
   - **Esforço**: 8h (casos + CI)
   - **Prioridade**: 🟡 MÉDIA

---

## 🚀 6. PRÓXIMOS PASSOS EVOLUTIVOS

### 6.1 Curto Prazo (1-2 semanas)

#### **Sprint 1: Correções Críticas**
1. ✅ **Fix: Frontend usando Mock** (CONCLUÍDO)
   - Deploy no servidor VPS
   - Validar `http://31.97.174.120:8080/` → "Fonte: API"

2. **Fix: Botão "Importar do SAP"** (2h)
   - Mudar para `POST /api/sap/sync`
   - Refetch orders após sync
   - Loading state durante sync

3. **Segurança: Internal endpoint auth** (2h)
   - Adicionar `X-Internal-Secret` header
   - Validar no Core

4. **Segurança: CORS whitelist** (1h)
   - Env var `ALLOWED_ORIGINS`
   - Aplicar no gateway

5. **Operação: Setup backup PostgreSQL** (3h)
   - Script `pg_dump` diário
   - Volume para backups
   - Testar restore

**Total Sprint 1**: 8h (~1 semana part-time)

#### **Sprint 2: Auditoria e Persistência**
1. **Feature: Audit Log** (8h)
   - Model `AuditLog`
   - Middleware para capturar transições
   - Migration Alembic
   - Endpoint `GET /orders/{id}/audit`

2. **Feature: Cursor de sincronização persistente** (4h)
   - Tabela `sap_sync_cursor`
   - Worker salva/lê cursor do Core
   - Endpoint `GET /api/sap/sync/status`

3. **Setup: Alembic migrations** (6h)
   - Configurar Alembic
   - Gerar migration inicial (schema atual)
   - Migrations para audit_log + cursor

**Total Sprint 2**: 18h (~2 semanas part-time)

### 6.2 Médio Prazo (1-2 meses)

#### **Tema 1: Observabilidade**
1. **Logging agregado: Loki + Promtail** (8h)
   - Docker Compose com Loki
   - Promtail configurado para todos os serviços
   - Grafana datasource

2. **Métricas: Prometheus + Grafana** (12h)
   - Exporters (Node Exporter, Postgres Exporter)
   - Custom metrics (gateway, core, worker)
   - Dashboards:
     - Pedidos por status (time series)
     - Latência SAP (histogram)
     - Taxa de sync (gauge)
     - Erros por serviço (counter)

3. **Alertas: Alertmanager** (4h)
   - Alertas críticos:
     - `PostgreSQLDown`
     - `SapSyncFailed > 5min`
     - `HighErrorRate > 5%`
     - `DiskSpacelow < 10%`
   - Integração Slack/email

**Total Tema 1**: 24h (~3 semanas)

#### **Tema 2: Tempo Real (SSE/WebSocket)**
1. **Backend: SSE no Gateway** (8h)
   - Endpoint `GET /orders/stream` (SSE)
   - Pub/Sub via Redis (`orders:updates` channel)
   - Core publica ao mudar status

2. **Frontend: Consumir SSE** (6h)
   - `EventSource` no React
   - Atualizar lista de pedidos em tempo real
   - Toast notification para mudanças

3. **Testes: E2E tempo real** (4h)
   - Validar que mudanças aparecem sem F5

**Total Tema 2**: 18h (~2 semanas)

#### **Tema 3: Outbox Pattern (WMS → SAP)**
1. **Backend: Tabela outbox** (4h)
   - Model `SapOutbox`
   - Trigger ao mudar status para `DESPACHADO`

2. **Worker: Consumer outbox** (8h)
   - Polling outbox (events `PENDING`)
   - `PATCH /Orders({DocEntry})` → update `U_WMS_STATUS`
   - Marcar `PROCESSED` ou `FAILED` (DLQ)
   - Retry com backoff

3. **Monitoramento: Dashboard outbox** (4h)
   - Grafana dashboard:
     - Events pending (gauge)
     - Events processed/min (rate)
     - Errors (counter)

**Total Tema 3**: 16h (~2 semanas)

#### **Tema 4: Testes Automatizados**
1. **Testes unitários Backend** (20h)
   - Core: state machine, validações (pytest)
   - Gateway: rotas, proxy (Jest)
   - Worker: sync logic (Jest)
   - Cobertura: >70%

2. **Testes de integração SAP** (8h)
   - Suite contra SAP Sandbox
   - CI: rodar antes de deploy

3. **Testes E2E Frontend** (12h)
   - Playwright ou Cypress
   - Cenários críticos:
     - Login → Dashboard
     - Filtrar pedidos
     - Arrastar card no Kanban
     - Importar do SAP

**Total Tema 4**: 40h (~5 semanas)

**Total Médio Prazo**: 98h (~12 semanas / 3 meses)

### 6.3 Longo Prazo (3-6 meses)

#### **Tema 1: Frontend Next.js (80% restante)**
1. **Layout completo** (16h)
   - Sidebar + Topbar + Bottom Nav
   - Breadcrumbs
   - User menu

2. **Dashboard** (12h)
   - Cards: pedidos por status
   - Gráficos: pedidos/dia, faturamento
   - KPIs: tempo médio de separação

3. **Páginas de pedidos** (24h)
   - Lista com TanStack Table (filtros, sorting, paginação)
   - Detalhes do pedido
   - Formulário de criação/edição
   - Transições de status

4. **Páginas de produtos** (16h)
   - CRUD de produtos
   - Visualização de estoque por depósito

5. **Páginas de estoque** (12h)
   - Dashboard de estoque
   - Movimentações

6. **RBAC client-side** (8h)
   - Guards por role
   - UI condicional (botões, menus)

7. **Testes Next.js** (16h)
   - Jest + React Testing Library
   - Cobertura >70%

**Total Tema 1**: 104h (~13 semanas)

#### **Tema 2: Bipagem (Scan)**
1. **Backend: Scan events** (12h)
   - Tabela `scan_events`
   - Endpoint `POST /scans`
   - Validações (item correto, qty, localização)
   - Idempotência (evitar scan duplicado)

2. **Frontend Mobile (PWA)** (40h)
   - Interface de bipagem
   - Camera API (código de barras)
   - Offline-first (Service Worker)
   - Sync quando online

3. **Testes scan** (8h)
   - Testes de validação
   - E2E: scan completo de pedido

**Total Tema 2**: 60h (~8 semanas)

#### **Tema 3: Otimizações SAP**
1. **SQLQueries no SAP** (8h)
   - Criar queries manualmente no SAP B1 Client
   - Endpoint gateway: `POST /api/sap/query/{queryName}`
   - Redução de 60-90% no tempo de resposta

2. **Cache de sessão SAP (Redis)** (6h)
   - Cache sessionId + cookie
   - TTL: 30min
   - Redução de ~50% de requests de login

3. **Webhook SAP → WMS** (16h)
   - Endpoint no gateway: `POST /webhooks/sap/order-update`
   - Validação de signature (HMAC)
   - Processar evento e notificar Core
   - Configuração no SAP B1 (lado do cliente)

**Total Tema 3**: 30h (~4 semanas)

#### **Tema 4: Relatórios e BI**
1. **Backend: Agregações** (12h)
   - Endpoints de relatórios:
     - `GET /reports/orders-by-status` (time series)
     - `GET /reports/performance` (tempo médio por etapa)
     - `GET /reports/sap-sync-health`

2. **Frontend: Dashboards BI** (16h)
   - Recharts ou Plotly
   - Filtros de período
   - Export CSV/PDF

3. **Scheduled reports** (8h)
   - Worker: gerar relatórios diários
   - Email com PDF anexo

**Total Tema 4**: 36h (~5 semanas)

**Total Longo Prazo**: 230h (~29 semanas / ~7 meses)

### 6.4 Backlog / Nice-to-Have

1. **Multi-tenancy** (40h)
   - Suporte a múltiplas empresas/filiais
   - Isolamento de dados por tenant
   - Configuração SAP por tenant

2. **Integração com transportadoras** (60h)
   - APIs Correios, Jadlog, etc
   - Geração automática de etiquetas
   - Rastreamento de entregas

3. **Mobile App nativo** (200h)
   - React Native ou Flutter
   - Features de bipagem
   - Offline-first

4. **Integração com balanças/impressoras** (40h)
   - Zebra printers (ZPL)
   - Balanças (serial/USB)

5. **Machine Learning** (80h)
   - Previsão de demanda
   - Otimização de roteirização
   - Detecção de anomalias

6. **Internacionalização (i18n)** (16h)
   - Suporte a EN, ES, PT
   - Date/currency localization

---

## 📈 7. ROADMAP VISUAL

```
┌─────────────────────────────────────────────────────────────┐
│ Q1 2026 (Jan-Mar)                                            │
├─────────────────────────────────────────────────────────────┤
│ ✅ Correção Mock → API real (CONCLUÍDO)                     │
│ 🔄 Sprint 1: Correções críticas (1 sem)                     │
│ 🔄 Sprint 2: Auditoria + Cursor (2 sem)                     │
│ 🔄 Observabilidade: Loki + Prometheus (3 sem)               │
│ 🔄 Tempo Real: SSE/WebSocket (2 sem)                        │
│ 🔄 Outbox Pattern: WMS → SAP (2 sem)                        │
│ 🔄 Testes automatizados (5 sem)                             │
│ Total: ~12 semanas                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Q2 2026 (Abr-Jun)                                            │
├─────────────────────────────────────────────────────────────┤
│ 🔄 Frontend Next.js (80% restante) (13 sem)                 │
│ 🔄 Bipagem (Scan) (8 sem)                                   │
│ 🔄 Otimizações SAP (SQLQueries, Cache, Webhooks) (4 sem)    │
│ 🔄 Relatórios e BI (5 sem)                                  │
│ Total: ~13 semanas (paralelizável)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Q3-Q4 2026 (Jul-Dez)                                         │
├─────────────────────────────────────────────────────────────┤
│ 🔮 Multi-tenancy                                             │
│ 🔮 Integração transportadoras                                │
│ 🔮 Mobile App nativo                                         │
│ 🔮 Machine Learning                                          │
│ 🔮 i18n                                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 8. RECOMENDAÇÕES ESTRATÉGICAS

### 8.1 Priorização por Impacto vs Esforço

| Iniciativa | Impacto | Esforço | Prioridade | Quando |
|------------|---------|---------|------------|--------|
| **Backups PostgreSQL** | 🔴 CRÍTICO | 3h | 🥇 P0 | Agora |
| **Fix botão SAP** | 🔴 ALTO | 2h | 🥇 P0 | Semana 1 |
| **Internal endpoint auth** | 🔴 ALTO | 2h | 🥇 P0 | Semana 1 |
| **CORS whitelist** | 🔴 ALTO | 1h | 🥇 P0 | Semana 1 |
| **Audit Log** | 🔴 ALTO | 8h | 🥈 P1 | Semana 2 |
| **Cursor persistente** | 🟡 MÉDIO | 4h | 🥈 P1 | Semana 2 |
| **Alembic migrations** | 🟡 MÉDIO | 6h | 🥈 P1 | Semana 2 |
| **Observabilidade** | 🟡 MÉDIO | 24h | 🥉 P2 | Mês 1 |
| **SSE/WebSocket** | 🟡 MÉDIO | 18h | 🥉 P2 | Mês 1 |
| **Outbox pattern** | 🟡 MÉDIO | 16h | 🥉 P2 | Mês 1-2 |
| **Testes automatizados** | 🟢 BAIXO | 40h | 🎖️ P3 | Mês 2 |
| **Frontend Next.js** | 🟡 MÉDIO | 104h | 🎖️ P3 | Q2 |
| **Bipagem (Scan)** | 🟡 MÉDIO | 60h | 🎖️ P3 | Q2 |

### 8.2 Dependências Técnicas

```
Backups PostgreSQL ─┐
                    ├─> Alembic Migrations
Internal Auth ──────┤
                    ├─> Audit Log ─> SSE/WebSocket
Cursor Persistente ─┤
                    └─> Outbox Pattern ─> Testes E2E
                                     │
                                     └─> Frontend Next.js
```

### 8.3 Recomendações de Time

**Time Mínimo (MVP)**:
- 1 Backend Dev (Python + Node.js)
- 1 Frontend Dev (React/Next.js)
- 0.5 DevOps (setup infra)

**Time Ideal (Roadmap completo)**:
- 2 Backend Devs
- 1 Frontend Dev (Next.js)
- 1 Mobile Dev (PWA/React Native)
- 1 DevOps
- 1 QA (testes automatizados)

### 8.4 Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Perda de dados (sem backup)** | 🟡 Média | 🔴 Crítico | Implementar backups P0 |
| **SAP indisponível** | 🟢 Baixa | 🟡 Médio | Fallback para mock, retry logic |
| **Drift de schema (sem migrations)** | 🔴 Alta | 🟡 Médio | Alembic P1 |
| **Regressões (sem testes)** | 🔴 Alta | 🟡 Médio | Testes P2 |
| **Vendor lock-in (SAP B1)** | 🟢 Baixa | 🟢 Baixo | Abstração já existe (sap-connector) |
| **Sobrecarga do SAP** | 🟡 Média | 🟡 Médio | Rate limiting, cache, SQLQueries |

### 8.5 Métricas de Sucesso

**Técnicas**:
- ✅ Uptime: >99.5%
- ✅ Latência API: p95 < 500ms
- ✅ Sync SAP: <2min (completo), <10s (incremental)
- ✅ Cobertura testes: >70%
- ✅ Incidentes críticos: 0/mês

**Negócio**:
- ✅ Pedidos processados: +50% vs sistema anterior
- ✅ Tempo médio de separação: -30%
- ✅ Erros de expedição: -80%
- ✅ Satisfação do operador: >4/5

---

## 📚 9. DOCUMENTAÇÃO DISPONÍVEL

### 9.1 Índice Geral

| Documento | Tipo | Status | Palavras | Tempo |
|-----------|------|--------|----------|-------|
| `SPEC.md` | Especificação | ✅ | 2000 | 10 min |
| `docs/ARCHITECTURE.md` | Arquitetura | ✅ | 1500 | 8 min |
| `docs/DATA_MODEL.md` | Dados | ⚠️ | 800 | 5 min |
| `SAP_MOCK_INDEX.md` | SAP Mock | ✅ | 470 | 3 min |
| `SAP_MOCK_README.md` | SAP Mock | ✅ | 2000 | 10 min |
| `sap-connector/README.md` | SAP Integração | ✅ | 1200 | 7 min |
| `CORRECAO_SAP_RESUMO.md` | Fix Recente | ✅ | 800 | 5 min |
| `docs/VALIDACAO_CADEIA_SAP.md` | Validação | ✅ | 1500 | 10 min |
| `web-next/README.md` | Frontend Next.js | ✅ | 1000 | 6 min |
| `DEPLOY.md` | Deploy | ⚠️ | 500 | 3 min |

**Total**: 107 arquivos markdown, ~50.000 palavras (~4h leitura)

### 9.2 Documentação Ausente

❌ **Necessário criar**:
1. `API_REFERENCE.md` (OpenAPI/Swagger)
2. `OPERATIONS_MANUAL.md` (runbook para ops)
3. `TROUBLESHOOTING.md` (erros comuns + soluções)
4. `SECURITY.md` (políticas de segurança)
5. `CONTRIBUTING.md` (guia para desenvolvedores)
6. `CHANGELOG.md` (histórico de versões)

---

## 🎬 10. PLANO DE AÇÃO IMEDIATO

### Semana 1 (P0: Crítico)
```bash
# Dia 1-2: Backups
- [ ] Script pg_dump com cron
- [ ] Teste de restore
- [ ] Volume persistente para backups

# Dia 3: Segurança
- [ ] Shared secret para /internal/sap/orders
- [ ] CORS whitelist
- [ ] Review de secrets (env vars)

# Dia 4-5: Fix SAP button
- [ ] Mudar para POST /api/sap/sync
- [ ] Refetch orders após sync
- [ ] Loading state
- [ ] Teste E2E
```

### Semana 2-3 (P1: Alta)
```bash
# Semana 2: Auditoria
- [ ] Alembic setup
- [ ] Migration: audit_log table
- [ ] Model AuditLog
- [ ] Middleware capture
- [ ] Endpoint GET /orders/{id}/audit

# Semana 3: Cursor + Testes
- [ ] Migration: sap_sync_cursor table
- [ ] Worker salva/lê cursor
- [ ] Endpoint GET /api/sap/sync/status
- [ ] Testes unitários críticos (state machine, sync)
```

### Mês 1 (P2: Observabilidade)
```bash
# Semana 4: Logging
- [ ] Loki + Promtail setup
- [ ] Grafana datasource
- [ ] Dashboards básicos

# Semana 5-6: Métricas
- [ ] Prometheus setup
- [ ] Custom metrics (gateway, core, worker)
- [ ] Dashboards Grafana (pedidos, latência, erros)
- [ ] Alertas críticos (Alertmanager)
```

---

## 🏁 CONCLUSÃO

### Estado Atual: 70% Funcional

**Pontos Fortes** ✅:
- Arquitetura sólida (Gateway + Core + Worker)
- Integração SAP completa (Service Layer + Mocks)
- Frontend funcional (Kanban operacional)
- Docker Compose pronto para produção
- Documentação extensa (107 MDs)

**Gaps Críticos** ❌:
- Backups PostgreSQL (risco de perda de dados)
- Auditoria não implementada (compliance)
- Testes automatizados: 0%
- Observabilidade básica (logs, métricas)
- Frontend Next.js 20% concluído

**Próximos 3 Meses**:
1. **Mês 1**: Correções críticas + Observabilidade
2. **Mês 2**: Auditoria + Testes + Tempo Real
3. **Mês 3**: Frontend Next.js + Bipagem

**Esforço Estimado (MVP completo)**: ~300h (~2-3 meses com 1 dev full-time)

**Recomendação**: Priorizar P0 (backups, segurança) **imediatamente**, depois seguir roadmap sequencial.

---

**Documento criado**: 2026-02-03  
**Próxima revisão**: Após Sprint 1 (P0)  
**Responsável**: Equipe Técnica WMS
