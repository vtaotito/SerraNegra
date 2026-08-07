# Backlog Executavel Priorizado - SAP B1 + WMS + Portal B2B + Power BI

## 1) Objetivo

Transformar o roadmap de 90 dias em backlog executavel com:

- **epicos e historias priorizadas**,
- **criterios de aceite claros**,
- **ordem de execucao orientada por impacto financeiro x esforco**.

---

## 2) Metodo de priorizacao

### Escala de Impacto Financeiro (IF)

- **5** = impacto estimado > R$ 500 mil/ano
- **4** = R$ 250 mil a R$ 500 mil/ano
- **3** = R$ 100 mil a R$ 250 mil/ano
- **2** = R$ 40 mil a R$ 100 mil/ano
- **1** = < R$ 40 mil/ano

### Escala de Esforco (E)

- Story points tecnicos (3, 5, 8, 13, 21)

### Score de prioridade

**Score = IF / E**

Quanto maior o score, maior a prioridade de implementacao.

> Observacao: estimativas financeiras sao referencias para priorizacao e devem ser calibradas com dados reais da distribuidora (faturamento, taxa de avaria, custo de atendimento, ruptura).

---

## 3) Epicos (visao macro)

| Epico | Nome | Resultado de negocio | IF medio | Esforco total (pts) | Prioridade |
|---|---|---|---:|---:|---|
| E1 | Integracao SAP confiavel e dados rastreaveis | Reduz retrabalho, divergencia e atraso de sincronizacao | 5 | 34 | Alta |
| E2 | Write-back WMS -> SAP (Outbox) | Evita status incoerente e perda operacional/comercial | 4 | 21 | Alta |
| E3 | Portal B2B MVP (pedidos + ocorrencias) | Reduz custo de atendimento e aumenta satisfacao de cliente | 5 | 34 | Alta |
| E4 | SLA de atendimento B2B | Aumenta previsibilidade e reduz churn por baixa experiencia | 4 | 21 | Media-Alta |
| E5 | Power BI executivo e operacional | Melhora decisao de margem, rota, SKU e nivel de servico | 4 | 29 | Media-Alta |
| E6 | Dominio vidro (avaria, quebra, retornavel) | Ataca perda financeira direta do negocio | 5 | 24 | Alta |
| E7 | Seguranca, observabilidade e qualidade | Reduz risco de indisponibilidade e regressao | 3 | 21 | Media |

---

## 4) Backlog priorizado (historia a historia)

## E1 - Integracao SAP confiavel e dados rastreaveis

### US-001 - Unificar pipeline de sincronizacao SAP -> WMS
- **IF:** 5 | **E:** 8 | **Score:** 0.63
- **Historia:** Como operacao, quero um unico fluxo de sincronizacao SAP para reduzir inconsistencias entre worker, gateway e core.
- **Criterios de aceite:**
  - Dado que a sincronizacao foi iniciada, quando pedidos forem lidos do SAP, entao todos devem passar pelo mesmo pipeline tecnico.
  - Dado que o pipeline unificado esta ativo, quando houver erro, entao logs devem incluir `correlationId`, `docEntry` e etapa.
  - Dado deploy em homologacao, quando executar sync, entao resultado funcional deve ser equivalente ao estado anterior (sem regressao de pedidos importados).

### US-002 - Persistir cursor de sincronizacao
- **IF:** 4 | **E:** 5 | **Score:** 0.80
- **Historia:** Como time de integracao, quero cursor persistido para evitar reprocessamento e carga desnecessaria no SAP.
- **Criterios de aceite:**
  - Dado restart do worker, quando voltar a sincronizar, entao deve continuar do ultimo cursor salvo.
  - Dado cursor invalido, quando detectar inconsistencia, entao sistema deve alertar e permitir reset controlado.
  - Dado sync concluido, quando consultar endpoint de status, entao ultimo cursor e timestamp devem estar disponiveis.

### US-003 - Reconciliação SAP x WMS
- **IF:** 5 | **E:** 8 | **Score:** 0.63
- **Historia:** Como supervisor, quero reconciliar pedidos entre SAP e WMS para detectar divergencias rapidamente.
- **Criterios de aceite:**
  - Dado periodo selecionado, quando rodar reconciliacao, entao sistema deve listar faltantes e divergentes.
  - Dado divergencia encontrada, quando abrir detalhe, entao exibir campos chave (DocEntry, status SAP, status WMS).
  - Dado divergencia resolvida, quando reprocessar, entao item deve sair da lista de pendencias.

### US-004 - Idempotencia forte por pedido SAP
- **IF:** 4 | **E:** 5 | **Score:** 0.80
- **Historia:** Como arquitetura, quero idempotencia por `sap_doc_entry` + hash de linhas para impedir duplicidade de pedidos e itens.
- **Criterios de aceite:**
  - Dado mesmo payload recebido duas vezes, quando processar, entao apenas uma escrita efetiva deve ocorrer.
  - Dado payload diferente com mesma chave, quando processar, entao registrar conflito e nao sobrescrever sem regra explicita.
  - Dado conflito, quando consultar logs, entao evento deve estar auditado com motivo.

### US-005 - Trilha E2E de correlacao
- **IF:** 3 | **E:** 8 | **Score:** 0.38
- **Historia:** Como suporte, quero rastrear uma transacao ponta a ponta para reduzir tempo de diagnostico.
- **Criterios de aceite:**
  - Dado uma transacao, quando buscar por `correlationId`, entao localizar eventos no gateway, worker e core.
  - Dado erro de integracao, quando abrir log consolidado, entao etapa de falha deve ser identificavel.
  - Dado auditoria, quando exportar trilha, entao incluir timestamps e atores tecnicos.

---

## E2 - Write-back WMS -> SAP (Outbox)

### US-006 - Implementar tabela e publisher de outbox
- **IF:** 4 | **E:** 8 | **Score:** 0.50
- **Historia:** Como operacao, quero que mudancas criticas de status no WMS sejam publicadas em outbox para garantir envio ao SAP.
- **Criterios de aceite:**
  - Dado transicao de pedido no WMS, quando evento for confirmado, entao registro de outbox deve ser criado na mesma transacao.
  - Dado falha de envio ao SAP, quando ocorrer, entao evento deve permanecer pendente para retry.
  - Dado sucesso de envio, quando concluir, entao status do outbox deve mudar para processado.

### US-007 - Consumer com retry e DLQ
- **IF:** 4 | **E:** 8 | **Score:** 0.50
- **Historia:** Como time de integracao, quero retries controlados e fila de falhas para nao perder atualizacoes SAP.
- **Criterios de aceite:**
  - Dado falha temporaria SAP, quando processar outbox, entao aplicar retry com backoff.
  - Dado excedente de tentativas, quando limite atingir, entao mover para DLQ com erro detalhado.
  - Dado item em DLQ, quando reprocessar manualmente, entao deve voltar para pendente e tentar novamente.

### US-008 - Painel de falhas de integracao
- **IF:** 3 | **E:** 5 | **Score:** 0.60
- **Historia:** Como supervisor, quero visualizar e reprocessar falhas para reduzir impacto operacional.
- **Criterios de aceite:**
  - Dado falha de outbox, quando abrir painel, entao listar causa, quantidade de tentativas e ultimo erro.
  - Dado permissao adequada, quando clicar em reprocessar, entao item deve retornar ao fluxo.
  - Dado reprocessamento concluido, quando atualizar painel, entao status deve refletir resultado.

---

## E3 - Portal B2B MVP (pedidos + ocorrencias)

### US-009 - Autenticacao e perfil de cliente B2B
- **IF:** 4 | **E:** 8 | **Score:** 0.50
- **Historia:** Como cliente B2B, quero acessar apenas meus pedidos e chamados com seguranca.
- **Criterios de aceite:**
  - Dado usuario autenticado, quando acessar portal, entao visualizar apenas dados do seu cliente/conta.
  - Dado usuario sem permissao, quando tentar acessar recurso de outro cliente, entao retorno deve ser 403.
  - Dado login valido, quando abrir sessao, entao token/perfil devem estar auditados.

### US-010 - Acompanhamento de pedidos no portal
- **IF:** 5 | **E:** 8 | **Score:** 0.63
- **Historia:** Como cliente B2B, quero acompanhar status e timeline do pedido sem depender de atendimento humano.
- **Criterios de aceite:**
  - Dado pedido existente, quando abrir detalhe, entao exibir status atual, timeline e dados logísticos.
  - Dado alteracao de status no WMS, quando portal atualizar, entao informacao deve refletir em ate 60s.
  - Dado filtro por periodo/status, quando aplicar, entao lista deve retornar corretamente paginada.

### US-011 - Abertura de ocorrencia com anexos
- **IF:** 5 | **E:** 8 | **Score:** 0.63
- **Historia:** Como cliente B2B, quero abrir ocorrencias (avaria, atraso, divergencia, devolucao) com evidencias.
- **Criterios de aceite:**
  - Dado pedido entregue, quando cliente abrir ocorrencia, entao deve selecionar tipo e descrever problema.
  - Dado upload de anexo valido, quando enviar, entao arquivo deve ficar associado ao chamado.
  - Dado ocorrencia registrada, quando consultar historico, entao status e prazo de atendimento devem estar visiveis.

### US-012 - Notificacoes de evento para cliente
- **IF:** 4 | **E:** 5 | **Score:** 0.80
- **Historia:** Como cliente B2B, quero ser notificado sobre mudancas importantes de pedido e chamado.
- **Criterios de aceite:**
  - Dado evento relevante (ex.: despacho, chamado atualizado), quando ocorrer, entao notificar via portal.
  - Dado preferencia configurada, quando habilitar email, entao enviar notificacao com link do detalhe.
  - Dado notificacao lida, quando cliente abrir central, entao status de leitura deve ser registrado.

---

## E4 - SLA de atendimento B2B

### US-013 - Motor de SLA de chamado
- **IF:** 4 | **E:** 8 | **Score:** 0.50
- **Historia:** Como gestao de atendimento, quero calcular SLA de primeiro atendimento e resolucao por tipo de ocorrencia.
- **Criterios de aceite:**
  - Dado abertura de chamado, quando tipo for definido, entao SLA alvo deve ser calculado automaticamente.
  - Dado chamado em progresso, quando prazo estiver proximo, entao status deve mudar para alerta.
  - Dado prazo vencido, quando ocorrer, entao chamado deve ser marcado como fora de SLA.

### US-014 - Fila operacional de atendimento
- **IF:** 3 | **E:** 5 | **Score:** 0.60
- **Historia:** Como equipe de atendimento, quero fila priorizada por SLA e severidade para atuar no que gera maior impacto financeiro.
- **Criterios de aceite:**
  - Dado multiplos chamados, quando abrir fila, entao ordem deve considerar severidade e vencimento de SLA.
  - Dado atribuicao de analista, quando registrar owner, entao historico deve guardar quem assumiu.
  - Dado conclusao do chamado, quando encerrar, entao motivo e acao corretiva devem ser obrigatorios.

### US-015 - Base de conhecimento e autosservico
- **IF:** 3 | **E:** 8 | **Score:** 0.38
- **Historia:** Como cliente B2B, quero consultar orientacoes antes de abrir chamado para reduzir tempo e custo de atendimento.
- **Criterios de aceite:**
  - Dado artigo publicado, quando cliente buscar termo, entao conteudo deve ser encontrado por relevancia.
  - Dado cliente resolveu pelo artigo, quando finalizar fluxo, entao registrar desvio de abertura de chamado.
  - Dado painel de atendimento, quando analisar indicadores, entao mostrar taxa de autosservico.

---

## E5 - Power BI executivo e operacional

### US-016 - Modelo semantico corporativo (fatos/dimensoes)
- **IF:** 4 | **E:** 8 | **Score:** 0.50
- **Historia:** Como area de dados, quero uma camada semantica padronizada para garantir KPIs confiaveis no Power BI.
- **Criterios de aceite:**
  - Dado modelo publicado, quando consumir no Power BI, entao fatos e dimensoes devem estar documentados.
  - Dado KPI (OTIF, fill rate, avaria), quando recalcular, entao regra deve estar centralizada e versionada.
  - Dado auditoria de dado, quando comparar com fonte, entao divergencia maxima aceitavel deve ser definida.

### US-017 - Dashboard executivo (diretoria/comercial)
- **IF:** 5 | **E:** 8 | **Score:** 0.63
- **Historia:** Como diretoria, quero visualizar margem, nivel de servico e perdas para decidir prioridades comerciais.
- **Criterios de aceite:**
  - Dado dashboard executivo, quando abrir, entao exibir OTIF, fill rate, margem e perdas por avaria.
  - Dado filtro por cliente/rota/periodo, quando aplicar, entao KPIs devem recalcular em ate 10s.
  - Dado comparacao temporal, quando selecionar periodo, entao mostrar variacao percentual.

### US-018 - Dashboard atendimento (SLA e backlog)
- **IF:** 4 | **E:** 5 | **Score:** 0.80
- **Historia:** Como coordenacao de atendimento, quero medir SLA e backlog para reduzir chamados fora de prazo.
- **Criterios de aceite:**
  - Dado dashboard de atendimento, quando abrir, entao mostrar primeiro atendimento, resolucao, backlog e reabertura.
  - Dado segmento por cliente/canal, quando filtrar, entao priorizar contas de maior impacto.
  - Dado meta definida, quando indicador piorar, entao sinalizar desvio.

### US-019 - Dashboard operacao (produtividade e divergencias)
- **IF:** 4 | **E:** 8 | **Score:** 0.50
- **Historia:** Como operacao, quero acompanhar produtividade e divergencias para reduzir retrabalho e perda.
- **Criterios de aceite:**
  - Dado dashboard operacional, quando abrir, entao mostrar produtividade por operador/zona e divergencia por SKU.
  - Dado incidencia alta de divergencia, quando detectar, entao permitir drill-down para origem.
  - Dado periodo diario/semanal, quando comparar, entao exibir tendencia.

---

## E6 - Dominio vidro (avaria, quebra e retornavel)

### US-020 - Evento de avaria/quebra por etapa
- **IF:** 5 | **E:** 8 | **Score:** 0.63
- **Historia:** Como operacao, quero registrar avaria por etapa (separacao, carga, transporte, entrega) para atacar perda financeira.
- **Criterios de aceite:**
  - Dado avaria identificada, quando registrar, entao etapa, quantidade e motivo devem ser obrigatorios.
  - Dado avaria com evidencia, quando anexar foto, entao registro deve ficar vinculado ao pedido/entrega.
  - Dado KPI de avaria, quando consultar BI, entao refletir o evento em ate 24h (ou near real-time conforme arquitetura).

### US-021 - Fluxo de devolucao/retorno de vasilhame
- **IF:** 4 | **E:** 8 | **Score:** 0.50
- **Historia:** Como comercial/financeiro, quero controlar retorno de vasilhames para reduzir perda patrimonial.
- **Criterios de aceite:**
  - Dado cliente com saldo retornavel, quando registrar devolucao, entao saldo deve ser atualizado.
  - Dado divergencia no retorno, quando fechar ciclo, entao gerar ocorrencia automaticamente.
  - Dado consolidado mensal, quando exportar, entao apresentar perdas e taxa de retorno.

### US-022 - KPI de perdas financeiras por avaria/retorno
- **IF:** 5 | **E:** 8 | **Score:** 0.63
- **Historia:** Como diretoria, quero KPI monetizado de perdas para priorizar acoes com maior retorno.
- **Criterios de aceite:**
  - Dado eventos de avaria e retorno, quando consolidar, entao calcular perda em R$ por cliente/rota/SKU.
  - Dado alvo de reducao, quando acompanhar mensalmente, entao mostrar gap vs meta.
  - Dado decisao tatico-comercial, quando filtrar top perdas, entao listar causas e recorrencia.

---

## E7 - Seguranca, observabilidade e qualidade

### US-023 - RBAC/ABAC no portal e APIs B2B
- **IF:** 3 | **E:** 8 | **Score:** 0.38
- **Historia:** Como seguranca, quero garantir segregacao de acesso por cliente/perfil para proteger dados sensiveis.
- **Criterios de aceite:**
  - Dado perfil cliente, quando consultar recursos, entao acessar apenas seu escopo.
  - Dado perfil interno, quando atuar em chamados, entao permissoes devem respeitar funcao.
  - Dado tentativa indevida, quando ocorrer, entao registrar auditoria e negar acesso.

### US-024 - Alertas operacionais de integracao e SLA
- **IF:** 3 | **E:** 5 | **Score:** 0.60
- **Historia:** Como suporte, quero alertas de falha de sync e SLA critico para agir antes de impacto no cliente.
- **Criterios de aceite:**
  - Dado falha recorrente de sync, quando limiar exceder, entao gerar alerta automatico.
  - Dado backlog critico de chamados, quando ultrapassar limite, entao notificar coordenacao.
  - Dado incidente encerrado, quando normalizar, entao registrar recuperacao.

### US-025 - Suite de testes E2E criticos
- **IF:** 3 | **E:** 8 | **Score:** 0.38
- **Historia:** Como engenharia, quero testes E2E dos fluxos criticos para reduzir regressao em producao.
- **Criterios de aceite:**
  - Dado pipeline CI, quando abrir PR, entao cenarios criticos devem executar automaticamente.
  - Dado regressao em fluxo de pedido/chamado, quando ocorrer, entao build deve falhar.
  - Dado cobertura acordada, quando medir, entao meta minima deve ser atingida para go-live.

---

## 5) Ordem recomendada de execucao (12 semanas)

### Sprint 1-2 (Semanas 1-4)
Prioridade: integracao e confiabilidade de dados

- US-002, US-004, US-001, US-006, US-007

### Sprint 3-4 (Semanas 5-8)
Prioridade: valor direto para cliente B2B

- US-009, US-010, US-011, US-012, US-013

### Sprint 5-6 (Semanas 9-12)
Prioridade: BI executivo + dominio vidro + operacao assistida

- US-017, US-018, US-020, US-022, US-008, US-014

> Itens de segunda onda (apos 90 dias): US-003, US-015, US-016, US-019, US-021, US-023, US-024, US-025.

---

## 6) Definicoes de pronto (DoR/DoD)

### DoR (Definition of Ready)
- Historia com objetivo de negocio e dono definido.
- Criticos de aceite revisados por negocio e tecnologia.
- Dependencias mapeadas (SAP, DB, frontend, BI).

### DoD (Definition of Done)
- Codigo em branch principal com review aprovado.
- Testes automatizados minimos do fluxo implementado.
- Observabilidade e logs incluidos.
- Documentacao funcional e tecnica atualizada.
- Criterios de aceite validados em homologacao.

---

## 7) Riscos e mitigacoes do backlog

- **Risco:** dependencia de ambiente SAP para testes reais.  
  **Mitigacao:** homologacao com sandbox + testes com mock e contrato.

- **Risco:** escopo B2B crescer sem controle.  
  **Mitigacao:** travar MVP em pedidos + ocorrencias + SLA.

- **Risco:** BI sem governanca de KPI.  
  **Mitigacao:** dicionario de dados versionado e aprovacao executiva de metricas.

---

## 8) Resultado esperado apos 90 dias

- Fluxo SAP <-> WMS mais confiavel e auditavel.
- Portal B2B MVP operando para acompanhamento de pedidos e ocorrencias.
- Dashboards executivos em Power BI com visao de servico, perdas e margem.
- Base pronta para segunda onda (retornavel, automacoes e escala).
