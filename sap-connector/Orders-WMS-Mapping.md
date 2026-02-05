# Mapeamento Orders (SAP B1) → WMS Orchestrator

**Base**: REDACTED_COMPANY_DB  
**Versão SAP B1**: 10.0 (1000190)  
**Data do mapeamento**: 2026-02-05

---

## ✅ Campos Disponíveis e Mapeamento

### 🔑 Identificadores (Obrigatórios)

| Campo SAP | Tipo | Exemplo | Campo WMS | Observação |
|-----------|------|---------|-----------|------------|
| `DocEntry` | number | 60 | `sapDocEntry` | Chave interna (PK) |
| `DocNum` | number | 5 | `externalOrderId` | Número visível ao usuário |
| `CardCode` | string | C00369 | `customerId` | Código do cliente |
| `CardName` | string | EUTIDES JACKSON SARMENTO | - | Nome do cliente (opcional) |

### 📅 Datas (Disponíveis)

| Campo SAP | Tipo | Exemplo | Campo WMS |
|-----------|------|---------|-----------|
| `DocDate` | string | 2023-02-10T00:00:00Z | `createdAt` (conv) |
| `DocDueDate` | string | 2023-02-10T00:00:00Z | - |
| `CreationDate` | string | 2023-02-10T00:00:00Z | `createdAt` |
| `CancelDate` | string | 2023-03-12T00:00:00Z | - |

### 📊 Status (Disponíveis)

| Campo SAP | Tipo | Valores | Mapeamento WMS |
|-----------|------|---------|----------------|
| `DocumentStatus` | string | `bost_Open`, `bost_Close` | Converter para status WMS |
| `Cancelled` | string | `tYES`, `tNO` | Verificar se cancelado |
| `CancelStatus` | string | `csNo`, `csYes` | - |

**Legenda DocumentStatus**:
- `bost_Open` = Pedido aberto
- `bost_Close` = Pedido fechado

### 💰 Valores (Disponíveis)

| Campo SAP | Tipo | Exemplo |
|-----------|------|---------|
| `DocTotal` | number | 65 |
| `DocCurrency` | string | R$ |
| `DiscountPercent` | number | 0 |

### 📦 Linhas do Pedido (DocumentLines)

#### Campos Essenciais por Linha

| Campo SAP | Tipo | Exemplo | Campo WMS | Obrigatório |
|-----------|------|---------|-----------|-------------|
| `LineNum` | number | 0 | - | ✅ |
| `ItemCode` | string | TP0000016 | `sku` | ✅ |
| `ItemDescription` | string | TAMPA PLASTICA... | - | ❌ |
| `Quantity` | number | 100 | `quantity` | ✅ |
| `WarehouseCode` | string | 02.02 | `warehouseCode` | ✅ |
| `Price` | number | 0.65 | - | ❌ |
| `LineTotal` | number | 65 | - | ❌ |
| `MeasureUnit` | string | UN | `uom` | ❌ |

#### Campos Adicionais Úteis

| Campo SAP | Uso |
|-----------|-----|
| `LineStatus` | Status da linha (`bost_Open`, `bost_Close`) |
| `RemainingOpenQuantity` | Quantidade pendente |
| `ShipToCode` | Código do endereço de entrega |
| `ShipToDescription` | Descrição do endereço |

---

## 🔄 Estratégia de Consulta Recomendada

### Opção 1: Consulta Simples (Sem Linhas)

```
GET /Orders?$top=50&$select=DocEntry,DocNum,CardCode,DocDate,DocumentStatus,DocTotal&$orderby=DocEntry desc
```

**Vantagens**: 
- Rápido
- Não dá timeout
- Bom para listagens

**Desvantagens**:
- Precisa buscar linhas separadamente

### Opção 2: Buscar Linhas Separadamente (RECOMENDADO)

Depois de obter os pedidos, buscar linhas individualmente:

```
GET /Orders({DocEntry})/DocumentLines?$select=LineNum,ItemCode,Quantity,WarehouseCode,MeasureUnit,LineStatus
```

**Vantagens**:
- Controle granular
- Evita timeouts
- Filtra apenas campos necessários

### Opção 3: Query SQL (Futuro - via SQLQueries)

Se disponível no Service Layer, criar uma query SQL customizada para:
- Retornar apenas campos necessários
- Filtrar por data de atualização
- Join com tabelas relacionadas (se necessário)

---

## 📝 Exemplo de Mapeamento Completo

### Request SAP

```typescript
// 1. Buscar pedidos
const ordersRes = await client.get<{ value: SapOrder[] }>(
  "/Orders?$top=50&$select=DocEntry,DocNum,CardCode,DocDate,DocumentStatus&$orderby=DocEntry desc"
);

// 2. Para cada pedido, buscar linhas
for (const order of ordersRes.data.value) {
  const linesRes = await client.get<{ value: SapOrderLine[] }>(
    `/Orders(${order.DocEntry})/DocumentLines?$select=LineNum,ItemCode,Quantity,WarehouseCode,MeasureUnit`
  );
  
  order.DocumentLines = linesRes.data.value;
}
```

### Mapeamento para WMS

```typescript
function mapOrderFromSapB1(sapOrder: SapOrder): WmsOrderDraft {
  return {
    externalOrderId: String(sapOrder.DocNum),
    customerId: sapOrder.CardCode,
    sapDocumentId: `Orders:${sapOrder.DocEntry}`,
    sapDocEntry: sapOrder.DocEntry,
    sapDocNum: sapOrder.DocNum,
    status: mapSapStatusToWms(sapOrder.DocumentStatus),
    createdAt: sapOrder.DocDate,
    items: (sapOrder.DocumentLines ?? []).map(line => ({
      sku: line.ItemCode,
      quantity: line.Quantity,
      warehouseCode: line.WarehouseCode,
      uom: line.MeasureUnit
    }))
  };
}

function mapSapStatusToWms(sapStatus: string): WmsOrderStatus {
  switch (sapStatus) {
    case "bost_Open":
      return "A_SEPARAR"; // ou status inicial do WMS
    case "bost_Close":
      return "DESPACHADO"; // ou status final do WMS
    default:
      return "A_SEPARAR";
  }
}
```

---

## ⚠️ Limitações Identificadas

### ❌ Endpoints que NÃO funcionam

1. **$expand=DocumentLines** - Retorna erro 400
2. **$select com DocStatus** - Campo não existe ou nome diferente
3. **CompanyService_GetCompanyInfo** - Timeout excessivo

### ✅ Alternativas

1. Buscar linhas separadamente (funciona)
2. Usar `DocumentStatus` em vez de `DocStatus`
3. Pular verificação de CompanyInfo (já sabemos a database)

---

## 🎯 Próximos Passos

### Implementação Imediata

1. ✅ Atualizar `mappings/src/order.ts` com campos descobertos
2. ✅ Criar função auxiliar para buscar DocumentLines
3. ✅ Implementar mapeamento de status SAP → WMS

### Polling Incremental

4. ⬜ Testar se existe campo de última atualização confiável
5. ⬜ Implementar query com filtro de data: `$filter=DocDate ge '2026-02-05'`
6. ⬜ Criar cache de pedidos já processados

### Escrita no SAP (UDF)

7. ⬜ Verificar se UDFs já existem (ex: `U_WMS_STATUS`)
8. ⬜ Testar PATCH em Orders para atualizar UDFs
9. ⬜ Documentar estrutura de UDFs necessários

---

**Documentação completa**: `Orders-fields.md`  
**Estrutura JSON**: `Orders-structure.json`  
**Script de mapeamento**: `examples/mapear-campos-orders.ts`
