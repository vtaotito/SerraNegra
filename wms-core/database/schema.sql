-- ============================================================================
-- WMS Database Schema
-- ============================================================================
-- Versão: 1.0.0
-- Data: 2026-02-05
-- Descrição: Schema completo do WMS com catálogo, pedidos, estoque e sync
-- ============================================================================

-- Limpar schema existente (CUIDADO: só em desenvolvimento)
-- DROP SCHEMA IF EXISTS public CASCADE;
-- CREATE SCHEMA public;

-- ============================================================================
-- 1. CATÁLOGO
-- ============================================================================

-- 1.1 Produtos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação
    sku VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    ean VARCHAR(20),
    
    -- Classificação
    category VARCHAR(100),
    
    -- Unidades
    unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'UN', -- UN, KG, CX, PC, etc
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- SAP Integration
    sap_item_code VARCHAR(50),
    sap_item_name TEXT,
    
    -- Dimensões e peso (opcional)
    weight_kg DECIMAL(10,3),
    length_cm DECIMAL(10,2),
    width_cm DECIMAL(10,2),
    height_cm DECIMAL(10,2),
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    -- Índices
    CONSTRAINT products_sku_not_empty CHECK (sku <> '')
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_sap_item_code ON products(sap_item_code);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_category ON products(category);

-- 1.2 Depósitos/Armazéns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Localização
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    
    -- Tipo
    warehouse_type VARCHAR(50) DEFAULT 'STORAGE', -- STORAGE, PICKING, EXPEDITION, QUARANTINE
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- SAP Integration
    sap_warehouse_code VARCHAR(20),
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX idx_warehouses_code ON warehouses(code);
CREATE INDEX idx_warehouses_sap_code ON warehouses(sap_warehouse_code);
CREATE INDEX idx_warehouses_is_active ON warehouses(is_active);

-- 1.3 Preço (Price Snapshot)
-- ----------------------------------------------------------------------------
-- Por enquanto preço único, depois evolui para lista de preço por cliente
CREATE TABLE IF NOT EXISTS product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamento
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Preço
    price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    
    -- Validade
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMP,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    
    CONSTRAINT product_prices_price_positive CHECK (price >= 0)
);

CREATE INDEX idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX idx_product_prices_valid_from ON product_prices(valid_from);
CREATE INDEX idx_product_prices_is_active ON product_prices(is_active);

-- ============================================================================
-- 2. PEDIDOS (OMS)
-- ============================================================================

-- 2.1 Clientes (Business Partners)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação
    customer_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    document VARCHAR(20), -- CPF/CNPJ
    
    -- Contato
    email VARCHAR(200),
    phone VARCHAR(20),
    
    -- Endereço
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    
    -- Segmentação
    segment VARCHAR(50), -- VAREJO, ATACADO, etc
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- SAP Integration
    sap_card_code VARCHAR(50),
    sap_card_name VARCHAR(200),
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_sap_card_code ON customers(sap_card_code);
CREATE INDEX idx_customers_is_active ON customers(is_active);

-- 2.2 Pedidos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação
    order_number VARCHAR(50) NOT NULL UNIQUE,
    
    -- Cliente
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(200) NOT NULL,
    
    -- Status WMS
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- PENDING, PROCESSING, PICKING, PICKED, PACKING, PACKED, READY_TO_SHIP, SHIPPED, DELIVERED, CANCELLED
    
    -- Datas
    order_date TIMESTAMP NOT NULL DEFAULT NOW(),
    due_date TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    
    -- Valores
    total_amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'BRL',
    
    -- Prioridade
    priority INTEGER DEFAULT 5, -- 1=urgent, 5=normal, 10=low
    
    -- Observações
    notes TEXT,
    
    -- SAP Integration
    sap_doc_entry INTEGER,
    sap_doc_num INTEGER,
    sap_doc_status VARCHAR(50),
    
    -- UDFs do SAP (User Defined Fields)
    sap_udf_wms_status VARCHAR(50),
    sap_udf_wms_orderid VARCHAR(100),
    sap_udf_wms_last_event TEXT,
    sap_udf_wms_last_ts TIMESTAMP,
    sap_udf_wms_corr_id VARCHAR(100),
    
    -- Sync
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(50), -- SYNCED, PENDING, ERROR
    sync_error TEXT,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    CONSTRAINT orders_total_positive CHECK (total_amount IS NULL OR total_amount >= 0)
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_sap_doc_entry ON orders(sap_doc_entry);
CREATE INDEX idx_orders_sync_status ON orders(sync_status);

-- 2.3 Linhas de Pedido
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamento
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    
    -- Identificação
    line_number INTEGER NOT NULL,
    
    -- Produto
    product_sku VARCHAR(50) NOT NULL,
    product_description TEXT NOT NULL,
    
    -- Quantidade
    quantity DECIMAL(15,3) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL,
    
    -- Quantidade processada
    quantity_picked DECIMAL(15,3) DEFAULT 0,
    quantity_packed DECIMAL(15,3) DEFAULT 0,
    quantity_shipped DECIMAL(15,3) DEFAULT 0,
    
    -- Preço
    unit_price DECIMAL(15,2),
    line_total DECIMAL(15,2),
    
    -- Depósito origem
    warehouse_id UUID REFERENCES warehouses(id),
    warehouse_code VARCHAR(20),
    
    -- SAP Integration
    sap_line_num INTEGER,
    sap_item_code VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT order_lines_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_lines_picked_valid CHECK (quantity_picked >= 0 AND quantity_picked <= quantity),
    CONSTRAINT order_lines_packed_valid CHECK (quantity_packed >= 0 AND quantity_packed <= quantity_picked),
    CONSTRAINT order_lines_shipped_valid CHECK (quantity_shipped >= 0 AND quantity_shipped <= quantity_packed)
);

CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX idx_order_lines_product_id ON order_lines(product_id);
CREATE INDEX idx_order_lines_warehouse_id ON order_lines(warehouse_id);

-- ============================================================================
-- 3. ESTOQUE (WMS)
-- ============================================================================

-- 3.1 Estoque por Produto e Depósito
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamento
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    
    -- Quantidades
    quantity_available DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantity_reserved DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantity_on_order DECIMAL(15,3) NOT NULL DEFAULT 0, -- Pedidos futuros
    
    -- Calculado: quantity_available - quantity_reserved
    quantity_free DECIMAL(15,3) GENERATED ALWAYS AS (quantity_available - quantity_reserved) STORED,
    
    -- Localização (opcional - para WMS avançado)
    location_zone VARCHAR(50),
    location_aisle VARCHAR(50),
    location_rack VARCHAR(50),
    location_level VARCHAR(50),
    location_position VARCHAR(50),
    
    -- Metadata
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraint único por produto/depósito
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
CREATE INDEX idx_stock_quantity_available ON stock(quantity_available);

-- 3.2 Movimentações de Estoque
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamento
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    
    -- Tipo de movimentação
    movement_type VARCHAR(50) NOT NULL,
    -- IN: PURCHASE, RETURN, TRANSFER_IN, ADJUSTMENT_IN
    -- OUT: SALE, TRANSFER_OUT, ADJUSTMENT_OUT, LOSS, DAMAGE
    
    -- Quantidade
    quantity DECIMAL(15,3) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL,
    
    -- Origem/Destino (para transferências)
    from_warehouse_id UUID REFERENCES warehouses(id),
    to_warehouse_id UUID REFERENCES warehouses(id),
    
    -- Referência
    reference_type VARCHAR(50), -- ORDER, TRANSFER, ADJUSTMENT, etc
    reference_id UUID,
    reference_number VARCHAR(100),
    
    -- Lote/Batch (para auditoria)
    batch_number VARCHAR(100),
    
    -- Observações
    notes TEXT,
    
    -- Auditoria
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    
    -- Origem da movimentação
    source_system VARCHAR(50) DEFAULT 'WMS' -- WMS, SAP, MANUAL
);

CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_batch ON stock_movements(batch_number);

-- 3.3 Reservas de Estoque
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamento
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_line_id UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
    
    -- Quantidade
    quantity_reserved DECIMAL(15,3) NOT NULL,
    quantity_picked DECIMAL(15,3) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE, PICKED, RELEASED, EXPIRED
    
    -- Validade
    reserved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    
    CONSTRAINT reservations_quantity_positive CHECK (quantity_reserved > 0),
    CONSTRAINT reservations_picked_valid CHECK (quantity_picked >= 0 AND quantity_picked <= quantity_reserved)
);

CREATE INDEX idx_reservations_product_id ON stock_reservations(product_id);
CREATE INDEX idx_reservations_warehouse_id ON stock_reservations(warehouse_id);
CREATE INDEX idx_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX idx_reservations_status ON stock_reservations(status);
CREATE INDEX idx_reservations_expires_at ON stock_reservations(expires_at);

-- ============================================================================
-- 4. SYNC/INTEGRAÇÃO
-- ============================================================================

-- 4.1 Controle de Sync (Polling Incremental)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tipo de entidade
    entity_type VARCHAR(50) NOT NULL UNIQUE,
    -- ORDERS, PRODUCTS, CUSTOMERS, STOCK, DELIVERIES
    
    -- Última sincronização
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50), -- SUCCESS, ERROR, RUNNING
    last_sync_error TEXT,
    
    -- Próxima sincronização
    next_sync_at TIMESTAMP,
    
    -- Configuração
    sync_interval_minutes INTEGER DEFAULT 5,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Estatísticas
    total_syncs INTEGER DEFAULT 0,
    successful_syncs INTEGER DEFAULT 0,
    failed_syncs INTEGER DEFAULT 0,
    
    -- Cursor/Offset (para polling incremental)
    last_sap_doc_entry INTEGER,
    last_sap_update_date TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_control_entity_type ON sync_control(entity_type);
CREATE INDEX idx_sync_control_next_sync ON sync_control(next_sync_at);

-- 4.2 Log de Sincronizações
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tipo
    entity_type VARCHAR(50) NOT NULL,
    sync_direction VARCHAR(10) NOT NULL, -- IN (SAP→WMS), OUT (WMS→SAP)
    
    -- Referência
    entity_id UUID,
    entity_reference VARCHAR(100),
    
    -- Status
    status VARCHAR(50) NOT NULL, -- SUCCESS, ERROR, PARTIAL
    error_message TEXT,
    
    -- Dados
    request_data JSONB,
    response_data JSONB,
    
    -- Timing
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    -- Metadata
    created_by VARCHAR(100)
);

CREATE INDEX idx_sync_logs_entity_type ON sync_logs(entity_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);
CREATE INDEX idx_sync_logs_entity_ref ON sync_logs(entity_type, entity_id);

-- ============================================================================
-- 5. AUDITORIA GERAL
-- ============================================================================

-- 5.1 Histórico de Alterações
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entidade
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    
    -- Operação
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    
    -- Dados
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    -- Usuário
    user_id VARCHAR(100),
    user_name VARCHAR(200),
    ip_address VARCHAR(50),
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);

-- ============================================================================
-- 6. VIEWS ÚTEIS
-- ============================================================================

-- 6.1 View: Estoque Total por Produto
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_stock_by_product AS
SELECT 
    p.id AS product_id,
    p.sku,
    p.description,
    p.unit_of_measure,
    SUM(s.quantity_available) AS total_available,
    SUM(s.quantity_reserved) AS total_reserved,
    SUM(s.quantity_free) AS total_free,
    SUM(s.quantity_on_order) AS total_on_order,
    COUNT(DISTINCT s.warehouse_id) AS warehouse_count
FROM products p
LEFT JOIN stock s ON p.id = s.product_id
WHERE p.is_active = true
GROUP BY p.id, p.sku, p.description, p.unit_of_measure;

-- 6.2 View: Pedidos com Detalhes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_orders_detailed AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.order_date,
    o.due_date,
    c.customer_code,
    c.name AS customer_name,
    c.city,
    c.state,
    COUNT(ol.id) AS line_count,
    SUM(ol.quantity) AS total_items,
    o.total_amount,
    o.sap_doc_entry,
    o.sap_doc_num,
    o.created_at,
    o.updated_at
FROM orders o
JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_lines ol ON o.order_id = ol.order_id
GROUP BY o.id, o.order_number, o.status, o.order_date, o.due_date,
         c.customer_code, c.name, c.city, c.state, o.total_amount,
         o.sap_doc_entry, o.sap_doc_num, o.created_at, o.updated_at;

-- ============================================================================
-- 7. FUNÇÕES E TRIGGERS
-- ============================================================================

-- 7.1 Trigger: Atualizar updated_at automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas que têm updated_at
CREATE TRIGGER trigger_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_order_lines_updated_at BEFORE UPDATE ON order_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_stock_updated_at BEFORE UPDATE ON stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_reservations_updated_at BEFORE UPDATE ON stock_reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sync_control_updated_at BEFORE UPDATE ON sync_control
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7.2 Função: Atualizar estoque após movimentação
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_stock_after_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar ou inserir registro de estoque
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

-- ============================================================================
-- 8. DADOS INICIAIS (SEED)
-- ============================================================================

-- 8.1 Sync Control Inicial
-- ----------------------------------------------------------------------------
INSERT INTO sync_control (entity_type, sync_interval_minutes, is_enabled)
VALUES 
    ('ORDERS', 5, true),
    ('PRODUCTS', 30, true),
    ('CUSTOMERS', 60, true),
    ('STOCK', 15, true)
ON CONFLICT (entity_type) DO NOTHING;

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================

-- Comentários nas tabelas
COMMENT ON TABLE products IS 'Catálogo de produtos do WMS';
COMMENT ON TABLE warehouses IS 'Depósitos e armazéns';
COMMENT ON TABLE product_prices IS 'Preços dos produtos (snapshot)';
COMMENT ON TABLE customers IS 'Clientes (Business Partners)';
COMMENT ON TABLE orders IS 'Pedidos de venda (OMS)';
COMMENT ON TABLE order_lines IS 'Linhas dos pedidos';
COMMENT ON TABLE stock IS 'Estoque por produto e depósito';
COMMENT ON TABLE stock_movements IS 'Movimentações de estoque';
COMMENT ON TABLE stock_reservations IS 'Reservas de estoque';
COMMENT ON TABLE sync_control IS 'Controle de sincronização com SAP';
COMMENT ON TABLE sync_logs IS 'Log de sincronizações';
COMMENT ON TABLE audit_log IS 'Log de auditoria geral';
