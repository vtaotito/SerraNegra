# 📊 Módulo de Relatórios WMS

Sistema completo de relatórios e análises para o Warehouse Management System.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Instalação](#instalação)
- [Categorias de Relatórios](#categorias-de-relatórios)
- [Exemplos de Uso](#exemplos-de-uso)
- [API de Relatórios](#api-de-relatórios)
- [Performance](#performance)
- [Manutenção](#manutenção)

---

## 🎯 Visão Geral

Este módulo fornece relatórios e análises para três áreas principais:

1. **SLA (Service Level Agreement)**: Monitoramento de prazos e performance operacional
2. **Produtividade**: Métricas de eficiência dos operadores e processos
3. **Divergências**: Identificação de erros, ajustes e discrepâncias

---

## 🚀 Instalação

### 1. Executar Migrações

```bash
# Migração base (se ainda não executada)
psql -d wms_db -f wms-core/migrations/0001_init.sql

# Migração de locations e inventory
psql -d wms_db -f wms-core/migrations/0002_locations_inventory.sql

# Relatórios SLA
psql -d wms_db -f wms-core/reports/queries/sla-reports.sql

# Relatórios de Produtividade
psql -d wms_db -f wms-core/reports/queries/productivity-reports.sql

# Relatórios de Divergências
psql -d wms_db -f wms-core/reports/queries/divergence-reports.sql
```

### 2. Verificar Instalação

```sql
-- Listar todas as views de relatório
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'report_%'
ORDER BY table_name;

-- Listar todas as funções de relatório
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'report_%'
ORDER BY routine_name;
```

---

## 📊 Categorias de Relatórios

### 1️⃣ Relatórios de SLA

#### `report_sla_picking_time`
**Descrição**: Tempo de separação por pedido (criação → finalização da separação)

**Campos**:
- `order_id`, `external_order_id`, `customer_id`
- `picking_started_at`, `picking_completed_at`
- `picking_duration_minutes`: Tempo de separação
- `wait_time_minutes`: Tempo de espera antes de iniciar
- `sla_status`: `DENTRO_SLA`, `ALERTA`, `FORA_SLA`
- `total_items`, `total_units`

**Exemplo**:
```sql
-- Pedidos fora do SLA de separação
SELECT * FROM report_sla_picking_time
WHERE sla_status = 'FORA_SLA'
ORDER BY picking_duration_minutes DESC
LIMIT 10;
```

---

#### `report_sla_checking_time`
**Descrição**: Tempo de conferência (fim separação → conferência)

**Campos**:
- `order_id`, `external_order_id`
- `picking_completed_at`, `checking_completed_at`
- `checking_duration_minutes`
- `sla_status`
- `checker_id`

**Exemplo**:
```sql
-- Performance de conferência por conferente
SELECT 
  checker_id,
  COUNT(*) as total_checks,
  AVG(checking_duration_minutes) as avg_time,
  COUNT(*) FILTER (WHERE sla_status = 'DENTRO_SLA') as within_sla
FROM report_sla_checking_time
WHERE checking_completed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY checker_id
ORDER BY avg_time;
```

---

#### `report_sla_end_to_end`
**Descrição**: SLA completo (criação → despacho)

**Campos**:
- `total_duration_hours`: Tempo total em horas
- `sla_status`
- Marcos: `picking_started`, `picking_completed`, `checked`, `quote_requested`, `ready_for_pickup`

**Exemplo**:
```sql
-- Análise de tempo por etapa
SELECT 
  AVG(EXTRACT(EPOCH FROM (picking_started - order_created_at)) / 3600) as avg_hours_to_start,
  AVG(EXTRACT(EPOCH FROM (picking_completed - picking_started)) / 3600) as avg_hours_picking,
  AVG(EXTRACT(EPOCH FROM (checked - picking_completed)) / 3600) as avg_hours_checking,
  AVG(EXTRACT(EPOCH FROM (dispatched_at - checked)) / 3600) as avg_hours_to_dispatch
FROM report_sla_end_to_end
WHERE dispatched_at >= CURRENT_DATE - INTERVAL '30 days';
```

---

#### `report_sla_summary(start_date, end_date, group_by)`
**Descrição**: Resumo de performance de SLA por período

**Parâmetros**:
- `p_start_date`: Data inicial
- `p_end_date`: Data final
- `p_group_by`: 'day', 'week', ou 'month'

**Exemplo**:
```sql
-- Resumo mensal
SELECT * FROM report_sla_summary(
  '2026-02-01'::timestamptz,
  '2026-02-28'::timestamptz,
  'day'
);
```

---

#### `report_orders_at_risk`
**Descrição**: Pedidos em risco de estouro de SLA

**Campos**:
- `risk_level`: `BAIXO`, `MÉDIO`, `ALTO`, `CRÍTICO`
- `hours_since_created`
- `sla_consumed_percentage`

**Exemplo**:
```sql
-- Dashboard de alertas
SELECT 
  risk_level,
  COUNT(*) as total_orders,
  AVG(sla_consumed_percentage) as avg_sla_consumed
FROM report_orders_at_risk
GROUP BY risk_level
ORDER BY 
  CASE risk_level
    WHEN 'CRÍTICO' THEN 1
    WHEN 'ALTO' THEN 2
    WHEN 'MÉDIO' THEN 3
    ELSE 4
  END;
```

---

### 2️⃣ Relatórios de Produtividade

#### `report_picker_productivity`
**Descrição**: Produtividade individual dos separadores

**Campos**:
- `picker_id`, `work_date`
- `tasks_completed`, `orders_completed`
- `total_units_picked`, `unique_skus`
- `units_per_hour`: KPI principal
- `avg_minutes_per_task`
- `accuracy_percentage`

**Exemplo**:
```sql
-- Top 10 separadores da semana
SELECT 
  picker_id,
  SUM(total_units_picked) as total_units,
  AVG(units_per_hour) as avg_productivity,
  AVG(accuracy_percentage) as avg_accuracy
FROM report_picker_productivity
WHERE work_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY picker_id
ORDER BY avg_productivity DESC
LIMIT 10;
```

---

#### `report_picker_ranking(start_date, end_date)`
**Descrição**: Ranking de performance dos separadores

**Campos**:
- `ranking`: Posição no ranking
- `performance_score`: Score ponderado (60% produtividade + 40% acurácia)

**Exemplo**:
```sql
-- Ranking do mês
SELECT * FROM report_picker_ranking(
  '2026-02-01'::timestamptz,
  '2026-02-28'::timestamptz
)
LIMIT 20;
```

---

#### `report_checker_productivity`
**Descrição**: Produtividade dos conferentes

**Campos**:
- `checker_id`, `work_date`
- `orders_checked`
- `orders_per_hour`
- `avg_minutes_per_order`

---

#### `report_productivity_by_zone`
**Descrição**: Produtividade por zona do armazém

**Exemplo**:
```sql
-- Zonas mais movimentadas
SELECT 
  zone,
  SUM(total_units) as total_units,
  SUM(unique_operators) as operators,
  SUM(total_units) / NULLIF(SUM(unique_operators), 0) as units_per_operator
FROM report_productivity_by_zone
WHERE movement_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY zone
ORDER BY total_units DESC;
```

---

#### `report_task_cycle_time`
**Descrição**: Tempo de ciclo por tipo de tarefa

**Campos**:
- Estatísticas: `avg_cycle_minutes`, `min_cycle_minutes`, `max_cycle_minutes`
- Percentis: `p50_cycle_minutes`, `p90_cycle_minutes`, `p95_cycle_minutes`

---

#### `report_operator_utilization(date)`
**Descrição**: Taxa de ocupação dos operadores

**Campos**:
- `utilization_rate`: % de tempo ativo vs tempo total

**Exemplo**:
```sql
-- Operadores com baixa utilização
SELECT * FROM report_operator_utilization(CURRENT_DATE)
WHERE utilization_rate < 70
ORDER BY utilization_rate;
```

---

### 3️⃣ Relatórios de Divergências

#### `report_scan_divergences`
**Descrição**: Divergências entre quantidade esperada e escaneada

**Campos**:
- `divergence_type`: `EXCESSO`, `FALTA`, `OK`
- `divergence_percentage`
- `severity`: `CRÍTICA`, `ALTA`, `MÉDIA`, `NENHUMA`

**Exemplo**:
```sql
-- Divergências críticas
SELECT * FROM report_scan_divergences
WHERE severity IN ('CRÍTICA', 'ALTA')
  AND occurred_at >= CURRENT_DATE - INTERVAL '24 hours'
ORDER BY divergence_percentage DESC;
```

---

#### `report_divergence_by_sku`
**Descrição**: Produtos com maior taxa de erro

**Campos**:
- `divergence_rate`: % de tarefas com divergência
- `excess_count`, `shortage_count`

**Exemplo**:
```sql
-- SKUs problemáticos
SELECT * FROM report_divergence_by_sku
WHERE divergence_rate > 10
  AND total_tasks >= 10
ORDER BY divergence_rate DESC
LIMIT 20;
```

---

#### `report_divergence_by_operator`
**Descrição**: Operadores com maior taxa de erro

**Exemplo**:
```sql
-- Operadores que precisam de treinamento
SELECT 
  operator_id,
  task_type,
  divergence_rate,
  accuracy_rate,
  critical_divergences
FROM report_divergence_by_operator
WHERE divergence_rate > 5
ORDER BY divergence_rate DESC;
```

---

#### `report_inventory_adjustments_detail`
**Descrição**: Detalhamento de ajustes de inventário

**Campos**:
- `adjustment_type`: `COUNT`, `DAMAGE`, `LOSS`, `FOUND`, `CORRECTION`
- `quantity_delta`: Diferença (positivo = acréscimo, negativo = decréscimo)
- `approval_status`: `APROVADO`, `PENDENTE_APROVAÇÃO`, `AUTO_APROVADO`

---

#### `report_adjustments_summary(start_date, end_date)`
**Descrição**: Resumo de ajustes por período

**Exemplo**:
```sql
-- Resumo de ajustes do mês
SELECT * FROM report_adjustments_summary(
  '2026-02-01'::timestamptz,
  '2026-02-28'::timestamptz
);
```

---

#### `report_checking_divergences`
**Descrição**: Divergências encontradas na conferência

**Campos**:
- `picking_divergence`: Diferença entre esperado e separado
- `checking_divergence`: Diferença entre separado e conferido

---

#### `report_accuracy_kpi(start_date, end_date)`
**Descrição**: KPI de acurácia operacional

**Campos**:
- `overall_accuracy`: Acurácia geral
- `perfect_rate`: % de tarefas perfeitas
- `major_divergence_rate`: % de divergências grandes

**Exemplo**:
```sql
-- KPI do mês
SELECT * FROM report_accuracy_kpi(
  '2026-02-01'::timestamptz,
  '2026-02-28'::timestamptz
);
```

---

## ⚡ Performance

### Otimizações Implementadas

1. **Índices**: Todos os campos frequentemente consultados possuem índices
2. **Desnormalização Controlada**: Códigos de localização armazenados para evitar JOINs
3. **Campos Calculados**: `available_quantity` calculado automaticamente

### Recomendações

```sql
-- Analisar performance de uma query
EXPLAIN ANALYZE
SELECT * FROM report_sla_end_to_end
WHERE order_created_at >= '2026-02-01';

-- Reindexar se necessário
REINDEX TABLE scan_events;
REINDEX TABLE location_movements;

-- Atualizar estatísticas
ANALYZE orders;
ANALYZE tasks;
ANALYZE scan_events;
```

### Materialização (Opcional)

Para relatórios muito pesados, considere materializar:

```sql
-- Criar view materializada
CREATE MATERIALIZED VIEW mv_daily_productivity AS
SELECT * FROM report_picker_productivity
WHERE work_date >= CURRENT_DATE - INTERVAL '90 days';

-- Criar índice
CREATE INDEX idx_mv_daily_productivity_date 
ON mv_daily_productivity(work_date DESC);

-- Refresh diário (via CRON)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_productivity;
```

---

## 🔄 Manutenção

### Job Diário: Snapshot de Inventário

```sql
-- Script para executar diariamente (ex: 02:00 AM)
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
  source
)
SELECT 
  CURRENT_DATE,
  NOW(),
  la.sku,
  l.code,
  la.quantity,
  la.reserved_quantity,
  la.available_quantity,
  la.lot_number,
  la.serial_number,
  la.expiration_date,
  'SYSTEM'
FROM location_assignments la
JOIN locations l ON l.id = la.location_id
WHERE l.is_active = true
ON CONFLICT (snapshot_date, sku, location_code, lot_number) 
DO UPDATE SET
  quantity = EXCLUDED.quantity,
  reserved_quantity = EXCLUDED.reserved_quantity,
  available_quantity = EXCLUDED.available_quantity,
  snapshot_time = EXCLUDED.snapshot_time;
```

### Arquivamento de Dados Antigos

```sql
-- Arquivar scan_events com mais de 1 ano
INSERT INTO scan_events_archive
SELECT * FROM scan_events
WHERE occurred_at < CURRENT_DATE - INTERVAL '1 year';

DELETE FROM scan_events
WHERE occurred_at < CURRENT_DATE - INTERVAL '1 year';

-- Vacuum para liberar espaço
VACUUM ANALYZE scan_events;
```

---

## 📱 Integração com Dashboards

### Exemplo: Grafana

```sql
-- Query para painel de SLA
SELECT 
  DATE_TRUNC('hour', order_created_at) as time,
  COUNT(*) as total,
  AVG(total_duration_hours) as avg_duration,
  COUNT(*) FILTER (WHERE sla_status = 'DENTRO_SLA') * 100.0 / COUNT(*) as sla_compliance
FROM report_sla_end_to_end
WHERE order_created_at >= $__timeFrom()
  AND order_created_at <= $__timeTo()
GROUP BY time
ORDER BY time;
```

### Exemplo: PowerBI / Tableau

Conectar diretamente às views e funções via conector PostgreSQL.

---

## 🆘 Troubleshooting

### Queries Lentas

```sql
-- Identificar queries lentas
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%report_%'
ORDER BY mean_time DESC
LIMIT 10;
```

### Views Vazias

```sql
-- Verificar se há dados nas tabelas base
SELECT 
  'orders' as table_name, COUNT(*) as count FROM orders
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'scan_events', COUNT(*) FROM scan_events;
```

---

## 📚 Documentação Adicional

- [Modelo de Dados Completo](./DATA_MODEL.md)
- [API de Relatórios](./api/README.md) _(futuro)_
- [Exemplos Avançados](./examples/) _(futuro)_

---

## 🎯 Roadmap

- [ ] Relatórios de custo operacional
- [ ] Análise preditiva de demanda
- [ ] Alertas automáticos (webhooks)
- [ ] Export para CSV/Excel automatizado
- [ ] API REST para todos os relatórios

---

**Versão**: 1.0.0  
**Última atualização**: 2026-02-03
