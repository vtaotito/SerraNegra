# Ajustes do Frontend para Mapeamento SAP B1

**Data**: 2026-02-03  
**Status**: ✅ Concluído

---

## 📋 Objetivo

Ajustar o frontend do Dashboard de Pedidos para refletir exatamente os dados e estrutura do mapeamento real da integração SAP Business One Service Layer.

Baseado em:
- `sap-connector/Orders-WMS-Mapping.md`
- `mappings/src/order.ts`
- `sap-connector/examples/mapear-campos-orders.ts`

---

## 🔄 Mudanças Implementadas

### 1. **Types Atualizados** (`web/src/api/types.ts`)

#### Order Type
Adicionados campos reais do SAP B1:

```typescript
export type Order = {
  orderId: string; // UUID/ULID interno do WMS
  externalOrderId: string | null; // DocNum do SAP (número visível)
  sapDocEntry?: number | null; // DocEntry do SAP (chave interna PK)
  sapDocNum?: number | null; // DocNum do SAP
  customerId: string; // CardCode do SAP
  customerName?: string | null; // CardName do SAP
  sapStatus?: string | null; // DocumentStatus (bost_Open, bost_Close)
  cancelled?: boolean | null; // Cancelled (tYES/tNO)
  docDate?: string | null; // DocDate (ISO)
  docDueDate?: string | null; // DocDueDate (ISO)
  currency?: string | null; // DocCurrency (ex: "R$", "US$")
  discountPercent?: number | null; // DiscountPercent
  shipToCode?: string | null; // ShipToCode
  // ... outros campos
}
```

#### OrderItem Type
Adicionados campos reais das DocumentLines:

```typescript
export type OrderItem = {
  sku: string; // ItemCode
  itemDescription?: string; // ItemDescription
  quantity: number; // Quantity
  price?: number; // Price
  warehouseCode?: string; // WarehouseCode (ex: "02.02")
  measureUnit?: string; // MeasureUnit (ex: "UN", "KG")
  lineTotal?: number; // LineTotal
  lineStatus?: string; // LineStatus (bost_Open, bost_Close)
}
```

---

### 2. **Formatação de Moeda** (`web/src/ui/format.tsx`)

Adicionado mapeamento para moedas no formato SAP:

```typescript
export function formatCurrency(value: number, currency?: string | null) {
  // SAP B1 retorna moedas como "R$", "US$" etc - precisamos mapear para códigos ISO
  const currencyMap: Record<string, string> = {
    "R$": "BRL",
    "US$": "USD",
    "€": "EUR",
    "$": "USD"
  };

  const currencyCode = currency ? (currencyMap[currency] || currency) : "BRL";
  // ...
}
```

---

### 3. **Mock Data Atualizado** (`web/src/api/mock.ts`)

#### Formato de SKUs SAP
```typescript
sku: `TP${String(16 + ((i + idx) % 50)).padStart(7, "0")}` 
// Exemplo: TP0000016 (formato real do SAP)
```

#### Código de Cliente SAP
```typescript
customerId: `C${String(369 + (i % 25)).padStart(5, "0")}`
// Exemplo: C00369 (formato real do SAP)
```

#### Código de Armazém SAP
```typescript
warehouseCode: `0${(i % 3) + 1}.0${(i % 3) + 1}`
// Exemplo: 02.02, 01.01, 03.03
```

#### Moeda e Status SAP
```typescript
currency: "R$", // SAP retorna "R$" (não "BRL")
sapStatus: status === "DESPACHADO" ? "bost_Close" : "bost_Open",
cancelled: false,
measureUnit: "UN",
lineStatus: status === "DESPACHADO" ? "bost_Close" : "bost_Open"
```

---

### 4. **Card de Pedido** (`web/src/ui/OrderCard.tsx`)

Exibição melhorada dos dados SAP:

```typescript
{o.customerName && (
  <div className="card-customer">
    <div className="fw-semibold text-sm">{o.customerName}</div>
    <div className="text-muted text-xs">{o.customerId}</div> // CardCode
  </div>
)}

<div className="card-mid">
  <div className="text-secondary text-xs">
    <span className="fw-semibold">DocNum:</span> {o.externalOrderId}
    {o.sapStatus && (
      <span className={`badge ${o.sapStatus === "bost_Close" ? "badge-sla-ok" : ""}`}>
        {o.sapStatus === "bost_Open" ? "SAP Aberto" : "SAP Fechado"}
      </span>
    )}
  </div>
  {/* Localização */}
</div>
```

---

### 5. **Drawer de Detalhes** (`web/src/ui/OrderDrawer.tsx`)

#### Seção: Dados do Pedido (SAP B1)
```typescript
<div className="panel">
  <div className="section-title">Dados do Pedido (SAP B1)</div>
  <div className="grid-2">
    <div className="kv">
      <div className="k">DocNum</div>
      <div className="v">{order.sapDocNum}</div>
    </div>
    <div className="kv">
      <div className="k">DocEntry</div>
      <div className="v">{order.sapDocEntry}</div>
    </div>
    <div className="kv">
      <div className="k">DocDate</div>
      <div className="v">{formatDateTime(order.docDate)}</div>
    </div>
    <div className="kv">
      <div className="k">DocDueDate</div>
      <div className="v">{formatDateTime(order.docDueDate)}</div>
    </div>
    {order.sapStatus && (
      <div className="kv">
        <div className="k">DocumentStatus (SAP)</div>
        <div className="v">
          <span className={`badge ${order.sapStatus === "bost_Close" ? "badge-sla-ok" : "badge-sla-soon"}`}>
            {order.sapStatus === "bost_Open" ? "Aberto" : "Fechado"}
          </span>
        </div>
      </div>
    )}
  </div>
  
  {/* DocTotal com Desconto */}
  {order.docTotal && (
    <div style={{ marginTop: 12, padding: 12, background: "rgba(0, 121, 191, 0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div className="k">DocTotal</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {formatCurrency(order.docTotal, order.currency)}
          </div>
        </div>
        {order.discountPercent && order.discountPercent > 0 && (
          <div>
            <div className="k">Desconto</div>
            <div className="fw-bold">{order.discountPercent}%</div>
          </div>
        )}
      </div>
    </div>
  )}
</div>
```

#### Seção: Cliente (CardCode/CardName)
```typescript
<div className="panel">
  <div className="section-title">Cliente (CardCode/CardName)</div>
  <div className="grid-2">
    <div className="kv">
      <div className="k">CardCode</div>
      <div className="v">{order.customerId}</div>
    </div>
    <div className="kv">
      <div className="k">CardName</div>
      <div className="v">{order.customerName}</div>
    </div>
  </div>
  
  {/* Endereço com ShipToCode */}
  <div style={{ marginTop: 12 }}>
    <div className="k">
      Endereço de Entrega {order.shipToCode && `(${order.shipToCode})`}
    </div>
    <div style={{ padding: 10, background: "var(--bg-hover)" }}>
      {order.shipToAddress}
      {order.shipToCity && order.shipToState && (
        <div>
          {order.shipToCity}/{order.shipToState}
          {order.shipToZipCode && ` - CEP: ${order.shipToZipCode}`}
        </div>
      )}
    </div>
  </div>
  
  {/* Comments (SAP) */}
</div>
```

#### Seção: Itens (DocumentLines)
Tabela completa com todos os campos SAP:

| Coluna | Campo SAP | Descrição |
|--------|-----------|-----------|
| **ItemCode** | `ItemCode` | SKU do item |
| **Description** | `ItemDescription` | Descrição do produto |
| **Qtd** | `Quantity` | Quantidade |
| **UM** | `MeasureUnit` | Unidade de medida (UN, KG, etc) |
| **Armazém** | `WarehouseCode` | Código do armazém (02.02) |
| **Preço** | `Price` | Preço unitário |
| **Total Linha** | `LineTotal` | Total da linha |

```typescript
<table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>
    <tr>
      <th>ItemCode</th>
      <th>Description</th>
      <th>Qtd</th>
      <th>UM</th>
      <th>Armazém</th>
      <th>Preço</th>
      <th>Total Linha</th>
    </tr>
  </thead>
  <tbody>
    {order.items.map((it, idx) => (
      <tr key={`${it.sku}-${idx}`}>
        <td>{it.sku}</td>
        <td>{it.itemDescription}</td>
        <td>{it.quantity}</td>
        <td>{it.measureUnit}</td>
        <td>{it.warehouseCode}</td>
        <td>{formatCurrency(it.price, order.currency)}</td>
        <td>{formatCurrency(it.lineTotal, order.currency)}</td>
      </tr>
    ))}
  </tbody>
</table>

{/* Total do Pedido (DocTotal) */}
<div style={{ marginTop: 12 }}>
  <span className="fw-bold">DocTotal (SAP):</span>
  <span style={{ fontSize: 18, fontWeight: 700 }}>
    {formatCurrency(order.docTotal, order.currency)}
  </span>
</div>
```

---

## 📊 Mapeamento de Campos SAP B1 → Frontend

### Campos de Identificação
| Campo SAP | Campo Frontend | Tipo | Observação |
|-----------|----------------|------|------------|
| `DocEntry` | `sapDocEntry` | number | Chave interna (PK) |
| `DocNum` | `externalOrderId` | string | Número visível ao usuário |
| `CardCode` | `customerId` | string | Código do cliente |
| `CardName` | `customerName` | string | Nome do cliente |

### Campos de Data
| Campo SAP | Campo Frontend | Tipo |
|-----------|----------------|------|
| `DocDate` | `docDate` | string (ISO) |
| `DocDueDate` | `docDueDate` | string (ISO) |
| `CreationDate` | `createdAt` | string (ISO) |

### Campos de Status
| Campo SAP | Campo Frontend | Valores |
|-----------|----------------|---------|
| `DocumentStatus` | `sapStatus` | `bost_Open` / `bost_Close` |
| `Cancelled` | `cancelled` | boolean (tYES → true, tNO → false) |

### Campos Financeiros
| Campo SAP | Campo Frontend | Tipo | Observação |
|-----------|----------------|------|------------|
| `DocTotal` | `docTotal` | number | Valor total |
| `DocCurrency` | `currency` | string | Ex: "R$", "US$" |
| `DiscountPercent` | `discountPercent` | number | Percentual de desconto |

### Campos de Linhas (DocumentLines)
| Campo SAP | Campo Frontend | Tipo | Observação |
|-----------|----------------|------|------------|
| `ItemCode` | `sku` | string | Código do produto |
| `ItemDescription` | `itemDescription` | string | Descrição do produto |
| `Quantity` | `quantity` | number | Quantidade |
| `WarehouseCode` | `warehouseCode` | string | Ex: "02.02" |
| `MeasureUnit` | `measureUnit` | string | Ex: "UN", "KG" |
| `Price` | `price` | number | Preço unitário |
| `LineTotal` | `lineTotal` | number | Total da linha |
| `LineStatus` | `lineStatus` | string | `bost_Open` / `bost_Close` |

---

## ✅ Validação

### TypeScript Check
```bash
npm run typecheck
# ✅ Sem erros
```

### Build de Produção
```bash
npm run build
# ✅ Build concluído com sucesso
# dist/assets/index-CLWk0k2m.js   279.11 kB │ gzip: 88.24 kB
```

---

## 🎯 Benefícios

1. **Consistência**: Frontend reflete exatamente a estrutura do SAP B1
2. **Rastreabilidade**: DocEntry e DocNum visíveis para debug
3. **Transparência**: Status SAP (bost_Open/bost_Close) diferenciado do status WMS
4. **Completude**: Todos os campos relevantes do mapeamento estão disponíveis
5. **Formatação**: Moedas do SAP ("R$", "US$") formatadas corretamente

---

## 📚 Referências

- `sap-connector/Orders-WMS-Mapping.md` - Mapeamento completo dos campos
- `mappings/src/order.ts` - Tipos e funções de mapeamento
- `sap-connector/examples/mapear-campos-orders.ts` - Script de descoberta de campos
- `API_CONTRACTS/openapi.yaml` - Contratos da API WMS

---

## 🔍 Próximos Passos Sugeridos

1. **Implementar filtros SAP**: 
   - Filtrar por DocumentStatus (bost_Open/bost_Close)
   - Filtrar por CardCode/CardName
   - Filtrar por WarehouseCode

2. **Adicionar validação de dados**:
   - Validar formato de moeda
   - Validar ranges de DocEntry/DocNum
   - Validar integridade de DocumentLines

3. **Melhorias visuais**:
   - Badge diferenciado para pedidos cancelados
   - Indicador visual de desconto
   - Ícones para diferentes status SAP

4. **Sincronização**:
   - Exibir timestamp da última sincronização SAP
   - Indicador de pedidos não sincronizados
   - Log de erros de sincronização

---

**Última atualização**: 2026-02-03  
**Autor**: AI Assistant (Cursor)
