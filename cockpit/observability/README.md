# Observabilidade — Cockpit

- **metrics/** — Latência das APIs, cache hit rate, falhas de ingestão, queries lentas
- **audit/** — Eventos de acesso (quem, quando, filtros, export, bookmark)
- **lineage/** — (Opcional) Metadados de linhagem para operação; catálogo detalhado pode ficar em `semantic/catalog`

Integrar com o `observability/` existente na raiz do repositório (logs, tracing, métricas).
