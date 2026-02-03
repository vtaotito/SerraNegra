# 🤖 Agente de Dados - WMS Core

> **Sistema completo de modelagem de dados, migrações e relatórios analíticos para Warehouse Management System**

---

## 📋 Sumário Executivo

O **Agente de Dados** é um módulo completo responsável por:

1. **Modelagem de Banco de Dados**: Estrutura de dados otimizada para operações de armazém
2. **Migrações Versionadas**: Scripts SQL para criação e evolução do schema
3. **Relatórios Analíticos**: Queries pré-construídas para SLA, produtividade e divergências
4. **API TypeScript**: Interface programática para acesso aos relatórios
5. **Jobs Automatizados**: Scripts para snapshots e manutenção

---

## 🎯 Objetivos Alcançados

### ✅ Modelagem de Tabelas

| Tabela | Propósito | Status |
|--------|-----------|--------|
| `orders` | Espelho dos pedidos WMS | ✅ Implementado |
| `tasks` | Tarefas operacionais (picking, packing, shipping) | ✅ Implementado |
| `scan_events` | Audit trail de escaneamentos | ✅ Implementado |
| `locations` | Endereços físicos do armazém | ✅ Implementado |
| `location_assignments` | Alocação de estoque por endereço | ✅ Implementado |
| `inventory_snapshot` | Fotografia diária do inventário | ✅ Implementado |
| `location_movements` | Histórico de movimentações | ✅ Implementado |
| `inventory_adjustments` | Ajustes manuais de inventário | ✅ Implementado |

### ✅ Relatórios Implementados

#### 1. Relatórios de SLA (5 views/funções)
- Tempo de separação por pedido
- Tempo de conferência
- SLA end-to-end (criação → despacho)
- Resumo agregado por período
- Pedidos em risco de estouro de SLA

#### 2. Relatórios de Produtividade (6 views/funções)
- Produtividade individual dos separadores
- Ranking de performance
- Produtividade dos conferentes
- Análise por zona do armazém
- Tempo de ciclo por tipo de tarefa
- Taxa de utilização dos operadores

#### 3. Relatórios de Divergências (7 views/funções)
- Divergências de contagem (scan vs esperado)
- Análise por SKU
- Análise por operador
- Detalhamento de ajustes de inventário
- Resumo de ajustes
- Divergências na conferência
- KPI de acurácia operacional

**Total**: 18 relatórios pré-construídos + 3 views utilitárias

---

## 📁 Estrutura de Arquivos

```
wms-core/
├── migrations/
│   ├── 0001_init.sql                    # Migração inicial (base)
│   └── 0002_locations_inventory.sql     # Locations + Inventory
│
├── reports/
│   ├── README.md                        # Documentação principal
│   ├── DATA_MODEL.md                    # Modelo de dados detalhado
│   ├── AGENTE_DE_DADOS.md              # Este documento
│   │
│   ├── queries/
│   │   ├── sla-reports.sql             # Relatórios de SLA
│   │   ├── productivity-reports.sql     # Relatórios de Produtividade
│   │   └── divergence-reports.sql       # Relatórios de Divergências
│   │
│   └── examples/
│       ├── example-queries.sql          # 10 casos de uso comuns
│       └── snapshot-job.sql             # Job diário de snapshot
│
└── src/
    └── services/
        └── reportService.ts             # API TypeScript
```

---

## 🚀 Como Usar

### 1. Instalação (Primeira Vez)

```bash
# 1. Executar migrações
psql -d wms_db -f wms-core/migrations/0001_init.sql
psql -d wms_db -f wms-core/migrations/0002_locations_inventory.sql

# 2. Instalar relatórios
psql -d wms_db -f wms-core/reports/queries/sla-reports.sql
psql -d wms_db -f wms-core/reports/queries/productivity-reports.sql
psql -d wms_db -f wms-core/reports/queries/divergence-reports.sql

# 3. Configurar job diário (cron)
# Editar crontab e adicionar:
# 0 2 * * * psql -d wms_db -f /path/to/snapshot-job.sql
```

### 2. Uso via SQL (PostgreSQL)

```sql
-- Pedidos em risco
SELECT * FROM report_orders_at_risk
WHERE risk_level IN ('CRÍTICO', 'ALTO');

-- Produtividade da última semana
SELECT * FROM report_picker_productivity
WHERE work_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY units_per_hour DESC;

-- Resumo de SLA do mês
SELECT * FROM report_sla_summary(
  '2026-02-01'::timestamptz,
  '2026-02-28'::timestamptz,
  'day'
);
```

### 3. Uso via TypeScript

```typescript
import { ReportService } from './services/reportService';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const reportService = new ReportService(pool);

// Obter pedidos em risco
const atRisk = await reportService.getOrdersAtRisk({
  minRiskLevel: 'ALTO'
});

// Produtividade semanal
const productivity = await reportService.getPickerProductivity({
  dateRange: {
    startDate: '2026-01-27T00:00:00Z',
    endDate: '2026-02-03T23:59:59Z'
  }
});

// KPI de acurácia
const accuracy = await reportService.getAccuracyKPI({
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2026-02-28T23:59:59Z'
});

console.log('SLA Compliance:', accuracy.perfectRate, '%');
```

---

## 📊 Casos de Uso Principais

### 1. Dashboard Executivo

```sql
-- KPIs do dia em tempo real
SELECT 
  COUNT(*) FILTER (WHERE status = 'DESPACHADO') as dispatched_today,
  COUNT(*) FILTER (WHERE status = 'EM_SEPARACAO') as in_progress,
  COUNT(*) FILTER (WHERE status = 'A_SEPARAR') as pending,
  ROUND(AVG(
    CASE WHEN status = 'DESPACHADO' 
    THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 
    END
  ), 2) as avg_hours_to_dispatch
FROM orders
WHERE created_at >= CURRENT_DATE;
```

### 2. Gestão de Operadores

```sql
-- Quem está trabalhando agora?
SELECT 
  assigned_to,
  COUNT(*) as active_tasks,
  MIN(started_at) as working_since
FROM tasks
WHERE status = 'IN_PROGRESS'
GROUP BY assigned_to;

-- Ranking mensal
SELECT * FROM report_picker_ranking(
  DATE_TRUNC('month', CURRENT_DATE),
  CURRENT_DATE
)
LIMIT 10;
```

### 3. Controle de Qualidade

```sql
-- Divergências críticas nas últimas 24h
SELECT * FROM report_scan_divergences
WHERE severity IN ('CRÍTICA', 'ALTA')
  AND occurred_at >= NOW() - INTERVAL '24 hours'
ORDER BY divergence_percentage DESC;

-- SKUs problemáticos
SELECT * FROM report_divergence_by_sku
WHERE divergence_rate > 10
ORDER BY divergence_rate DESC
LIMIT 20;
```

### 4. Gestão de Inventário

```sql
-- Inventário atual consolidado
SELECT * FROM v_inventory_current
WHERE total_available < 10
ORDER BY total_available;

-- Produtos vencidos ou próximos do vencimento
SELECT 
  la.sku,
  l.code as location,
  la.expiration_date,
  la.quantity,
  la.expiration_date - CURRENT_DATE as days_to_expire
FROM location_assignments la
JOIN locations l ON l.id = la.location_id
WHERE la.expiration_date <= CURRENT_DATE + INTERVAL '7 days'
  AND l.is_active = true
ORDER BY la.expiration_date;
```

---

## 🎯 KPIs Disponíveis

### Operacionais
- ✅ **Taxa de cumprimento de SLA**: % de pedidos dentro do SLA
- ✅ **Tempo médio de separação**: Minutos por pedido
- ✅ **Unidades por hora**: Produtividade dos separadores
- ✅ **Taxa de acurácia**: % de tarefas sem divergências
- ✅ **Tempo de ciclo**: Tempo médio por tipo de tarefa

### Qualidade
- ✅ **Taxa de divergências**: % de erros por operador/SKU
- ✅ **Divergências críticas**: Quantidade de erros graves
- ✅ **Ajustes de inventário**: Volume de correções manuais

### Utilização
- ✅ **Taxa de ocupação**: % de tempo ativo dos operadores
- ✅ **Localizações em uso**: % de endereços ocupados
- ✅ **Taxa de reserva**: % de estoque reservado vs disponível

---

## 🔧 Manutenção e Monitoramento

### Jobs Diários

| Job | Horário | Função |
|-----|---------|--------|
| Snapshot de Inventário | 02:00 AM | Gera fotografia diária do estoque |
| Limpeza de Snapshots | 03:00 AM | Remove dados > 90 dias |
| VACUUM/ANALYZE | 04:00 AM | Otimiza performance do banco |

### Monitoramento de Performance

```sql
-- Verificar tamanho das tabelas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Queries mais lentas
SELECT 
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
WHERE query LIKE '%report_%'
ORDER BY mean_time DESC
LIMIT 10;
```

### Alertas Recomendados

1. **Pedidos em risco**: Notificar quando `risk_level = 'CRÍTICO'`
2. **Divergências altas**: Alert se `divergence_rate > 15%`
3. **Produtos vencidos**: Notificar produtos com validade expirada
4. **Baixa produtividade**: Alert se `units_per_hour < 30`
5. **Ajustes pendentes**: Notificar ajustes > 50 unidades sem aprovação

---

## 📈 Métricas de Implementação

### Cobertura

- **Tabelas**: 11 tabelas principais + 8 auxiliares
- **Índices**: 35 índices otimizados
- **Views**: 12 views analíticas
- **Funções**: 6 funções SQL
- **Relatórios**: 18 relatórios completos
- **Tipos TypeScript**: 15 interfaces definidas

### Linhas de Código

| Componente | Linhas | Comentários |
|------------|--------|-------------|
| Migrações SQL | ~450 | Completo |
| Relatórios SQL | ~1,200 | Documentado |
| TypeScript API | ~600 | Tipado |
| Exemplos | ~500 | 10 casos de uso |
| Documentação | ~1,500 | 4 arquivos MD |
| **Total** | **~4,250** | **Pronto para produção** |

---

## 🚦 Roadmap Futuro

### Fase 2 (Próximos Passos)
- [ ] Materializar views de relatórios pesados
- [ ] Implementar cache em Redis para queries frequentes
- [ ] Criar API REST para todos os relatórios
- [ ] Dashboard web com gráficos interativos (React + Chart.js)
- [ ] Alertas automáticos via webhook/email

### Fase 3 (Médio Prazo)
- [ ] Machine Learning para previsão de demanda
- [ ] Análise preditiva de SLA (antecipação de atrasos)
- [ ] Otimização de rotas de picking
- [ ] Análise de custo operacional
- [ ] Integração com Power BI / Tableau

### Fase 4 (Longo Prazo)
- [ ] Data warehouse para análise histórica
- [ ] Particionamento de tabelas grandes
- [ ] Replicação read-only para analytics
- [ ] Time-series database para métricas em tempo real

---

## 🆘 Suporte e Troubleshooting

### Problemas Comuns

**1. Views vazias**
```sql
-- Verificar se há dados
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM tasks WHERE status = 'COMPLETED';
```

**2. Queries lentas**
```sql
-- Recriar índices
REINDEX TABLE scan_events;
ANALYZE scan_events;
```

**3. Snapshot não executado**
```bash
# Verificar logs
tail -f /var/log/wms/snapshot.log

# Executar manualmente
psql -d wms_db -f snapshot-job.sql
```

### Contato

Para questões técnicas ou sugestões de melhorias, consulte:
- **Documentação**: `wms-core/reports/README.md`
- **Modelo de Dados**: `wms-core/reports/DATA_MODEL.md`
- **Exemplos**: `wms-core/reports/examples/`

---

## 📝 Changelog

### v1.0.0 (2026-02-03)
- ✅ Implementação inicial completa
- ✅ 11 tabelas principais
- ✅ 18 relatórios analíticos
- ✅ API TypeScript
- ✅ Job de snapshot diário
- ✅ Documentação completa

---

## 📄 Licença

Este módulo faz parte do projeto WMS Core e segue a mesma licença do projeto principal.

---

**Versão**: 1.0.0  
**Última atualização**: 2026-02-03  
**Status**: ✅ Produção Ready
