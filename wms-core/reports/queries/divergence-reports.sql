-- ============================================================================
-- RELATÓRIOS DE DIVERGÊNCIAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- D1: Divergências de Contagem (Scan vs Esperado)
-- Objetivo: Identificar discrepâncias entre quantidade escaneada e esperada
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_scan_divergences AS
SELECT 
  t.id as task_id,
  t.order_id,
  o.external_order_id,
  t.type as task_type,
  t.assigned_to as operator_id,
  tl.sku,
  tl.quantity as expected_quantity,
  tl.scanned_quantity,
  (tl.quantity - tl.scanned_quantity) as divergence,
  
  -- Tipo de divergência
  CASE 
    WHEN tl.scanned_quantity > tl.quantity THEN 'EXCESSO'
    WHEN tl.scanned_quantity < tl.quantity THEN 'FALTA'
    ELSE 'OK'
  END as divergence_type,
  
  -- Percentual de divergência
  ROUND(
    ABS(tl.quantity - tl.scanned_quantity) * 100.0 / NULLIF(tl.quantity, 0),
    2
  ) as divergence_percentage,
  
  -- Severidade
  CASE 
    WHEN ABS(tl.quantity - tl.scanned_quantity) * 100.0 / NULLIF(tl.quantity, 0) >= 20 THEN 'CRÍTICA'
    WHEN ABS(tl.quantity - tl.scanned_quantity) * 100.0 / NULLIF(tl.quantity, 0) >= 10 THEN 'ALTA'
    WHEN ABS(tl.quantity - tl.scanned_quantity) * 100.0 / NULLIF(tl.quantity, 0) > 0 THEN 'MÉDIA'
    ELSE 'NENHUMA'
  END as severity,
  
  t.completed_at as occurred_at,
  
  -- Contexto adicional
  (
    SELECT COUNT(*) 
    FROM scan_events se 
    WHERE se.task_id = t.id AND se.type = 'PRODUCT_SCAN'
  ) as total_scans
  
FROM tasks t
JOIN task_lines tl ON tl.task_id = t.id
JOIN orders o ON o.id = t.order_id
WHERE t.status = 'COMPLETED'
  AND tl.quantity != tl.scanned_quantity
ORDER BY divergence_percentage DESC, t.completed_at DESC;

-- ----------------------------------------------------------------------------
-- D2: Análise de Divergências por SKU
-- Objetivo: Identificar produtos com maior taxa de erro
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_divergence_by_sku AS
SELECT 
  tl.sku,
  
  -- Estatísticas gerais
  COUNT(DISTINCT t.id) as total_tasks,
  SUM(tl.quantity) as total_expected,
  SUM(tl.scanned_quantity) as total_scanned,
  SUM(tl.quantity - tl.scanned_quantity) as total_divergence,
  
  -- Taxa de divergência
  COUNT(*) FILTER (WHERE tl.quantity != tl.scanned_quantity) as tasks_with_divergence,
  ROUND(
    COUNT(*) FILTER (WHERE tl.quantity != tl.scanned_quantity) * 100.0 / COUNT(*),
    2
  ) as divergence_rate,
  
  -- Tipos de divergência
  COUNT(*) FILTER (WHERE tl.scanned_quantity > tl.quantity) as excess_count,
  COUNT(*) FILTER (WHERE tl.scanned_quantity < tl.quantity) as shortage_count,
  
  -- Divergência média
  ROUND(AVG(ABS(tl.quantity - tl.scanned_quantity)), 2) as avg_divergence,
  
  -- Última ocorrência
  MAX(t.completed_at) as last_divergence_date
  
FROM tasks t
JOIN task_lines tl ON tl.task_id = t.id
WHERE t.status = 'COMPLETED'
GROUP BY tl.sku
HAVING COUNT(*) FILTER (WHERE tl.quantity != tl.scanned_quantity) > 0
ORDER BY divergence_rate DESC, tasks_with_divergence DESC;

-- ----------------------------------------------------------------------------
-- D3: Divergências por Operador
-- Objetivo: Identificar operadores com maior taxa de erro
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_divergence_by_operator AS
SELECT 
  t.assigned_to as operator_id,
  t.type as task_type,
  
  -- Estatísticas gerais
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT tl.sku) as unique_skus,
  
  -- Divergências
  COUNT(*) FILTER (WHERE tl.quantity != tl.scanned_quantity) as tasks_with_divergence,
  ROUND(
    COUNT(*) FILTER (WHERE tl.quantity != tl.scanned_quantity) * 100.0 / COUNT(*),
    2
  ) as divergence_rate,
  
  -- Acurácia
  ROUND(
    AVG(
      CASE 
        WHEN tl.quantity = 0 THEN 100
        ELSE LEAST(tl.scanned_quantity * 100.0 / tl.quantity, 100)
      END
    ),
    2
  ) as accuracy_rate,
  
  -- Tipos de divergência
  SUM(CASE WHEN tl.scanned_quantity > tl.quantity THEN 1 ELSE 0 END) as excess_count,
  SUM(CASE WHEN tl.scanned_quantity < tl.quantity THEN 1 ELSE 0 END) as shortage_count,
  
  -- Severidade
  COUNT(*) FILTER (
    WHERE ABS(tl.quantity - tl.scanned_quantity) * 100.0 / NULLIF(tl.quantity, 0) >= 20
  ) as critical_divergences,
  
  -- Período
  MIN(t.completed_at) as first_task_date,
  MAX(t.completed_at) as last_task_date
  
FROM tasks t
JOIN task_lines tl ON tl.task_id = t.id
WHERE t.status = 'COMPLETED'
  AND t.assigned_to IS NOT NULL
GROUP BY t.assigned_to, t.type
ORDER BY divergence_rate DESC, tasks_with_divergence DESC;

-- ----------------------------------------------------------------------------
-- D4: Ajustes de Inventário (Audit Trail)
-- Objetivo: Rastrear todos os ajustes manuais de inventário
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_inventory_adjustments_detail AS
SELECT 
  ia.id as adjustment_id,
  ia.adjustment_type,
  ia.sku,
  ia.location_code,
  l.zone,
  l.type as location_type,
  ia.lot_number,
  
  -- Quantidades
  ia.quantity_before,
  ia.quantity_after,
  ia.quantity_delta,
  
  -- Classificação
  CASE 
    WHEN ia.quantity_delta > 0 THEN 'ACRÉSCIMO'
    WHEN ia.quantity_delta < 0 THEN 'DECRÉSCIMO'
    ELSE 'SEM_ALTERAÇÃO'
  END as change_direction,
  
  -- Magnitude
  CASE 
    WHEN ABS(ia.quantity_delta) >= 100 THEN 'ALTO'
    WHEN ABS(ia.quantity_delta) >= 50 THEN 'MÉDIO'
    ELSE 'BAIXO'
  END as magnitude,
  
  ia.reason,
  ia.actor_id,
  ia.actor_role,
  ia.approved_by,
  ia.approved_at,
  ia.occurred_at,
  
  -- Status de aprovação
  CASE 
    WHEN ia.approved_by IS NOT NULL THEN 'APROVADO'
    WHEN ABS(ia.quantity_delta) >= 50 THEN 'PENDENTE_APROVAÇÃO'
    ELSE 'AUTO_APROVADO'
  END as approval_status
  
FROM inventory_adjustments ia
LEFT JOIN locations l ON l.id = ia.location_id
ORDER BY ia.occurred_at DESC;

-- ----------------------------------------------------------------------------
-- D5: Resumo de Ajustes por Período
-- Objetivo: Análise agregada de ajustes de inventário
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION report_adjustments_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  adjustment_type TEXT,
  total_adjustments BIGINT,
  unique_skus BIGINT,
  unique_locations BIGINT,
  total_units_added BIGINT,
  total_units_removed BIGINT,
  net_change BIGINT,
  avg_magnitude NUMERIC(10,2),
  pending_approval BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ia.adjustment_type,
    COUNT(*)::BIGINT as total_adjustments,
    COUNT(DISTINCT ia.sku)::BIGINT as unique_skus,
    COUNT(DISTINCT ia.location_id)::BIGINT as unique_locations,
    SUM(CASE WHEN ia.quantity_delta > 0 THEN ia.quantity_delta ELSE 0 END)::BIGINT as total_units_added,
    ABS(SUM(CASE WHEN ia.quantity_delta < 0 THEN ia.quantity_delta ELSE 0 END))::BIGINT as total_units_removed,
    SUM(ia.quantity_delta)::BIGINT as net_change,
    ROUND(AVG(ABS(ia.quantity_delta)), 2) as avg_magnitude,
    COUNT(*) FILTER (WHERE ia.approved_by IS NULL AND ABS(ia.quantity_delta) >= 50)::BIGINT as pending_approval
  FROM inventory_adjustments ia
  WHERE ia.occurred_at BETWEEN p_start_date AND p_end_date
  GROUP BY ia.adjustment_type
  ORDER BY total_adjustments DESC;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- D6: Divergências em Conferência (Double Check)
-- Objetivo: Identificar discrepâncias encontradas na conferência
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_checking_divergences AS
WITH picking_scans AS (
  SELECT 
    se.order_id,
    se.task_id,
    se.value as sku,
    SUM(COALESCE(se.quantity, 1)) as picked_quantity
  FROM scan_events se
  JOIN tasks t ON t.id = se.task_id
  WHERE se.type = 'PRODUCT_SCAN'
    AND t.type = 'PICKING'
  GROUP BY se.order_id, se.task_id, se.value
),
checking_scans AS (
  SELECT 
    se.order_id,
    se.value as sku,
    SUM(COALESCE(se.quantity, 1)) as checked_quantity
  FROM scan_events se
  JOIN tasks t ON t.id = se.task_id
  WHERE se.type = 'PRODUCT_SCAN'
    AND t.type = 'PACKING' -- Conferência durante embalagem
  GROUP BY se.order_id, se.value
)
SELECT 
  o.id as order_id,
  o.external_order_id,
  oi.sku,
  oi.quantity as expected_quantity,
  ps.picked_quantity,
  cs.checked_quantity,
  
  -- Divergências
  (oi.quantity - COALESCE(ps.picked_quantity, 0)) as picking_divergence,
  (COALESCE(ps.picked_quantity, 0) - COALESCE(cs.checked_quantity, 0)) as checking_divergence,
  
  -- Status
  CASE 
    WHEN COALESCE(ps.picked_quantity, 0) = oi.quantity 
      AND COALESCE(cs.checked_quantity, 0) = oi.quantity THEN 'OK'
    WHEN COALESCE(ps.picked_quantity, 0) != oi.quantity THEN 'DIVERGÊNCIA_PICKING'
    WHEN COALESCE(cs.checked_quantity, 0) != COALESCE(ps.picked_quantity, 0) THEN 'DIVERGÊNCIA_CONFERÊNCIA'
    ELSE 'VERIFICAR'
  END as status,
  
  -- Timestamps
  (SELECT MAX(occurred_at) FROM scan_events WHERE order_id = o.id AND type = 'PRODUCT_SCAN') as last_scan,
  
  -- Operadores envolvidos
  (SELECT STRING_AGG(DISTINCT actor_id, ', ') FROM scan_events WHERE order_id = o.id) as operators_involved
  
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN picking_scans ps ON ps.order_id = o.id AND ps.sku = oi.sku
LEFT JOIN checking_scans cs ON cs.order_id = o.id AND cs.sku = oi.sku
WHERE o.status IN ('CONFERIDO', 'AGUARDANDO_COTACAO', 'AGUARDANDO_COLETA', 'DESPACHADO')
  AND (
    COALESCE(ps.picked_quantity, 0) != oi.quantity
    OR COALESCE(cs.checked_quantity, 0) != COALESCE(ps.picked_quantity, 0)
  )
ORDER BY last_scan DESC;

-- ----------------------------------------------------------------------------
-- D7: Taxa de Acurácia Geral do Sistema
-- Objetivo: KPI de acurácia operacional
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION report_accuracy_kpi(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  period TEXT,
  total_tasks BIGINT,
  perfect_tasks BIGINT,
  tasks_with_minor_divergence BIGINT,
  tasks_with_major_divergence BIGINT,
  overall_accuracy NUMERIC(5,2),
  perfect_rate NUMERIC(5,2),
  minor_divergence_rate NUMERIC(5,2),
  major_divergence_rate NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH task_accuracy AS (
    SELECT 
      t.id,
      t.completed_at,
      SUM(tl.quantity) as total_expected,
      SUM(tl.scanned_quantity) as total_scanned,
      MAX(ABS(tl.quantity - tl.scanned_quantity) * 100.0 / NULLIF(tl.quantity, 0)) as max_divergence_pct
    FROM tasks t
    JOIN task_lines tl ON tl.task_id = t.id
    WHERE t.status = 'COMPLETED'
      AND t.completed_at BETWEEN p_start_date AND p_end_date
    GROUP BY t.id, t.completed_at
  )
  SELECT 
    TO_CHAR(p_start_date, 'YYYY-MM-DD') || ' a ' || TO_CHAR(p_end_date, 'YYYY-MM-DD') as period,
    COUNT(*)::BIGINT as total_tasks,
    COUNT(*) FILTER (WHERE max_divergence_pct = 0)::BIGINT as perfect_tasks,
    COUNT(*) FILTER (WHERE max_divergence_pct > 0 AND max_divergence_pct < 10)::BIGINT as tasks_with_minor_divergence,
    COUNT(*) FILTER (WHERE max_divergence_pct >= 10)::BIGINT as tasks_with_major_divergence,
    ROUND(AVG(LEAST(total_scanned * 100.0 / NULLIF(total_expected, 0), 100)), 2) as overall_accuracy,
    ROUND(COUNT(*) FILTER (WHERE max_divergence_pct = 0) * 100.0 / COUNT(*), 2) as perfect_rate,
    ROUND(COUNT(*) FILTER (WHERE max_divergence_pct > 0 AND max_divergence_pct < 10) * 100.0 / COUNT(*), 2) as minor_divergence_rate,
    ROUND(COUNT(*) FILTER (WHERE max_divergence_pct >= 10) * 100.0 / COUNT(*), 2) as major_divergence_rate
  FROM task_accuracy;
END;
$$ LANGUAGE plpgsql;

COMMENT ON VIEW report_scan_divergences IS 'Divergências detalhadas entre quantidades esperadas e escaneadas';
COMMENT ON VIEW report_divergence_by_sku IS 'Análise de divergências agrupadas por produto';
COMMENT ON VIEW report_divergence_by_operator IS 'Análise de divergências agrupadas por operador';
COMMENT ON VIEW report_inventory_adjustments_detail IS 'Detalhamento de todos os ajustes de inventário';
COMMENT ON FUNCTION report_adjustments_summary IS 'Resumo agregado de ajustes de inventário por período';
COMMENT ON VIEW report_checking_divergences IS 'Divergências encontradas no processo de conferência';
COMMENT ON FUNCTION report_accuracy_kpi IS 'KPI de acurácia operacional do sistema';
