# Próximos Passos - Implementação Integração SAP B1

**Status Atual**: ✅ Arquitetura e helpers implementados  
**Data**: 2026-02-05

---

## ✅ Concluído

### 1. Arquitetura Base
- ✅ SAP Service Layer Client (auth + retry + circuit breaker + rate limit)
- ✅ Mappings (Order, Item, Inventory)
- ✅ Contrato de integração documentado
- ✅ Conferência de dados (base REDACTED_COMPANY_DB confirmada)

### 2. Mapeamento de Campos
- ✅ 200+ campos identificados em Orders
- ✅ DocumentLines mapeado
- ✅ Tipos TypeScript atualizados
- ✅ Documentação: `Orders-WMS-Mapping.md`

### 3. Investigação de Endpoints
- ✅ 13/17 endpoints disponíveis
- ✅ SQLQueries disponível (mas criação programática bloqueada)
- ✅ DeliveryNotes, Items, Warehouses confirmados
- ✅ Documentação: `ENDPOINTS-ALTERNATIVOS.md`

### 4. SQLQueries Helper
- ✅ Helper implementado (`sap-connector/src/sqlQueries.ts`)
- ✅ 6 queries SQL documentadas
- ✅ Guia de criação manual: `SQL-QUERIES-MANUAL.md`

---

## 🔄 Em Andamento / Próximos Passos

### Fase 1: Setup SQLQueries (Manual)

**Prioridade**: Alta  
**Responsável**: Administrador SAP B1

1. ⬜ Criar queries no SAP B1 Client (Query Generator):
   - `WMS_Orders_With_Lines`
   - `WMS_Orders_Updated_Since`
   - `WMS_Inventory_By_Warehouse`
   - `WMS_Active_Items`
   - `WMS_Active_Warehouses`
   - `WMS_Active_Customers`

2. ⬜ Testar execução manual de cada query

3. ⬜ Validar execução via Service Layer:
   ```bash
   POST /SQLQueries('WMS_Orders_With_Lines')/List
   ```

4. ⬜ Documentar IDs/nomes exatos das queries criadas

**Arquivos de referência**:
- `sap-connector/SQL-QUERIES-MANUAL.md`

---

### Fase 2: Implementar Polling Incremental

**Prioridade**: Alta  
**Depende de**: Fase 1 concluída

1. ⬜ Criar serviço de polling:
   ```typescript
   class SapPollingService {
     async pollOrders(since: string): Promise<WmsOrderDraft[]>
     async pollInventory(): Promise<WmsInventory[]>
   }
   ```

2. ⬜ Implementar cache/state:
   - Última data de sincronização
   - Pedidos já processados (por DocEntry)
   - Evitar duplicatas

3. ⬜ Definir intervalo de polling:
   - **Pedidos**: 1-5 min
   - **Estoque**: 15-30 min
   - **Catálogos** (Items/Warehouses): 1x/dia

4. ⬜ Adicionar métricas:
   - Pedidos sincronizados
   - Latência do SAP
   - Erros

**Arquivos a criar**:
- `wms-core/services/sapPollingService.ts`
- `wms-core/services/sapSyncState.ts`

---

### Fase 3: Escrita no SAP (UDF/UDT)

**Prioridade**: Média  
**Depende de**: Administrador SAP B1 criar UDFs

1. ⬜ Criar UDFs em Orders (via SAP B1 Client):
   - `U_WMS_STATUS` (string, 20) - Status do pedido no WMS
   - `U_WMS_ORDERID` (string, 50) - ID interno do WMS (UUID)
   - `U_WMS_LAST_EVENT` (string, 30) - Último evento (ex: DESPACHAR)
   - `U_WMS_LAST_TS` (datetime) - Timestamp do último update
   - `U_WMS_CORR_ID` (string, 100) - Correlation ID

2. ⬜ Testar PATCH em Orders:
   ```typescript
   await client.patch(`/Orders(${docEntry})`, {
     U_WMS_STATUS: "DESPACHADO",
     U_WMS_ORDERID: orderId,
     U_WMS_LAST_TS: new Date().toISOString()
   });
   ```

3. ⬜ Implementar serviço de sincronização status:
   ```typescript
   class SapStatusSync {
     async updateOrderStatus(
       docEntry: number,
       wmsStatus: string,
       orderId: string
     ): Promise<void>
   }
   ```

4. ⬜ Definir gatilhos de escrita:
   - `EM_SEPARACAO` → atualizar UDF
   - `CONFERIDO` → atualizar UDF
   - `DESPACHADO` → atualizar UDF + criar Delivery Note

**Arquivos a criar**:
- `wms-core/services/sapStatusSync.ts`
- Documentação dos UDFs criados

---

### Fase 4: Criar Delivery Notes

**Prioridade**: Média  
**Depende de**: Fase 3 concluída

1. ⬜ Mapear campos obrigatórios de DeliveryNotes

2. ⬜ Implementar criação:
   ```typescript
   class SapDeliveryNoteService {
     async createFromOrder(
       order: WmsOrder,
       sapDocEntry: number
     ): Promise<{ docEntry: number; docNum: number }>
   }
   ```

3. ⬜ Testar criação:
   ```typescript
   await client.post("/DeliveryNotes", {
     CardCode: order.customerId,
     DocDate: new Date().toISOString().split('T')[0],
     DocumentLines: order.items.map(item => ({
       ItemCode: item.sku,
       Quantity: item.quantity,
       WarehouseCode: item.warehouseCode,
       BaseType: 17, // Orders
       BaseEntry: order.sapDocEntry,
       BaseLine: item.lineNum
     }))
   });
   ```

4. ⬜ Adicionar ao fluxo:
   - Quando pedido → `DESPACHADO`
   - Criar Delivery Note no SAP
   - Guardar DocEntry da Delivery Note no WMS

**Arquivos a criar**:
- `wms-core/services/sapDeliveryNoteService.ts`

---

### Fase 5: Observabilidade e Monitoramento

**Prioridade**: Média

1. ⬜ Métricas (Prometheus):
   - `sap_requests_total` (por endpoint, status)
   - `sap_request_duration_seconds`
   - `sap_circuit_breaker_state`
   - `sap_sync_orders_total`
   - `sap_sync_lag_seconds`

2. ⬜ Logs estruturados (todos os requests SAP):
   - Correlation ID
   - Endpoint
   - Latência
   - Status

3. ⬜ Alertas:
   - SAP indisponível > 5min
   - Circuit breaker aberto
   - Lag de sincronização > threshold
   - Erros consecutivos

4. ⬜ Dashboard:
   - Status da integração SAP
   - Pedidos sincronizados (últimas 24h)
   - Latência média
   - Taxa de erro

**Arquivos a criar**:
- `observability/metrics/sapMetrics.ts`
- `observability/dashboards/sap-integration.json`

---

### Fase 6: Testes de Integração

**Prioridade**: Alta

1. ⬜ Testes unitários:
   - Mappings (Order, Item, Inventory)
   - SQLQueries helper
   - Circuit breaker
   - Rate limiter

2. ⬜ Testes de integração:
   - Polling completo
   - Sincronização status
   - Criação de Delivery Note
   - Idempotência

3. ⬜ Testes de resiliência:
   - SAP indisponível (timeout)
   - SAP retorna 5xx
   - Circuit breaker abre/fecha
   - Retry com backoff

4. ⬜ Teste end-to-end:
   - Criar pedido no SAP → sincronizar → processar no WMS → despachar → criar Delivery Note

**Arquivos a criar**:
- `tests/integration/sap-polling.test.ts`
- `tests/integration/sap-delivery-note.test.ts`

---

## 📋 Checklist de Go-Live

### Pré-requisitos

- ⬜ SQLQueries criadas no SAP B1
- ⬜ UDFs criados em Orders
- ⬜ Credenciais de produção configuradas
- ⬜ Firewall/allowlist liberado
- ⬜ Testes de integração passando

### Configuração

- ⬜ Polling habilitado
- ⬜ Intervalo de polling definido
- ⬜ Métricas e alertas ativos
- ⬜ Logs estruturados configurados

### Monitoramento

- ⬜ Dashboard configurado
- ⬜ Alertas testados
- ⬜ Runbook de troubleshooting criado

### Rollback

- ⬜ Plano de rollback documentado
- ⬜ Como desabilitar polling
- ⬜ Como compensar escritas no SAP

---

## 🎯 Marcos (Milestones)

| Marco | Descrição | Status | ETA |
|-------|-----------|--------|-----|
| M1 | SQLQueries criadas manualmente | ⬜ | - |
| M2 | Polling incremental funcionando | ⬜ | - |
| M3 | Escrita de UDFs funcionando | ⬜ | - |
| M4 | Delivery Notes criadas | ⬜ | - |
| M5 | Observabilidade completa | ⬜ | - |
| M6 | Testes end-to-end passando | ⬜ | - |
| M7 | Go-live produção | ⬜ | - |

---

**Última atualização**: 2026-02-05  
**Responsável**: Arquiteto de Integração SAP B1
