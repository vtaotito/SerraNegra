-- Migration 003: Create Stock Tables
-- Data: 2026-02-05
-- Descrição: Cria tabelas de estoque (WMS)

-- 1. Estoque
CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    quantity_available DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantity_reserved DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantity_on_order DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantity_free DECIMAL(15,3) GENERATED ALWAYS AS (quantity_available - quantity_reserved) STORED,
    location_zone VARCHAR(50),
    location_aisle VARCHAR(50),
    location_rack VARCHAR(50),
    location_level VARCHAR(50),
    location_position VARCHAR(50),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_unique_product_warehouse UNIQUE (product_id, warehouse_id),
    CONSTRAINT stock_quantities_valid CHECK (
        quantity_available >= 0 AND 
        quantity_reserved >= 0 AND 
        quantity_reserved <= quantity_available AND
        quantity_on_order >= 0
    )
);

CREATE INDEX idx_stock_product_id ON stock(product_id);
CREATE INDEX idx_stock_warehouse_id ON stock(warehouse_id);

-- 2. Movimentações de Estoque
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL,
    from_warehouse_id UUID REFERENCES warehouses(id),
    to_warehouse_id UUID REFERENCES warehouses(id),
    reference_type VARCHAR(50),
    reference_id UUID,
    reference_number VARCHAR(100),
    batch_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    source_system VARCHAR(50) DEFAULT 'WMS'
);

CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

-- 3. Reservas de Estoque
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_line_id UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
    quantity_reserved DECIMAL(15,3) NOT NULL,
    quantity_picked DECIMAL(15,3) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    reserved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    CONSTRAINT reservations_quantity_positive CHECK (quantity_reserved > 0)
);

CREATE INDEX idx_reservations_product_id ON stock_reservations(product_id);
CREATE INDEX idx_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX idx_reservations_status ON stock_reservations(status);

-- Triggers
CREATE TRIGGER trigger_stock_updated_at BEFORE UPDATE ON stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_reservations_updated_at BEFORE UPDATE ON stock_reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função: Atualizar estoque após movimentação
CREATE OR REPLACE FUNCTION update_stock_after_movement()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO stock (product_id, warehouse_id, quantity_available)
    VALUES (NEW.product_id, NEW.warehouse_id, 
            CASE 
                WHEN NEW.movement_type IN ('PURCHASE', 'RETURN', 'TRANSFER_IN', 'ADJUSTMENT_IN') 
                THEN NEW.quantity
                ELSE -NEW.quantity
            END)
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
        quantity_available = stock.quantity_available + 
            CASE 
                WHEN NEW.movement_type IN ('PURCHASE', 'RETURN', 'TRANSFER_IN', 'ADJUSTMENT_IN') 
                THEN NEW.quantity
                ELSE -NEW.quantity
            END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_after_movement
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION update_stock_after_movement();
