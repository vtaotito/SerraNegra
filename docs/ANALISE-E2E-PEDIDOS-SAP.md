# Análise E2E — Pedidos SAP B1 → Painel BI

Documentação completa do fluxo de dados desde o SAP Business One até os números exibidos nas telas de Business Intelligence do Painel GSN.

---

## 1. Visão Geral da Arquitetura

```
SAP B1 (Service Layer) → Gateway Fastify (sync periódico) → PostgreSQL → API REST → Painel Next.js
```

| Camada | Tecnologia | Função |
|--------|-----------|--------|
| **Origem** | SAP B1 Service Layer (OData) | Fonte de verdade dos dados transacionais |
| **Gateway** | Fastify (:4000) | Sync periódico, cache, API REST |
| **Persistência** | PostgreSQL | Armazenamento local dos pedidos |
| **Frontend** | Next.js (React) | Agregação client-side + visualização |

---

## 2. Camada 1 — SAP Business One (Origem)

### 2.1 Conexão

| Parâmetro | Configuração |
|-----------|-------------|
| URL Base | `SAP_B1_BASE_URL` (Service Layer HTTPS, porta 50000) |
| Banco | `SAP_B1_COMPANY_DB` (SBO_GARRAFARIA_PRD) |
| Autenticação | Login/Password via POST /Login |
| Timeout | 120s por request, max 3 tentativas |
| Concorrência | Max 4 requests simultâneos, 5 RPS |

### 2.2 Entidades OData Consultadas

| Endpoint OData | Entidade SAP | Tabela HANA | Retorno |
|---------------|-------------|-------------|---------|
| `/Orders` | Sales Orders (ORDR) | ORDR + RDR1 | Pedidos de venda com DocumentLines |
| `/Orders({DocEntry})` | Sales Order Detail | ORDR + RDR1 | Pedido individual com todas as linhas |
| `/Invoices` | A/R Invoices (OINV) | OINV + INV1 | Notas fiscais de saída |
| `/Invoices({DocEntry})` | Invoice Detail | OINV + INV1 | NF individual com linhas |
| `/SalesPersons` | Vendedores (OSLP) | OSLP | Código e nome dos vendedores |
| `/BusinessPartners` | Clientes (OCRD) | OCRD | Dados cadastrais dos clientes |
| `/BusinessPartnerGroups` | Grupos de BP (OCRG) | OCRG | Grupos de parceiros |
| `/Items` | Produtos (OITM) | OITM | Catálogo de produtos |
| `/PriceLists` | Listas de Preço (OPLN) | OPLN | Tabelas de preço |

### 2.3 Campos de /Orders (Sales Orders)

A busca é feita em 2 fases:
- **Phase 1**: Headers paginados em lotes de 500 (`GET /Orders?$top=500&$skip=N&$orderby=DocDate desc`)
- **Phase 2**: Enriquecimento individual com DocumentLines via `GET /Orders({DocEntry})`

| Campo SAP | Campo Local (PG) | Tipo | Descrição |
|-----------|-----------------|------|-----------|
| DocEntry | doc_entry | INTEGER PK | Identificador único interno do SAP |
| DocNum | doc_num | INTEGER | Número do documento visível ao usuário |
| DocDate | doc_date | DATE | Data de emissão do pedido |
| DocDueDate | doc_due_date | DATE | Data de entrega prevista |
| CardCode | card_code | TEXT | Código do cliente (ex: C00001) |
| CardName | card_name | TEXT | Nome/razão social do cliente |
| DocTotal | doc_total | NUMERIC(18,2) | Valor total do pedido em BRL |
| DocCurrency | doc_currency | TEXT | Moeda (default BRL) |
| DocStatus | doc_status | TEXT | O = Aberto, C = Fechado |
| DocumentStatus | document_status | TEXT | Status detalhado (bost_Open/bost_Close) |
| SalesPersonCode | sales_person_code | INTEGER | Código do vendedor (FK → OSLP) |
| Cancelled | cancelled | TEXT | Y = Cancelado, N = Ativo |
| Comments | comments | TEXT | Observações do pedido |

### 2.4 Campos de DocumentLines (RDR1)

| Campo SAP | Campo Local (PG) | Tipo | Descrição |
|-----------|-----------------|------|-----------|
| LineNum | line_num | INTEGER | Número da linha dentro do pedido |
| ItemCode | item_code | TEXT | SKU do produto |
| ItemDescription | item_description | TEXT | Descrição do produto |
| Quantity | quantity | NUMERIC(18,4) | Quantidade vendida |
| UnitPrice | unit_price | NUMERIC(18,4) | Preço unitário |
| Price | price | NUMERIC(18,4) | Preço base (antes de desconto) |
| LineTotal | line_total | NUMERIC(18,2) | Total da linha (Qty × Price − Desc) |
| DiscountPercent | discount_percent | NUMERIC(8,2) | Percentual de desconto |
| WarehouseCode | warehouse_code | TEXT | Código do depósito |
| CFOPCode | cfop_code | TEXT | CFOP da operação fiscal |
| Weight1 | weight | NUMERIC(18,4) | Peso da linha |
| TaxCode | tax_code | TEXT | Código tributário |
| Usage | usage_code | INTEGER | Tipo de utilização |

---

## 3. Camada 2 — Gateway Fastify (Sync + API)

### 3.1 Processo de Sincronização (`dailySync.ts`)

O scheduler roda automaticamente via cron a cada hora (`0 * * * *`) + sync inicial 15s após boot. Também pode ser disparado manualmente via `POST /api/sap/sales-orders/sync`.

| Etapa | Descrição | Detalhes Técnicos |
|-------|-----------|-------------------|
| 1. `ensureSchema()` | Cria/migra tabelas no PostgreSQL | CREATE TABLE IF NOT EXISTS + índices + views |
| 2. Paginação SAP | Busca pedidos em lotes de 500 | `GET /Orders?$top=500&$skip=N` — Prefer: odata.maxpagesize=500 |
| 3. `upsertOrderHeaders()` | Salva cabeçalhos no PostgreSQL | INSERT ... ON CONFLICT (doc_entry) DO UPDATE — upsert atômico |
| 4. Loop até 50.000 | Continua até acabar páginas ou atingir limite | Break quando page < 500 ou totalFetched >= 50.000 |
| 5. Log de sync | Registra resultado na tabela `sap_sync_log` | status, fetched, upserted, duration_ms, message |

### 3.2 Normalização dos Dados

| Campo | Valor SAP | Valor Normalizado | Função |
|-------|-----------|-------------------|--------|
| Cancelled | `tYES` | `Y` | `normCancelled()` |
| Cancelled | qualquer outro | `N` | `normCancelled()` |
| DocumentStatus | `bost_Open` ou `O` | `O` | `normDocStatus()` |
| DocumentStatus | `bost_Close` ou `C` | `C` | `normDocStatus()` |

### 3.3 Lazy Loading de Linhas

O sync principal salva apenas headers (sem linhas) para ser rápido. As linhas são carregadas sob demanda via `GET /api/sap/sales-orders/:docEntry/lines`:

1. Verifica se existem linhas na tabela `sap_sales_order_lines` para o `doc_entry`
2. Se sim, retorna do cache local (source: `cache`)
3. Se não, busca no SAP via `GET /Orders({docEntry})`
4. Salva as linhas no PostgreSQL para cache futuro
5. Atualiza `num_lines` e `total_quantity` no header

### 3.4 Rotas da API do Gateway

| Rota | Método | Descrição | Fonte |
|------|--------|-----------|-------|
| `/api/sap/sales-orders` | GET | Lista pedidos com filtros | PostgreSQL (`querySalesOrders`) |
| `/api/sap/sales-orders/sync` | POST | Dispara sync manual SAP → PG | SAP → PostgreSQL |
| `/api/sap/sales-orders/:docEntry/lines` | GET | Linhas de um pedido | PostgreSQL ou SAP |
| `/api/sap/products/analytics` | GET | Análise agregada de produtos | PostgreSQL (`queryProductAnalytics`) |
| `/api/sap/products/orders` | GET | Linhas por itemCodes | PostgreSQL (`queryProductOrders`) |
| `/api/sap/sync/invoices` | POST | Busca notas fiscais | SAP direto (sem persistência) |
| `/api/sap/sync/salespersons` | POST | Busca vendedores | SAP direto |
| `/api/sap/sync/bp-groups` | POST | Busca grupos de BP | SAP direto |
| `/api/sap/prices/practiced` | GET | Preços praticados | PostgreSQL (SQL) |

---

## 4. Camada 3 — Queries SQL (PostgreSQL)

### 4.1 Schema do Banco

#### Tabela: `sap_sales_orders`

```sql
CREATE TABLE sap_sales_orders (
  doc_entry         INTEGER PRIMARY KEY,
  doc_num           INTEGER NOT NULL,
  doc_date          DATE,
  doc_due_date      DATE,
  card_code         TEXT,
  card_name         TEXT,
  doc_total         NUMERIC(18,2) DEFAULT 0,
  doc_currency      TEXT DEFAULT 'BRL',
  doc_status        TEXT,          -- O = Aberto, C = Fechado
  document_status   TEXT,
  sales_person_code INTEGER,
  cancelled         TEXT DEFAULT 'N',  -- Y ou N
  comments          TEXT,
  num_lines         INTEGER DEFAULT 0,
  total_quantity    NUMERIC(18,4) DEFAULT 0,
  raw_json          JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabela: `sap_sales_order_lines`

```sql
CREATE TABLE sap_sales_order_lines (
  id                SERIAL PRIMARY KEY,
  doc_entry         INTEGER NOT NULL REFERENCES sap_sales_orders(doc_entry) ON DELETE CASCADE,
  line_num          INTEGER,
  item_code         TEXT,
  item_description  TEXT,
  quantity          NUMERIC(18,4) DEFAULT 0,
  unit_price        NUMERIC(18,4) DEFAULT 0,
  line_total        NUMERIC(18,2) DEFAULT 0,
  discount_percent  NUMERIC(8,2) DEFAULT 0,
  warehouse_code    TEXT,
  price             NUMERIC(18,4) DEFAULT 0,
  cfop_code         TEXT,
  weight            NUMERIC(18,4) DEFAULT 0,
  tax_code          TEXT,
  usage_code        INTEGER,
  UNIQUE (doc_entry, line_num)
);
```

#### Índices

```sql
CREATE INDEX idx_so_doc_date      ON sap_sales_orders (doc_date DESC);
CREATE INDEX idx_so_card_code     ON sap_sales_orders (card_code);
CREATE INDEX idx_so_doc_status    ON sap_sales_orders (doc_status);
CREATE INDEX idx_so_synced        ON sap_sales_orders (synced_at DESC);
CREATE INDEX idx_so_sales_person  ON sap_sales_orders (sales_person_code);
CREATE INDEX idx_sol_doc_entry    ON sap_sales_order_lines (doc_entry);
CREATE INDEX idx_sol_item_code    ON sap_sales_order_lines (item_code);
```

### 4.2 Query: `querySalesOrders()` — Página de Pedidos

Retorna pedidos com linhas embutidas via `json_agg`, com fallback para `raw_json` quando não há linhas persistidas.

| Aspecto | Detalhe |
|---------|---------|
| Filtros | `doc_date >= dateFrom`, `doc_date <= dateTo`, `card_code`, `sales_person_code`, status, search (ILIKE) |
| Ordenação | `doc_date DESC, doc_num DESC` |
| Limite | Default 50.000 registros |
| Linhas (JSON) | `COALESCE(json_agg de sap_sales_order_lines, json_agg de raw_json->'DocumentLines', '[]')` |
| Campos extras | PaymentMethod, PaymentGroupCode, ShipToCode, Address, Address2 extraídos do `raw_json` |

### 4.3 Query: `queryProductAnalytics()` — Análise de Produtos

Agregação server-side que retorna ~200-500 linhas ao invés de 50k orders. Usa CTE `all_lines` com UNION ALL.

| Métrica | SQL | Uso no Frontend |
|---------|-----|----------------|
| `total_qty` | `SUM(quantity)` | Quantidade total vendida |
| `total_revenue` | `SUM(line_total)` | Faturamento do produto |
| `max_sale / min_sale` | `MAX/MIN(line_total) WHERE > 0` | Faixa de valores |
| `sale_count` | `COUNT(*)` | Número de transações |
| `unique_clients` | `COUNT(DISTINCT card_code)` | Clientes únicos |
| `qty_3m` | `SUM(CASE WHEN doc_date >= date3mCutoff)` | Qtd nos últimos 3 meses |

### 4.4 Query: Preços Praticados

| Métrica | SQL | Descrição |
|---------|-----|-----------|
| `avg_price` | `ROUND(AVG(unit_price), 2)` | Preço médio praticado |
| `median_price` | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY unit_price)` | Mediana do preço |
| `last_price` | `ARRAY_AGG(unit_price ORDER BY doc_date DESC)[1]` | Último preço praticado |
| `avg_discount` | `ROUND(AVG(discount_percent), 1)` | Desconto médio |
| `total_revenue` | `SUM(line_total)` | Receita total |
| `unique_clients` | `COUNT(DISTINCT card_code)` | Clientes únicos |

### 4.5 Views Materializadas

| View | Agregação | Uso |
|------|-----------|-----|
| `vw_pedidos_resumo` | Seleção simples ordenada por data | Consulta rápida |
| `vw_pedidos_por_cliente` | GROUP BY card_code | Ranking de clientes |
| `vw_pedidos_por_vendedor` | GROUP BY sales_person_code | Ranking de vendedores |
| `vw_itens_mais_vendidos` | GROUP BY item_code | Ranking de produtos |
| `vw_pedidos_por_mes` | DATE_TRUNC('month') | Tendência mensal |
| `vw_ultimo_sync` | Último registro de sap_sync_log | Status da sincronização |

---

## 5. Camada 4 — Frontend (Painel Next.js)

### 5.1 Mapa de Páginas BI

| Página | Rota | API | Dados |
|--------|------|-----|-------|
| Visão Executiva | `/business-intelligence` | `GET /api/bi/executive-summary` | KPIs, Rankings, Trends |
| Pedidos de Venda | `/business-intelligence/pedidos` | `GET /api/sap/sales-orders` | Tabela virtualizada + KPIs + gráficos |
| Comercial/Dados | `/business-intelligence/comercial/dados` | `POST /api/sap/sync/invoices` | Notas fiscais expandíveis |
| Faturamento | `/business-intelligence/faturamento` | `GET /api/sap/sales-orders` | Análise temporal |
| Clientes | `/business-intelligence/clientes` | `GET /api/sap/sales-orders + customers` | Análise por cliente |
| Vendedores | `/business-intelligence/vendedores` | `GET /api/sap/sales-orders + salespersons` | Análise por vendedor |
| Estoque | `/business-intelligence/estoque` | `GET /v1/inventory` | Posição de estoque |
| Preços | `/business-intelligence/precos` | `GET /api/sap/prices + practiced` | Tabelas e preços praticados |
| Margens | `/business-intelligence/margens` | `GET /api/sap/prices/practiced` | Análise de margens |
| Markup | `/business-intelligence/markup` | `GET /api/sap/markup/items` | Precificação e custos |
| Carteira | `/business-intelligence/carteira` | `GET /api/sap/sales-orders` | Pedidos em aberto |
| Marketing | `/business-intelligence/marketing` | `GET /api/bi/rd/overview` | RD Station |

### 5.2 Página de Pedidos — Cálculos dos KPIs

Todos os cálculos são feitos **client-side** em React (`useMemo`) a partir do array de pedidos retornado pela API.

| KPI | Fórmula | Filtro |
|-----|---------|--------|
| **Pedidos** | `filtered.length` | Todos (inclui cancelados) |
| **Faturamento** | `Σ doc_total WHERE cancelled ≠ 'Y'` | Apenas ativos |
| **Ticket Médio** | `Faturamento / COUNT(ativos)` | Apenas ativos |
| **Mediana** | `mediana(doc_total)` dos ativos com valor > 0 | Ativos > 0 |
| **Clientes** | `COUNT(DISTINCT card_code)` dos ativos | Apenas ativos |
| **Qtd Total** | `Σ total_quantity` de filtered | Todos (inclui cancelados) |
| **Abertos** | `COUNT WHERE doc_status='O' AND cancelled≠'Y'` | — |
| **Fechados** | `COUNT WHERE doc_status='C' AND cancelled≠'Y'` | — |
| **Cancelados** | `COUNT WHERE cancelled='Y'` | — |

### 5.3 Estatísticas Descritivas (Box Plot)

| Métrica | Fórmula | Descrição |
|---------|---------|-----------|
| Mediana | `sorted[mid]` ou média dos 2 centrais | Valor central |
| Média | `Σ values / count` | Média aritmética |
| Desvio Padrão | `√(Σ(v − mean)² / (n−1))` | Dispersão amostral |
| P25 / P75 | Interpolação linear no array ordenado | Percentis |
| IQR | P75 − P25 | Amplitude interquartil |
| Assimetria | `(mean − median) / mean` | Direção da cauda |
| CV | `stdDev / mean` | Coeficiente de variação |

### 5.4 Agregações para Gráficos

| Gráfico | Função | Lógica |
|---------|--------|--------|
| Tendência Diária | `aggregateByDay()` | Agrupa por `doc_date[0:10]`, soma `doc_total`, conta pedidos. Exclui cancelados. |
| Status (Donut) | `statusAggregate()` | Conta Abertos (O, !Y), Fechados (C, !Y), Cancelados (Y) |
| Top 5 Clientes | `aggregateByClient()` | Agrupa por `card_code`, soma `doc_total`, top 5 |
| Histograma | `histogramBins()` | Faixas: 0-500, 500-1k, 1k-2.5k, 2.5k-5k, 5k-10k, 10k-25k, 25k-50k, 50k+ |
| Dia da Semana | `aggregateByWeekday()` | `getDay()` do doc_date, soma + mediana por dia |
| Por Vendedor | `aggregateBySalesPerson()` | Agrupa por `sales_person_code`, valor/pedidos/mediana/ticket. Top 10. |
| Acumulado | `cumulativeByDay()` | Soma progressiva do faturamento diário |
| Scatter | `scatterData()` | X = num linhas, Y = doc_total. Max 300 pontos |
| Lead Time | `leadTimeData()` | `differenceInCalendarDays(due, date)`. Filtra 0-90 dias |

### 5.5 Detalhe do Pedido (OrderDetailPanel)

Quando o usuário expande um pedido, as linhas são agrupadas por produto base via `groupOrderLines()`:

| Campo | Fórmula |
|-------|---------|
| **Saída (un)** | `Σ(Quantity × embalaQty)` — converte embalagens para unidades |
| **% Qtd** | `(totalUnd do grupo / totalUnd do pedido) × 100` |
| **R$/UND** | `totalVal / totalUnd` (preço médio por unidade) |
| **Desc%** | `MAX(DiscountPercent)` entre variantes |
| **Total** | `Σ LineTotal` de todas as variantes |

### 5.6 Visão Executiva — KPIs com Variação

| KPI | Fórmula | Variação (%) |
|-----|---------|-------------|
| Faturamento | `Σ doc_total` dos ativos | `(fat − prevFat) / prevFat × 100` |
| Pedidos | `COUNT` de ativos | `(ped − prevPed) / prevPed × 100` |
| Ticket Médio | `fat / pedidos` | `(ticket − prevTicket) / prevTicket × 100` |
| Clientes Ativos | `COUNT(DISTINCT card_code)` | `(atual − anterior) / anterior × 100` |
| Qtd Vendida | `Σ total_quantity` | Sem variação |
| Base Total | Total de clientes cadastrados | Sem variação |

### 5.7 Comercial/Dados — Notas Fiscais

Diferente das outras páginas, esta busca dados **diretamente do SAP** via `POST /api/sap/sync/invoices` (sem persistência local).

| KPI | Fórmula |
|-----|---------|
| Documentos | `filtered.length` |
| Itens Vendidos | `Σ doc.lines.length` |
| Valor Total | `Σ doc.docTotal` |
| Ticket Médio | `Valor Total / Documentos` |

---

## 6. Diagrama de Fluxo E2E

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SAP BUSINESS ONE                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   ORDR   │  │   RDR1   │  │   OINV   │  │   OSLP   │           │
│  │ (Orders) │  │ (Lines)  │  │(Invoices)│  │(SalesPer)│           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └──────┬───────┘              │              │                 │
│     Service Layer (OData REST)      │              │                 │
│     GET /Orders?$top=500&$skip=N    │              │                 │
│     GET /Orders({DocEntry})         │              │                 │
└──────┬──────────────────────────────┴──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  GATEWAY (Fastify :4000)                             │
│                                                                     │
│  Scheduler (cron: cada hora)                                        │
│    1. Pagina /Orders em lotes de 500                                │
│    2. Normaliza cancelled (tYES→Y) e docStatus                      │
│    3. UPSERT em sap_sales_orders (ON CONFLICT)                      │
│    4. Registra em sap_sync_log                                      │
│                                                                     │
│  Rotas REST:                                                        │
│    GET  /api/sap/sales-orders        → querySalesOrders(PG)         │
│    GET  /api/sap/sales-orders/:id/lines → cache local ou SAP        │
│    GET  /api/sap/products/analytics  → queryProductAnalytics(PG)    │
│    POST /api/sap/sync/invoices       → SAP direto                   │
│    POST /api/sap/sync/salespersons   → SAP direto                   │
│    GET  /api/sap/prices/practiced    → SQL (PG)                     │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL                                       │
│                                                                     │
│  sap_sales_orders ──1:N──→ sap_sales_order_lines                   │
│  sap_sync_log              markup_overrides                         │
│                                                                     │
│  Views: vw_pedidos_resumo, vw_pedidos_por_cliente,                 │
│         vw_pedidos_por_vendedor, vw_itens_mais_vendidos,           │
│         vw_pedidos_por_mes, vw_ultimo_sync                         │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                PAINEL NEXT.JS (React)                                │
│                                                                     │
│  cockpit-api.ts → fetchSalesOrders({dateFrom, dateTo, limit})      │
│       │                                                             │
│       ▼                                                             │
│  useFetch() → orders[], spMap, custMap                              │
│       │                                                             │
│       ▼                                                             │
│  useMemo() — Cálculos Client-Side                                  │
│    KPIs:   totalDocs, activeValue, ticketMédio, mediana, etc.      │
│    Stats:  mean, stdDev, p25, p75, min, max, skew, cv              │
│    Charts: aggregateByDay, statusAggregate, histogramBins, etc.    │
│       │                                                             │
│       ▼                                                             │
│  Renderização: Cards KPI + Recharts + Tabela Virtual               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Pontos Críticos e Observações

| Item | Detalhe |
|------|---------|
| **Notas Fiscais** | NÃO são persistidas localmente — buscadas do SAP a cada acesso |
| **Pedidos de Venda** | Cache híbrido: headers no PG (sync horário), linhas sob demanda |
| **Filtro de Cancelados** | `cancelled = 'Y'` exclui de TODAS as métricas de valor |
| **Conversão de Embalagem** | `parseItemInfo()` extrai CAIXA/FARDO/PALETE do ItemDescription |
| **Fallback de Linhas** | Se não há linhas no PG, usa `raw_json->'DocumentLines'` |
| **Estado do Cliente** | Regex do Address/Address2: `substring('-([A-Z]{2})\s')` |
| **Período Comparativo** | Visão Executiva compara com período anterior de mesma duração |
| **Limite de Sync** | Max 50.000 pedidos por sync. Cron roda a cada hora |
| **Vendedor no Frontend** | `spMap` (Map<code, name>) resolve código → nome |

---

*Gerado em 12/05/2026 — GSN WMS (Garrafaria Serra Negra)*
