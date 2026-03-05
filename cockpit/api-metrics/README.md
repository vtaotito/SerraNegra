# API de Métricas

Query engine: consultas parametrizadas por período, filtros globais (vendedor, região, canal, cliente, produto), paginação e ordenação. Resposta inclui metadados (medida, período, filtros). Cache por (usuário/papel + filtros + período) com TTL. RLS aplicado conforme papel do usuário.

Stack a definir (Node/TS ou Python) conforme time. Integrar com `semantic/metrics` para resolução das definições.
