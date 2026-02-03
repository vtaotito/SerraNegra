-- Migração 0002: Locations & Inventory Snapshot
-- Descrição: Adiciona tabelas de endereçamento e snapshot de inventário

-- ============================================================================
-- LOCATIONS (Endereços do armazém)
-- ============================================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- Ex: "A-01-02-03" (corredor-coluna-nivel-posicao)
  type TEXT NOT NULL, -- PICKING, STORAGE, STAGING, PACKING, SHIPPING
  zone TEXT, -- Ex: "ZONA_A", "ZONA_B", "EXPEDICAO"
  aisle TEXT, -- Corredor
  column_number TEXT, -- Coluna
  level_number TEXT, -- Nível
  position_number TEXT, -- Posição
  capacity_weight NUMERIC(10,2), -- Capacidade em kg
  capacity_volume NUMERIC(10,2), -- Capacidade em m³
  capacity_pallet INTEGER, -- Capacidade em pallets
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_blocked BOOLEAN NOT NULL DEFAULT false, -- Bloqueado para uso
  blocked_reason TEXT, -- Motivo do bloqueio
  blocked_at TIMESTAMPTZ,
  blocked_by TEXT,
  temperature_controlled BOOLEAN DEFAULT false, -- Área climatizada
  requires_special_equipment BOOLEAN DEFAULT false, -- Requer empilhadeira, etc
  metadata JSONB, -- Dados extras: dimensões, restrições, etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- LOCATION_ASSIGNMENTS (Atribuição de produtos a endereços)
-- ============================================================================
CREATE TABLE IF NOT EXISTS location_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0, -- Quantidade reservada para picking
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  lot_number TEXT, -- Lote
  serial_number TEXT, -- Número de série (para itens rastreados)
  expiration_date DATE, -- Data de validade
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_counted_at TIMESTAMPTZ, -- Última contagem física
  metadata JSONB,
  UNIQUE(location_id, sku, lot_number)
);

-- ============================================================================
-- INVENTORY_SNAPSHOT (Fotografia do inventário)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sku TEXT NOT NULL,
  location_code TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL,
  lot_number TEXT,
  serial_number TEXT,
  expiration_date DATE,
  unit_cost NUMERIC(10,2), -- Custo unitário
  total_value NUMERIC(12,2), -- Valor total (quantity * unit_cost)
  source TEXT NOT NULL DEFAULT 'SYSTEM', -- SYSTEM, PHYSICAL_COUNT, ADJUSTMENT
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date, sku, location_code, lot_number)
);

-- ============================================================================
-- LOCATION_MOVEMENTS (Movimentações de estoque entre endereços)
-- ============================================================================
CREATE TABLE IF NOT EXISTS location_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type TEXT NOT NULL, -- TRANSFER, REPLENISHMENT, ADJUSTMENT, PICKING, PUTAWAY
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  from_location_code TEXT, -- Desnormalizado para histórico
  to_location_code TEXT, -- Desnormalizado para histórico
  lot_number TEXT,
  serial_number TEXT,
  task_id UUID REFERENCES tasks(id), -- Relacionado a tarefa, se aplicável
  order_id UUID REFERENCES orders(id), -- Relacionado a pedido, se aplicável
  reason TEXT, -- Motivo da movimentação
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  CHECK (from_location_id IS NOT NULL OR to_location_id IS NOT NULL)
);

-- ============================================================================
-- INVENTORY_ADJUSTMENTS (Ajustes de inventário)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_type TEXT NOT NULL, -- COUNT, DAMAGE, LOSS, FOUND, CORRECTION
  sku TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  location_code TEXT NOT NULL, -- Desnormalizado
  lot_number TEXT,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  quantity_delta INTEGER NOT NULL, -- Diferença (after - before)
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  approved_by TEXT, -- Quem aprovou o ajuste
  approved_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Locations
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations (code);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations (type);
CREATE INDEX IF NOT EXISTS idx_locations_zone ON locations (zone);
CREATE INDEX IF NOT EXISTS idx_locations_active_blocked ON locations (is_active, is_blocked);

-- Location Assignments
CREATE INDEX IF NOT EXISTS idx_location_assignments_location_id ON location_assignments (location_id);
CREATE INDEX IF NOT EXISTS idx_location_assignments_sku ON location_assignments (sku);
CREATE INDEX IF NOT EXISTS idx_location_assignments_expiration ON location_assignments (expiration_date);

-- Inventory Snapshot
CREATE INDEX IF NOT EXISTS idx_inventory_snapshot_date ON inventory_snapshot (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshot_sku ON inventory_snapshot (sku);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshot_location ON inventory_snapshot (location_code);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshot_date_sku ON inventory_snapshot (snapshot_date DESC, sku);

-- Location Movements
CREATE INDEX IF NOT EXISTS idx_location_movements_occurred_at ON location_movements (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_movements_sku ON location_movements (sku);
CREATE INDEX IF NOT EXISTS idx_location_movements_task_id ON location_movements (task_id);
CREATE INDEX IF NOT EXISTS idx_location_movements_order_id ON location_movements (order_id);
CREATE INDEX IF NOT EXISTS idx_location_movements_from_location ON location_movements (from_location_id);
CREATE INDEX IF NOT EXISTS idx_location_movements_to_location ON location_movements (to_location_id);

-- Inventory Adjustments
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_occurred_at ON inventory_adjustments (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_sku ON inventory_adjustments (sku);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location ON inventory_adjustments (location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_type ON inventory_adjustments (adjustment_type);

-- ============================================================================
-- TRIGGERS para atualização automática de updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS úteis
-- ============================================================================

-- View: Inventário atual consolidado por SKU
CREATE OR REPLACE VIEW v_inventory_current AS
SELECT 
  la.sku,
  SUM(la.quantity) as total_quantity,
  SUM(la.reserved_quantity) as total_reserved,
  SUM(la.available_quantity) as total_available,
  COUNT(DISTINCT la.location_id) as location_count,
  MAX(la.assigned_at) as last_updated
FROM location_assignments la
JOIN locations l ON l.id = la.location_id
WHERE l.is_active = true
GROUP BY la.sku;

-- View: Inventário por localização
CREATE OR REPLACE VIEW v_inventory_by_location AS
SELECT 
  l.code as location_code,
  l.type as location_type,
  l.zone,
  la.sku,
  la.quantity,
  la.reserved_quantity,
  la.available_quantity,
  la.lot_number,
  la.expiration_date,
  la.assigned_at,
  la.last_counted_at
FROM location_assignments la
JOIN locations l ON l.id = la.location_id
WHERE l.is_active = true
ORDER BY l.code, la.sku;

-- View: Localizações disponíveis para picking
CREATE OR REPLACE VIEW v_locations_pickable AS
SELECT 
  l.id,
  l.code,
  l.zone,
  l.type,
  COALESCE(SUM(la.available_quantity), 0) as available_units,
  COUNT(DISTINCT la.sku) as sku_count
FROM locations l
LEFT JOIN location_assignments la ON la.location_id = l.id
WHERE l.is_active = true 
  AND l.is_blocked = false
  AND l.type IN ('PICKING', 'STORAGE')
GROUP BY l.id, l.code, l.zone, l.type
ORDER BY l.code;

COMMENT ON TABLE locations IS 'Endereços físicos do armazém';
COMMENT ON TABLE location_assignments IS 'Atribuição de produtos a endereços específicos';
COMMENT ON TABLE inventory_snapshot IS 'Fotografia diária do inventário para análise histórica';
COMMENT ON TABLE location_movements IS 'Movimentações de estoque entre endereços';
COMMENT ON TABLE inventory_adjustments IS 'Ajustes manuais de inventário (contagem, perdas, danos)';
