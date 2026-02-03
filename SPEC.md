# Orquestrador do Projeto (PM/Tech Lead) — SPEC (MVP)

## Objetivo (North Star)
Criar um **Orquestrador de Pedidos WMS** que:

- Centraliza o **ciclo de vida** do pedido em uma **máquina de estados** única e auditável.
- Publica eventos e integrações (ex.: SAP) de forma **idempotente**, com **rastreabilidade ponta-a-ponta**.
- Fornece APIs padronizadas (contratos OpenAPI) para criação/consulta e transições do pedido.

## Escopo do MVP
### In-scope
- **State machine** do pedido com os status:
  - `A_SEPARAR` → `EM_SEPARACAO` → `CONFERIDO` → `AGUARDANDO_COTACAO` → `AGUARDANDO_COLETA` → `DESPACHADO`
- API para:
  - Criar pedido
  - Consultar pedido
  - Executar transições via eventos (commands)
  - Consultar histórico (audit trail)
- Idempotência:
  - Em criação de pedido
  - Em processamento de evento/transição
- Logging e correlação:
  - `correlationId`, `requestId`, `orderId`
- Integração SAP (checklist + pontos de contrato; implementação pode ser faseada)

### Out-of-scope (MVP)
- Otimização de roteirização/transportadora
- Regras complexas de alocação de estoque
- UI completa (pode ser apenas APIs + logs)

## Domínio: Pedido
### Identificadores
- `orderId` (**interno**, UUID/ULID)
- `externalOrderId` (**cliente/ERP**, string) — opcional, mas recomendado
- `sapDocumentId` (ex.: número de documento/entrega/ordem no SAP) — opcional

### Campos mínimos (MVP)
- `customerId` (string)
- `items[]`:
  - `sku` (string)
  - `quantity` (number)
- `status` (enum conforme state machine)
- `createdAt`, `updatedAt` (ISO-8601)

## Regras de Negócio (RB)
- **RB-01 (Status como fonte de verdade)**: o status do pedido é derivado **somente** da máquina de estados definida em `STATE_MACHINE.json`.
- **RB-02 (Transições válidas)**: toda mudança de status deve acontecer por **evento (command)** validado contra a state machine.
- **RB-03 (Imutabilidade de itens após separação)**:
  - ao entrar em `EM_SEPARACAO`, o conjunto de itens não pode ser alterado (exceto via fluxo de cancelamento/ajuste fora do MVP).
- **RB-04 (Auditoria obrigatória)**:
  - cada transição deve registrar: `from`, `to`, `eventType`, `actor`, `occurredAt`, `idempotencyKey`, `reason` (se houver).
- **RB-05 (Idempotência)**:
  - Requisições com mesma `Idempotency-Key` para o mesmo recurso devem retornar **o mesmo resultado** (sem duplicar efeitos).
- **RB-06 (Conferência)**:
  - `CONFERIDO` só é permitido após `EM_SEPARACAO`.
- **RB-07 (Cotação/Coleta/Despacho)**:
  - `AGUARDANDO_COTACAO` só após `CONFERIDO`
  - `AGUARDANDO_COLETA` só após `AGUARDANDO_COTACAO`
  - `DESPACHADO` só após `AGUARDANDO_COLETA`

## State Machine (Contrato)
### Estados (status)
- `A_SEPARAR`
- `EM_SEPARACAO`
- `CONFERIDO`
- `AGUARDANDO_COTACAO`
- `AGUARDANDO_COLETA`
- `DESPACHADO`

### Eventos (commands)
- `INICIAR_SEPARACAO`
- `FINALIZAR_SEPARACAO`
- `CONFERIR`
- `SOLICITAR_COTACAO`
- `CONFIRMAR_COTACAO`
- `AGUARDAR_COLETA`
- `DESPACHAR`

> Observação: no MVP, `SOLICITAR_COTACAO` e `CONFIRMAR_COTACAO` podem ser mapeados para uma única transição, dependendo do desenho operacional; o JSON de state machine define o padrão canônico.

## Padrões: erros, logging, idempotência
### Erros (códigos)
Formato: `WMS-<categoria>-<numero>`

- **Validação/Contrato**
  - `WMS-VAL-001`: Payload inválido
  - `WMS-VAL-002`: Campo obrigatório ausente
- **Negócio / State machine**
  - `WMS-SM-001`: Transição inválida para o status atual
  - `WMS-SM-002`: Evento desconhecido
  - `WMS-SM-003`: Pedido em status final (sem transições)
- **Concorrência/Idempotência**
  - `WMS-IDEM-001`: Idempotency-Key já usada com payload diferente
  - `WMS-CONC-001`: Conflito de versão (otimista)
- **Integração**
  - `WMS-INT-001`: Falha ao integrar com SAP
  - `WMS-INT-002`: Timeout ao integrar com SAP

### Logging (mínimo)
Cada request deve registrar:
- `timestamp`
- `level`
- `service` (ex.: `wms-orchestrator`)
- `correlationId` (propagado entre serviços)
- `requestId` (por request)
- `orderId` (quando aplicável)
- `eventType` (quando aplicável)
- `idempotencyKey` (quando aplicável)
- `errorCode` (quando aplicável)

### Idempotência (padrão)
- Header: `Idempotency-Key` (string)
- Escopo:
  - **Criação**: `POST /orders` (mesma chave + mesmo payload → mesmo `orderId`)
  - **Eventos**: `POST /orders/{orderId}/events` (mesma chave + mesmo payload → mesma transição/resultado)
- Armazenamento sugerido:
  - Tabela/coleção de idempotência com: `scope`, `key`, `requestHash`, `responseSnapshot`, `createdAt`, `expiresAt`

## Milestones (sugestão)
- **M1**: artefatos de contrato (este SPEC + JSON + OpenAPI) + esqueleto do serviço
- **M2**: persistência + criação/consulta + auditoria
- **M3**: transições + idempotência + testes
- **M4**: integração SAP (piloto) + observabilidade

## Entregáveis deste pacote
- `SPEC.md` (este arquivo)
- `STATE_MACHINE.json`
- `API_CONTRACTS/openapi.yaml`
- `SAP_INTEGRATION_CHECKLIST.md`

