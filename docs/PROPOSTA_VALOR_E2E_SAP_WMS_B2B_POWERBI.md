# Proposta de Valor E2E - SAP B1 + WMS + Portal B2B + Power BI

## 1) Objetivo

Definir uma proposta de valor orientada a negocio e um plano de evolucao tecnica para o projeto, considerando:

- conector SAP Business One (Service Layer),
- operacao WMS,
- portal B2B (web/app),
- camada analitica em Power BI,

com foco no contexto de uma distribuidora de garrafas de vidro.

---

## 2) Diagnostico E2E atual do repositorio

### 2.1 Arquitetura em uso hoje (evidencia no codigo)

Fluxo principal atual:

1. **SAP B1** -> **Gateway (`/sap/*`)**
2. **Gateway/Worker** -> **Core FastAPI (`core/app/main.py`)**
3. **Core** -> **PostgreSQL**
4. **Web Next.js (`web-next`)** consumindo API via Nginx (`/api`)

Arquivos-chave:

- `docker-compose.yml` (stack atual com `core`, `gateway`, `worker`, `web`, `nginx`)
- `core/app/main.py` (endpoints operacionais, bulk sync e `/internal/sap/orders`)
- `gateway/src/routes/sap.ts` (saude SAP, sync de pedidos, produtos, estoque e clientes)
- `web-next/app/*` (dashboard operacional e integracao SAP)
- `wms-core/reports/*` (base SQL robusta para analises e BI)

### 2.2 O que esta forte hoje

- Conector SAP resiliente (retry/backoff, circuit breaker, rate limit) em `sap-connector`.
- Sync SAP com endpoints de operacao e bulk import para catalogo/estoque/clientes.
- Core com idempotencia, historico de eventos de pedidos e endpoint interno protegido por segredo.
- Frontend Next.js funcional para operacao interna (pedidos, estoque, produtos, integracao SAP).
- Suite de testes de dominio consistente:
  - `npm test`: **21 passed, 0 failed, 6 skipped** (integracoes SAP reais ficam opcionais por ambiente).
- Base SQL de relatorios pronta para Power BI (`report_sla_*`, `report_*_productivity`, `report_*_divergence`).

### 2.3 Gaps reais para o alvo de negocio

1. **Portal B2B de atendimento ainda nao existe como produto de cliente final**
   - Hoje o frontend e majoritariamente operacional interno (WMS/OMS).
   - Faltam jornadas de cliente: pedidos, ocorrencias, 2a via, SLA de atendimento, devolucoes.

2. **Mobile app B2B nao esta implementado**
   - Existe PWA de coletor (`collector/`) voltada para operacao de armazem, nao para cliente B2B.

3. **Power BI ainda sem camada semantica oficial do negocio**
   - Ha excelentes views SQL, mas falta modelo corporativo (fatos/dimensoes/KPIs) e governanca de dados.

4. **Duplicidade de caminhos de integracao SAP**
   - Parte da logica esta no `worker`, parte no `gateway`, parte no `sap-connector`.
   - Oportunidade de consolidar padrao unico (cursor, outbox, rastreabilidade e retry padronizado).

5. **Lacunas de dominio especifico de vidro**
   - Nao ha ainda tratamento explicito de indicadores de avaria/quebra por rota/cliente.
   - Nao ha modelagem de retornavel/vasilhame (ciclo de retorno e perdas) no fluxo de atendimento B2B.

---

## 3) Proposta de valor para a distribuidora de garrafas de vidro

## Proposta de valor (frase executiva)

**"Transformar o processo pedido-a-entrega em uma cadeia integrada e rastreavel, reduzindo ruptura e avaria, acelerando atendimento B2B e dando visibilidade de margem e nivel de servico em tempo quase real."**

### 3.1 Pilar 1 - Excelencia operacional SAP + WMS

Valor entregue:

- Menos retrabalho entre ERP e operacao.
- Maior acuracia de estoque e status.
- Reducao de erros de separacao/expedicao.

Para vidro, isso impacta diretamente:

- menor quebra por manuseio indevido,
- melhor controle por lote/sku/embalagem,
- maior previsibilidade de expedicao.

### 3.2 Pilar 2 - Portal B2B de atendimento (web/app)

Valor entregue:

- Cliente acompanha status do pedido sem depender de contato manual.
- Canal unico para ocorrencias (atraso, avaria, divergencia, devolucao).
- Menor custo de atendimento e maior satisfacao.

Funcionalidades-alvo:

- acompanhamento de pedido e entrega,
- abertura e tracking de chamados,
- anexos de evidencia (foto/assinatura/comprovantes),
- notificacoes proativas por evento.

### 3.3 Pilar 3 - Power BI orientado a decisao

Valor entregue:

- Direcao comercial e operacoes com visao unica de performance.
- Prioridade correta de clientes, rotas e SKUs.
- Decisoes baseadas em margem, nivel de servico e perdas.

---

## 4) Arquitetura alvo de evolucao

Fluxo recomendado:

1. **SAP B1** continua como sistema transacional financeiro/comercial.
2. **Conector SAP padronizado** (unico) para leitura/escrita com:
   - cursor persistente,
   - idempotencia,
   - retries controlados,
   - trilha de correlacao.
3. **WMS Core** como motor de execucao logistica (estado, tarefas, auditoria).
4. **Portal B2B** consumindo APIs de pedidos, atendimento e ocorrencias.
5. **Power BI** consumindo camada curada (views + modelo semantico).

---

## 5) KPIs prioritarios para distribuidora de garrafas de vidro

### Operacao e servico

- OTIF (on time in full)
- Fill rate por cliente/canal
- Lead time pedido -> despacho
- Taxa de ruptura por SKU
- Taxa de avaria/quebra por rota, transportadora e cliente

### Atendimento B2B

- SLA de primeiro atendimento
- SLA de resolucao de chamado
- % chamados reabertos
- % autosservico (portal) vs atendimento manual

### Financeiro e comercial

- Margem por pedido/cliente/rota
- Custo logistico por pedido e por volume (ex.: por milheiro de garrafas)
- Ciclo de devolucao/retorno (quando aplicavel a retornaveis)
- Receita perdida por ruptura e avaria

---

## 6) Roadmap recomendado (90 dias)

### Fase 1 (0-30 dias) - Fundacao de integracao e dados

- Consolidar padrao de sync SAP em um fluxo principal.
- Persistir cursor e status de sincronizacao no banco.
- Fechar trilha de auditoria tecnica (correlationId de ponta a ponta).
- Definir dicionario de dados para Power BI (fatos e dimensoes).

**Resultado esperado:** dados confiaveis e rastreaveis para operacao e BI.

### Fase 2 (31-60 dias) - Portal B2B MVP

- Entregar portal web B2B com:
  - consulta de pedidos,
  - status de entrega,
  - abertura de ocorrencias/chamados,
  - timeline de atendimento.
- Publicar APIs de atendimento com SLA e historico.

**Resultado esperado:** reducao de carga no time de atendimento e aumento de transparencia para cliente.

### Fase 3 (61-90 dias) - Power BI executivo e escala

- Publicar dashboards executivos:
  - Operacao (SLA, produtividade, divergencias),
  - Atendimento (SLA chamados, backlog),
  - Comercial (margem, nivel de servico).
- Incluir indicadores de avaria/quebra e perdas no modelo analitico.
- Definir ritual de governanca (revisao semanal de KPIs).

**Resultado esperado:** gestao por indicadores e aceleracao de decisoes.

---

## 7) Backlog tecnico recomendado por frente

### SAP + Integracao

- Unificar logica de sincronizacao (gateway/worker/sap-connector).
- Implementar outbox para WMS -> SAP (write-back confiavel de status/eventos).
- Criar testes de integracao SAP reais em pipeline controlado.

### WMS

- Expandir eventos para registrar avaria/quebra na operacao.
- Reforcar controles por lote/localizacao para rastreabilidade fina.
- Consolidar APIs de produtividade e divergencias para consumo analitico.

### Portal B2B

- Autenticacao por perfil de cliente B2B.
- Gestao de ocorrencias/chamados com SLA e classificacao.
- Notificacoes de status (pedido, entrega, tratativa de ocorrencia).

### Power BI

- Modelo semantico oficial (fato pedidos, fato atendimento, fato estoque, dimensoes).
- Camada de qualidade de dados (regras e monitoramento).
- Dashboards por papel: diretoria, operacao, atendimento, comercial.

---

## 8) Impacto esperado no negocio

Com a evolucao proposta, a distribuidora tende a ganhar em 4 frentes:

1. **Confiabilidade operacional**: menos erro de status, menos retrabalho e menor avaria.
2. **Experiencia B2B**: cliente com visibilidade e atendimento mais rapido.
3. **Eficiência financeira**: reducao de custo oculto (ruptura, urgencia, retrabalho).
4. **Gestao orientada a dados**: decisoes comerciais e logisticas com base em KPI diario.

---

## 9) Proximo passo pratico no projeto

Iniciar por um sprint de consolidacao de integracao e dados, com 3 entregas objetivas:

1. **Matriz de rastreabilidade E2E** (SAP -> WMS -> Portal -> BI),
2. **Modelo semantico minimo para Power BI**,
3. **MVP do portal B2B focado em acompanhamento de pedidos + ocorrencias**.

Isso cria base concreta para escalar o produto com menor risco tecnico e maior retorno de negocio.
