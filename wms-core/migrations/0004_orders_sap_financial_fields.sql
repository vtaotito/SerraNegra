-- Migração 0004: Campos Financeiros SAP
-- Adiciona campos financeiros do SAP para exibição no painel

-- Adicionar campos financeiros do SAP
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS doc_total NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

-- Índice para busca parcial por external_order_id
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id_trgm 
  ON orders USING gin (external_order_id gin_trgm_ops)
  WHERE external_order_id IS NOT NULL;

-- Se a extensão pg_trgm não estiver disponível, usar índice BTREE
-- Este índice ainda permite ILIKE com performance razoável
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id_btree 
  ON orders (external_order_id)
  WHERE external_order_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN orders.doc_total IS 'Valor total do pedido (DocTotal do SAP)';
COMMENT ON COLUMN orders.currency IS 'Código da moeda do pedido (SAP)';
