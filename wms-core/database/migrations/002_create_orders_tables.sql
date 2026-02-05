-- Migration 002: Create Orders Tables
-- Data: 2026-02-05
-- Descrição: Cria tabelas de pedidos (OMS)

-- 1. Clientes
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    document VARCHAR(20),
    email VARCHAR(200),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    segment VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sap_card_code VARCHAR(50),
    sap_card_name VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_sap_card_code ON customers(sap_card_code);

-- 2. Pedidos
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(200) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    order_date TIMESTAMP NOT NULL DEFAULT NOW(),
    due_date TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    total_amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'BRL',
    priority INTEGER DEFAULT 5,
    notes TEXT,
    sap_doc_entry INTEGER,
    sap_doc_num INTEGER,
    sap_doc_status VARCHAR(50),
    sap_udf_wms_status VARCHAR(50),
    sap_udf_wms_orderid VARCHAR(100),
    sap_udf_wms_last_event TEXT,
    sap_udf_wms_last_ts TIMESTAMP,
    sap_udf_wms_corr_id VARCHAR(100),
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(50),
    sync_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    CONSTRAINT orders_total_positive CHECK (total_amount IS NULL OR total_amount >= 0)
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_sap_doc_entry ON orders(sap_doc_entry);

-- 3. Linhas de Pedido
CREATE TABLE IF NOT EXISTS order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    line_number INTEGER NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    product_description TEXT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL,
    quantity_picked DECIMAL(15,3) DEFAULT 0,
    quantity_packed DECIMAL(15,3) DEFAULT 0,
    quantity_shipped DECIMAL(15,3) DEFAULT 0,
    unit_price DECIMAL(15,2),
    line_total DECIMAL(15,2),
    warehouse_id UUID REFERENCES warehouses(id),
    warehouse_code VARCHAR(20),
    sap_line_num INTEGER,
    sap_item_code VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT order_lines_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX idx_order_lines_product_id ON order_lines(product_id);

-- Triggers
CREATE TRIGGER trigger_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_order_lines_updated_at BEFORE UPDATE ON order_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
