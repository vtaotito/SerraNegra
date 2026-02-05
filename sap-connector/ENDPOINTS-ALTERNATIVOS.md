# Endpoints Alternativos - SAP B1 Service Layer

**Base**: REDACTED_COMPANY_DB  
**Data**: 2026-02-05  
**Total testado**: 17 endpoints

---

## ✅ Resultados (13/17 disponíveis)

### 🎯 Endpoint Principal: SQLQueries

**Status**: ✅ **DISPONÍVEL**

O endpoint `SQLQueries` está funcionando e pode ser usado para:
- Criar queries SQL customizadas
- Consultar dados com filtros complexos
- Otimizar consultas (evitar múltiplos requests)
- Bypass de limitações do OData (ex: $expand que não funciona)

#### Como Usar SQLQueries

1. **Criar uma Query** (via POST):
```typescript
await client.post("/SQLQueries", {
  QueryCategory: -1, // User query
  QueryDescription: "WMS_Orders_Full",
  Query: `
    SELECT 
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.DocDate,
      T0.DocTotal,
      T1.LineNum,
      T1.ItemCode,
      T1.Quantity,
      T1.WhsCode as WarehouseCode
    FROM ORDR T0
    INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
    WHERE T0.DocDate >= ?
    ORDER BY T0.DocEntry DESC
  `
});
```

2. **Executar a Query**:
```typescript
const result = await client.post("/SQLQueries('WMS_Orders_Full')/List", {
  ParamsCollection: [
    { Name: "date", Value: "2026-01-01" }
  ]
});
```

#### Vantagens do SQLQueries

- ✅ Consultas complexas com JOINs
- ✅ Filtros avançados (datas, status, etc.)
- ✅ Performance melhor (1 query vs múltiplos requests)
- ✅ Acesso direto às tabelas SAP (ORDR, RDR1, OITM, etc.)
- ✅ Bypass de limitações do OData

#### Limitações

- ⚠️ Apenas leitura (SELECT)
- ⚠️ Precisa conhecer estrutura de tabelas SAP
- ⚠️ Queries precisam ser criadas antes (não ad-hoc)

---

## 📦 Endpoints de Documentos (Disponíveis)

### Orders (Pedidos de Venda)
✅ `/Orders` - Já testado e mapeado

### DeliveryNotes (Notas de Entrega)
✅ `/DeliveryNotes?$select=DocEntry,DocNum`

**Uso**: Criar notas de entrega a partir de Orders quando status = DESPACHADO

### Invoices (Notas Fiscais)
✅ `/Invoices?$select=DocEntry,DocNum`

**Uso**: Verificar se pedido já foi faturado

### PurchaseOrders (Pedidos de Compra)
✅ `/PurchaseOrders?$select=DocEntry,DocNum`

**Uso**: Integração reversa (recebimento de mercadorias)

---

## 📊 Endpoints de Cadastros (Disponíveis)

### Items (Produtos/SKUs)
✅ `/Items?$select=ItemCode,ItemName`

**Uso**: Sincronizar catálogo de produtos

### BusinessPartners (Clientes/Fornecedores)
✅ `/BusinessPartners?$select=CardCode,CardName`

**Uso**: Sincronizar cadastro de clientes

### Warehouses (Depósitos)
✅ `/Warehouses?$select=WarehouseCode,WarehouseName`

**Uso**: Mapear depósitos SAP → WMS

### BinLocations (Endereços/Bins)
✅ `/BinLocations?$select=AbsEntry,BinCode`

**Uso**: Gestão de bins (se habilitado no SAP)

### SalesPersons (Vendedores)
✅ `/SalesPersons`

**Uso**: Informações de vendedores

---

## 📦 Endpoints de Movimentação (Disponíveis)

### InventoryGenEntries (Entrada/Saída de Estoque)
✅ `/InventoryGenEntries`

**Uso**: Movimentações manuais de estoque

### StockTransfers (Transferências entre Depósitos)
✅ `/StockTransfers`

**Uso**: Transferências de estoque

### InventoryPostings (Lançamentos de Inventário)
✅ `/InventoryPostings`

**Uso**: Ajustes de inventário

---

## ❌ Endpoints Indisponíveis

| Endpoint | Status | Motivo |
|----------|--------|--------|
| `QueryService` | ❌ | 400 Bad Request |
| `SeriesService` | ❌ | 400 Bad Request (precisa parâmetros) |
| `ItemWarehouseInfo` | ❌ | 400 Bad Request |
| `$metadata` | ❌ | Não acessível (timeout/permissão) |

---

## 🎯 Recomendações para Integração WMS

### 1. Para Consulta de Pedidos com Itens

**Opção A: SQLQueries (RECOMENDADO)**
```sql
-- Criar query que retorna pedidos + itens em 1 request
SELECT 
  T0.DocEntry,
  T0.DocNum,
  T0.CardCode,
  T0.DocDate,
  T0.DocStatus,
  T1.LineNum,
  T1.ItemCode,
  T1.Dscription AS ItemDescription,
  T1.Quantity,
  T1.WhsCode AS WarehouseCode,
  T1.LineStatus
FROM ORDR T0
INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
WHERE T0.DocDate >= [%0]
  AND T0.DocStatus = 'O'
ORDER BY T0.DocEntry DESC
```

**Opção B: Múltiplos Requests OData**
- GET `/Orders` (lista)
- GET `/Orders({DocEntry})/DocumentLines` (para cada pedido)

### 2. Para Sincronizar Catálogo

```typescript
// Items (produtos)
const items = await client.get("/Items?$select=ItemCode,ItemName,InventoryUOM");

// Warehouses (depósitos)
const warehouses = await client.get("/Warehouses?$select=WarehouseCode,WarehouseName");
```

### 3. Para Criar Delivery Note (ao despachar)

```typescript
// Quando pedido chegar em status DESPACHADO no WMS
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

---

## 📝 Próximos Passos

### Implementar SQLQueries

1. ✅ Endpoint disponível e testado
2. ⬜ Criar query SQL para pedidos + itens
3. ⬜ Implementar helper no sap-connector
4. ⬜ Testar performance vs múltiplos requests
5. ⬜ Documentar queries padrão do WMS

### Explorar Delivery Notes

1. ⬜ Mapear campos obrigatórios
2. ⬜ Testar criação de Delivery Note
3. ⬜ Implementar no fluxo DESPACHADO

### Sincronização de Cadastros

1. ⬜ Implementar sync de Items
2. ⬜ Implementar sync de Warehouses
3. ⬜ Cache com TTL

---

**Arquivos relacionados**:
- Relatório JSON: `sap-connector/endpoints-investigation.json`
- Script de teste: `sap-connector/examples/investigar-endpoints.ts`
- Como executar: `npm run sap:investigar-endpoints`
