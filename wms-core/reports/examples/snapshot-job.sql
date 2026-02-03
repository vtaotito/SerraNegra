-- ============================================================================
-- JOB DE SNAPSHOT DIÁRIO DO INVENTÁRIO
-- ============================================================================
-- Este script deve ser executado diariamente (ex: 02:00 AM via CRON)
-- para criar uma fotografia do estado do inventário
-- ============================================================================

DO $$
DECLARE
  v_snapshot_date DATE := CURRENT_DATE;
  v_rows_inserted INTEGER := 0;
  v_rows_updated INTEGER := 0;
  v_start_time TIMESTAMPTZ := NOW();
  v_end_time TIMESTAMPTZ;
BEGIN
  RAISE NOTICE 'Iniciando snapshot de inventário para data: %', v_snapshot_date;

  -- ============================================================================
  -- 1. SNAPSHOT DO INVENTÁRIO ATUAL
  -- ============================================================================
  
  INSERT INTO inventory_snapshot (
    snapshot_date,
    snapshot_time,
    sku,
    location_code,
    quantity,
    reserved_quantity,
    available_quantity,
    lot_number,
    serial_number,
    expiration_date,
    unit_cost,
    total_value,
    source,
    metadata
  )
  SELECT 
    v_snapshot_date,
    NOW(),
    la.sku,
    l.code,
    la.quantity,
    la.reserved_quantity,
    la.available_quantity,
    la.lot_number,
    la.serial_number,
    la.expiration_date,
    NULL as unit_cost, -- TODO: integrar com tabela de custos se existir
    NULL as total_value, -- TODO: calcular com base no custo
    'SYSTEM',
    jsonb_build_object(
      'location_id', l.id,
      'location_type', l.type,
      'zone', l.zone,
      'last_counted_at', la.last_counted_at,
      'is_blocked', l.is_blocked
    )
  FROM location_assignments la
  JOIN locations l ON l.id = la.location_id
  WHERE l.is_active = true
  
  ON CONFLICT (snapshot_date, sku, location_code, lot_number) 
  DO UPDATE SET
    quantity = EXCLUDED.quantity,
    reserved_quantity = EXCLUDED.reserved_quantity,
    available_quantity = EXCLUDED.available_quantity,
    snapshot_time = EXCLUDED.snapshot_time,
    serial_number = EXCLUDED.serial_number,
    expiration_date = EXCLUDED.expiration_date,
    metadata = EXCLUDED.metadata;
  
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  
  RAISE NOTICE 'Snapshot criado: % registros', v_rows_inserted;

  -- ============================================================================
  -- 2. CRIAR SUMÁRIO DO SNAPSHOT (para consultas rápidas)
  -- ============================================================================
  
  CREATE TEMP TABLE snapshot_summary AS
  SELECT 
    v_snapshot_date as snapshot_date,
    COUNT(DISTINCT sku) as unique_skus,
    COUNT(DISTINCT location_code) as unique_locations,
    SUM(quantity) as total_units,
    SUM(reserved_quantity) as total_reserved,
    SUM(available_quantity) as total_available,
    COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '7 days') as expiring_soon_count,
    COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE) as expired_count
  FROM inventory_snapshot
  WHERE snapshot_date = v_snapshot_date;
  
  -- ============================================================================
  -- 3. DETECTAR MUDANÇAS SIGNIFICATIVAS (vs. dia anterior)
  -- ============================================================================
  
  CREATE TEMP TABLE significant_changes AS
  WITH yesterday AS (
    SELECT sku, location_code, SUM(quantity) as qty
    FROM inventory_snapshot
    WHERE snapshot_date = v_snapshot_date - INTERVAL '1 day'
    GROUP BY sku, location_code
  ),
  today AS (
    SELECT sku, location_code, SUM(quantity) as qty
    FROM inventory_snapshot
    WHERE snapshot_date = v_snapshot_date
    GROUP BY sku, location_code
  )
  SELECT 
    COALESCE(t.sku, y.sku) as sku,
    COALESCE(t.location_code, y.location_code) as location_code,
    COALESCE(y.qty, 0) as qty_yesterday,
    COALESCE(t.qty, 0) as qty_today,
    COALESCE(t.qty, 0) - COALESCE(y.qty, 0) as qty_change,
    ROUND(
      (COALESCE(t.qty, 0) - COALESCE(y.qty, 0)) * 100.0 / NULLIF(COALESCE(y.qty, 0), 0),
      2
    ) as pct_change
  FROM today t
  FULL OUTER JOIN yesterday y 
    ON y.sku = t.sku AND y.location_code = t.location_code
  WHERE ABS(COALESCE(t.qty, 0) - COALESCE(y.qty, 0)) >= 50
     OR ABS((COALESCE(t.qty, 0) - COALESCE(y.qty, 0)) * 100.0 / NULLIF(COALESCE(y.qty, 0), 0)) >= 20;

  -- Log das mudanças significativas
  v_rows_updated := (SELECT COUNT(*) FROM significant_changes);
  
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Detectadas % mudanças significativas de inventário', v_rows_updated;
    
    -- Mostrar algumas mudanças (para logs)
    RAISE NOTICE 'Exemplos de mudanças:';
    FOR i IN 1..LEAST(v_rows_updated, 5) LOOP
      RAISE NOTICE '  - SKU: %, Local: %, Mudança: % unidades (%% %%)',
        (SELECT sku FROM significant_changes LIMIT 1 OFFSET i-1),
        (SELECT location_code FROM significant_changes LIMIT 1 OFFSET i-1),
        (SELECT qty_change FROM significant_changes LIMIT 1 OFFSET i-1),
        (SELECT pct_change FROM significant_changes LIMIT 1 OFFSET i-1);
    END LOOP;
  END IF;

  -- ============================================================================
  -- 4. CALCULAR MÉTRICAS DO DIA
  -- ============================================================================
  
  CREATE TEMP TABLE daily_metrics AS
  SELECT 
    v_snapshot_date as metric_date,
    'inventory_turnover' as metric_name,
    COUNT(DISTINCT la.sku) as metric_value,
    'SKUs com movimentação' as metric_unit
  FROM location_assignments la
  WHERE EXISTS (
    SELECT 1 FROM location_movements lm
    WHERE lm.sku = la.sku
      AND lm.occurred_at >= v_snapshot_date - INTERVAL '1 day'
      AND lm.occurred_at < v_snapshot_date
  )
  
  UNION ALL
  
  SELECT 
    v_snapshot_date,
    'zero_stock_items',
    COUNT(DISTINCT la.sku),
    'SKUs com estoque zerado'
  FROM location_assignments la
  WHERE la.available_quantity = 0
  
  UNION ALL
  
  SELECT 
    v_snapshot_date,
    'total_locations_in_use',
    COUNT(DISTINCT l.id),
    'Localizações em uso'
  FROM locations l
  WHERE l.is_active = true
    AND EXISTS (
      SELECT 1 FROM location_assignments la
      WHERE la.location_id = l.id AND la.quantity > 0
    );

  -- ============================================================================
  -- 5. LIMPAR SNAPSHOTS ANTIGOS (manter apenas 90 dias)
  -- ============================================================================
  
  DELETE FROM inventory_snapshot
  WHERE snapshot_date < CURRENT_DATE - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Removidos % registros de snapshots antigos', v_rows_updated;
  END IF;

  -- ============================================================================
  -- 6. VACUUM E ANALYZE (otimização)
  -- ============================================================================
  
  -- Não é possível executar VACUUM dentro de um bloco DO, 
  -- então apenas registramos a necessidade
  RAISE NOTICE 'Recomendado executar: VACUUM ANALYZE inventory_snapshot;';

  -- ============================================================================
  -- 7. RELATÓRIO FINAL
  -- ============================================================================
  
  v_end_time := NOW();
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SNAPSHOT CONCLUÍDO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Data do snapshot: %', v_snapshot_date;
  RAISE NOTICE 'Início: %', v_start_time;
  RAISE NOTICE 'Fim: %', v_end_time;
  RAISE NOTICE 'Duração: % segundos', EXTRACT(EPOCH FROM (v_end_time - v_start_time));
  RAISE NOTICE 'Registros inseridos/atualizados: %', v_rows_inserted;
  
  -- Exibir sumário
  FOR r IN SELECT * FROM snapshot_summary LOOP
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'SKUs únicos: %', r.unique_skus;
    RAISE NOTICE 'Localizações únicas: %', r.unique_locations;
    RAISE NOTICE 'Total de unidades: %', r.total_units;
    RAISE NOTICE 'Unidades reservadas: %', r.total_reserved;
    RAISE NOTICE 'Unidades disponíveis: %', r.total_available;
    RAISE NOTICE 'Itens vencendo em 7 dias: %', r.expiring_soon_count;
    RAISE NOTICE 'Itens já vencidos: %', r.expired_count;
  END LOOP;
  
  RAISE NOTICE '========================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'ERRO ao executar snapshot: % %', SQLERRM, SQLSTATE;
    RAISE;
END $$;

-- ============================================================================
-- CONFIGURAÇÃO DO CRON (Linux/PostgreSQL)
-- ============================================================================

/*
Para agendar este job diariamente às 02:00 AM:

1. Via pg_cron (se instalado):

SELECT cron.schedule(
  'daily-inventory-snapshot',
  '0 2 * * *',
  $$
  \i /path/to/snapshot-job.sql
  $$
);

2. Via crontab do sistema:

0 2 * * * psql -U wms_user -d wms_db -f /path/to/snapshot-job.sql >> /var/log/wms/snapshot.log 2>&1

3. Via scheduler do Windows (Task Scheduler):

Ação: psql.exe
Argumentos: -U wms_user -d wms_db -f "C:\path\to\snapshot-job.sql"
Disparador: Diariamente às 02:00
*/

-- ============================================================================
-- MONITORAMENTO DO JOB
-- ============================================================================

-- Ver últimos snapshots criados
SELECT 
  snapshot_date,
  COUNT(*) as records,
  COUNT(DISTINCT sku) as unique_skus,
  SUM(quantity) as total_units,
  MAX(snapshot_time) as last_update
FROM inventory_snapshot
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- Ver espaço em disco utilizado
SELECT 
  pg_size_pretty(pg_total_relation_size('inventory_snapshot')) as table_size,
  (SELECT COUNT(*) FROM inventory_snapshot) as total_records;
