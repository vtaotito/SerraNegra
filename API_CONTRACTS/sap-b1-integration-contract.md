# Contrato de Integração — SAP Business One (Service Layer / B1if / DI)

Este documento define **o que o WMS Orchestrator lê**, **o que escreve**, e **quando**, na integração com **SAP Business One**.

> Contexto do projeto: `SPEC.md` + `STATE_MACHINE.json` definem o status canônico do pedido no WMS.

## 1) Entidades mapeadas (SAP -> WMS)

### 1.1 Pedido (Sales Order)
- **SAP (Service Layer)**: `Orders` (equivalente funcional a ORDR/RDR1).
- **WMS (modelo canônico)**:
  - `externalOrderId`: recomendado usar `DocNum` (string) como referência humana; guardar também `DocEntry`.
  - `customerId`: `CardCode`
  - `items[]`: `DocumentLines[].ItemCode` + `DocumentLines[].Quantity`

Mapeamento base implementado em `mappings/src/order.ts`.

### 1.2 Item (Catálogo)
- **SAP**: `Items` (OITM).
- **WMS**: catálogo por `sku` (ItemCode) + metadados (nome, UoM, ativo/inativo).

Mapeamento base implementado em `mappings/src/item.ts`.

### 1.3 Estoque
- **Por depósito (warehouse)**:
  - origem típica: `ItemWarehouseInfoCollection` (OITW) via `Items('SKU')?$expand=ItemWarehouseInfoCollection`
  - alternativa: coleção dedicada `ItemWarehouseInfoCollection` (se disponível no SL)
- **Por bin (quando bins habilitados)**:
  - origem típica: `BinLocations` + `BinLocationQuantities` (ou entidade equivalente) filtrada por `ItemCode`/`WarehouseCode`

Mapeamento canônico implementado em `mappings/src/inventory.ts`.

## 2) Estratégia de sincronização (polling x eventos)

### 2.1 MVP recomendado: Polling incremental + “event hint”
Como o SAP B1 não oferece push nativo robusto para todos os objetos, o padrão recomendado é:
- **Polling incremental** (baseline): o orquestrador consulta deltas por janela de tempo.
- **Event hint** (opcional/ideal): B1if ou SQL (TransactionNotification) grava um “log de mudanças” em UDT e o orquestrador consome esse log com alta frequência.

#### Chave de delta (sugestões)
- Preferência: usar campos de atualização quando confiáveis (`UpdateDate` + `UpdateTime`) **ou** um **UDF “dirty flag”**.
- Alternativa robusta: **UDT de mudanças** (`@WMS_CHANGES`) preenchida por:
  - `SBO_SP_TransactionNotification` (SQL Server) ou procedures no HANA
  - B1if cenário que registra eventos de alteração

### 2.2 Futuro: Eventos via B1if (fila)
Para volumes altos, o ideal é:
- B1if empurrar eventos para um broker (Kafka/Rabbit/SQS) ou webhook do WMS
- WMS aplicar deduplicação (Inbox) por chave canônica (ver seção 5)

## 3) Cache, rate limits e resiliência

### 3.1 Cache (leitura)
- **Itens e depósitos/bins**: cache com TTL (ex.: 10–60 min).
- **Pedidos**: cache curto (ex.: 30–120 s) ou nenhum (depende do SLA de atualização).
- **Invalidação**: preferir invalidação por “event hint” quando existir.

### 3.2 Rate limits
Service Layer pode saturar facilmente (CPU/threads do B1). Padrão sugerido:
- **RPS**: iniciar com 5–10 rps por instância
- **Concorrência**: 4–8 chamadas simultâneas
- Ajustar por ambiente/latência e observar 429/5xx

### 3.3 Retry + Circuit Breaker (obrigatório)
Política padrão:
- Retry com backoff exponencial + jitter para: 408, 429, 5xx, timeouts/rede
- Circuit breaker abre após falhas consecutivas e evita “thundering herd”

Implementação base: `sap-connector/src/serviceLayerClient.ts`.

## 4) Momento de escrita no SAP (“quando escrevemos”)

### 4.1 MVP: status e rastreabilidade via UDF/UDT
Objetivo: refletir no SAP o progresso do pedido no WMS sem criar documentos logísticos ainda.

**Escrever em marcos estáveis** (recomendado):
- Ao entrar em `EM_SEPARACAO`
- Ao entrar em `CONFERIDO`
- Ao entrar em `DESPACHADO`

**Campos sugeridos (UDF em `Orders`)**:
- `U_WMS_STATUS` (string/enum): status canônico do WMS
- `U_WMS_ORDERID` (string): `orderId` interno do WMS
- `U_WMS_LAST_EVENT` (string): último evento aplicado (`DESPACHAR`, etc.)
- `U_WMS_LAST_TS` (datetime): timestamp do último update
- `U_WMS_CORR_ID` (string): correlação ponta-a-ponta

**UDT sugerida (auditoria/outbox do lado SAP, opcional)**:
- `@WMS_SYNC` / `@WMS_OUTBOX`
  - `U_OrderId`, `U_DocEntry`, `U_Status`, `U_CorrelationId`, `U_PayloadHash`, `U_Result`, `U_CreatedAt`

### 4.2 Futuro: entrega/baixa (documentos)
Quando o processo exigir documento fiscal/logístico no SAP:
- Criar **Delivery Note** a partir do Sales Order (`DeliveryNotes` com `BaseType=17` e `BaseEntry=DocEntry`)
- Se necessário, movimentações adicionais (ex.: saída de estoque) conforme desenho do cliente

## 5) Idempotência e deduplicação (integração)

### 5.1 Chaves canônicas
Para qualquer escrita no SAP (status ou documento), definir uma chave canônica:
- `SAPB1:Orders:<DocEntry>:<WMS_STATUS>`
ou
- `SAPB1:Orders:<DocEntry>:<EVENT_TYPE>`

### 5.2 Garantia operacional
- WMS assume **at-least-once** (pode repetir chamadas).
- Escritas devem ser idempotentes via:
  - “compare-and-set” por UDF (não reescrever se já está no status-alvo), e/ou
  - registro em outbox/inbox do WMS (recomendado no serviço futuro)

## 6) Endpoints típicos (Service Layer)

> Observação: os nomes/entidades podem variar por versão/configuração do B1. Ajustar após validar no ambiente.

### Leituras
- `POST /Login` (auth)
- `GET /Orders?$select=DocEntry,DocNum,CardCode,DocStatus,UpdateDate,UpdateTime&$expand=DocumentLines($select=LineNum,ItemCode,Quantity,WarehouseCode)`
- `GET /Items?$select=ItemCode,ItemName,InventoryUOM,InventoryItem,SalesItem,PurchaseItem,Valid,Frozen,UpdateDate,UpdateTime`
- `GET /Warehouses`
- `GET /BinLocations` (se bins)
- `GET /BinLocationQuantities` (se bins; ou entidade equivalente)

### Escritas (MVP: UDF)
- `PATCH /Orders(<DocEntry>)` com `{ "U_WMS_STATUS": "...", "U_WMS_ORDERID": "...", ... }`

## 7) Segurança e logs
- Não logar senha; mascarar PII.
- Propagar `X-Correlation-Id` (SPEC) até o SAP.

