# SerraNegra

Deploy e artefatos do WMS Orchestrator (API + web) com fluxo de releases por timestamp.
# WMS Orchestrator — Artefatos (MVP)

Este workspace contém os artefatos do MVP do **WMS Orchestrator** (contratos e máquina de estados) e uma base de **integração com SAP Business One**.

## Conteúdo
- `SPEC.md`: escopo e regras do MVP
- `STATE_MACHINE.json`: máquina de estados do pedido
- `API_CONTRACTS/openapi.yaml`: contrato HTTP do orquestrador
- `API_CONTRACTS/sap-b1-integration-contract.md`: contrato de integração SAP B1
- `sap-connector/`: client SAP B1 (Service Layer) com auth + retry + circuit breaker + rate limit
- `mappings/`: mapeamentos SAP -> WMS (Order, Item, Inventory)
- `collector/`: app PWA do operador (fila, picking, packing e expedicao com offline)

## Como validar localmente (apenas typecheck)

```bash
npm install
npm run typecheck
```

