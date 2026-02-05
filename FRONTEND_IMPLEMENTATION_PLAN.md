# 🚀 PLANO DE IMPLEMENTAÇÃO - FRONTEND WMS/OMS

**Data**: 2026-02-03  
**Stack**: Next.js 14 (App Router) + React + TypeScript + TailwindCSS + shadcn/ui

---

## 📊 ANÁLISE DO BACKEND

### Base URL
- **Desenvolvimento**: `http://localhost:8000`
- **Health Check**: `GET /health`
- **Autenticação**: Headers (`X-User-Id`, `X-User-Role`)
- **CORS**: Habilitado para todas as origens em dev

### Endpoints Disponíveis (47+ endpoints)

#### 🛒 ORDERS (Pedidos)
| Método | Endpoint | Uso no Frontend |
|--------|----------|-----------------|
| GET | `/orders` | **Dashboard** + **Lista de Pedidos** |
| GET | `/orders/:id` | **Detalhe do Pedido** |
| POST | `/orders` | **Criar Pedido** (se necessário) |
| PUT | `/orders/:id` | **Atualizar Pedido** |
| POST | `/orders/:id/events` | **Aplicar Evento** (mudar status) |
| GET | `/orders/:id/history` | **Histórico/Timeline** |

**Query Params para listagem**:
- `customerId`, `status`, `externalOrderId`, `priority`
- `from`, `to` (datas)
- `limit` (1-200, padrão 50), `cursor` (paginação)

#### 📦 CATALOG - ITEMS (Produtos)
| Método | Endpoint | Uso no Frontend |
|--------|----------|-----------------|
| GET | `/api/v1/catalog/items` | **Lista de Produtos** |
| GET | `/api/v1/catalog/items/:code` | **Detalhe do Produto** |

**Query Params**:
- `search`, `categoryId`, `active`
- `limit`, `cursor`

#### 🏢 CATALOG - WAREHOUSES (Armazéns)
| Método | Endpoint | Uso no Frontend |
|--------|----------|-----------------|
| GET | `/api/v1/catalog/warehouses` | **Filtro de Depósitos** |
| GET | `/api/v1/catalog/warehouses/:code` | **Detalhe do Armazém** |

#### 📊 INVENTORY (Estoque)
| Método | Endpoint | Uso no Frontend |
|--------|----------|-----------------|
| GET | `/api/v1/inventory` | **Visão de Estoque** |
| GET | `/api/v1/inventory/:itemCode/:warehouseCode` | **Estoque Específico** |

**Query Params**:
- `itemCode`, `warehouseCode`, `batchNumber`
- `minQuantity`, `includeReserved`
- `limit`, `cursor`

#### 🚚 SHIPMENTS (Remessas)
| Método | Endpoint | Uso no Frontend |
|--------|----------|-----------------|
| GET | `/api/v1/shipments` | **Lista de Remessas** |
| GET | `/api/v1/shipments/:id` | **Detalhe da Remessa** |

#### 👥 CUSTOMERS (Clientes)
| Método | Endpoint | Uso no Frontend |
|--------|----------|-----------------|
| GET | `/api/v1/customers` | **Lista de Clientes** (filtros) |
| GET | `/api/v1/customers/:id` | **Detalhe do Cliente** |

#### 📱 DASHBOARD
| Método | Endpoint | Uso no Frontend |
|--------|----------|-----------------|
| GET | `/api/v1/dashboard/orders` | **Dashboard Principal** |
| GET | `/api/v1/dashboard/tasks` | **Dashboard de Tarefas** |
| GET | `/api/v1/dashboard/metrics` | **KPIs/Métricas** |

---

## 🗂️ MODELO DE DADOS

### OrderStatus (State Machine)
```typescript
enum OrderStatus {
  A_SEPARAR = "A_SEPARAR",           // Estado inicial
  EM_SEPARACAO = "EM_SEPARACAO",     // Em processo
  CONFERIDO = "CONFERIDO",           // Separado e conferido
  AGUARDANDO_COTACAO = "AGUARDANDO_COTACAO",
  AGUARDANDO_COLETA = "AGUARDANDO_COLETA",
  DESPACHADO = "DESPACHADO"          // Estado final
}
```

### Order (Tipo Principal)
```typescript
type Order = {
  // Identificação
  id: string;                        // UUID (PK)
  order_number: string;              // Número único
  
  // Cliente
  customer_id: string;
  customer_name: string;
  
  // Status e fluxo
  status: OrderStatus;
  order_date: Date;
  due_date?: Date;
  shipped_at?: Date;
  delivered_at?: Date;
  
  // Valores
  total_amount?: number;
  currency: string;                  // 'BRL', 'R$'
  
  // Prioridade
  priority: number;                  // 1=urgent, 5=normal, 10=low
  
  // Observações
  notes?: string;
  
  // Integração SAP
  sap_doc_entry?: number;            // DocEntry (PK SAP)
  sap_doc_num?: number;              // DocNum (visível)
  sap_doc_status?: string;           // bost_Open, bost_Close
  
  // Sincronização
  last_sync_at?: Date;
  sync_status?: 'SYNCED' | 'PENDING' | 'ERROR';
  sync_error?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  
  // Relacionamentos
  lines?: OrderLine[];               // Linhas do pedido
  events?: OrderEvent[];             // Histórico
}
```

### OrderLine
```typescript
type OrderLine = {
  id: string;
  order_id: string;
  product_id: string;
  
  line_number: number;
  product_sku: string;
  product_description: string;
  
  quantity: number;                  // Quantidade solicitada
  unit_of_measure: string;           // 'UN', 'KG'
  
  quantity_picked: number;           // Quantidade separada
  quantity_packed: number;           // Quantidade embalada
  quantity_shipped: number;          // Quantidade enviada
  
  unit_price?: number;
  line_total?: number;
  
  warehouse_id?: string;
  warehouse_code?: string;
  
  sap_line_num?: number;
  sap_item_code?: string;
}
```

### Product
```typescript
type Product = {
  id: string;
  sku: string;                       // UNIQUE
  description: string;
  ean?: string;
  category?: string;
  unit_of_measure: string;           // 'UN'
  is_active: boolean;
  
  sap_item_code?: string;
  sap_item_name?: string;
  
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}
```

### Stock
```typescript
type Stock = {
  id: string;
  product_id: string;
  warehouse_id: string;
  
  quantity_available: number;        // Disponível
  quantity_reserved: number;         // Reservado
  quantity_on_order: number;         // Em pedidos futuros
  quantity_free: number;             // CALCULADO: available - reserved
  
  location_zone?: string;
  location_aisle?: string;
  location_rack?: string;
  location_level?: string;
  location_position?: string;
}
```

### Customer
```typescript
type Customer = {
  id: string;
  customer_code: string;             // UNIQUE
  name: string;
  document?: string;                 // CPF/CNPJ
  
  email?: string;
  phone?: string;
  
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  
  segment?: 'VAREJO' | 'ATACADO' | 'DISTRIBUTOR' | 'INTERNAL';
  is_active: boolean;
  
  sap_card_code?: string;
  sap_card_name?: string;
}
```

---

## 🎯 TELAS MÍNIMAS (MVP)

### 1. 🏠 Dashboard (`/`)
**Prioridade**: ⭐⭐⭐ ALTA

**Cards de Métricas**:
- Pedidos Abertos (status: A_SEPARAR)
- Em Separação (status: EM_SEPARACAO)
- Despachados Hoje (status: DESPACHADO, data: hoje)
- Erros de Integração (sync_status: ERROR)

**Gráficos** (opcional):
- Pedidos por status (bar chart)
- Pedidos por dia (line chart - últimos 7 dias)

**API**:
```typescript
GET /api/v1/dashboard/metrics
GET /api/v1/dashboard/orders?status=A_SEPARAR&limit=10
```

**Componentes**:
- `DashboardLayout.tsx`
- `MetricCard.tsx`
- `OrderStatusChart.tsx` (Recharts)
- `RecentOrdersList.tsx`

---

### 2. 📋 Lista de Pedidos (`/pedidos`)
**Prioridade**: ⭐⭐⭐ ALTA

**Features**:
- Tabela com paginação (TanStack Table)
- Filtros: Status, Cliente, Período, Prioridade
- Busca por número do pedido
- Ordenação por data, prioridade, valor
- Badge de status com cores
- Badge de sync status (SYNCED/PENDING/ERROR)
- Ação: Ver detalhes

**Colunas**:
1. Número do Pedido (order_number)
2. Cliente (customer_name)
3. Status (status)
4. Prioridade (priority: 1-10)
5. Valor Total (total_amount + currency)
6. Data do Pedido (order_date)
7. SLA (due_date)
8. Sync Status (sync_status)
9. DocNum SAP (sap_doc_num)
10. Ações (ver detalhes, atualizar)

**API**:
```typescript
GET /orders?status=&customerId=&from=&to=&priority=&limit=50&cursor=
```

**Componentes**:
- `OrdersListPage.tsx`
- `OrdersTable.tsx` (TanStack Table)
- `OrderFilters.tsx`
- `OrderStatusBadge.tsx`
- `SyncStatusBadge.tsx`

---

### 3. 📄 Detalhe do Pedido (`/pedidos/[id]`)
**Prioridade**: ⭐⭐⭐ ALTA

**Seções**:

#### Cabeçalho
- Número do Pedido
- Status atual (badge grande)
- Ações: Atualizar Status, Forçar Sync

#### Dados do Pedido
- Cliente (nome + código + link para detalhe)
- Data do Pedido / Data de Vencimento
- Prioridade
- Valor Total
- Observações

#### Dados SAP
- DocEntry
- DocNum
- DocumentStatus (bost_Open/bost_Close)
- Última Sincronização
- Status de Sync (com erro, se houver)

#### Linhas do Pedido
Tabela com:
- SKU
- Descrição
- Quantidade Solicitada
- Quantidade Separada
- Quantidade Embalada
- Quantidade Enviada
- Preço Unitário
- Total Linha
- Armazém
- Progress bar (picked/packed/shipped)

#### Timeline/Histórico
- Lista de eventos (OrderEvent)
- Data/hora, tipo de evento, quem fez, status de/para

**API**:
```typescript
GET /orders/:id                    // Detalhe completo
GET /orders/:id/history            // Timeline
POST /orders/:id/events            // Aplicar evento (mudar status)
```

**Componentes**:
- `OrderDetailPage.tsx`
- `OrderHeader.tsx`
- `OrderInfo.tsx`
- `OrderSapInfo.tsx`
- `OrderLinesTable.tsx`
- `OrderTimeline.tsx`
- `OrderStatusActions.tsx` (dropdown com eventos possíveis)

---

### 4. 📦 Lista de Produtos (`/produtos`)
**Prioridade**: ⭐⭐ MÉDIA

**Features**:
- Tabela com paginação
- Busca por SKU, descrição, EAN
- Filtro: Categoria, Ativo/Inativo
- Ação: Ver detalhes, Ver estoque

**Colunas**:
1. SKU
2. Descrição
3. EAN
4. Categoria
5. UM (Unidade de Medida)
6. Status (Ativo/Inativo)
7. ItemCode SAP
8. Ações

**API**:
```typescript
GET /api/v1/catalog/items?search=&categoryId=&active=&limit=50&cursor=
```

**Componentes**:
- `ProductsListPage.tsx`
- `ProductsTable.tsx`
- `ProductFilters.tsx`
- `ProductStatusBadge.tsx`

---

### 5. 📄 Detalhe do Produto (`/produtos/[code]`)
**Prioridade**: ⭐⭐ MÉDIA

**Seções**:

#### Informações Gerais
- SKU
- Descrição
- EAN
- Categoria
- Unidade de Medida
- Status (Ativo/Inativo)

#### Dados SAP
- ItemCode
- ItemName

#### Dimensões
- Peso (kg)
- Comprimento/Largura/Altura (cm)

#### Estoque por Depósito
Tabela com:
- Armazém (código + nome)
- Disponível
- Reservado
- Livre (disponível - reservado)
- Em Pedidos
- Localização (zona/corredor/estante)

**API**:
```typescript
GET /api/v1/catalog/items/:code
GET /api/v1/inventory?itemCode=:code
```

**Componentes**:
- `ProductDetailPage.tsx`
- `ProductInfo.tsx`
- `ProductSapInfo.tsx`
- `ProductDimensions.tsx`
- `ProductStockTable.tsx`

---

### 6. 📊 Estoque (`/estoque`)
**Prioridade**: ⭐⭐ MÉDIA

**Features**:
- Tabela com paginação
- Filtros: Armazém, SKU, Quantidade mínima
- Busca por SKU
- Ordenação por disponível, reservado, livre
- Badge de alerta: quantidade baixa (< minQuantity)

**Colunas**:
1. SKU
2. Descrição do Produto
3. Armazém
4. Disponível
5. Reservado
6. Livre (disponível - reservado)
7. Em Pedidos
8. Localização
9. Ações (ver produto, ajustar - se permissão)

**API**:
```typescript
GET /api/v1/inventory?itemCode=&warehouseCode=&minQuantity=&includeReserved=true&limit=50&cursor=
```

**Componentes**:
- `InventoryListPage.tsx`
- `InventoryTable.tsx`
- `InventoryFilters.tsx`
- `StockQuantityBadge.tsx`

---

### 7. 🔄 Sincronização/Integração (`/integracao`)
**Prioridade**: ⭐ BAIXA (futuro)

**Features**:
- Status da última sincronização por entidade (Orders, Products, Customers, Stock)
- Data/hora da última sync
- Status (SUCCESS/ERROR/RUNNING)
- Erro (se houver)
- Botão "Sincronizar Agora" (se houver endpoint)
- Log de sincronizações (tabela com histórico)

**API**:
```typescript
// Não há endpoints específicos no backend atual
// Pode usar os campos sync_status, last_sync_at dos pedidos
GET /orders?sync_status=ERROR  // Listar pedidos com erro de sync
```

**Componentes**:
- `IntegrationPage.tsx`
- `SyncStatusCard.tsx`
- `SyncLogsTable.tsx`

---

## 🏗️ ARQUITETURA DO FRONTEND

### Estrutura de Pastas

```
web-next/                          # Novo projeto Next.js
├── app/                           # App Router (Next.js 14)
│   ├── layout.tsx                 # Layout raiz (providers, fonts)
│   ├── page.tsx                   # Dashboard (/)
│   ├── pedidos/
│   │   ├── page.tsx               # Lista de pedidos
│   │   └── [id]/
│   │       └── page.tsx           # Detalhe do pedido
│   ├── produtos/
│   │   ├── page.tsx               # Lista de produtos
│   │   └── [code]/
│   │       └── page.tsx           # Detalhe do produto
│   ├── estoque/
│   │   └── page.tsx               # Visão de estoque
│   ├── integracao/
│   │   └── page.tsx               # Sincronização
│   └── api/                       # API Routes (se necessário)
│
├── components/                    # Componentes reutilizáveis
│   ├── ui/                        # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── drawer.tsx
│   │   ├── toast.tsx
│   │   ├── skeleton.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── AppLayout.tsx          # Layout principal (sidebar + topbar)
│   │   ├── Sidebar.tsx            # Navegação lateral
│   │   ├── MobileNav.tsx          # Bottom nav mobile
│   │   ├── Topbar.tsx             # Barra superior
│   │   └── Breadcrumb.tsx
│   └── shared/
│       ├── EmptyState.tsx
│       ├── ErrorState.tsx
│       ├── LoadingState.tsx
│       └── StatusBadge.tsx
│
├── features/                      # Features (por domínio)
│   ├── orders/
│   │   ├── components/
│   │   │   ├── OrdersTable.tsx
│   │   │   ├── OrderFilters.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── OrderStatusBadge.tsx
│   │   │   ├── OrderTimeline.tsx
│   │   │   └── OrderStatusActions.tsx
│   │   ├── hooks/
│   │   │   ├── useOrders.ts       # useQuery
│   │   │   ├── useOrder.ts        # useQuery
│   │   │   ├── useOrderHistory.ts
│   │   │   └── useOrderMutations.ts # useMutation
│   │   └── types.ts
│   │
│   ├── products/
│   │   ├── components/
│   │   │   ├── ProductsTable.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   └── ProductStockTable.tsx
│   │   ├── hooks/
│   │   │   ├── useProducts.ts
│   │   │   └── useProduct.ts
│   │   └── types.ts
│   │
│   ├── inventory/
│   │   ├── components/
│   │   │   ├── InventoryTable.tsx
│   │   │   └── StockQuantityBadge.tsx
│   │   ├── hooks/
│   │   │   └── useInventory.ts
│   │   └── types.ts
│   │
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── MetricCard.tsx
│   │   │   ├── OrderStatusChart.tsx
│   │   │   └── RecentOrdersList.tsx
│   │   ├── hooks/
│   │   │   └── useDashboard.ts
│   │   └── types.ts
│   │
│   └── customers/
│       ├── components/
│       │   └── CustomerSelect.tsx
│       ├── hooks/
│       │   └── useCustomers.ts
│       └── types.ts
│
├── lib/                           # Utilitários e configurações
│   ├── api/
│   │   ├── client.ts              # Axios/fetch configurado
│   │   ├── interceptors.ts        # Auth headers, error handling
│   │   ├── endpoints.ts           # Constantes de endpoints
│   │   └── queryClient.ts         # TanStack Query config
│   ├── schemas/
│   │   ├── order.schema.ts        # Zod schemas
│   │   ├── product.schema.ts
│   │   └── inventory.schema.ts
│   ├── utils/
│   │   ├── cn.ts                  # classNames utility
│   │   ├── format.ts              # formatCurrency, formatDate
│   │   └── validation.ts
│   └── constants/
│       ├── status.ts              # OrderStatus, Priority
│       └── colors.ts              # Status colors
│
├── styles/
│   └── globals.css                # TailwindCSS + custom CSS
│
├── public/
│   └── ...
│
├── .env.local                     # Variáveis de ambiente
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔧 CONFIGURAÇÃO TÉCNICA

### 1. Criar projeto Next.js

```bash
npx create-next-app@latest web-next --typescript --tailwind --app --src-dir=false --import-alias="@/*"
cd web-next
```

### 2. Instalar dependências

```bash
# shadcn/ui (configurar primeiro)
npx shadcn-ui@latest init

# TanStack Query
npm install @tanstack/react-query @tanstack/react-query-devtools

# TanStack Table
npm install @tanstack/react-table

# Forms
npm install react-hook-form zod @hookform/resolvers

# API Client
npm install axios

# Date handling
npm install date-fns

# Charts (opcional)
npm install recharts

# Icons
npm install lucide-react

# Utils
npm install clsx tailwind-merge
```

### 3. Configurar shadcn/ui

```bash
# Componentes necessários (instalar conforme necessário)
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add drawer
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add popover
```

### 4. Configurar variáveis de ambiente (.env.local)

```bash
# API
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000

# Auth (desenvolvimento)
NEXT_PUBLIC_DEV_USER_ID=dev-user
NEXT_PUBLIC_DEV_USER_ROLE=SUPERVISOR
NEXT_PUBLIC_DEV_USER_NAME=Usuário Dev

# Features
NEXT_PUBLIC_ENABLE_MOCK=false
NEXT_PUBLIC_ENABLE_DEVTOOLS=true
```

### 5. Configurar TailwindCSS (tailwind.config.ts)

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Status colors
        status: {
          a_separar: "#3B82F6",        // blue-500
          em_separacao: "#F59E0B",     // amber-500
          conferido: "#8B5CF6",        // violet-500
          aguardando_cotacao: "#EC4899", // pink-500
          aguardando_coleta: "#10B981", // green-500
          despachado: "#06B6D4",       // cyan-500
        },
        sync: {
          synced: "#10B981",           // green-500
          pending: "#F59E0B",          // amber-500
          error: "#EF4444",            // red-500
        },
        priority: {
          urgent: "#EF4444",           // red-500 (P1)
          high: "#F59E0B",             // amber-500
          normal: "#3B82F6",           // blue-500 (P2)
          low: "#6B7280",              // gray-500 (P3)
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

---

## 🎨 DESIGN SYSTEM

### Cores de Status

```typescript
// lib/constants/status.ts
export const ORDER_STATUS_CONFIG = {
  A_SEPARAR: {
    label: "A Separar",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: "PackageOpen",
  },
  EM_SEPARACAO: {
    label: "Em Separação",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    icon: "PackageSearch",
  },
  CONFERIDO: {
    label: "Conferido",
    color: "bg-violet-100 text-violet-800 border-violet-300",
    icon: "PackageCheck",
  },
  AGUARDANDO_COTACAO: {
    label: "Aguardando Cotação",
    color: "bg-pink-100 text-pink-800 border-pink-300",
    icon: "DollarSign",
  },
  AGUARDANDO_COLETA: {
    label: "Aguardando Coleta",
    color: "bg-green-100 text-green-800 border-green-300",
    icon: "Truck",
  },
  DESPACHADO: {
    label: "Despachado",
    color: "bg-cyan-100 text-cyan-800 border-cyan-300",
    icon: "CheckCircle2",
  },
};

export const SYNC_STATUS_CONFIG = {
  SYNCED: {
    label: "Sincronizado",
    color: "bg-green-100 text-green-800",
    icon: "CheckCircle",
  },
  PENDING: {
    label: "Pendente",
    color: "bg-amber-100 text-amber-800",
    icon: "Clock",
  },
  ERROR: {
    label: "Erro",
    color: "bg-red-100 text-red-800",
    icon: "AlertCircle",
  },
};

export const PRIORITY_CONFIG = {
  1: { label: "Urgente (P1)", color: "bg-red-100 text-red-800", icon: "AlertTriangle" },
  2: { label: "Alta", color: "bg-orange-100 text-orange-800", icon: "ArrowUp" },
  3: { label: "Normal (P2)", color: "bg-blue-100 text-blue-800", icon: "Minus" },
  4: { label: "Baixa", color: "bg-gray-100 text-gray-800", icon: "ArrowDown" },
  5: { label: "Muito Baixa (P3)", color: "bg-gray-100 text-gray-600", icon: "ArrowDown" },
};
```

### Typography
- Headings: Inter (font-sans)
- Body: Inter
- Monospace (SKU, códigos): Mono (font-mono)

### Spacing
- Mobile: px-4, py-6
- Desktop: px-6, py-8
- Cards: p-6
- Gaps: gap-4, gap-6

### Breakpoints (Tailwind padrão)
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1536px

---

## 📱 NAVEGAÇÃO

### Desktop (Sidebar + Topbar)
```
┌──────────────────────────────────────┐
│  [Logo]  │  Topbar (Breadcrumb)  [👤]│
├──────────┼───────────────────────────┤
│          │                           │
│ Sidebar  │  Content Area             │
│          │                           │
│ • Home   │  [Page Content]           │
│ • Pedidos│                           │
│ • Produtos                           │
│ • Estoque│                           │
│ • Integr.│                           │
│          │                           │
└──────────┴───────────────────────────┘
```

### Mobile (Bottom Navigation)
```
┌───────────────────────────┐
│  [≡] Topbar          [👤] │
├───────────────────────────┤
│                           │
│  Content Area             │
│  (Full Width)             │
│                           │
│                           │
├───────────────────────────┤
│ 🏠  📋  📦  📊  ⚙️        │
└───────────────────────────┘
```

### Menu Items
1. 🏠 Dashboard (/)
2. 📋 Pedidos (/pedidos)
3. 📦 Produtos (/produtos)
4. 📊 Estoque (/estoque)
5. 🔄 Integração (/integracao)

---

## 🔐 AUTENTICAÇÃO (DESENVOLVIMENTO)

### Headers da API (atual)
```typescript
{
  "X-User-Id": "dev-user",
  "X-User-Role": "SUPERVISOR", // OPERADOR, SUPERVISOR, COMERCIAL, ADMIN
  "X-User-Name": "Usuário Dev"
}
```

### Interceptor (axios)
```typescript
// lib/api/interceptors.ts
axiosInstance.interceptors.request.use((config) => {
  config.headers["X-User-Id"] = process.env.NEXT_PUBLIC_DEV_USER_ID;
  config.headers["X-User-Role"] = process.env.NEXT_PUBLIC_DEV_USER_ROLE;
  config.headers["X-User-Name"] = process.env.NEXT_PUBLIC_DEV_USER_NAME;
  return config;
});
```

### Futuro (JWT)
- Implementar login page
- Armazenar token no localStorage/cookie
- Usar `Authorization: Bearer <token>`
- Refresh token logic

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Setup Inicial
- [ ] Criar projeto Next.js
- [ ] Instalar dependências (TanStack Query, shadcn/ui, etc)
- [ ] Configurar TailwindCSS
- [ ] Configurar variáveis de ambiente
- [ ] Criar estrutura de pastas
- [ ] Configurar API Client (axios + interceptors)
- [ ] Configurar TanStack Query (queryClient)
- [ ] Definir tipos TypeScript base (Order, Product, etc)

### Fase 2: Layout e Navegação
- [ ] Criar AppLayout (sidebar + topbar)
- [ ] Criar Sidebar (desktop)
- [ ] Criar MobileNav (bottom navigation)
- [ ] Criar Topbar (breadcrumb, user menu)
- [ ] Implementar navegação entre páginas
- [ ] Testar responsividade (mobile/desktop)

### Fase 3: Dashboard
- [ ] Criar página Dashboard (/)
- [ ] Implementar hook useDashboard (metrics)
- [ ] Criar MetricCard component
- [ ] Exibir KPIs (pedidos abertos, em separação, etc)
- [ ] Criar RecentOrdersList
- [ ] (Opcional) Implementar gráfico com Recharts

### Fase 4: Pedidos
- [ ] Criar página Lista de Pedidos (/pedidos)
- [ ] Implementar hook useOrders (listagem)
- [ ] Criar OrdersTable com TanStack Table
- [ ] Implementar paginação (cursor-based)
- [ ] Criar OrderFilters (status, cliente, data)
- [ ] Criar OrderStatusBadge
- [ ] Criar SyncStatusBadge
- [ ] Testar busca e filtros
- [ ] Criar página Detalhe do Pedido (/pedidos/[id])
- [ ] Implementar hook useOrder (detalhe)
- [ ] Implementar hook useOrderHistory (timeline)
- [ ] Criar OrderDetail component
- [ ] Criar OrderLinesTable
- [ ] Criar OrderTimeline
- [ ] Criar OrderStatusActions (aplicar eventos)
- [ ] Implementar hook useOrderMutations (PUT, POST events)

### Fase 5: Produtos
- [ ] Criar página Lista de Produtos (/produtos)
- [ ] Implementar hook useProducts
- [ ] Criar ProductsTable
- [ ] Criar ProductFilters (search, category, active)
- [ ] Criar página Detalhe do Produto (/produtos/[code])
- [ ] Implementar hook useProduct
- [ ] Criar ProductDetail component
- [ ] Criar ProductStockTable (estoque por depósito)

### Fase 6: Estoque
- [ ] Criar página Estoque (/estoque)
- [ ] Implementar hook useInventory
- [ ] Criar InventoryTable
- [ ] Criar InventoryFilters (warehouse, SKU, minQuantity)
- [ ] Criar StockQuantityBadge (com alerta se baixo)

### Fase 7: Integração (opcional)
- [ ] Criar página Integração (/integracao)
- [ ] Exibir status de sincronização
- [ ] Listar pedidos com erro de sync
- [ ] (Futuro) Botão "Sincronizar Agora"

### Fase 8: UX/UI Polish
- [ ] Implementar loading states (Skeleton)
- [ ] Implementar empty states
- [ ] Implementar error states
- [ ] Adicionar toasts (sucesso/erro)
- [ ] Melhorar acessibilidade (ARIA labels)
- [ ] Testar navegação via teclado
- [ ] Otimizar performance (lazy loading, memoization)
- [ ] Adicionar dark mode (opcional)

### Fase 9: Qualidade
- [ ] Configurar ESLint
- [ ] Configurar Prettier
- [ ] Garantir tipos TS sem `any`
- [ ] Testar em diferentes navegadores
- [ ] Testar em diferentes tamanhos de tela
- [ ] Documentar README do frontend

### Fase 10: Deploy
- [ ] Build de produção (`npm run build`)
- [ ] Testar build localmente
- [ ] Configurar variáveis de ambiente (produção)
- [ ] Deploy (Vercel, Netlify, etc)

---

## 📚 REFERÊNCIAS

### Documentação Backend
- `SETUP_CHECKLIST.md` - Setup do backend
- `POSTGRES_MIGRATION_GUIDE.md` - Guia PostgreSQL
- `api/README.md` - API REST
- `api/QUICKSTART.md` - Quick start

### Código Backend
- `api/routes.ts` - Rotas e endpoints
- `api/controllers/` - Controllers da API
- `wms-core/migrations/` - Schemas do banco
- `sap-connector/Orders-WMS-Mapping.md` - Mapeamento SAP

### Stack Frontend
- Next.js: https://nextjs.org/docs
- TailwindCSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com
- TanStack Query: https://tanstack.com/query
- TanStack Table: https://tanstack.com/table
- React Hook Form: https://react-hook-form.com
- Zod: https://zod.dev
- Lucide Icons: https://lucide.dev

---

## 🚀 PRÓXIMOS PASSOS

1. **AGORA**: Criar projeto Next.js e estrutura base
2. **Hoje**: Implementar layout + navegação + dashboard
3. **Amanhã**: Implementar lista e detalhe de pedidos
4. **Esta semana**: Produtos + Estoque + Polish UX
5. **Próxima semana**: Testes + Deploy

---

**Última atualização**: 2026-02-03  
**Autor**: AI Assistant (Cursor)
