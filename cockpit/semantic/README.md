# Camada Semântica

- **metrics/** — Definições únicas de métricas (fórmula, tabela, filtros padrão) em YAML/JSON ou código; versionamento
- **catalog/** — Catálogo (linhagem aba/coluna → transformação → tabela → medida), owner, versão
- **aggregates/** — Rollups (ex.: mensal por vendedor, cliente, produto) para performance da Home e listagens

Garantir uma única definição por métrica (ex.: Faturamento Bruto, Margem %, Ticket Médio) consumida pela API de métricas e pelo front.
