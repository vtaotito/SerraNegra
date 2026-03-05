# Cockpit Comercial — Produto Analítico

Produto analítico (“cockpit”) que substitui/complementa o Excel multi-abas: ingestão versionada, modelo analítico (fatos/dimensões + SCD), camada semântica, APIs de métricas/insights/IA e portal web com filtros globais, drill-through e bookmarks.

## Estrutura

- **etl/** — Ingestão do Excel (versão, hash), staging, validação e orquestração
- **dw/** — Schema do warehouse (dimensões, fatos, SCD, partições)
- **semantic/** — Definições de métricas, catálogo, agregações
- **api-metrics/** — API de consulta a métricas (filtros, cache)
- **api-insights/** — Drivers, anomalias, forecast
- **api-ai/** — NLQ, Explain, RAG, guardrails (IA grounded)
- **front-cockpit/** — Portal web (Next.js/React, design system, módulos)
- **observability/** — Métricas, auditoria, linhagem do cockpit

## Documentação

- [COCKPIT_BACKLOG.md](../docs/COCKPIT_BACKLOG.md) — Épicos, features e histórias
- [COCKPIT_ESTRUTURA_PASTAS.md](../docs/COCKPIT_ESTRUTURA_PASTAS.md) — Detalhe da estrutura e integração

## Como rodar (futuro)

- Ver `docker-compose.cockpit.yml` (quando existir) ou variáveis em `.env` com prefixo `COCKPIT_`.
- Dependências: Postgres (DB ou schema cockpit), Redis (cache).

## Ordem de implementação

1. **Contrato de dados** — Preencher `cockpit/etl/contract/COCKPIT_CONTRACT.md` com os nomes exatos das abas e colunas do Excel; congelar versão (ver checklist no próprio contrato).
2. Ingestão → DW → Semântica → API Métricas → Portal (shell + filtros + Home) → Qualidade de dados → Módulos domínio → Insights API → IA → Segurança/Observabilidade.
