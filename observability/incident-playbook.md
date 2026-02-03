# Playbook de incidentes (WMS Orchestrator)

## Objetivo

Padronizar a resposta a incidentes de **performance**, **erros** e **divergências operacionais** usando:

- **Logs estruturados** (com `requestId`/`correlationId`/`orderId`/`taskId`)
- **Traces** (spans por etapa)
- **Métricas** (latência por endpoint/etapa, erros por operador/role, falhas SAP)

## 0) Princípios

- **Sempre capture correlação**: guarde `requestId` e `correlationId` do cliente e propague para SAP.
- **Primeiro estabilize**: mitigar > investigar. Evite “caçar” a causa raiz com produção degradada.
- **Um incidente = uma hipótese por vez**: altere uma alavanca, observe, registre resultado.

## 1) Triage (5 minutos)

- **Sintoma**:
  - Latência alta (p95/p99) em listagens/filtros (`/dashboard/orders`, `/dashboard/tasks`)
  - Aumento de erro (4xx/5xx) em `/scans` ou integrações
  - Divergência operacional (double-check / quantidades / endereço)
  - Instabilidade SAP (429/5xx, circuit aberto, timeouts)

- **Perguntas rápidas**:
  - É global ou por tenant/cliente?
  - É por rota específica?
  - Está correlacionado a um operador/role?
  - Houve deploy/mudança de configuração (rate limit, retry, timeout)?

## 2) Sinais e como investigar

### 2.1 Latência em listagens/filtros

- **Métricas**:
  - `wms_api_request_duration_ms{path="/api/v1/dashboard/orders"}` (p95/p99)
  - Compare `status=200` vs `status=500`
- **Traces**:
  - Trace do request e veja a maior barra (span mais longo)
  - Se houver chamadas SAP, o span `SAP ...` costuma evidenciar gargalo
- **Logs**:
  - Filtrar por `correlationId` e procurar `durationMs`

**Mitigações típicas**:
- Reduzir `limit` default e forçar paginação por cursor
- Cache de resultados (por filtros estáveis e TTL curto)
- Se consultar SAP, usar **batch**, reduzir campos, e aplicar rate-limit/concurrency menor durante o incidente

### 2.2 Erros por operador/role

- **Métricas**:
  - `wms_api_requests_total{role="operador",status="4xx/5xx"}`
  - `wms_scan_events_total{role="operador",type="..."}` para detectar padrões anormais
- **Logs**:
  - Buscar por `actorId` / `role` / `orderId`

**Mitigações típicas**:
- Se for erro de validação: melhorar mensagem/contrato; não é “incidente” se esperado
- Se for 5xx: feature-flag / rollback / desabilitar integração específica

### 2.3 Divergências (endereços/quantidades/SKU inesperado)

- **Logs**:
  - Procure por mensagens de divergência com `orderId` e `taskId`
- **Traces**:
  - Avalie a sequência de eventos (spans/atributos por etapa)

**Mitigações típicas**:
- Travar avanço de estado quando divergência grave
- Forçar recontagem / dupla conferência para lotes afetados

### 2.4 Instabilidade SAP (timeouts/429/5xx/circuit aberto)

- **Métricas**:
  - `wms_sap_requests_total{status="429"|"5xx"|"error"}`
  - `wms_sap_request_duration_ms` (p95/p99)
- **Logs** (sap-connector):
  - `"Retry SAP (HTTP)."` / `"Retry SAP (network/timeout)."` / `"Sessão do SAP expirada; relogando."`
- **Traces**:
  - Spans `SAP GET|POST|PATCH ...` para ver o endpoint “vilão”

**Mitigações típicas**:
- Reduzir `maxConcurrent` e `maxRps` temporariamente
- Aumentar `timeoutMs` apenas se for “slow but progressing”
- Ajustar `maxAttempts` (reduzir para parar efeito cascata)
- Se circuit abrir: pausar jobs e drenar fila (backpressure)

## 3) Comunicação

- Abrir canal/incidente com:
  - **impacto** (quem/quanto)
  - **início** (timestamp)
  - **rota/fluxo** afetado
  - **mitigação** aplicada (evidência)
  - **próximo update** (SLA de comunicação)

## 4) Pós-incidente (RCA)

- Timeline: detecção → confirmação → mitigação → normalização
- Evidência:
  - métricas antes/depois
  - traces exemplares
  - logs correlacionados (IDs)
- Ações:
  - correção definitiva
  - melhoria de alertas/SLOs
  - runbooks e testes de carga/regressão

