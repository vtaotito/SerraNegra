-- ============================================================================
-- RELATÓRIOS DE SLA (Service Level Agreement)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- R1: SLA de Tempo de Separação (Lead Time da Separação)
-- Objetivo: Medir tempo entre criação do pedido e finalização da separação
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_sla_picking_time AS
SELECT 
  o.id as order_id,
  o.external_order_id,
  o.customer_id,
  o.created_at as order_created_at,
  
  -- Início da separação
  t_inicio.occurred_at as picking_started_at,
  
  -- Fim da separação
  t_fim.occurred_at as picking_completed_at,
  
  -- Tempo de separação (em minutos)
  EXTRACT(EPOCH FROM (t_fim.occurred_at - t_inicio.occurred_at)) / 60 as picking_duration_minutes,
  
  -- Tempo desde criação até início separação
  EXTRACT(EPOCH FROM (t_inicio.occurred_at - o.created_at)) / 60 as wait_time_minutes,
  
  -- SLA Status (exemplo: SLA de 120 minutos)
  CASE 
    WHEN EXTRACT(EPOCH FROM (t_fim.occurred_at - t_inicio.occurred_at)) / 60 <= 120 THEN 'DENTRO_SLA'
    WHEN EXTRACT(EPOCH FROM (t_fim.occurred_at - t_inicio.occurred_at)) / 60 <= 180 THEN 'ALERTA'
    ELSE 'FORA_SLA'
  END as sla_status,
  
  -- Quantidade de itens
  COUNT(DISTINCT oi.id) as total_items,
  SUM(oi.quantity) as total_units
  
FROM orders o
LEFT JOIN order_transitions t_inicio 
  ON t_inicio.order_id = o.id 
  AND t_inicio.event_type = 'INICIAR_SEPARACAO'
LEFT JOIN order_transitions t_fim 
  ON t_fim.order_id = o.id 
  AND t_fim.event_type = 'FINALIZAR_SEPARACAO'
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE t_inicio.occurred_at IS NOT NULL
  AND t_fim.occurred_at IS NOT NULL
GROUP BY o.id, o.external_order_id, o.customer_id, o.created_at, 
         t_inicio.occurred_at, t_fim.occurred_at;

-- ----------------------------------------------------------------------------
-- R2: SLA de Conferência
-- Objetivo: Tempo entre fim de separação e conferência
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_sla_checking_time AS
SELECT 
  o.id as order_id,
  o.external_order_id,
  
  t_separacao.occurred_at as picking_completed_at,
  t_conferencia.occurred_at as checking_completed_at,
  
  -- Tempo de conferência (em minutos)
  EXTRACT(EPOCH FROM (t_conferencia.occurred_at - t_separacao.occurred_at)) / 60 as checking_duration_minutes,
  
  -- SLA Status (exemplo: SLA de 30 minutos)
  CASE 
    WHEN EXTRACT(EPOCH FROM (t_conferencia.occurred_at - t_separacao.occurred_at)) / 60 <= 30 THEN 'DENTRO_SLA'
    WHEN EXTRACT(EPOCH FROM (t_conferencia.occurred_at - t_separacao.occurred_at)) / 60 <= 60 THEN 'ALERTA'
    ELSE 'FORA_SLA'
  END as sla_status,
  
  t_conferencia.actor_id as checker_id
  
FROM orders o
JOIN order_transitions t_separacao 
  ON t_separacao.order_id = o.id 
  AND t_separacao.event_type = 'FINALIZAR_SEPARACAO'
JOIN order_transitions t_conferencia 
  ON t_conferencia.order_id = o.id 
  AND t_conferencia.event_type = 'CONFERIR'
WHERE t_separacao.occurred_at IS NOT NULL
  AND t_conferencia.occurred_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- R3: SLA End-to-End (Criação até Despacho)
-- Objetivo: Tempo total desde criação do pedido até despacho
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_sla_end_to_end AS
SELECT 
  o.id as order_id,
  o.external_order_id,
  o.customer_id,
  o.created_at as order_created_at,
  
  t_despacho.occurred_at as dispatched_at,
  
  -- Tempo total (em horas)
  EXTRACT(EPOCH FROM (t_despacho.occurred_at - o.created_at)) / 3600 as total_duration_hours,
  
  -- SLA Status (exemplo: SLA de 24 horas)
  CASE 
    WHEN EXTRACT(EPOCH FROM (t_despacho.occurred_at - o.created_at)) / 3600 <= 24 THEN 'DENTRO_SLA'
    WHEN EXTRACT(EPOCH FROM (t_despacho.occurred_at - o.created_at)) / 3600 <= 48 THEN 'ALERTA'
    ELSE 'FORA_SLA'
  END as sla_status,
  
  -- Todos os marcos importantes
  t1.occurred_at as picking_started,
  t2.occurred_at as picking_completed,
  t3.occurred_at as checked,
  t4.occurred_at as quote_requested,
  t5.occurred_at as ready_for_pickup,
  
  COUNT(DISTINCT oi.id) as total_items,
  SUM(oi.quantity) as total_units
  
FROM orders o
LEFT JOIN order_transitions t_despacho 
  ON t_despacho.order_id = o.id 
  AND t_despacho.event_type = 'DESPACHAR'
LEFT JOIN order_transitions t1 ON t1.order_id = o.id AND t1.event_type = 'INICIAR_SEPARACAO'
LEFT JOIN order_transitions t2 ON t2.order_id = o.id AND t2.event_type = 'FINALIZAR_SEPARACAO'
LEFT JOIN order_transitions t3 ON t3.order_id = o.id AND t3.event_type = 'CONFERIR'
LEFT JOIN order_transitions t4 ON t4.order_id = o.id AND t4.event_type = 'SOLICITAR_COTACAO'
LEFT JOIN order_transitions t5 ON t5.order_id = o.id AND t5.event_type = 'AGUARDAR_COLETA'
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE t_despacho.occurred_at IS NOT NULL
GROUP BY o.id, o.external_order_id, o.customer_id, o.created_at,
         t_despacho.occurred_at, t1.occurred_at, t2.occurred_at,
         t3.occurred_at, t4.occurred_at, t5.occurred_at;

-- ----------------------------------------------------------------------------
-- R4: Dashboard SLA - Resumo por Período
-- Objetivo: Agregação de performance por dia/semana/mês
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION report_sla_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_group_by TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE (
  period TEXT,
  total_orders BIGINT,
  within_sla BIGINT,
  within_sla_percentage NUMERIC(5,2),
  alert_sla BIGINT,
  alert_sla_percentage NUMERIC(5,2),
  outside_sla BIGINT,
  outside_sla_percentage NUMERIC(5,2),
  avg_duration_hours NUMERIC(10,2),
  min_duration_hours NUMERIC(10,2),
  max_duration_hours NUMERIC(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE p_group_by
      WHEN 'day' THEN TO_CHAR(o.created_at, 'YYYY-MM-DD')
      WHEN 'week' THEN TO_CHAR(DATE_TRUNC('week', o.created_at), 'YYYY-MM-DD')
      WHEN 'month' THEN TO_CHAR(DATE_TRUNC('month', o.created_at), 'YYYY-MM')
    END as period,
    
    COUNT(*)::BIGINT as total_orders,
    
    COUNT(*) FILTER (WHERE sla.sla_status = 'DENTRO_SLA')::BIGINT as within_sla,
    ROUND(COUNT(*) FILTER (WHERE sla.sla_status = 'DENTRO_SLA') * 100.0 / COUNT(*), 2) as within_sla_percentage,
    
    COUNT(*) FILTER (WHERE sla.sla_status = 'ALERTA')::BIGINT as alert_sla,
    ROUND(COUNT(*) FILTER (WHERE sla.sla_status = 'ALERTA') * 100.0 / COUNT(*), 2) as alert_sla_percentage,
    
    COUNT(*) FILTER (WHERE sla.sla_status = 'FORA_SLA')::BIGINT as outside_sla,
    ROUND(COUNT(*) FILTER (WHERE sla.sla_status = 'FORA_SLA') * 100.0 / COUNT(*), 2) as outside_sla_percentage,
    
    ROUND(AVG(sla.total_duration_hours), 2) as avg_duration_hours,
    ROUND(MIN(sla.total_duration_hours), 2) as min_duration_hours,
    ROUND(MAX(sla.total_duration_hours), 2) as max_duration_hours
    
  FROM orders o
  JOIN report_sla_end_to_end sla ON sla.order_id = o.id
  WHERE o.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY period
  ORDER BY period DESC;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- R5: Pedidos em Risco (alertas de SLA)
-- Objetivo: Identificar pedidos que estão próximos de estourar SLA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_orders_at_risk AS
SELECT 
  o.id as order_id,
  o.external_order_id,
  o.customer_id,
  o.status,
  o.created_at,
  
  -- Tempo decorrido desde criação
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 as hours_since_created,
  
  -- SLA esperado por status
  CASE o.status
    WHEN 'A_SEPARAR' THEN 2 -- 2 horas para iniciar
    WHEN 'EM_SEPARACAO' THEN 4 -- 4 horas para separar
    WHEN 'CONFERIDO' THEN 24 -- 24 horas para despachar
    ELSE 48
  END as sla_hours,
  
  -- Percentual de SLA consumido
  ROUND(
    EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 / 
    CASE o.status
      WHEN 'A_SEPARAR' THEN 2
      WHEN 'EM_SEPARACAO' THEN 4
      WHEN 'CONFERIDO' THEN 24
      ELSE 48
    END * 100, 2
  ) as sla_consumed_percentage,
  
  -- Nível de risco
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 >= 
      CASE o.status
        WHEN 'A_SEPARAR' THEN 2
        WHEN 'EM_SEPARACAO' THEN 4
        WHEN 'CONFERIDO' THEN 24
        ELSE 48
      END THEN 'CRÍTICO'
    WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 >= 
      CASE o.status
        WHEN 'A_SEPARAR' THEN 1.5
        WHEN 'EM_SEPARACAO' THEN 3
        WHEN 'CONFERIDO' THEN 18
        ELSE 36
      END THEN 'ALTO'
    WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 >= 
      CASE o.status
        WHEN 'A_SEPARAR' THEN 1
        WHEN 'EM_SEPARACAO' THEN 2
        WHEN 'CONFERIDO' THEN 12
        ELSE 24
      END THEN 'MÉDIO'
    ELSE 'BAIXO'
  END as risk_level,
  
  COUNT(DISTINCT oi.id) as total_items
  
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.status NOT IN ('DESPACHADO')
GROUP BY o.id, o.external_order_id, o.customer_id, o.status, o.created_at
HAVING EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 >= 
  CASE o.status
    WHEN 'A_SEPARAR' THEN 1
    WHEN 'EM_SEPARACAO' THEN 2
    WHEN 'CONFERIDO' THEN 12
    ELSE 24
  END
ORDER BY sla_consumed_percentage DESC;

COMMENT ON VIEW report_sla_picking_time IS 'SLA de tempo de separação por pedido';
COMMENT ON VIEW report_sla_checking_time IS 'SLA de tempo de conferência por pedido';
COMMENT ON VIEW report_sla_end_to_end IS 'SLA end-to-end (criação até despacho)';
COMMENT ON FUNCTION report_sla_summary IS 'Resumo de performance de SLA por período';
COMMENT ON VIEW report_orders_at_risk IS 'Pedidos em risco de estouro de SLA';
