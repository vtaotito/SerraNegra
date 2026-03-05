# Cockpit Comercial — Blueprint para Backlog

Blueprint pronto para planejamento: **épicos → features → histórias de usuário** com critérios de aceitação, alinhado ao spec do cockpit analítico (Excel → produto analítico + IA grounded).

---

## Fase 1 — MVP Executivo + Comercial

### Épico 1 — Contrato de Dados e Ingestão Versionada

| ID | Feature | Descrição |
|----|---------|-----------|
| F1.1 | Contrato de dados | Mapeamento abas/colunas do Excel, tipos, chaves; documento congelado e versionado |
| F1.2 | Ingestão versionada | Captura do arquivo (SharePoint/OneDrive/local) + hash + metadados (autor, data, caminho) + histórico de versões |
| F1.3 | Staging e validação | Landing zone por aba; validação de schema, checksum, logs de ingestão |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H1.1.1 | Gestor de dados | um documento de contrato (abas, colunas, tipos, chaves) aprovado e versionado | garantir reprodutibilidade e evolução controlada | (A) Documento publicado em repo; (B) alterações via MR com revisão |
| H1.2.1 | Sistema | detectar nova versão do Excel (hash/metadados) e registrar em histórico | auditoria e reprocessamento seletivo | (A) Cada ingestão gera registro com hash, timestamp, origem; (B) listagem de versões disponível |
| H1.2.2 | Operador | disparar ingestão sob demanda (“Atualizar dados”) além do agendamento | flexibilidade em dev/staging | (A) Endpoint ou job manual; (B) idempotência por versão |
| H1.3.1 | Pipeline | gravar dados brutos em staging por aba com validação de schema | evitar dados quebrados no DW | (A) Schema check por aba; (B) registros rejeitados em tabela de erros com motivo |
| H1.3.2 | Admin | consultar log de ingestões (sucesso/falha, duração, registros) | operação e troubleshooting | (A) Tela ou API de logs; (B) filtro por período e status |

---

### Épico 2 — Modelo Analítico (DW: fatos, dimensões, SCD)

| ID | Feature | Descrição |
|----|---------|-----------|
| F2.1 | Staging → limpeza e padronização | Datas, moedas, códigos (trim, upper), nulos → unknown_* |
| F2.2 | Dimensões com SCD | DimCliente, DimProduto, DimVendedor, DimTempo, DimDomínios; SCD2 onde aplicável |
| F2.3 | Fatos e grãos | FatoDocumentos (Documento+Item+Linha), FatoEstoque, FatoCarteira, FatoCustos conforme spec |
| F2.4 | Integridade e duplicidade | Chaves candidatas, unicidade, referência a dimensões; tratamento de duplicidade |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H2.1.1 | Pipeline | padronizar datas (timezone, campo “data documento” vs “lançamento”) e moeda base | consistência nas métricas | (A) Regras documentadas; (B) colunas normalizadas em staging |
| H2.2.1 | Analista | que DimCliente/DimProduto/DimVendedor tenham histórico (SCD2) para atributos críticos | análise temporal correta | (A) effective_from/effective_to ou equivalente; (B) FK dos fatos para surrogate key |
| H2.3.1 | Sistema | FatoDocumentos no grão linha (Documento+Item+Linha) sem duplicidade na chave candidata | (A1)(A2) do spec | (A) Chave única (DocNum, TipoObjeto, DataDocumento, CardCode, line_id); (B) teste de unicidade no pipeline |
| H2.4.1 | Pipeline | garantir que CardCode em fatos exista em DimCliente ou seja mapeado para unknown_customer | integridade referencial | (A) Regra aplicada; (B) alerta quando unknown_* é usado |

---

### Épico 3 — Camada Semântica e Métricas

| ID | Feature | Descrição |
|----|---------|-----------|
| F3.1 | Dicionário de métricas | Definições únicas (fórmula, tabela, filtros padrão) versionadas |
| F3.2 | KPI store / agregações | Rollups por mês (geral, vendedor, cliente, produto) para performance |
| F3.3 | API de métricas | Consultas parametrizadas por filtros globais, paginação, ordenação, cache |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H3.1.1 | Produto | um catálogo de métricas (Faturamento Bruto/Líquido, Margem %, CMV, Ticket, etc.) com fórmula e origem | métricas únicas e rastreáveis | (A) Definições em código/config versionado; (B) exposição no catálogo (Admin) |
| H3.2.1 | Sistema | tabelas de agregação mensal (faturamento, volume, margem por dimensão) atualizadas no refresh | Home e listagens rápidas | (A) Jobs de agregação; (B) incremental por partição de data |
| H3.3.1 | Front-end | chamar uma API de métricas com período, filtros (vendedor, região, canal) e receber valores consistentes com o DW | (B1) filtros globais | (A) API documentada; (B) resposta inclui metadados (medida, período, filtros) |
| H3.3.2 | Sistema | cachear resultados por (usuário/papel + filtros + período) com TTL | (E1) performance | (A) Cache configurável; (B) métrica cache hit rate |

---

### Épico 4 — Portal Web (Cockpit) — Navegação e Filtros

| ID | Feature | Descrição |
|----|---------|-----------|
| F4.1 | Shell do app | Topbar (período, busca, Chat/IA, Bookmarks, status atualização) + Sidebar (módulos) |
| F4.2 | Filtros globais persistentes | Período, vendedor, região, canal, cliente, produto; persistência em drill-through |
| F4.3 | Home — Visão Executiva | KPI cards, trend MTD/YTD, waterfall drivers, top clientes/produtos/vendedores, painel Insights IA |
| F4.4 | Comercial — Detalhe | Funil Vendedor→Cliente→Produto→Documento; scatter preço×volume; tabela de documentos |
| F4.5 | Componentes padrão | KPI Card, Global Filter Bar, Rich Table, Drill-through Drawer, skeleton/empty states, toasts/banner |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H4.1.1 | Usuário | uma topbar com seletor de período global, busca (cliente/produto/doc), botão Chat/IA, Bookmarks e “Dados atualizados em…” | (B1) navegação tipo app | (A) Componentes implementados; (B) estado de período sincronizado com filtros globais |
| H4.2.1 | Usuário | que filtros globais (período, vendedor, região, canal, etc.) se mantenham ao fazer drill-through e ao voltar | (B1)(B2) | (A) Estado em contexto/URL; (B) botão “Voltar” e breadcrumb visíveis |
| H4.2.2 | Usuário | salvar e reabrir uma visão com os mesmos filtros (bookmark) | (B4) | (A) Salvar bookmark; (B) abrir bookmark restaura filtros e visualização |
| H4.3.1 | Executivo | ver na Home KPIs (Faturamento, Volume, Margem %, CMV, Ticket, Carteira, Estoque, Rupturas) com variação e sparkline | panorama rápido | (A) KPI cards com dados da Metrics API; (B) “Explain this” no card |
| H4.3.2 | Executivo | ver trend de faturamento/margem por mês e waterfall de drivers de margem | (B1) | (A) Gráficos com dados corretos; (B) deep link para detalhe |
| H4.4.1 | Gerente | fazer drill Vendedor → Cliente → Produto → Documento preservando filtros globais | (B2) | (A) Breadcrumb e “Voltar”; (B) tabela e scatter atualizam por nível |
| H4.5.1 | Usuário | ver skeleton loaders e empty states em todas as páginas | (B3) | (A) Loading state; (B) empty state com CTA quando sem dados |

---

### Épico 5 — Qualidade de Dados e Alertas

| ID | Feature | Descrição |
|----|---------|-----------|
| F5.1 | Regras de qualidade | Freshness, schema/tipos, completude, unicidade, integridade referencial, reconciliação |
| F5.2 | Reconciliação | Comparação total RESUMO COMERCIAL vs DW (mesmo período); threshold e alerta |
| F5.3 | Alertas acionáveis | Estoque crítico, queda de margem, carteira atípica, falha de ingestão; botão “Abrir visualização” |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H5.1.1 | Admin | regra de freshness (última ingestão &lt; SLA) com alerta em falha | (E3) | (A) Job/check de freshness; (B) banner no app + notificação |
| H5.2.1 | Sistema | comparar totais do DW com aba RESUMO COMERCIAL para o período e disparar alerta se diferença &gt; threshold | (A1) | (A) Cálculo documentado; (B) alerta “Reconciliação” acionável |
| H5.3.1 | Usuário | receber alerta “Estoque crítico” com botão que abre Estoque filtrado | acionabilidade | (A) Regra (ex.: cobertura &lt; X dias); (B) deep link com filtros |

---

## Fase 2 — Produtos, Clientes, Estoque, Carteira

### Épico 6 — Módulos de Domínio (Clientes, Produtos, Estoque, Carteira, Margens)

| ID | Feature | Descrição |
|----|---------|-----------|
| F6.1 | Clientes | Ranking, sparklines, Pareto 80/20, “clientes em risco”, drill Cliente 360 |
| F6.2 | Produtos | Curva ABC, giro×margem, ruptura/estoque baixo, drill Produto 360 |
| F6.3 | Estoque | Cobertura (dias), aging, itens críticos, recomendações Repor/Queimar |
| F6.4 | Carteira/Pipeline | Carteira por mês/segmento, tabela oportunidades, previsão de faturamento |
| F6.5 | Margens & CMV | Drivers preço×volume×mix×custo, heatmap mês×categoria, auditoria de variação |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H6.1.1 | Gerente | ranking de clientes com sparkline por mês e concentração 80/20 | análise de concentração | (A) Gráfico e tabela; (B) filtros globais aplicados |
| H6.1.2 | Gerente | lista “Clientes em risco” (anomalia/queda) com link para detalhe | (B4) insights | (A) Dados da Insights API; (B) “Abrir análise” com filtro |
| H6.2.1 | Analista | curva ABC e quadrantes Giro×Margem com ruptura/estoque baixo destacados | mix e operação | (A) Visualizações; (B) drill-through para Produto 360 |
| H6.3.1 | Operador | ver cobertura em dias por categoria/produto e itens críticos com recomendação Repor/Queimar | (A) Estoque | (A) Tabela e filtros; (B) link para vendas/estoque |
| H6.4.1 | Comercial | carteira por mês e por segmento + tabela de oportunidades (cliente, valor, data, status) | pipeline | (A) Gráficos e tabela; (B) previsão baseada em carteira+histórico |
| H6.5.1 | Controller | drivers de margem (preço/volume/mix/custo) e heatmap mês×categoria com auditoria de variação | (A) Margem | (A) Waterfall/drivers; (B) “onde CMV subiu / preço caiu” |

---

## Fase 3 — IA Avançada e Data Quality / Admin

### Épico 7 — Serviço de Insights (Drivers, Anomalias, Forecast)

| ID | Feature | Descrição |
|----|---------|-----------|
| F7.1 | Insights API — drivers | Decomposição de variação (preço, volume, mix, custo) por KPI e nível |
| F7.2 | Insights API — anomalias | Detecção robusta (z-score/MAD, mudança de regime) por KPI e nível |
| F7.3 | Insights API — forecast | Série temporal com intervalo de confiança e premissas documentadas |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H7.1.1 | Front/IA | endpoint de drivers para um KPI e período (e opcionalmente vendedor/cliente/produto) | explicar variações | (A) API estável; (B) resposta com contribuições % e R$ |
| H7.2.1 | Sistema | detectar anomalias por KPI (empresa → vendedor → cliente → produto) com método configurável | (B4) insights automáticos | (A) Endpoint anomalias; (B) usado por “3 coisas para ver hoje” |
| H7.3.1 | Usuário | previsão de faturamento/volume com intervalo e premissas (sazonalidade, tendência) | (C) forecast | (A) Forecast API; (B) narrativa executiva opcional |

---

### Épico 8 — IA Grounded (NLQ, Explain, Narrativa)

| ID | Feature | Descrição |
|----|---------|-----------|
| F8.1 | RAG e guardrails | Base de conhecimento (glossário, regras, mapeamento abas→medidas); IA só responde via APIs |
| F8.2 | Chat de dados (NLQ) | Perguntas em português → resposta curta + evidências + drivers + ações + link para visual |
| F8.3 | Explain this (contextual) | Clique em KPI/variação → painel: o que mudou, onde, por quê, o que fazer |
| F8.4 | Insights automáticos | “3 coisas para ver hoje”; cards com “Abrir análise”, “Explicar”, “Criar alerta” |
| F8.5 | Avaliação | Consistência numérica, groundedness, testes de RLS/CLS, rubrica de narrativa |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H8.1.1 | Sistema | indexar glossário de métricas, regras de negócio e mapeamento aba→tabela→medida para RAG | (C2) grounded | (A) Base indexada; (B) IA usa apenas resultados de Metrics/Insights API para números |
| H8.2.1 | Usuário | fazer pergunta em português e receber resposta com evidências (métrica, período, filtros), drivers, ações e link para visualização | (C1)(C2) | (A) Resposta contém os 5 elementos; (B) link abre visão exata no dashboard |
| H8.2.2 | Produto | que a IA nunca retorne números sem evidência da Metrics API | (C2)(C3) | (A) Guardrail implementado; (B) teste de groundedness em amostra de perguntas |
| H8.3.1 | Usuário | clicar em “Explain this” em um KPI/variação e ver painel: o que mudou, onde, por quê, o que fazer | (C1) | (A) Drawer/modal com conteúdo; (B) dados vêm da Insights API |
| H8.4.1 | Usuário | ver na Home “3 coisas para ver hoje” (quedas, ganhos, anomalias, ruptura, carteira atípica) com ações | (B4) | (A) Cards com botões Abrir/Explicar/Alerta |
| H8.5.1 | QA | rodar bateria de testes: valores chat = dashboard, groundedness, RLS (vendedor não vê outro) | (C3)(D1) | (A) Testes automatizados; (B) relatório de qualidade narrativa |

---

### Épico 9 — Segurança, Governança e Observabilidade

| ID | Feature | Descrição |
|----|---------|-----------|
| F9.1 | RBAC e RLS/CLS | Papéis (Executivo, Gerente, Vendedor, Analista, Admin); RLS por seller_id/região/tenant; CLS mascaramento PII |
| F9.2 | Auditoria e linhagem | Quem acessou o quê, quando, filtros, export; aba/coluna → transformação → tabela → medida → visual |
| F9.3 | Qualidade de Dados — tela e logs | Freshness, % nulos, duplicidade, reconciliação, log de ingestões (versões) |
| F9.4 | Admin e catálogo | Papéis/permissões, regras RLS/CLS, catálogo de métricas (owner, versão), auditoria de acessos/ações |
| F9.5 | Observabilidade | Logs estruturados, tracing, métricas (latência, cache hit, falhas ingestão, queries lentas) |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H9.1.1 | Admin | definir papéis e regras RLS (ex.: vendedor só vê sua carteira) aplicadas em todas as consultas | (D1) | (A) RLS por papel; (B) teste automatizado: vendedor A não vê dados de vendedor B |
| H9.1.2 | Admin | mascarar PII (nome completo, CPF, email) conforme papel (CLS) | (D3) | (A) Colunas sensíveis configuráveis; (B) logs de export |
| H9.2.1 | Admin | consultar auditoria de acessos (quem, quando, quais filtros, se exportou) | (D2) | (A) Registro em toda consulta/export; (B) tela ou API de auditoria |
| H9.2.2 | Analista | ver linhagem: aba/coluna Excel → transformação → tabela DW → medida → visual | governança | (A) Metadados de linhagem; (B) expostos no catálogo ou tela Admin |
| H9.3.1 | Admin | tela Qualidade de Dados com freshness, % nulos por campo, duplicidade, reconciliação e log de versões de ingestão | (E3) | (A) Métricas e lista de ingestões; (B) link para logs em falha |
| H9.5.1 | DevOps | métricas de latência, cache hit, falhas de ingestão e queries lentas em painel operacional | (E1) | (A) Instrumentação; (B) alertas configuráveis |

---

## Fase 4 — Performance, Feature Flags e Go-Live

### Épico 10 — Performance, CI/CD e Operação

| ID | Feature | Descrição |
|----|---------|-----------|
| F10.1 | Incremental refresh e agregações | Partições por data; reprocessar janela recente; rollups mensais |
| F10.2 | Limites de UI e backend | Progressive disclosure, paginação server-side, virtualização; limites de query |
| F10.3 | Ambientes e CI/CD | Dev, Staging, Prod; pipeline lint/test → qualidade dados → deploy → smoke (consultas + RBAC) |
| F10.4 | Feature flags | IA (chat/insights), Forecast, Export/compartilhamento, versão v2 de métricas |

**Histórias (exemplos)**

| História | Como… | Quero… | Para… | Critérios de aceitação |
|----------|--------|--------|--------|------------------------|
| H10.1.1 | Sistema | refresh incremental por partição de data com janela de segurança reprocessável | (E2) | (A) Sem inconsistência ao reprocessar últimos N dias |
| H10.2.1 | Produto | evitar telas com muitos visuais pesados; usar “ver detalhes” (drawer) e paginação server-side em tabelas | (E1) | (A) Limite de visuais por tela; (B) virtualização em listas grandes |
| H10.3.1 | DevOps | pipeline CI: lint/test (ETL, APIs, front) → testes qualidade dados → deploy infra+apps → smoke (consultas + login RBAC) | (E3) | (A) Pipeline documentado; (B) promoção staging → prod controlada |
| H10.4.1 | Produto | liberar IA (chat/insights) por grupo de usuários e forecast por módulo via feature flags | rollback seguro | (A) Flags configuráveis; (B) rollback sem deploy |

---

## Critérios de Aceitação Globais (Checklist de Go-Live)

- **A) Dados e modelo**: (A1) Reconciliação DW vs RESUMO COMERCIAL dentro do threshold; (A2) FatoDocumentos sem duplicidade; (A3) Dimensões com SCD e integridade.
- **B) UX**: (B1) Filtros globais persistentes em drill-through; (B2) Voltar + breadcrumb; (B3) Skeleton e empty states; (B4) Bookmarks.
- **C) IA**: (C1) Resposta com evidências + drivers + ações + link; (C2) Números só via API; (C3) Teste groundedness.
- **D) Segurança**: (D1) RLS testado; (D2) Auditoria de acessos/exports; (D3) CLS mascaramento.
- **E) Operação**: (E1) Home no SLA com cache/agregações; (E2) Incremental refresh ok; (E3) Alertas de ingestão/freshness.

---

## Ordem sugerida de implementação (resumo)

1. Contrato de dados + ingestão versionada + staging (Épico 1).  
2. Modelo DW: staging → limpeza, dimensões SCD, fatos (Épico 2).  
3. Camada semântica + agregações + Metrics API (Épico 3).  
4. Portal: shell, filtros globais, Home, Comercial, componentes (Épico 4).  
5. Qualidade de dados e alertas (Épico 5).  
6. Módulos Clientes, Produtos, Estoque, Carteira, Margens (Épico 6).  
7. Insights API: drivers, anomalias, forecast (Épico 7).  
8. IA: RAG, chat NLQ, Explain, insights automáticos, avaliação (Épico 8).  
9. RBAC, RLS/CLS, auditoria, linhagem, Admin, observabilidade (Épico 9).  
10. Performance, CI/CD, feature flags, go-live (Épico 10).

Este documento pode ser importado para Azure DevOps, Jira ou equivalente (épicos = Epics, features = Features, histórias = User Stories, critérios = Acceptance Criteria).
