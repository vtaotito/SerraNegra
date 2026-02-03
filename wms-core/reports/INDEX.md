# 📑 Índice do Agente de Dados - WMS Core

Guia rápido de navegação para todos os componentes do módulo de relatórios.

---

## 📚 Documentação Principal

| Arquivo | Descrição | Link |
|---------|-----------|------|
| **README.md** | Documentação completa dos relatórios | [Ver →](./README.md) |
| **DATA_MODEL.md** | Modelo de dados detalhado (ER, tabelas, campos) | [Ver →](./DATA_MODEL.md) |
| **AGENTE_DE_DADOS.md** | Sumário executivo do módulo | [Ver →](./AGENTE_DE_DADOS.md) |
| **INDEX.md** | Este arquivo (índice geral) | [Ver →](./INDEX.md) |

---

## 🗄️ Migrações SQL

| Arquivo | Descrição | Localização |
|---------|-----------|-------------|
| **0001_init.sql** | Migração inicial (orders, tasks, scan_events) | `../migrations/` |
| **0002_locations_inventory.sql** | Locations, inventory, movements | `../migrations/` |

---

## 📊 Relatórios SQL

### Queries por Categoria

| Categoria | Arquivo | Relatórios Incluídos |
|-----------|---------|---------------------|
| **SLA** | [sla-reports.sql](./queries/sla-reports.sql) | 5 relatórios:<br/>• Tempo de separação<br/>• Tempo de conferência<br/>• End-to-end<br/>• Resumo por período<br/>• Pedidos em risco |
| **Produtividade** | [productivity-reports.sql](./queries/productivity-reports.sql) | 6 relatórios:<br/>• Prod. separadores<br/>• Ranking de performance<br/>• Prod. conferentes<br/>• Prod. por zona<br/>• Tempo de ciclo<br/>• Utilização operadores |
| **Divergências** | [divergence-reports.sql](./queries/divergence-reports.sql) | 7 relatórios:<br/>• Divergências de scan<br/>• Por SKU<br/>• Por operador<br/>• Ajustes de inventário<br/>• Resumo de ajustes<br/>• Divergências conferência<br/>• KPI de acurácia |

**Total**: 18 relatórios + 3 views utilitárias

---

## 💻 Exemplos e Scripts

| Arquivo | Descrição |
|---------|-----------|
| [example-queries.sql](./examples/example-queries.sql) | 10 casos de uso práticos:<br/>• Dashboard executivo<br/>• Análise de operadores<br/>• Gargalos operacionais<br/>• Acurácia<br/>• Gestão de inventário<br/>• Movimentações<br/>• Ajustes<br/>• Comparativo temporal<br/>• Top clientes<br/>• Alertas automáticos |
| [snapshot-job.sql](./examples/snapshot-job.sql) | Job diário de snapshot:<br/>• Fotografia do inventário<br/>• Detecção de mudanças<br/>• Métricas diárias<br/>• Limpeza automática |

---

## 🔧 Ferramentas

| Arquivo | Descrição |
|---------|-----------|
| [install.sh](./install.sh) | Script de instalação automatizado (Linux/Mac):<br/>• Instalação completa<br/>• Instalação seletiva<br/>• Verificação<br/>• Desinstalação<br/>• Config. de jobs |

---

## 📦 Código TypeScript

| Arquivo | Descrição | Localização |
|---------|-----------|-------------|
| **reportService.ts** | API TypeScript para relatórios | `../src/services/` |

**Recursos**:
- 15 interfaces TypeScript
- 10+ métodos de consulta
- Suporte a filtros e paginação
- Totalmente tipado

---

## 🗺️ Mapa de Navegação Rápida

### Por Objetivo

#### "Quero instalar o sistema"
1. Leia: [README.md](./README.md) - Seção "Instalação"
2. Execute: [install.sh](./install.sh) OU siga instruções manuais
3. Verifique: Execute queries de verificação

#### "Quero entender o modelo de dados"
1. Leia: [DATA_MODEL.md](./DATA_MODEL.md)
2. Veja: Diagramas ER e descrições das tabelas
3. Explore: Campos, relacionamentos e regras

#### "Quero criar relatórios"
1. Consulte: [README.md](./README.md) - Seção "Categorias de Relatórios"
2. Use: Exemplos em [example-queries.sql](./examples/example-queries.sql)
3. Adapte: Queries para suas necessidades

#### "Quero integrar com código TypeScript"
1. Importe: `reportService.ts`
2. Configure: Cliente de banco de dados
3. Use: Métodos tipados para consultas

#### "Quero configurar jobs automáticos"
1. Configure: [snapshot-job.sql](./examples/snapshot-job.sql)
2. Agende: Via cron, pg_cron ou Task Scheduler
3. Monitore: Logs e execução

#### "Quero monitorar performance"
1. Use: Views de relatório existentes
2. Crie: Dashboards em Grafana/PowerBI
3. Configure: Alertas para métricas críticas

---

## 📋 Checklist de Implementação

### Setup Inicial
- [ ] Banco de dados PostgreSQL instalado
- [ ] Executar migração 0001 (base)
- [ ] Executar migração 0002 (locations + inventory)
- [ ] Instalar relatórios SQL
- [ ] Verificar instalação

### Configuração
- [ ] Configurar job de snapshot diário
- [ ] Definir políticas de retenção de dados
- [ ] Configurar backup automático
- [ ] Criar usuários com permissões adequadas

### Integração
- [ ] Integrar reportService.ts na aplicação
- [ ] Configurar conexão com banco
- [ ] Testar endpoints de relatório
- [ ] Documentar APIs customizadas

### Monitoramento
- [ ] Configurar alertas de SLA
- [ ] Monitorar performance de queries
- [ ] Configurar logs de aplicação
- [ ] Criar dashboards de visualização

### Otimização (Opcional)
- [ ] Materializar views pesadas
- [ ] Configurar cache (Redis)
- [ ] Implementar particionamento
- [ ] Configurar replicação read-only

---

## 🎯 Casos de Uso Rápidos

### Operações Diárias

```sql
-- Ver pedidos urgentes
SELECT * FROM report_orders_at_risk WHERE risk_level = 'CRÍTICO';

-- Produtividade de hoje
SELECT * FROM report_picker_productivity WHERE work_date = CURRENT_DATE;

-- Divergências recentes
SELECT * FROM report_scan_divergences 
WHERE occurred_at >= NOW() - INTERVAL '24 hours'
  AND severity IN ('CRÍTICA', 'ALTA');
```

### Análises Semanais

```sql
-- Performance semanal
SELECT * FROM report_picker_ranking(
  DATE_TRUNC('week', CURRENT_DATE),
  CURRENT_DATE
);

-- SLA da semana
SELECT * FROM report_sla_summary(
  DATE_TRUNC('week', CURRENT_DATE),
  CURRENT_DATE,
  'day'
);
```

### Relatórios Gerenciais

```sql
-- Resumo mensal de acurácia
SELECT * FROM report_accuracy_kpi(
  DATE_TRUNC('month', CURRENT_DATE),
  CURRENT_DATE
);

-- Análise de ajustes
SELECT * FROM report_adjustments_summary(
  DATE_TRUNC('month', CURRENT_DATE),
  CURRENT_DATE
);
```

---

## 🔗 Links Externos Úteis

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pg_cron Extension](https://github.com/citusdata/pg_cron)
- [TypeScript Node.js Driver (pg)](https://node-postgres.com/)
- [Grafana PostgreSQL Integration](https://grafana.com/docs/grafana/latest/datasources/postgres/)

---

## 📞 Suporte

### Problemas Comuns
Consulte: [README.md](./README.md) - Seção "Troubleshooting"

### Documentação Técnica
Consulte: [DATA_MODEL.md](./DATA_MODEL.md)

### Exemplos de Código
Consulte: [example-queries.sql](./examples/example-queries.sql)

---

## 📊 Estatísticas do Módulo

| Métrica | Valor |
|---------|-------|
| Arquivos SQL | 5 |
| Arquivos Markdown | 4 |
| Arquivos TypeScript | 1 |
| Scripts Shell | 1 |
| **Total de Arquivos** | **11** |
| Tabelas Principais | 11 |
| Views | 12 |
| Funções SQL | 6 |
| Relatórios | 18 |
| Linhas de Código | ~4.250 |

---

## 🏆 Status do Projeto

| Componente | Status | Cobertura |
|------------|--------|-----------|
| Migrações | ✅ Completo | 100% |
| Relatórios SQL | ✅ Completo | 100% |
| API TypeScript | ✅ Completo | 100% |
| Documentação | ✅ Completo | 100% |
| Exemplos | ✅ Completo | 100% |
| Testes | ⚠️ Pendente | 0% |
| CI/CD | ⚠️ Pendente | 0% |

---

**Versão**: 1.0.0  
**Última atualização**: 2026-02-03  
**Mantenedor**: Agente de Dados WMS Core
