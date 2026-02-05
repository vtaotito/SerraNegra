# 📊 Enriquecimento de Dados SAP — Dashboard WMS

## 🎯 Objetivo

Melhorar significativamente a disponibilidade e visualização das informações dos pedidos provenientes do SAP Business One, enriquecendo tanto os cards do Kanban quanto o drawer de detalhes.

---

## ✨ Melhorias Implementadas

### 1. 📋 **Tipos Enriquecidos (types.ts)**

**Campos adicionados ao `Order`:**

```typescript
export type Order = {
  // ... campos existentes
  
  // 🆕 Informações do Cliente (SAP)
  customerName?: string | null;           // CardName (SAP)
  
  // 🆕 Endereço Completo (SAP)
  shipToAddress?: string | null;          // Address (SAP)
  shipToCity?: string | null;             // Cidade
  shipToState?: string | null;            // Estado
  shipToZipCode?: string | null;          // CEP
  
  // 🆕 Informações Financeiras (SAP)
  docTotal?: number | null;               // DocTotal (SAP)
  currency?: string | null;               // DocCurrency (SAP - ex: BRL, USD)
  docDate?: string | null;                // DocDate (SAP)
  
  // 🆕 Observações
  comments?: string | null;               // Comments (SAP)
};
```

**Campos adicionados ao `OrderItem`:**

```typescript
export type OrderItem = {
  sku: string;
  itemDescription?: string;    // 🆕 ItemDescription (SAP)
  quantity: number;
  price?: number;              // 🆕 Price (SAP)
  warehouse?: string;          // 🆕 WarehouseCode (SAP)
  lineTotal?: number;          // 🆕 Calculado (price * quantity)
};
```

---

### 2. 🎲 **Mock Enriquecido com Dados Realistas**

**Listas de dados realistas adicionadas:**

- **Clientes reais:** Magazine Luiza, Casas Bahia, Mercado Livre, etc.
- **Cidades brasileiras:** São Paulo/SP, Rio de Janeiro/RJ, Belo Horizonte/MG, etc.
- **Produtos descritivos:** "Notebook Dell Inspiron 15", "Smart TV Samsung 55\" 4K", etc.
- **Valores monetários:** Preços entre R$ 100 e R$ 3.000, totais calculados
- **Armazéns:** CD-1, CD-2, CD-3

**Dados gerados automaticamente:**
- 36 pedidos com 1 a 3 itens cada
- Valores totais reais (soma dos itens × quantidade)
- Endereços completos com CEP
- Observações em 30% dos pedidos

---

### 3. 🎨 **Card do Kanban Enriquecido**

**Antes:**
```
┌─────────────────┐
│ ord_0001        │ P1
│ ERP-10000 · CUST-210
│ 2 itens | Jadlog
└─────────────────┘
```

**Depois:**
```
┌──────────────────────────┐
│ ord_0001             P1 │ SLA 12.5h
├──────────────────────────┤
│ Magazine Luiza S.A.      │ ⭐ Nome do cliente
│ ERP-10000 · CUST-210     │
│ 📍 São Paulo/SP          │ 📍 Cidade/Estado
├──────────────────────────┤
│   R$ 3.450,00           │ 💰 Valor total
├──────────────────────────┤
│ 2 itens | Jadlog         │
└──────────────────────────┘
```

**Novos elementos:**
- ✅ Nome completo do cliente (destaque)
- ✅ Cidade/Estado com ícone de localização
- ✅ Valor total do pedido formatado em BRL
- ✅ Separador visual entre seções

---

### 4. 📱 **Drawer de Detalhes Reorganizado**

**Nova estrutura em seções:**

#### 📄 **Dados do Pedido (SAP)**
- DocNum (SAP)
- DocEntry (SAP)
- Data do Documento
- SLA (Vencimento)
- **Valor Total em destaque** (fonte grande, cor azul, background destacado)

#### 👤 **Cliente**
- Código do cliente
- Nome completo
- **Endereço de entrega** (caixa com fundo cinza)
  - Rua/número
  - Cidade/Estado - CEP
- **Observações** (se houver, em caixa amarela)

#### 🚚 **Logística**
- Status WMS
- Transportadora
- Prioridade
- Data de criação

#### 📦 **Itens do Pedido** (Tabela Enriquecida)
Colunas:
| SKU | Descrição | Qtd | Preço Unit. | Total |
|-----|-----------|-----|-------------|-------|
| SKU-100 | Notebook Dell... | 2 | R$ 2.500,00 | R$ 5.000,00 |
| SKU-150 | Mouse Logitech... | 1 | R$ 150,00 | R$ 150,00 |

**Total do Pedido:** R$ 5.150,00 (em destaque no rodapé)

#### 🔍 **Pendências** (inalterado)
#### 📜 **Histórico (audit trail)** (inalterado)
#### 📱 **Histórico de bipagem** (inalterado)

---

### 5. 🎨 **Indicadores Visuais de Status Melhorados**

**Cada coluna do Kanban agora tem:**

1. **Borda superior colorida** (3px)
2. **Ícone emoji representativo**
3. **Contador com cor de fundo** (mesma cor da borda)

| Status | Ícone | Cor | Significado |
|--------|-------|-----|-------------|
| A_SEPARAR | 📦 | Cinza (#8993a4) | Aguardando |
| EM_SEPARACAO | 🔄 | Azul (#0079bf) | Em processo |
| CONFERIDO | ✅ | Verde (#61bd4f) | Concluído |
| AGUARDANDO_COTACAO | 💰 | Amarelo (#f2d600) | Aguardando comercial |
| AGUARDANDO_COLETA | 🚚 | Laranja (#ff9f1a) | Aguardando logística |
| DESPACHADO | ✈️ | Verde (#61bd4f) | Finalizado |

**Exemplo visual:**
```
┌──────────────────────── (borda azul)
│ 🔄 Em separação [5] (contador azul)
│ ┌────────────┐
│ │  Card 1    │
│ └────────────┘
```

---

### 6. 💱 **Formatação Monetária**

Nova função `formatCurrency()`:

```typescript
formatCurrency(1500.50, "BRL")  // R$ 1.500,50
formatCurrency(99.99, "USD")    // US$ 99,99
formatCurrency(500)             // R$ 500,00 (BRL padrão)
```

- Usa `Intl.NumberFormat` nativo
- Suporta múltiplas moedas
- Formatação padrão pt-BR
- Fallback para BRL se moeda não especificada

---

## 📊 Mapeamento de Campos SAP → WMS

### Pedido (Orders / ORDR)

| Campo SAP | Campo WMS | Tipo | Descrição |
|-----------|-----------|------|-----------|
| `DocEntry` | `sapDocEntry` | number | Chave interna SAP |
| `DocNum` | `sapDocNum` | number | Número do documento |
| `CardCode` | `customerId` | string | Código do cliente |
| `CardName` | `customerName` | string | Nome do cliente |
| `DocDate` | `docDate` | string (ISO) | Data do documento |
| `DocDueDate` | `slaDueAt` | string (ISO) | Data de vencimento/SLA |
| `DocTotal` | `docTotal` | number | Valor total |
| `DocCurrency` | `currency` | string | Moeda (BRL, USD, etc.) |
| `Address` | `shipToAddress` | string | Endereço de entrega |
| `Comments` | `comments` | string | Observações |

### Item (DocumentLines)

| Campo SAP | Campo WMS | Tipo | Descrição |
|-----------|-----------|------|-----------|
| `ItemCode` | `sku` | string | Código do item |
| `ItemDescription` | `itemDescription` | string | Descrição do item |
| `Quantity` | `quantity` | number | Quantidade |
| `Price` | `price` | number | Preço unitário |
| `WarehouseCode` | `warehouse` | string | Armazém |
| `LineTotal` | `lineTotal` | number | Total da linha |

---

## 🎨 Novos Estilos CSS

```css
.card-customer {
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
}

.card-value {
  margin-bottom: 8px;
  padding: 6px 8px;
  background: rgba(0, 121, 191, 0.08);
  border-radius: 6px;
  text-align: center;
  font-size: 15px;
  color: var(--primary);
}

.table.table-items .tr {
  grid-template-columns: 1fr 2fr 0.5fr 0.8fr 0.8fr;
}
```

---

## 📈 Impacto

### Antes
- ✗ Dados mínimos (ID, cliente código, quantidade)
- ✗ Sem contexto financeiro
- ✗ Sem endereço visível
- ✗ Colunas sem identificação visual clara

### Depois
- ✅ Dados completos do SAP
- ✅ Valor total destacado (R$)
- ✅ Nome do cliente e localização
- ✅ Colunas com cores, ícones e bordas
- ✅ Endereço completo no drawer
- ✅ Observações destacadas
- ✅ Itens com preços unitários e totais

---

## 🚀 Próximos Passos (Backend)

Para aproveitar completamente esses campos no backend, implemente o mapeamento completo no endpoint `POST /api/sap/sync`:

```typescript
// Exemplo de mapeamento completo no backend
const wmsOrder = {
  externalOrderId: sapOrder.DocNum.toString(),
  sapDocEntry: sapOrder.DocEntry,
  sapDocNum: sapOrder.DocNum,
  customerId: sapOrder.CardCode,
  customerName: sapOrder.CardName,          // 🆕
  shipToAddress: sapOrder.Address,          // 🆕
  docTotal: sapOrder.DocTotal,              // 🆕
  currency: sapOrder.DocCurrency,           // 🆕
  docDate: sapOrder.DocDate,                // 🆕
  slaDueAt: sapOrder.DocDueDate,           // 🆕
  comments: sapOrder.Comments,              // 🆕
  items: sapOrder.DocumentLines.map(line => ({
    sku: line.ItemCode,
    itemDescription: line.ItemDescription,  // 🆕
    quantity: line.Quantity,
    price: line.Price,                      // 🆕
    warehouse: line.WarehouseCode,          // 🆕
    lineTotal: line.LineTotal               // 🆕
  }))
};
```

---

## ✅ Validação

```bash
✓ npm run typecheck — 0 erros
✓ npm run build — 276.04 KB (87.61 kB gzipped)
✓ 36 pedidos mock com dados enriquecidos
✓ Formatação monetária pt-BR
✓ Responsivo (mobile + desktop)
```

---

## 📸 Comparação Visual

### Card do Kanban

**Antes:** 4 linhas de informação
**Depois:** 7 linhas + valor em destaque + localização

**Aumento de informação:** +75%

### Drawer

**Antes:** 1 seção "Resumo"
**Depois:** 4 seções organizadas (SAP / Cliente / Logística / Itens)

**Aumento de campos:** +12 campos

---

**Resultado:** Interface significativamente mais informativa, permitindo que operadores tomem decisões baseadas em dados completos do SAP sem precisar alternar entre sistemas. 🎉
