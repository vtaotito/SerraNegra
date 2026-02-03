# Checklist de Integração SAP (WMS Orchestrator)

## 1) Escopo funcional (o “quê”)
- **Objeto SAP-alvo**: confirmar quais documentos serão criados/atualizados pelo orquestrador (ex.: entrega, remessa, ordem de venda, picking, PGI).
- **Eventos que disparam SAP**: mapear quais transições geram integração (recomendado: ao menos `DESPACHADO`).
- **Responsabilidades**:
  - **WMS Orchestrator**: fonte de verdade do status e auditoria.
  - **SAP**: registro fiscal/logístico conforme processo do cliente.
- **Reprocessamento**: definir o que pode ser reenviado e em quais condições.

## 2) Contratos e mapeamento de dados
- **IDs e correlação**:
  - `orderId` (interno) ↔ `externalOrderId` (ERP) ↔ `sapDocumentId` (SAP)
  - Definir onde `sapDocumentId` será armazenado/atualizado.
- **Campos obrigatórios**:
  - centro/planta (`WERKS`), depósito (`LGORT`), organização de vendas etc. (se aplicável)
  - dados de cliente, endereço, transportadora
  - itens: SKU/material (`MATNR`), quantidade, unidade (`MEINS`), lote/serial (se houver)
- **Conversões**:
  - unidade (ex.: UN/CAIXA), decimais, timezone/UTC, pad de códigos (`MATNR` com zeros à esquerda)
- **Validações**:
  - consistência de itens (SKU existe no SAP, unidade permitida)
  - quantidades (sem negativo, tolerâncias)

## 3) Mecanismo de integração (como)
- **Tecnologia** (escolher 1):
  - **IDoc**
  - **BAPI / RFC**
  - **OData / API REST (SAP Gateway / SAP BTP)**
  - **PI/PO / CPI (middleware)** com filas/retry
- **Ambientes**: DEV / QA / PRD com endpoints e credenciais separados.
- **Rede/segurança**:
  - VPN/allowlist, TLS, certificados (mTLS se necessário)
  - contas técnicas, rotação e segregação (least privilege)

## 4) Idempotência e consistência
- **Chave de idempotência**:
  - Definir chave canônica por operação SAP, ex.: `SAP:<orderId>:<eventType>` ou `SAP:<externalOrderId>:DESPACHADO`
- **Garantia “at-least-once”**:
  - assumir que chamadas podem repetir; SAP deve tolerar ou o middleware deve deduplicar.
- **Outbox/Inbox (recomendado)**:
  - **Outbox** no orquestrador para publicar integrações SAP com retry controlado.
  - **Inbox** (se SAP/middleware enviar callbacks) para deduplicar recebimentos.
- **Ordem de eventos**:
  - garantir que eventos são processados em sequência por `orderId` (ou detectar “late events”).

## 5) Observabilidade e auditoria
- **Correlações obrigatórias**:
  - `X-Correlation-Id` propagado até o conector SAP/middleware
  - guardar `sapRequestId` / `sapTransactionId` / `idocNumber` / `messageId` (conforme tecnologia)
- **Logs estruturados**: registrar payloads (com mascaramento) + resposta SAP + latência.
- **Métricas**:
  - taxa de sucesso/erro, retries, DLQ, tempo médio de integração
- **Alertas**:
  - erro repetitivo por pedido, backlog de integrações, DLQ > 0

## 6) Tratamento de erro e retry
- **Classificação**:
  - **transiente** (timeout, 5xx, indisponível) → retry com backoff
  - **permanente** (validação SAP, dados inválidos) → não retry automático; abrir incidente/tarefa
- **Política de retry**:
  - exponencial (ex.: 1m, 5m, 15m, 1h) com limite (ex.: 10 tentativas)
- **DLQ**:
  - enviar mensagens falhas para fila de análise
- **Playbook operacional**:
  - como reprocessar manualmente um pedido e como evitar duplicidade

## 7) Segurança e compliance
- **Mascaramento**: PII (CPF/CNPJ, endereços) e segredos nunca em log puro.
- **Criptografia**: em trânsito e em repouso.
- **Auditoria**: quem disparou a integração (actor) e quando.

## 8) Testes e homologação
- **Dados de teste**: materiais/SKUs válidos, clientes, plantas, depósitos.
- **Casos mínimos**:
  - pedido simples 1 item
  - múltiplos itens e quantidades decimais
  - falha transiente (timeout) + retry
  - falha permanente (material inválido) + DLQ
  - idempotência (reenviar mesmo evento) sem duplicar documento SAP
- **Critérios de aceite**:
  - rastreabilidade completa (orderId ↔ doc SAP)
  - sem duplicidade em reprocessamento

## 9) Checklist final (go-live)
- **Credenciais PRD** entregues e testadas
- **Monitoramento** ativo (dashboards + alertas)
- **Rotina de reprocessamento** definida (scripts/endpoint admin, se aplicável)
- **SLA/horário de suporte** acordado
- **Rollback** (como desfazer ou compensar se SAP rejeitar após status avançado)

