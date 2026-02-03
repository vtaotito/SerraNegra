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
npm run build
```

## Configuração SAP B1

### Quick Start (Windows)

```powershell
.\quick-start.ps1
```

### Quick Start (Linux/Mac)

```bash
chmod +x quick-start.sh
./quick-start.sh
```

### Manual

1. Instalar e compilar:
   ```bash
   npm install
   npm run build
   ```

2. Testar conectividade SAP:
   ```bash
   npm run sap:test
   ```

3. Executar exemplo completo:
   ```bash
   npm run sap:example
   ```

### Credenciais

O arquivo `.env` já está pré-configurado com o ambiente development fornecido:
- URL: `https://REDACTED_SAP_HOST/b1s/v1`
- Token: (ver `.env`)

**Importante**: o script `sap:test` identificará automaticamente o método de autenticação correto.

Ver documentação completa:
- `INTEGRATION_SUMMARY.md` (visão geral das entregas)
- `sap-connector/SETUP.md` (setup detalhado)
- `sap-connector/README.md` (API do connector)

