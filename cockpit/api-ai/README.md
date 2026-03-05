# Serviço de IA (Grounded)

- **rag/** — Indexação e retrieval: glossário de métricas, regras de negócio, mapeamento abas → tabelas → medidas, playbooks
- **chat/** — NLQ: pergunta em português → orquestração que chama apenas Metrics API e Insights API → resposta curta + evidências + drivers + ações + link para visual
- **explain/** — “Explain this”: contexto (KPI/variação) → painel o que mudou, onde, por quê, o que fazer
- **guardrails/** — Validação e bloqueio: nenhum número sem evidência da API; mascaramento PII por papel

Sempre grounded: IA não inventa números; toda afirmação suportada por resposta das APIs.
