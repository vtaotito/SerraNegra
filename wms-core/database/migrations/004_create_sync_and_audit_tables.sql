-- Migration 004: Create Sync and Audit Tables
-- Data: 2026-02-05
-- Descrição: Cria tabelas de sincronização e auditoria

-- 1. Controle de Sync
CREATE TABLE IF NOT EXISTS sync_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL UNIQUE,
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,
    next_sync_at TIMESTAMP,
    sync_interval_minutes INTEGER DEFAULT 5,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    total_syncs INTEGER DEFAULT 0,
    successful_syncs INTEGER DEFAULT 0,
    failed_syncs INTEGER DEFAULT 0,
    last_sap_doc_entry INTEGER,
    last_sap_update_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_control_entity_type ON sync_control(entity_type);
CREATE INDEX idx_sync_control_next_sync ON sync_control(next_sync_at);

-- 2. Log de Sincronizações
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    sync_direction VARCHAR(10) NOT NULL,
    entity_id UUID,
    entity_reference VARCHAR(100),
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    request_data JSONB,
    response_data JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    created_by VARCHAR(100)
);

CREATE INDEX idx_sync_logs_entity_type ON sync_logs(entity_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);

-- 3. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    user_id VARCHAR(100),
    user_name VARCHAR(200),
    ip_address VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Trigger
CREATE TRIGGER trigger_sync_control_updated_at BEFORE UPDATE ON sync_control
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dados iniciais de sync_control
INSERT INTO sync_control (entity_type, sync_interval_minutes, is_enabled)
VALUES 
    ('ORDERS', 5, true),
    ('PRODUCTS', 30, true),
    ('CUSTOMERS', 60, true),
    ('STOCK', 15, true)
ON CONFLICT (entity_type) DO NOTHING;
