-- ============================================================================
-- EXEMPLOS DE QUERIES ÚTEIS
-- Casos de uso comuns para análise de dados do WMS
-- ============================================================================

-- ============================================================================
-- 1. DASHBOARD EXECUTIVO - VISÃO GERAL
-- ============================================================================

-- KPIs do dia
WITH today_stats AS (
  SELECT 
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'DESPACHADO') as dispatched_orders,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'EM_SEPARACAO') as in_progress_orders,
    COUNT(DISTINCT t.id) FILTER (WHERE t.type = 'PICKING' AND t.status = 'COMPLETED') as completed_picks,
    SUM(oi.quantity) as total_units
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN tasks t ON t.order_id = o.id
  WHERE o.created_at >= CURRENT_DATE
),
sla_stats AS (
  SELECT 
    COUNT(*) as total_with_sla,
    COUNT(*) FILTER (WHERE sla_status = 'DENTRO_SLA') as within_sla,
    AVG(total_duration_hours) as avg_duration
  FROM report_sla_end_to_end
  WHERE order_created_at >= CURRENT_DATE
)
SELECT 
  t.*,
  s.within_sla * 100.0 / NULLIF(s.total_with_sla, 0) as sla_compliance_pct,
  s.avg_duration as avg_order_hours
FROM today_stats t
CROSS JOIN sla_stats s;

-- ============================================================================
-- 2. ANÁLISE DE OPERADORES - QUEM ESTÁ TRABALHANDO AGORA
-- ============================================================================

SELECT 
  t.assigned_to as operator_id,
  t.type as current_task_type,
  COUNT(*) as active_tasks,
  MIN(t.started_at) as working_since,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(t.started_at))) / 3600, 2) as hours_working,
  STRING_AGG(DISTINCT o.external_order_id, ', ') as current_orders
FROM tasks t
JOIN orders o ON o.id = t.order_id
WHERE t.status = 'IN_PROGRESS'
  AND t.started_at IS NOT NULL
GROUP BY t.assigned_to, t.type
ORDER BY working_since;

-- ============================================================================
-- 3. GARGALOS - ONDE ESTÃO OS ATRASOS
-- ============================================================================

-- Pedidos parados há mais tempo em cada etapa
WITH order_age_by_status AS (
  SELECT 
    o.id,
    o.external_order_id,
    o.status,
    o.customer_id,
    COUNT(DISTINCT oi.id) as item_count,
    SUM(oi.quantity) as unit_count,
    ROUND(EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 3600, 2) as hours_in_current_status,
    o.updated_at as last_update,
    ROW_NUMBER() OVER (PARTITION BY o.status ORDER BY o.updated_at) as rank_in_status
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status NOT IN ('DESPACHADO')
  GROUP BY o.id, o.external_order_id, o.status, o.customer_id, o.updated_at
)
SELECT 
  status,
  COUNT(*) as orders_in_status,
  AVG(hours_in_current_status) as avg_hours,
  MAX(hours_in_current_status) as max_hours,
  SUM(unit_count) as total_units_pending
FROM order_age_by_status
GROUP BY status
ORDER BY avg_hours DESC;

-- Pedidos mais antigos por status (top 5 de cada)
WITH ranked_orders AS (
  SELECT 
    o.id,
    o.external_order_id,
    o.status,
    o.customer_id,
    ROUND(EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 3600, 2) as hours_waiting,
    COUNT(DISTINCT oi.id) as items,
    ROW_NUMBER() OVER (PARTITION BY o.status ORDER BY o.updated_at) as rank
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status NOT IN ('DESPACHADO')
  GROUP BY o.id, o.external_order_id, o.status, o.customer_id, o.updated_at
)
SELECT * FROM ranked_orders
WHERE rank <= 5
ORDER BY status, rank;

-- ============================================================================
-- 4. ANÁLISE DE ACURÁCIA - QUALIDADE OPERACIONAL
-- ============================================================================

-- Acurácia por operador na última semana
SELECT 
  t.assigned_to as operator_id,
  t.type as task_type,
  COUNT(DISTINCT t.id) as total_tasks,
  SUM(tl.quantity) as expected_units,
  SUM(tl.scanned_quantity) as scanned_units,
  ROUND(SUM(tl.scanned_quantity) * 100.0 / NULLIF(SUM(tl.quantity), 0), 2) as accuracy_pct,
  COUNT(*) FILTER (WHERE tl.quantity != tl.scanned_quantity) as tasks_with_errors,
  ROUND(COUNT(*) FILTER (WHERE tl.quantity != tl.scanned_quantity) * 100.0 / COUNT(*), 2) as error_rate_pct
FROM tasks t
JOIN task_lines tl ON tl.task_id = t.id
WHERE t.status = 'COMPLETED'
  AND t.completed_at >= CURRENT_DATE - INTERVAL '7 days'
  AND t.assigned_to IS NOT NULL
GROUP BY t.assigned_to, t.type
HAVING COUNT(DISTINCT t.id) >= 5
ORDER BY accuracy_pct DESC;

-- ============================================================================
-- 5. ANÁLISE DE INVENTÁRIO - SITUAÇÃO ATUAL
-- ============================================================================

-- Inventário total por zona
SELECT 
  l.zone,
  COUNT(DISTINCT l.id) as locations,
  COUNT(DISTINCT la.sku) as unique_skus,
  SUM(la.quantity) as total_units,
  SUM(la.reserved_quantity) as reserved_units,
  SUM(la.available_quantity) as available_units,
  ROUND(SUM(la.reserved_quantity) * 100.0 / NULLIF(SUM(la.quantity), 0), 2) as reservation_rate_pct
FROM locations l
LEFT JOIN location_assignments la ON la.location_id = l.id
WHERE l.is_active = true
  AND l.is_blocked = false
GROUP BY l.zone
ORDER BY total_units DESC;

-- SKUs com baixo estoque (menos de 10 unidades disponíveis)
SELECT 
  la.sku,
  SUM(la.quantity) as total_qty,
  SUM(la.reserved_quantity) as reserved_qty,
  SUM(la.available_quantity) as available_qty,
  COUNT(DISTINCT la.location_id) as locations_count,
  STRING_AGG(DISTINCT l.code, ', ') as location_codes
FROM location_assignments la
JOIN locations l ON l.id = la.location_id
WHERE l.is_active = true
GROUP BY la.sku
HAVING SUM(la.available_quantity) < 10
  AND SUM(la.available_quantity) > 0
ORDER BY available_qty;

-- Produtos vencidos ou próximos do vencimento
SELECT 
  la.sku,
  l.code as location,
  l.zone,
  la.quantity,
  la.lot_number,
  la.expiration_date,
  la.expiration_date - CURRENT_DATE as days_to_expire,
  CASE 
    WHEN la.expiration_date < CURRENT_DATE THEN 'VENCIDO'
    WHEN la.expiration_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'URGENTE'
    WHEN la.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'ATENÇÃO'
    ELSE 'OK'
  END as status
FROM location_assignments la
JOIN locations l ON l.id = la.location_id
WHERE la.expiration_date IS NOT NULL
  AND la.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
  AND l.is_active = true
ORDER BY la.expiration_date;

-- ============================================================================
-- 6. ANÁLISE DE MOVIMENTAÇÕES - ATIVIDADE RECENTE
-- ============================================================================

-- Movimentações por hora (últimas 24h)
SELECT 
  DATE_TRUNC('hour', lm.occurred_at) as hour,
  lm.movement_type,
  COUNT(*) as total_movements,
  SUM(lm.quantity) as total_units,
  COUNT(DISTINCT lm.actor_id) as unique_operators
FROM location_movements lm
WHERE lm.occurred_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', lm.occurred_at), lm.movement_type
ORDER BY hour DESC, total_units DESC;

-- Localizações mais movimentadas
SELECT 
  COALESCE(lm.from_location_code, lm.to_location_code) as location,
  l.zone,
  l.type,
  COUNT(*) as movement_count,
  SUM(lm.quantity) as total_units,
  COUNT(DISTINCT lm.sku) as unique_skus
FROM location_movements lm
LEFT JOIN locations l ON (
  l.id = lm.from_location_id OR l.id = lm.to_location_id
)
WHERE lm.occurred_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(lm.from_location_code, lm.to_location_code), l.zone, l.type
ORDER BY movement_count DESC
LIMIT 20;

-- ============================================================================
-- 7. ANÁLISE DE AJUSTES - PERDAS E GANHOS
-- ============================================================================

-- Resumo de ajustes do mês atual
SELECT 
  ia.adjustment_type,
  COUNT(*) as total_adjustments,
  SUM(CASE WHEN ia.quantity_delta > 0 THEN ia.quantity_delta ELSE 0 END) as total_gains,
  ABS(SUM(CASE WHEN ia.quantity_delta < 0 THEN ia.quantity_delta ELSE 0 END)) as total_losses,
  SUM(ia.quantity_delta) as net_change,
  COUNT(DISTINCT ia.sku) as affected_skus
FROM inventory_adjustments ia
WHERE DATE_TRUNC('month', ia.occurred_at) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY ia.adjustment_type
ORDER BY total_adjustments DESC;

-- Ajustes pendentes de aprovação
SELECT 
  ia.id,
  ia.adjustment_type,
  ia.sku,
  ia.location_code,
  ia.quantity_delta,
  ia.reason,
  ia.actor_id,
  ia.occurred_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - ia.occurred_at)) / 3600, 2) as hours_pending
FROM inventory_adjustments ia
WHERE ia.approved_by IS NULL
  AND ABS(ia.quantity_delta) >= 50
ORDER BY ABS(ia.quantity_delta) DESC;

-- ============================================================================
-- 8. COMPARATIVO TEMPORAL - ESTA SEMANA VS SEMANA PASSADA
-- ============================================================================

WITH this_week AS (
  SELECT 
    COUNT(DISTINCT o.id) as orders,
    SUM(oi.quantity) as units,
    AVG(sla.total_duration_hours) as avg_duration
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN report_sla_end_to_end sla ON sla.order_id = o.id
  WHERE o.created_at >= DATE_TRUNC('week', CURRENT_DATE)
),
last_week AS (
  SELECT 
    COUNT(DISTINCT o.id) as orders,
    SUM(oi.quantity) as units,
    AVG(sla.total_duration_hours) as avg_duration
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN report_sla_end_to_end sla ON sla.order_id = o.id
  WHERE o.created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
    AND o.created_at < DATE_TRUNC('week', CURRENT_DATE)
)
SELECT 
  'Esta Semana' as period,
  tw.orders,
  tw.units,
  ROUND(tw.avg_duration, 2) as avg_duration_hours,
  ROUND((tw.orders - lw.orders) * 100.0 / NULLIF(lw.orders, 0), 2) as orders_change_pct,
  ROUND((tw.units - lw.units) * 100.0 / NULLIF(lw.units, 0), 2) as units_change_pct
FROM this_week tw
CROSS JOIN last_week lw
UNION ALL
SELECT 
  'Semana Passada',
  lw.orders,
  lw.units,
  ROUND(lw.avg_duration, 2),
  NULL,
  NULL
FROM last_week lw;

-- ============================================================================
-- 9. ANÁLISE DE CLIENTES - TOP CLIENTES
-- ============================================================================

SELECT 
  o.customer_id,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'DESPACHADO') as dispatched_orders,
  SUM(oi.quantity) as total_units,
  ROUND(AVG(sla.total_duration_hours), 2) as avg_processing_hours,
  MAX(o.created_at) as last_order_date
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN report_sla_end_to_end sla ON sla.order_id = o.id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY o.customer_id
ORDER BY total_orders DESC
LIMIT 20;

-- ============================================================================
-- 10. ALERTAS E NOTIFICAÇÕES
-- ============================================================================

-- Todos os alertas importantes do momento
SELECT 'PEDIDO_EM_RISCO' as alert_type, 
       order_id::TEXT as reference_id,
       CONCAT('Pedido ', external_order_id, ' - Risco: ', risk_level) as message,
       sla_consumed_percentage as severity_score
FROM report_orders_at_risk
WHERE risk_level IN ('CRÍTICO', 'ALTO')

UNION ALL

SELECT 'DIVERGÊNCIA_CRÍTICA',
       task_id::TEXT,
       CONCAT('SKU ', sku, ' - Divergência: ', divergence, ' unidades'),
       divergence_percentage
FROM report_scan_divergences
WHERE severity = 'CRÍTICA'
  AND occurred_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 'AJUSTE_PENDENTE',
       id::TEXT,
       CONCAT('Ajuste de ', ABS(quantity_delta), ' unidades do SKU ', sku),
       ABS(quantity_delta)
FROM inventory_adjustments
WHERE approved_by IS NULL
  AND ABS(quantity_delta) >= 50
  AND occurred_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 'PRODUTO_VENCIDO',
       sku,
       CONCAT('SKU ', sku, ' vencido em ', location_code, ' - ', quantity, ' unidades'),
       quantity
FROM location_assignments la
JOIN locations l ON l.id = la.location_id
WHERE la.expiration_date < CURRENT_DATE
  AND la.quantity > 0

ORDER BY severity_score DESC
LIMIT 50;

-- ============================================================================
-- FIM DOS EXEMPLOS
-- ============================================================================
