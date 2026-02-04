-- Migração 0003: Campos Estendidos para Orders
-- Adiciona campos adicionais necessários para integração SAP e gestão operacional

-- Adicionar campos SAP
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS sap_doc_entry INTEGER,
  ADD COLUMN IF NOT EXISTS sap_doc_num INTEGER;

-- Adicionar campos operacionais
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

-- Índice para busca por DocEntry (usado frequentemente)
CREATE INDEX IF NOT EXISTS idx_orders_sap_doc_entry 
  ON orders (sap_doc_entry) 
  WHERE sap_doc_entry IS NOT NULL;

-- Índice para busca por DocNum
CREATE INDEX IF NOT EXISTS idx_orders_sap_doc_num 
  ON orders (sap_doc_num) 
  WHERE sap_doc_num IS NOT NULL;

-- Índice para filtros operacionais
CREATE INDEX IF NOT EXISTS idx_orders_carrier 
  ON orders (carrier) 
  WHERE carrier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_priority 
  ON orders (priority) 
  WHERE priority IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_sla_due_at 
  ON orders (sla_due_at) 
  WHERE sla_due_at IS NOT NULL;

-- Índice composto para dashboard
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at 
  ON orders (status, updated_at DESC);

-- Comentários
COMMENT ON COLUMN orders.sap_doc_entry IS 'DocEntry do SAP Business One (chave interna)';
COMMENT ON COLUMN orders.sap_doc_num IS 'DocNum do SAP Business One (número visível)';
COMMENT ON COLUMN orders.customer_name IS 'Nome do cliente (CardName do SAP)';
COMMENT ON COLUMN orders.carrier IS 'Transportadora responsável';
COMMENT ON COLUMN orders.priority IS 'Prioridade: NORMAL, URGENT, CRITICAL';
COMMENT ON COLUMN orders.sla_due_at IS 'Prazo de SLA para despacho';
