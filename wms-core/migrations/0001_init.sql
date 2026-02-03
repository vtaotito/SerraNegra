-- WMS Core schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  external_order_id TEXT,
  customer_id TEXT NOT NULL,
  ship_to_address TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  assigned_to TEXT,
  depends_on_task_id UUID REFERENCES tasks(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS task_lines (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  scanned_quantity INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scan_events (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id),
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  quantity INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  idempotency_key TEXT,
  correlation_id TEXT,
  request_id TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS order_transitions (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT,
  reason TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_scope_key
  ON idempotency_keys (scope, key);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_tasks_order_id
  ON tasks (order_id);

CREATE INDEX IF NOT EXISTS idx_scan_events_order_id
  ON scan_events (order_id);

CREATE INDEX IF NOT EXISTS idx_order_transitions_order_id
  ON order_transitions (order_id);
