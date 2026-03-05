# Cockpit Comercial — Estrutura de Pastas

Estrutura de pastas proposta para o produto analítico (“cockpit”), alinhada ao spec e ao repositório existente (WMS). Os componentes do cockpit podem coexistir com `core/`, `gateway/`, `web-next/`, etc., sob uma raiz **`cockpit/`** ou **`analytics/`**.

---

## 1) Opção recomendada: raiz `cockpit/`

Toda a funcionalidade analítica fica sob `cockpit/`, facilitando ownership, CI e deploy independente.

```
wms/
├── api/                    # (existente) API Node/TS
├── core/                   # (existente) FastAPI — WMS
├── gateway/                # (existente) BFF/Gateway
├── web-next/               # (existente) App principal
├── observability/          # (existente) — estender para cockpit
├── docs/                   # (existente) + COCKPIT_*.md
│
└── cockpit/                # ← NOVO: produto analítico
    ├── README.md           # Visão geral, como rodar, dependências
    ├── docker-compose.cockpit.yml   # (opcional) serviços só do cockpit
    │
    ├── etl/                # Ingestão + staging + orquestração
    │   ├── README.md
    │   ├── ingest/         # Captura Excel (versão, hash, metadados)
    │   ├── staging/        # Schemas e cargas por aba (landing zone)
    │   ├── dbt/             # (opcional) se usar dbt para transformações
    │   └── jobs/            # Orquestração (schedule, triggers)
    │
    ├── dw/                  # Warehouse / Lakehouse (modelo analítico)
    │   ├── README.md
    │   ├── schema/          # DDL: staging, dimensões, fatos, SCD
    │   ├── migrations/      # Versões de schema
    │   └── seeds/           # Dados de referência (ex.: calendário)
    │
    ├── semantic/            # Camada semântica / métricas
    │   ├── README.md
    │   ├── metrics/         # Definições de métricas (YAML/JSON ou código)
    │   ├── catalog/         # Catálogo (linhagem, owner, versão)
    │   └── aggregates/      # Rollups (mensal, por dimensão)
    │
    ├── api-metrics/         # API de métricas (query engine)
    │   ├── README.md
    │   ├── src/
    │   │   ├── routes/      # Endpoints por domínio (faturamento, estoque…)
    │   │   ├── services/    # Resolução de métricas, cache
    │   │   └── middleware/  # Auth, RLS context, audit
    │   └── package.json ou requirements.txt
    │
    ├── api-insights/        # API de insights (drivers, anomalias, forecast)
    │   ├── README.md
    │   ├── src/
    │   │   ├── drivers/
    │   │   ├── anomalies/
    │   │   ├── forecast/
    │   │   └── narrative/
    │   └── package.json ou requirements.txt
    │
    ├── api-ai/              # Serviço de IA (orquestração LLM, RAG, guardrails)
    │   ├── README.md
    │   ├── src/
    │   │   ├── rag/         # Indexação e retrieval (glossário, regras)
    │   │   ├── chat/        # NLQ, resposta grounded
    │   │   ├── explain/     # Explain this (contexto)
    │   │   └── guardrails/  # Validação, bloqueio PII
    │   └── requirements.txt
    │
    ├── front-cockpit/       # Portal web “Cockpit” (React/Next + TS)
    │   ├── README.md
    │   ├── app/             # Rotas (Home, Comercial, Clientes, …)
    │   ├── components/      # Design system (KPI card, filter bar, table, drawer)
    │   ├── features/        # Por módulo (executivo, comercial, clientes, …)
    │   ├── lib/             # API client, auth, state (filtros globais)
    │   └── package.json
    │
    └── observability/       # Específico do cockpit (ou link para repo observability)
        ├── README.md
        ├── metrics/         # Latência, cache hit, falhas ingestão, queries lentas
        ├── audit/            # Eventos de acesso, export, bookmark
        └── lineage/         # Metadados de linhagem (opcional, pode estar em semantic/catalog)
```

---

## 2) Integração com o repositório atual

- **Postgres**: o cockpit pode usar o mesmo `postgres` do `docker-compose.yml` com um database adicional (ex.: `cockpit` ou schema `cockpit`) ou outro instance, conforme política de isolamento.
- **Redis**: reutilizar para cache de métricas e sessões do cockpit.
- **Gateway**: o BFF existente pode rotear `/api/cockpit/*` para os novos serviços (api-metrics, api-insights, api-ai) ou o cockpit pode expor seu próprio gateway/BFF.
- **Front**:  
  - **Opção A**: novo app em `cockpit/front-cockpit/` (Next.js) servido por uma rota/porta (ex.: `/cockpit` no nginx).  
  - **Opção B**: módulos “Cockpit” dentro de `web-next/` (pasta `web-next/features/cockpit/` e rotas `/cockpit/*`).
- **Observabilidade**: estender `observability/` com métricas e traces do cockpit (ingestão, APIs, cache, IA).

---

## 3) Responsabilidades por pasta

| Pasta | Responsabilidade |
|-------|-------------------|
| `cockpit/etl` | Detecção de mudança (Excel), versionamento, carga em staging, validação de schema e qualidade (checksum, logs). |
| `cockpit/dw` | Modelo analítico: tabelas staging, dimensões (SCD), fatos, partições; migrations e seeds. |
| `cockpit/semantic` | Definições únicas de métricas, agregações, catálogo e linhagem (aba/coluna → tabela → medida). |
| `cockpit/api-metrics` | API de consulta a métricas (filtros globais, período, paginação, cache). |
| `cockpit/api-insights` | Endpoints para drivers, anomalias, forecast e narrativa. |
| `cockpit/api-ai` | RAG, NLQ, Explain, guardrails e orquestração LLM (sempre grounded nas APIs). |
| `cockpit/front-cockpit` | UI do cockpit: navegação, filtros globais, drill-through, bookmarks, chat/IA. |
| `cockpit/observability` | Métricas, auditoria e (opcional) linhagem operacional do cockpit. |

---

## 4) Convenções sugeridas

- **Contrato de dados**: manter em `cockpit/etl/contract/COCKPIT_CONTRACT.md` (abas, colunas, tipos, chaves). Preencher com nomes exatos do Excel e congelar versão (passo 1 do backlog).
- **Ambientes**: `cockpit/.env.dev`, `cockpit/.env.staging`, `cockpit/.env.prod` (ou uso do `.env` na raiz com prefixo `COCKPIT_`).
- **Testes**: em cada subpasta, ex.: `cockpit/etl/tests/`, `cockpit/api-metrics/tests/`, `cockpit/front-cockpit/__tests__/`.
- **CI**: jobs específicos para `cockpit/` (lint, test, build images) além dos já existentes para core/gateway/web-next.

---

## 5) Próximos passos

1. Criar a árvore `cockpit/` com READMEs em cada pasta.  
2. Definir stack por componente (ex.: api-metrics em Node/TS ou Python conforme time).  
3. Configurar acesso ao Postgres (novo DB ou schema) e Redis.  
4. Implementar conforme **COCKPIT_BACKLOG.md** (Épicos 1–10).

A estrutura acima pode ser ajustada se você preferir nomes como `analytics/` em vez de `cockpit/`, ou consolidar `api-metrics` e `api-insights` em um único serviço.
