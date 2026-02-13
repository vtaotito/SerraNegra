# Proposta Comercial - Evolucao SAP B1 + WMS + Portal B2B + Power BI

## 1) Resumo executivo

Esta proposta comercial cobre a evolucao do projeto para o cenario da distribuidora de garrafas de vidro, com foco em:

1. integracao SAP B1 confiavel e rastreavel,
2. portal B2B de atendimento (web/app),
3. camada analitica em Power BI orientada a resultado financeiro.

---

## 2) Objetivo de negocio contratado

Entregar em ate 90 dias um **MVP produtivo** capaz de:

- reduzir custo de atendimento por autosservico B2B,
- aumentar confiabilidade de status e sincronizacao SAP/WMS,
- dar visibilidade executiva de perdas, SLA e margem.

---

## 3) Escopo da proposta (MVP 90 dias)

### Inclui

- backlog prioritario da primeira onda:
  - Integracao SAP/WMS: cursor, idempotencia, unificacao de pipeline.
  - Outbox WMS -> SAP com retry e controle de falhas.
  - Portal B2B MVP: login, acompanhamento de pedidos, ocorrencias e notificacoes.
  - Power BI: dashboards executivo e atendimento.
  - Dominio vidro: eventos de avaria/quebra + KPI de perdas financeiras.

### Nao inclui nesta fase

- app mobile nativo (iOS/Android),
- faturamento/financeiro completo de chamados,
- ML preditivo,
- customizacoes fora do backlog priorizado.

---

## 4) Premissas comerciais

- Disponibilidade de ambiente SAP B1 (sandbox/homologacao) para testes.
- Time do cliente com sponsor de negocio e ponto focal tecnico.
- Janela de homologacao do cliente dentro do cronograma.
- Projeto conduzido em metodo agil com sprints quinzenais.

---

## 5) Modelo de investimento (opcoes)

## Opcao recomendada - Projeto fechado MVP 90 dias

**Valor total:** **R$ 132.000**

### Distribuicao de pagamento

- **30% na assinatura:** R$ 39.600
- **30% ao fim da Sprint 2 (integracao base):** R$ 39.600
- **25% ao fim da Sprint 4 (portal B2B MVP):** R$ 33.000
- **15% no go-live assistido:** R$ 19.800

### Prazo

- 12 semanas (6 sprints de 2 semanas)

---

## Opcao 2 - MVP + Segunda onda de escala (120-150 dias)

**Valor total:** **R$ 198.000**

Inclui tudo da opcao recomendada +:

- reconciliacao SAP x WMS,
- dashboards operacionais completos,
- fluxo de retornavel/devolucao,
- observabilidade e alertas ampliados.

---

## Opcao 3 - Programa completo (180 dias)

**Valor total:** **R$ 279.000**

Inclui opcao 2 +:

- trilha completa de governanca de dados,
- suite E2E ampliada com metas de cobertura,
- pacote de aceleracao de melhoria continua por 3 meses apos go-live.

---

## 6) Sustentacao mensal (apos entrega)

### Plano Care (recomendado para MVP)
- **R$ 6.900/mês**
- Ate 40h/mês
- Correcao, suporte tecnico, pequenos ajustes e monitoramento

### Plano Growth
- **R$ 12.900/mês**
- Ate 80h/mês
- Inclui evolucao funcional continua e priorizacao mensal

### Plano Enterprise
- **R$ 22.900/mês**
- Ate 160h/mês
- SLA ampliado, squad dedicado parcial e governanca executiva mensal

---

## 7) Estimativa de retorno (referencia para decisao)

Com base no estudo economico do projeto e no escopo proposto, a expectativa de ganho anual combinado (faixa) e:

- **R$ 350 mil a R$ 1,2 milhao/ano**, somando:
  - reducao de perda por avaria/quebra,
  - reducao de custo de atendimento manual,
  - ganho por menor ruptura e melhor nivel de servico.

### Payback estimado (MVP 90 dias)

- Cenario conservador: **6 a 10 meses**
- Cenario base: **4 a 7 meses**
- Cenario agressivo: **3 a 5 meses**

---

## 8) Cronograma comercial e marcos

### Marco 1 - Fundacao de integracao e dados (Semanas 1-4)
- pipeline SAP/WMS unificado
- cursor persistente
- outbox iniciado

### Marco 2 - Portal B2B MVP (Semanas 5-8)
- autenticacao cliente
- pedidos e timeline
- abertura de ocorrencias

### Marco 3 - BI executivo e go-live (Semanas 9-12)
- dashboards executivo e atendimento
- KPI de avaria/perdas
- go-live assistido

---

## 9) Condicoes gerais

- Valores em BRL, sem impostos.
- Reajuste anual pelo IPCA para contratos recorrentes.
- Mudancas de escopo relevantes serao tratadas por change request.
- SLA e governanca detalhados em anexo contratual.

---

## 10) Recomendacao final

Para este projeto, a recomendacao e **Opcao recomendada (R$ 132.000 / 90 dias)** com contratacao do **Plano Care (R$ 6.900/mês)** por no minimo 3 meses apos go-live.

Essa combinacao entrega resultado rapido, reduz risco tecnico e cria base para escalar B2B e BI com seguranca.

---

## 11) Proximo passo

Se aprovado, o kickoff pode ser iniciado em ate 5 dias uteis com:

1. validacao final do backlog prioritario,
2. definicao de responsaveis do cliente,
3. abertura da Sprint 1.
