# Arquitetura (NodeJS + TypeScript + FastAPI) — WMS

## Objetivo
Definir uma arquitetura **robusta e escalável** para um WMS com:

- **bipagem (scan)** e validações de coleta/expedição
- **audit trail** (event log imutável)
- **integração SAP Business One (Service Layer)** com retries e reprocessamento
- **dashboards** com atualização em tempo real
- **segurança** (RBAC/ABAC leve), rastreabilidade e observabilidade

Este documento complementa `SPEC.md`, `STATE_MACHINE.json` e `API_CONTRACTS/openapi.yaml`.

## Princípio central (evitar duplicação de regras)
- **Regra de negócio “dura”** (state machine, validações de domínio, consistência) fica em **um único lugar (Core)**.
- O Gateway/BFF **não decide status** nem replica validações críticas; ele:
  - autentica/autoriza
  - aplica limites (rate limit) e políticas (CORS, WAF, etc.)
  - traduz UX → comandos do core
  - entrega tempo real (SSE/WebSocket)

## Opção recomendada (WMS): Node/TS como Gateway + FastAPI como Core

### NodeJS (TypeScript) — `gateway`
**Responsabilidades**
- BFF/API Gateway (Web + Coletor/PWA)
- AuthN/AuthZ (JWT/OIDC) + RBAC + ABAC leve (por depósito/warehouse)
- Rate limiting / proteção de API
- Realtime: **SSE ou WebSockets** (dashboard “vivo”)
- Observabilidade na borda (logs/traces) + propagação de `X-Correlation-Id`

**Não faz**
- não muda status diretamente
- não reimplementa state machine
- não integra SAP “no request thread” (evita travar UX)

### FastAPI (Python) — `core`
**Responsabilidades**
- Máquina de estados do pedido (`STATE_MACHINE.json`) e validações críticas
- Serviços de **Scan Validation** (double-check, regras de bipagem)
- Persistência (PostgreSQL) + auditoria (append-only)
- Integrações pesadas/IO (SAP B1 via Service Layer) por **jobs assíncronos**

### Worker (Python) — `worker`
**Responsabilidades**
- Jobs assíncronos:
  - sync/consulta SAP
  - publicação de eventos SAP (outbox)
  - reconciliação/relatórios/etiquetas
- Retry com backoff + DLQ (se houver broker)

## Fluxos principais

### 1) Criação e ciclo do pedido (status)
- UI/Coletor → `gateway` → `core`
- `core` valida, persiste, grava **audit trail**, emite evento de domínio
- `gateway` notifica dashboard via SSE/WS

### 2) Bipagem (scan) e validação
- Coletor envia eventos de scan para `gateway`
- `gateway` autentica/autoriza e encaminha para `core`
- `core` valida:
  - se a tarefa está “lockada” para o operador
  - se a localização/SKU/qty faz sentido
  - se é duplicado (idempotência)
- `core` grava `scan_events` (append-only) e retorna resultado (`OK/ERROR`)
- `gateway` atualiza dashboard em tempo real

### 3) Integração SAP B1 (Service Layer)
**Padrão recomendado**
- `core` grava uma intenção de integração (ex.: “despachar no SAP”) em uma **outbox** transacional no Postgres.
- `worker` consome a outbox e executa chamadas ao SAP.
- Sucesso/falha atualiza o status da integração e grava evento de auditoria.

**Por quê**
- Evita que UX fique lenta/instável por IO do SAP.
- Permite retry controlado, DLQ e reprocessamento.

## Dados e persistência (alto nível)
Ver `docs/DATA_MODEL.md`.

## Cache, filas e concorrência
- **PostgreSQL** como fonte de verdade.
- **Redis** para:
  - idempotência de operações sensíveis (scan/confirm)
  - locks (por `taskId`/`orderId`) com TTL
  - cache de dados SAP (TTL curto)
- **Broker** (quando necessário):
  - RabbitMQ (simples/efetivo) ou Kafka (alto volume/eventos)

## Segurança (camadas)
- **JWT/OIDC** no `gateway` + RBAC
- **ABAC leve** (ex.: operador só vê `warehouseId` permitido)
- Proteções:
  - rate limit por IP e por usuário
  - validação forte de payload (Zod no gateway / Pydantic no core)
  - CORS estrito, headers de segurança no reverse proxy
- Auditoria:
  - toda mudança de status e toda bipagem relevante gera evento em `scan_events`

## Observabilidade e rastreabilidade
- **Correlações**:
  - `X-Correlation-Id` gerado no `gateway` e propagado para `core` e `worker`
  - logs sempre com `correlationId`, `orderId`, `taskId` (quando houver)
- **OpenTelemetry** (gateway + core + worker)
- Export sugerido:
  - Prometheus/Grafana (métricas)
  - Loki (logs)
  - Tempo/Jaeger (traces)

## Organização do repositório (sugestão)
- `gateway/` (NodeJS + TS) — BFF, tempo real
- `core/` (FastAPI) — domínio e integrações
- `worker/` (Python) — jobs e integrações assíncronas
- `API_CONTRACTS/` — OpenAPI (contratos)
- `docs/` — arquitetura, dados, deploy, operação

