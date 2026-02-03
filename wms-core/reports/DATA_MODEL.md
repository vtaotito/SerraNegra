# Modelo de Dados - WMS Core

## Visão Geral

Este documento descreve o modelo de dados completo do sistema WMS, incluindo todas as entidades, relacionamentos e regras de negócio.

---

## 📊 Diagrama de Entidades (ER Simplificado)

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   ORDERS    │◄────────┤ ORDER_ITEMS  │         │    TASKS    │
│             │         │              │         │             │
│ id (PK)     │         │ order_id(FK) │         │ id (PK)     │
│ status      │         │ sku          │         │ order_id(FK)│
│ customer_id │         │ quantity     │         │ type        │
└──────┬──────┘         └──────────────┘         └──────┬──────┘
       │                                                 │
       │                ┌──────────────┐                │
       └────────────────┤ SCAN_EVENTS  │◄───────────────┘
       │                │              │
       │                │ order_id(FK) │
       │                │ task_id (FK) │
       │                │ type         │
       │                │ value        │
       │                └──────────────┘
       │
       │                ┌────────────────────┐
       └────────────────┤ ORDER_TRANSITIONS  │
                        │                    │
                        │ order_id (FK)      │
                        │ from_status        │
                        │ to_status          │
                        └────────────────────┘

┌──────────────┐         ┌─────────────────────┐
│  LOCATIONS   │◄────────┤ LOCATION_ASSIGNMENTS│
│              │         │                     │
│ id (PK)      │         │ location_id (FK)    │
│ code (UQ)    │         │ sku                 │
│ type         │         │ quantity            │
│ zone         │         │ lot_number          │
└──────┬───────┘         └─────────────────────┘
       │
       │                 ┌──────────────────────┐
       ├─────────────────┤ LOCATION_MOVEMENTS   │
       │                 │                      │
       │                 │ from_location_id(FK) │
       │                 │ to_location_id (FK)  │
       │                 │ sku                  │
       │                 └──────────────────────┘
       │
       │                 ┌──────────────────────┐
       └─────────────────┤ INVENTORY_ADJUSTMENTS│
                         │                      │
                         │ location_id (FK)     │
                         │ sku                  │
                         │ quantity_delta       │
                         └──────────────────────┘

┌────────────────────┐
│ INVENTORY_SNAPSHOT │
│                    │
│ snapshot_date      │
│ sku                │
│ location_code      │
│ quantity           │
└────────────────────┘
```

---

## 📦 Entidades Principais

### 1. ORDERS (Pedidos)
**Descrição**: Pedidos do sistema WMS (espelho de pedidos do ERP).

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único interno |
| external_order_id | TEXT | ❌ | ID do pedido no sistema externo (SAP) |
| customer_id | TEXT | ✅ | ID do cliente |
| ship_to_address | TEXT | ❌ | Endereço de entrega |
| status | TEXT | ✅ | Status atual (ver State Machine) |
| created_at | TIMESTAMPTZ | ✅ | Data de criação |
| updated_at | TIMESTAMPTZ | ✅ | Data de atualização |
| version | INTEGER | ✅ | Versão (controle otimista) |

**Status Válidos**: `A_SEPARAR`, `EM_SEPARACAO`, `CONFERIDO`, `AGUARDANDO_COTACAO`, `AGUARDANDO_COLETA`, `DESPACHADO`

---

### 2. ORDER_ITEMS (Itens do Pedido)
**Descrição**: Produtos incluídos em cada pedido.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| order_id | UUID | ✅ | FK para orders |
| sku | TEXT | ✅ | Código do produto |
| quantity | INTEGER | ✅ | Quantidade solicitada |
| created_at | TIMESTAMPTZ | ✅ | Data de criação |

---

### 3. TASKS (Tarefas)
**Descrição**: Tarefas operacionais (separação, embalagem, expedição).

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| order_id | UUID | ✅ | FK para orders |
| type | TEXT | ✅ | Tipo: PICKING, PACKING, SHIPPING |
| status | TEXT | ✅ | Status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| assigned_to | TEXT | ❌ | ID do operador atribuído |
| depends_on_task_id | UUID | ❌ | FK para outra task (dependência) |
| started_at | TIMESTAMPTZ | ❌ | Momento de início |
| completed_at | TIMESTAMPTZ | ❌ | Momento de conclusão |
| metadata | JSONB | ❌ | Dados extras |

---

### 4. TASK_LINES (Linhas da Tarefa)
**Descrição**: Itens específicos de cada tarefa.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| task_id | UUID | ✅ | FK para tasks |
| sku | TEXT | ✅ | Código do produto |
| quantity | INTEGER | ✅ | Quantidade esperada |
| scanned_quantity | INTEGER | ✅ | Quantidade escaneada (default: 0) |

---

### 5. SCAN_EVENTS (Eventos de Escaneamento)
**Descrição**: Audit trail de todas as leituras de código de barras.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| order_id | UUID | ✅ | FK para orders |
| task_id | UUID | ❌ | FK para tasks |
| type | TEXT | ✅ | Tipo: ADDRESS_SCAN, PRODUCT_SCAN, QUANTITY_SCAN |
| value | TEXT | ✅ | Valor escaneado |
| quantity | INTEGER | ❌ | Quantidade (quando aplicável) |
| occurred_at | TIMESTAMPTZ | ✅ | Timestamp do evento |
| actor_id | TEXT | ✅ | ID do operador |
| actor_role | TEXT | ✅ | Papel: PICKER, CHECKER, SUPERVISOR, SHIPPER |
| idempotency_key | TEXT | ❌ | Chave de idempotência |
| correlation_id | TEXT | ❌ | ID de correlação |
| metadata | JSONB | ❌ | Dados extras |

---

### 6. ORDER_TRANSITIONS (Transições de Status)
**Descrição**: Histórico de mudanças de status dos pedidos (audit trail).

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| order_id | UUID | ✅ | FK para orders |
| from_status | TEXT | ✅ | Status anterior |
| to_status | TEXT | ✅ | Status novo |
| event_type | TEXT | ✅ | Evento que causou a transição |
| actor_id | TEXT | ✅ | Quem executou |
| actor_role | TEXT | ✅ | Papel do executor |
| occurred_at | TIMESTAMPTZ | ✅ | Momento da transição |
| idempotency_key | TEXT | ❌ | Chave de idempotência |
| reason | TEXT | ❌ | Motivo/observação |
| metadata | JSONB | ❌ | Dados extras |

---

### 7. LOCATIONS (Endereços Físicos)
**Descrição**: Localizações físicas no armazém.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| code | TEXT | ✅ | Código único (ex: A-01-02-03) |
| type | TEXT | ✅ | Tipo: PICKING, STORAGE, STAGING, PACKING, SHIPPING |
| zone | TEXT | ❌ | Zona do armazém |
| aisle | TEXT | ❌ | Corredor |
| column_number | TEXT | ❌ | Coluna |
| level_number | TEXT | ❌ | Nível |
| position_number | TEXT | ❌ | Posição |
| capacity_weight | NUMERIC | ❌ | Capacidade em kg |
| capacity_volume | NUMERIC | ❌ | Capacidade em m³ |
| capacity_pallet | INTEGER | ❌ | Capacidade em pallets |
| is_active | BOOLEAN | ✅ | Endereço ativo |
| is_blocked | BOOLEAN | ✅ | Endereço bloqueado |
| blocked_reason | TEXT | ❌ | Motivo do bloqueio |
| temperature_controlled | BOOLEAN | ❌ | Área climatizada |
| metadata | JSONB | ❌ | Dados extras |

---

### 8. LOCATION_ASSIGNMENTS (Alocação de Estoque)
**Descrição**: Produtos alocados em cada endereço.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| location_id | UUID | ✅ | FK para locations |
| sku | TEXT | ✅ | Código do produto |
| quantity | INTEGER | ✅ | Quantidade física |
| reserved_quantity | INTEGER | ✅ | Quantidade reservada (default: 0) |
| available_quantity | INTEGER | ✅ | Calculado: quantity - reserved_quantity |
| lot_number | TEXT | ❌ | Número do lote |
| serial_number | TEXT | ❌ | Número de série |
| expiration_date | DATE | ❌ | Data de validade |
| assigned_at | TIMESTAMPTZ | ✅ | Momento da alocação |
| last_counted_at | TIMESTAMPTZ | ❌ | Última contagem física |

---

### 9. INVENTORY_SNAPSHOT (Fotografia do Inventário)
**Descrição**: Registro diário do estado do inventário para análise histórica.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| snapshot_date | DATE | ✅ | Data da fotografia |
| snapshot_time | TIMESTAMPTZ | ✅ | Timestamp da captura |
| sku | TEXT | ✅ | Código do produto |
| location_code | TEXT | ✅ | Código do endereço |
| quantity | INTEGER | ✅ | Quantidade física |
| reserved_quantity | INTEGER | ✅ | Quantidade reservada |
| available_quantity | INTEGER | ✅ | Quantidade disponível |
| lot_number | TEXT | ❌ | Lote |
| expiration_date | DATE | ❌ | Validade |
| unit_cost | NUMERIC | ❌ | Custo unitário |
| total_value | NUMERIC | ❌ | Valor total |
| source | TEXT | ✅ | Origem: SYSTEM, PHYSICAL_COUNT, ADJUSTMENT |

**Uso**: Executar um JOB diário que popula esta tabela a partir de `location_assignments`.

---

### 10. LOCATION_MOVEMENTS (Movimentações)
**Descrição**: Histórico de movimentação de estoque entre endereços.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| movement_type | TEXT | ✅ | TRANSFER, REPLENISHMENT, ADJUSTMENT, PICKING, PUTAWAY |
| sku | TEXT | ✅ | Produto |
| quantity | INTEGER | ✅ | Quantidade movimentada |
| from_location_id | UUID | ❌ | FK origem |
| to_location_id | UUID | ❌ | FK destino |
| from_location_code | TEXT | ❌ | Código origem (desnormalizado) |
| to_location_code | TEXT | ❌ | Código destino (desnormalizado) |
| task_id | UUID | ❌ | FK para tasks |
| order_id | UUID | ❌ | FK para orders |
| reason | TEXT | ❌ | Motivo |
| actor_id | TEXT | ✅ | Operador |
| occurred_at | TIMESTAMPTZ | ✅ | Momento |

---

### 11. INVENTORY_ADJUSTMENTS (Ajustes de Inventário)
**Descrição**: Ajustes manuais de inventário (contagem, perdas, danos).

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| adjustment_type | TEXT | ✅ | COUNT, DAMAGE, LOSS, FOUND, CORRECTION |
| sku | TEXT | ✅ | Produto |
| location_id | UUID | ✅ | FK para locations |
| location_code | TEXT | ✅ | Código (desnormalizado) |
| lot_number | TEXT | ❌ | Lote |
| quantity_before | INTEGER | ✅ | Quantidade antes |
| quantity_after | INTEGER | ✅ | Quantidade depois |
| quantity_delta | INTEGER | ✅ | Diferença (after - before) |
| reason | TEXT | ✅ | Motivo do ajuste |
| actor_id | TEXT | ✅ | Quem fez |
| approved_by | TEXT | ❌ | Quem aprovou |
| approved_at | TIMESTAMPTZ | ❌ | Quando aprovou |
| occurred_at | TIMESTAMPTZ | ✅ | Momento |

---

## 📈 Views Materializadas / Relatórios

### Views Disponíveis

#### Inventário
- `v_inventory_current`: Inventário consolidado por SKU
- `v_inventory_by_location`: Inventário por localização
- `v_locations_pickable`: Localizações disponíveis para picking

#### SLA
- `report_sla_picking_time`: Tempo de separação por pedido
- `report_sla_checking_time`: Tempo de conferência
- `report_sla_end_to_end`: Tempo total (criação → despacho)
- `report_orders_at_risk`: Pedidos em risco de estourar SLA

#### Produtividade
- `report_picker_productivity`: Produtividade individual dos separadores
- `report_checker_productivity`: Produtividade dos conferentes
- `report_productivity_by_zone`: Produtividade por zona
- `report_task_cycle_time`: Tempo de ciclo por tipo de tarefa

#### Divergências
- `report_scan_divergences`: Divergências de contagem
- `report_divergence_by_sku`: Divergências por produto
- `report_divergence_by_operator`: Divergências por operador
- `report_inventory_adjustments_detail`: Detalhamento de ajustes
- `report_checking_divergences`: Divergências na conferência

---

## 🔍 Índices Importantes

### Performance de Consultas
```sql
-- Orders
idx_order_items_order_id
idx_tasks_order_id
idx_scan_events_order_id
idx_order_transitions_order_id

-- Locations
idx_locations_code
idx_locations_type
idx_locations_zone
idx_location_assignments_sku
idx_location_assignments_location_id

-- Time-based
idx_scan_events_occurred_at
idx_location_movements_occurred_at
idx_inventory_snapshot_date

-- Audit
idx_inventory_adjustments_occurred_at
```

---

## 🔒 Regras de Integridade

### Referencial
- Todas as FKs têm `ON DELETE CASCADE` apropriado
- Constraints UNIQUE em campos críticos (location.code, idempotency keys)

### Check Constraints
- `location_movements`: pelo menos um de `from_location_id` ou `to_location_id` deve estar preenchido

### Triggers
- Atualização automática de `updated_at` em `locations`
- Possibilidade de adicionar triggers para auditoria automática

---

## 📊 Exemplos de Uso

### Consultar inventário de um SKU
```sql
SELECT * FROM v_inventory_current
WHERE sku = 'PROD-12345';
```

### Verificar performance de um picker
```sql
SELECT * FROM report_picker_productivity
WHERE picker_id = 'USER123'
  AND work_date >= CURRENT_DATE - INTERVAL '7 days';
```

### Pedidos em risco
```sql
SELECT * FROM report_orders_at_risk
WHERE risk_level IN ('CRÍTICO', 'ALTO');
```

### Resumo de SLA mensal
```sql
SELECT * FROM report_sla_summary(
  '2026-02-01'::timestamptz,
  '2026-02-28'::timestamptz,
  'day'
);
```

---

## 🚀 Próximos Passos

1. **Implementar Job de Snapshot Diário**: Script que popula `inventory_snapshot` a cada dia
2. **Materializar Views**: Para consultas muito pesadas, considerar views materializadas
3. **Particionamento**: Para tabelas históricas grandes (scan_events, location_movements)
4. **Arquivamento**: Política de retenção de dados antigos

---

## 📝 Notas de Implementação

- **Idempotência**: Garantida via tabela `idempotency_keys`
- **Auditoria**: Todas as ações críticas registradas em `order_transitions`, `scan_events`, `inventory_adjustments`
- **Versionamento**: Controle otimista de concorrência em `orders.version`
- **Desnormalização Controlada**: Campos como `location_code` em movimentos para preservar histórico mesmo se endereço for renomeado
