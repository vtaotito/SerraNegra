-- ============================================================================
-- RELATÓRIOS DE PRODUTIVIDADE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- P1: Produtividade Individual de Separadores (Pickers)
-- Objetivo: Medir performance de cada separador
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_picker_productivity AS
SELECT 
  t.assigned_to as picker_id,
  DATE(t.completed_at) as work_date,
  
  -- Quantidade de tarefas
  COUNT(DISTINCT t.id) as tasks_completed,
  
  -- Quantidade de pedidos
  COUNT(DISTINCT t.order_id) as orders_completed,
  
  -- Quantidade total de itens separados
  SUM(tl.quantity) as total_units_picked,
  
  -- Quantidade de SKUs únicos
  COUNT(DISTINCT tl.sku) as unique_skus,
  
  -- Tempo total trabalhado (soma de todas as tarefas)
  ROUND(SUM(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 3600, 2) as total_hours,
  
  -- Produtividade: unidades por hora
  ROUND(
    SUM(tl.quantity) / NULLIF(SUM(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 3600, 0),
    2
  ) as units_per_hour,
  
  -- Tempo médio por tarefa (em minutos)
  ROUND(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60, 2) as avg_minutes_per_task,
  
  -- Tempo médio por pedido (em minutos)
  ROUND(
    SUM(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60 / 
    NULLIF(COUNT(DISTINCT t.order_id), 0),
    2
  ) as avg_minutes_per_order,
  
  -- Taxa de acurácia (baseada em scans)
  ROUND(
    AVG(tl.scanned_quantity * 100.0 / NULLIF(tl.quantity, 0)),
    2
  ) as accuracy_percentage
  
FROM tasks t
JOIN task_lines tl ON tl.task_id = t.id
WHERE t.type = 'PICKING'
  AND t.status = 'COMPLETED'
  AND t.assigned_to IS NOT NULL
  AND t.started_at IS NOT NULL
  AND t.completed_at IS NOT NULL
GROUP BY t.assigned_to, DATE(t.completed_at)
ORDER BY work_date DESC, total_units_picked DESC;

-- ----------------------------------------------------------------------------
-- P2: Ranking de Produtividade dos Separadores
-- Objetivo: Comparar performance entre separadores
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION report_picker_ranking(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  ranking INTEGER,
  picker_id TEXT,
  total_orders BIGINT,
  total_units BIGINT,
  total_hours NUMERIC(10,2),
  units_per_hour NUMERIC(10,2),
  avg_accuracy NUMERIC(5,2),
  performance_score NUMERIC(10,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH picker_stats AS (
    SELECT 
      t.assigned_to,
      COUNT(DISTINCT t.order_id)::BIGINT as orders_count,
      SUM(tl.quantity)::BIGINT as units_count,
      SUM(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 3600 as hours_worked,
      SUM(tl.quantity) / NULLIF(SUM(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 3600, 0) as productivity,
      AVG(tl.scanned_quantity * 100.0 / NULLIF(tl.quantity, 0)) as accuracy
    FROM tasks t
    JOIN task_lines tl ON tl.task_id = t.id
    WHERE t.type = 'PICKING'
      AND t.status = 'COMPLETED'
      AND t.assigned_to IS NOT NULL
      AND t.completed_at BETWEEN p_start_date AND p_end_date
    GROUP BY t.assigned_to
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY 
      (COALESCE(productivity, 0) * 0.6 + COALESCE(accuracy, 0) * 0.4) DESC
    )::INTEGER as ranking,
    assigned_to as picker_id,
    orders_count as total_orders,
    units_count as total_units,
    ROUND(hours_worked, 2) as total_hours,
    ROUND(productivity, 2) as units_per_hour,
    ROUND(accuracy, 2) as avg_accuracy,
    ROUND(productivity * 0.6 + accuracy * 0.4, 2) as performance_score
  FROM picker_stats
  WHERE hours_worked > 0
  ORDER BY performance_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- P3: Produtividade de Conferentes (Checkers)
-- Objetivo: Medir performance dos conferentes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_checker_productivity AS
SELECT 
  ot.actor_id as checker_id,
  DATE(ot.occurred_at) as work_date,
  
  -- Quantidade de pedidos conferidos
  COUNT(DISTINCT ot.order_id) as orders_checked,
  
  -- Quantidade total de itens conferidos
  SUM(oi.quantity) as total_units_checked,
  
  -- Primeira e última conferência do dia
  MIN(ot.occurred_at) as first_check,
  MAX(ot.occurred_at) as last_check,
  
  -- Tempo total de trabalho (horas)
  ROUND(
    EXTRACT(EPOCH FROM (MAX(ot.occurred_at) - MIN(ot.occurred_at))) / 3600,
    2
  ) as work_hours,
  
  -- Pedidos por hora
  ROUND(
    COUNT(DISTINCT ot.order_id) / 
    NULLIF(EXTRACT(EPOCH FROM (MAX(ot.occurred_at) - MIN(ot.occurred_at))) / 3600, 0),
    2
  ) as orders_per_hour,
  
  -- Tempo médio por pedido (minutos)
  ROUND(
    EXTRACT(EPOCH FROM (MAX(ot.occurred_at) - MIN(ot.occurred_at))) / 60 /
    NULLIF(COUNT(DISTINCT ot.order_id), 0),
    2
  ) as avg_minutes_per_order
  
FROM order_transitions ot
JOIN orders o ON o.id = ot.order_id
JOIN order_items oi ON oi.order_id = o.id
WHERE ot.event_type = 'CONFERIR'
  AND ot.actor_role = 'CHECKER'
GROUP BY ot.actor_id, DATE(ot.occurred_at)
ORDER BY work_date DESC, orders_checked DESC;

-- ----------------------------------------------------------------------------
-- P4: Produtividade por Zona/Endereço
-- Objetivo: Identificar gargalos operacionais por área
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_productivity_by_zone AS
SELECT 
  l.zone,
  l.type as location_type,
  DATE(lm.occurred_at) as movement_date,
  
  -- Quantidade de movimentações
  COUNT(*) as total_movements,
  
  -- Quantidade de unidades movimentadas
  SUM(lm.quantity) as total_units,
  
  -- SKUs únicos movimentados
  COUNT(DISTINCT lm.sku) as unique_skus,
  
  -- Operadores únicos na zona
  COUNT(DISTINCT lm.actor_id) as unique_operators,
  
  -- Média de unidades por movimentação
  ROUND(AVG(lm.quantity), 2) as avg_units_per_movement,
  
  -- Distribuição por tipo de movimentação
  COUNT(*) FILTER (WHERE lm.movement_type = 'PICKING') as picking_movements,
  COUNT(*) FILTER (WHERE lm.movement_type = 'REPLENISHMENT') as replenishment_movements,
  COUNT(*) FILTER (WHERE lm.movement_type = 'TRANSFER') as transfer_movements,
  COUNT(*) FILTER (WHERE lm.movement_type = 'PUTAWAY') as putaway_movements
  
FROM location_movements lm
LEFT JOIN locations l ON l.id = lm.from_location_id OR l.id = lm.to_location_id
WHERE l.zone IS NOT NULL
GROUP BY l.zone, l.type, DATE(lm.occurred_at)
ORDER BY movement_date DESC, total_units DESC;

-- ----------------------------------------------------------------------------
-- P5: Tempo de Ciclo por Tipo de Tarefa
-- Objetivo: Medir eficiência operacional por tipo de tarefa
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_task_cycle_time AS
SELECT 
  t.type as task_type,
  DATE(t.completed_at) as completion_date,
  
  -- Estatísticas de tempo
  COUNT(*) as tasks_completed,
  
  ROUND(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60, 2) as avg_cycle_minutes,
  ROUND(MIN(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60, 2) as min_cycle_minutes,
  ROUND(MAX(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60, 2) as max_cycle_minutes,
  
  -- Percentis
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60, 2) as p50_cycle_minutes,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60, 2) as p90_cycle_minutes,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 60, 2) as p95_cycle_minutes,
  
  -- Estatísticas de quantidade
  SUM(tl.quantity) as total_units,
  ROUND(AVG(tl.quantity), 2) as avg_units_per_task,
  
  -- Operadores
  COUNT(DISTINCT t.assigned_to) as unique_operators
  
FROM tasks t
JOIN task_lines tl ON tl.task_id = t.id
WHERE t.status = 'COMPLETED'
  AND t.started_at IS NOT NULL
  AND t.completed_at IS NOT NULL
GROUP BY t.type, DATE(t.completed_at)
ORDER BY completion_date DESC, task_type;

-- ----------------------------------------------------------------------------
-- P6: Utilização de Recursos (Operadores)
-- Objetivo: Medir taxa de ocupação dos operadores
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION report_operator_utilization(
  p_date DATE
)
RETURNS TABLE (
  operator_id TEXT,
  operator_role TEXT,
  total_tasks BIGINT,
  active_hours NUMERIC(10,2),
  idle_hours NUMERIC(10,2),
  utilization_rate NUMERIC(5,2),
  first_activity TIMESTAMPTZ,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH operator_activity AS (
    SELECT 
      t.assigned_to,
      MAX(ot.actor_role) as role,
      COUNT(DISTINCT t.id) as task_count,
      MIN(t.started_at) as first_start,
      MAX(t.completed_at) as last_end,
      SUM(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) / 3600 as active_time
    FROM tasks t
    LEFT JOIN order_transitions ot ON ot.actor_id = t.assigned_to
    WHERE DATE(t.completed_at) = p_date
      AND t.status = 'COMPLETED'
      AND t.assigned_to IS NOT NULL
    GROUP BY t.assigned_to
  ),
  total_time AS (
    SELECT 
      assigned_to,
      active_time,
      EXTRACT(EPOCH FROM (last_end - first_start)) / 3600 as total_span
    FROM operator_activity
  )
  SELECT 
    oa.assigned_to as operator_id,
    oa.role as operator_role,
    oa.task_count::BIGINT as total_tasks,
    ROUND(oa.active_time, 2) as active_hours,
    ROUND(tt.total_span - oa.active_time, 2) as idle_hours,
    ROUND((oa.active_time / NULLIF(tt.total_span, 0)) * 100, 2) as utilization_rate,
    oa.first_start as first_activity,
    oa.last_end as last_activity
  FROM operator_activity oa
  JOIN total_time tt ON tt.assigned_to = oa.assigned_to
  ORDER BY utilization_rate DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON VIEW report_picker_productivity IS 'Produtividade individual dos separadores';
COMMENT ON FUNCTION report_picker_ranking IS 'Ranking de performance dos separadores';
COMMENT ON VIEW report_checker_productivity IS 'Produtividade dos conferentes';
COMMENT ON VIEW report_productivity_by_zone IS 'Produtividade por zona do armazém';
COMMENT ON VIEW report_task_cycle_time IS 'Tempo de ciclo por tipo de tarefa';
COMMENT ON FUNCTION report_operator_utilization IS 'Taxa de utilização dos operadores';
