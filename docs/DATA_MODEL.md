# Modelo de Dados (PostgreSQL) — WMS

## Objetivo
Definir um modelo que suporte:

- **status** do pedido (state machine)
- **tarefas** (picking/packing/shipping) e concorrência (2 operadores)
- **audit trail** (append-only) para bipagens/ações
- **integração SAP** com outbox e reprocessamento

## Tabelas (MVP + extensões “robustas”)

### `orders`
- **Propósito**: espelho do pedido no WMS + status atual.
- **Campos chave**
  - `order_id` (PK, UUID/ULID)
  - `external_order_id` (unique opcional)
  - `customer_id`
  - `status` (enum ou varchar validado pelo core)
  - `created_at`, `updated_at`
  - `version` (int) — optimistic locking
- **Índices**
  - `(status, updated_at desc)`
  - `(external_order_id)` unique

### `order_items`
- **Propósito**: itens do pedido.
- **Campos**
  - `order_item_id` (PK)
  - `order_id` (FK)
  - `sku`
  - `qty`
  - `uom` (opcional)
- **Índices**
  - `(order_id)`
  - `(sku)`

### `tasks`
- **Propósito**: unidade de trabalho operacional (picking/packing/shipping).
- **Campos**
  - `task_id` (PK)
  - `order_id` (FK)
  - `type` (PICK/PACK/SHIP)
  - `status`
  - `assigned_user_id` (nullable)
  - `warehouse_id`
  - `created_at`, `updated_at`
  - `version` (int)
- **Índices**
  - `(warehouse_id, status, updated_at desc)`
  - `(order_id)`

### `scan_events` (append-only)
- **Propósito**: audit trail imutável; “verdade” de rastreabilidade.
- **Campos**
  - `event_id` (PK, UUID)
  - `occurred_at` (timestamp)
  - `received_at` (timestamp)
  - `correlation_id` (string)
  - `actor_user_id`
  - `device_id` (nullable)
  - `order_id` (nullable)
  - `task_id` (nullable)
  - `location_code` (nullable)
  - `sku` (nullable)
  - `qty` (nullable)
  - `event_type` (ex.: SCAN_LOCATION, SCAN_ITEM, CONFIRM_QTY, SHORTAGE, PACK_OK, etc.)
  - `result` (OK/ERROR)
  - `error_code` (nullable)
  - `error_detail` (jsonb, nullable)
  - `idempotency_key` (nullable)
- **Índices**
  - `(order_id, occurred_at desc)`
  - `(task_id, occurred_at desc)`
  - `(actor_user_id, occurred_at desc)`
  - `(event_type, occurred_at desc)`
- **Particionamento (quando crescer)**
  - por mês em `occurred_at` para evitar tabela gigante

### `idempotency_keys`
- **Propósito**: garantir idem em POST sensíveis.
- **Campos**
  - `scope` (ex.: ORDER_CREATE, ORDER_EVENT, SCAN)
  - `key`
  - `request_hash`
  - `response_snapshot` (jsonb)
  - `created_at`
  - `expires_at`
- **Chave**
  - PK composta `(scope, key)`

### `integration_outbox`
- **Propósito**: outbox transacional para SAP/webhooks.
- **Campos**
  - `outbox_id` (PK)
  - `aggregate_type` (ex.: ORDER)
  - `aggregate_id` (ex.: order_id)
  - `event_type` (ex.: SAP_DESPATCH_REQUESTED)
  - `payload` (jsonb)
  - `status` (PENDING/PROCESSING/SENT/FAILED)
  - `attempts`
  - `next_retry_at`
  - `created_at`, `updated_at`
- **Índices**
  - `(status, next_retry_at)`

## Concorrência (2 operadores no mesmo pedido)
- **Opção 1 (simples/boa)**: optimistic locking via `version` em `orders`/`tasks`.
- **Opção 2 (UX forte)**: lock em Redis por `task_id` (TTL + renew) + fallback para optimistic lock.

