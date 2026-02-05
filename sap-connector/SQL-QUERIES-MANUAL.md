# Queries SQL para Integração WMS (Uso Manual)

⚠️ **Nota**: O SAP B1 Service Layer desta versão não permite criar SQLQueries programaticamente via API.  
As queries abaixo devem ser criadas **manualmente** via:
- **SAP B1 Client** → Ferramentas → Queries → Generator de Queries
- **B1if** (SAP Business One Integration Framework)
- **DI API** com permissões administrativas

---

## 📋 Query 1: Pedidos com Linhas (Otimizada)

**Nome**: `WMS_Orders_With_Lines`  
**Categoria**: User Query (-1)  
**Parâmetro**: `@dateFrom` (data inicial, formato: YYYY-MM-DD)

```sql
SELECT 
  T0.DocEntry,
  T0.DocNum,
  T0.CardCode,
  T0.CardName,
  T0.DocDate,
  T0.DocDueDate,
  T0.DocTotal,
  T0.DocCur AS DocCurrency,
  T0.DocStatus AS DocumentStatus,
  T0.Canceled AS Cancelled,
  T0.CreateDate AS CreationDate,
  T1.LineNum,
  T1.ItemCode,
  T1.Dscription AS ItemDescription,
  T1.Quantity,
  T1.WhsCode AS WarehouseCode,
  T1.UomCode AS MeasureUnit,
  T1.Price,
  T1.LineTotal,
  T1.LineStatus
FROM ORDR T0
INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
WHERE T0.DocDate >= [%0]
ORDER BY T0.DocEntry DESC, T1.LineNum ASC
```

**Uso**:
- Retorna pedidos + linhas em 1 única consulta
- Muito mais eficiente que múltiplos requests OData
- Parâmetro [%0]: data inicial (ex: '2023-01-01')

---

## 📋 Query 2: Pedidos Atualizados Recentemente

**Nome**: `WMS_Orders_Updated_Since`  
**Categoria**: User Query (-1)  
**Parâmetro**: `@updateDate` (data de atualização, formato: YYYY-MM-DD)

```sql
SELECT 
  T0.DocEntry,
  T0.DocNum,
  T0.CardCode,
  T0.DocDate,
  T0.DocStatus AS DocumentStatus,
  T0.UpdateDate
FROM ORDR T0
WHERE T0.UpdateDate >= [%0]
ORDER BY T0.UpdateDate DESC
```

**Uso**:
- Para polling incremental
- Parâmetro [%0]: data da última sincronização

---

## 📋 Query 3: Estoque por Depósito

**Nome**: `WMS_Inventory_By_Warehouse`  
**Categoria**: User Query (-1)  
**Parâmetros**: Nenhum

```sql
SELECT 
  T0.ItemCode,
  T0.ItemName,
  T1.WhsCode AS WarehouseCode,
  T1.OnHand,
  T1.IsCommited AS Committed,
  T1.OnOrder AS Ordered,
  (T1.OnHand - T1.IsCommited) AS Available
FROM OITM T0
INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode
WHERE T0.frozenFor = 'N'
ORDER BY T0.ItemCode, T1.WhsCode
```

**Uso**:
- Sincronização de estoque
- Retorna disponibilidade por item/depósito

---

## 📋 Query 4: Itens Ativos (Catálogo)

**Nome**: `WMS_Active_Items`  
**Categoria**: User Query (-1)  
**Parâmetros**: Nenhum

```sql
SELECT 
  T0.ItemCode,
  T0.ItemName,
  T0.InvntryUom AS InventoryUOM,
  T0.InvntItem AS InventoryItem,
  T0.SellItem AS SalesItem,
  T0.PrchseItem AS PurchaseItem,
  T0.validFor AS Valid,
  T0.frozenFor AS Frozen
FROM OITM T0
WHERE T0.frozenFor = 'N'
  AND T0.validFor = 'Y'
ORDER BY T0.ItemCode
```

**Uso**:
- Sincronizar catálogo de produtos
- Apenas itens ativos e válidos

---

## 📋 Query 5: Depósitos Ativos

**Nome**: `WMS_Active_Warehouses`  
**Categoria**: User Query (-1)  
**Parâmetros**: Nenhum

```sql
SELECT 
  T0.WhsCode AS WarehouseCode,
  T0.WhsName AS WarehouseName,
  T0.Inactive,
  T0.Location
FROM OWHS T0
WHERE T0.Inactive = 'N'
ORDER BY T0.WhsCode
```

**Uso**:
- Mapear depósitos SAP → WMS

---

## 📋 Query 6: Clientes Ativos

**Nome**: `WMS_Active_Customers`  
**Categoria**: User Query (-1)  
**Parâmetros**: Nenhum

```sql
SELECT 
  T0.CardCode,
  T0.CardName,
  T0.CardType,
  T0.frozenFor AS Frozen,
  T0.validFor AS Valid
FROM OCRD T0
WHERE T0.CardType = 'C'
  AND T0.frozenFor = 'N'
  AND T0.validFor = 'Y'
ORDER BY T0.CardCode
```

**Uso**:
- Sincronizar cadastro de clientes

---

## 🔧 Como Criar as Queries no SAP B1

### Via SAP B1 Client

1. Abrir SAP B1 Client
2. Menu → **Ferramentas** → **Queries** → **Query Generator**
3. Clicar em **Novo**
4. Cole o SQL acima
5. Definir parâmetros (se houver)
6. Salvar com o nome especificado (ex: `WMS_Orders_With_Lines`)

### Via Service Layer (se houver permissão)

```http
POST /b1s/v1/SQLQueries
Content-Type: application/json

{
  "QueryCategory": -1,
  "QueryDescription": "WMS_Orders_With_Lines",
  "Query": "SELECT ..."
}
```

---

## 📊 Comparação de Performance

| Abordagem | Requests | Tempo Estimado | Observação |
|-----------|----------|----------------|------------|
| **OData múltiplos** | N+1 | ~500ms × N requests | 1 para lista + 1 por pedido |
| **SQLQuery (JOINado)** | 1 | ~200-500ms | Tudo em 1 request |
| **Ganho** | - | **60-90% mais rápido** | Especialmente com muitos pedidos |

---

## 🎯 Próximos Passos

### Opção A: Criar Queries Manualmente (Recomendado)

1. ✅ Copiar queries acima
2. ⬜ Criar no SAP B1 Client (Query Generator)
3. ⬜ Testar execução manual
4. ⬜ Usar via Service Layer: `POST /SQLQueries('WMS_Orders_With_Lines')/List`

### Opção B: Usar B1if (Advanced)

1. ⬜ Criar cenário B1if para criação automática de queries
2. ⬜ Executar queries via B1if
3. ⬜ Webhook → WMS quando houver mudanças

### Opção C: Fallback (OData Direto)

Se não puder criar queries, usar abordagem tradicional:
- GET `/Orders` (lista)
- GET `/Orders({DocEntry})/DocumentLines` para cada pedido
- Performance menor, mas funcional

---

**Status**: ⚠️ Queries documentadas, aguardando criação manual no SAP B1
