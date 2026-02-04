# 🔄 Refatoração — Integração SAP

## Mudanças Implementadas

### ❌ Removido

**Estado local e merge de pedidos:**
- ❌ `const [sapOrders, setSapOrders]` — estado local removido
- ❌ `const [useSapSource, setUseSapSource]` — flag de fonte removida
- ❌ `const [showSapPanel, setShowSapPanel]` — painel SAP removido
- ❌ Lógica condicional: `useSapSource && sapOrders.length > 0 ? sapOrders : ordersQuery.data`
- ❌ `handleSapOrdersLoaded()` — callback removido
- ❌ `SapIntegrationPanel` — componente removido do dashboard
- ❌ Botão "Testar SAP" — removido do FiltersBar
- ❌ Lógica de atualização via API SAP no `moveOrderMutation`

**Imports não utilizados:**
- ❌ `import type { UiOrder }` — não mais necessário no dashboard
- ❌ `import { listSapOrders, updateSapOrderStatus }` — funções removidas
- ❌ `import { SapIntegrationPanel }` — componente removido

---

### ✅ Adicionado

**Nova função de sincronização (`sap.ts`):**

```typescript
export async function syncSapOrders(): Promise<{
  ok: boolean;
  message: string;
  imported: number;
  timestamp: string;
}>
```

**Mutation de sincronização (`OrdersDashboard.tsx`):**

```typescript
const syncSapMutation = useMutation({
  mutationFn: () => syncSapOrders(),
  onSuccess: async (data) => {
    toast.success(`${data.imported} pedidos importados do SAP`);
    await ordersQuery.refetch();
  },
  onError: (err: any) => {
    toast.error(err?.message || "Erro ao importar pedidos do SAP");
  }
});
```

**Botão "Importar do SAP" simplificado:**
- ✅ Dispara `POST /api/sap/sync` no backend
- ✅ Aguarda resposta com número de pedidos importados
- ✅ Refaz fetch do `listOrders()` automaticamente
- ✅ Toast de sucesso/erro
- ✅ Spinner inline durante processamento

---

## Fluxo Anterior vs Novo

### ❌ Fluxo Anterior (Merge Local)

```
┌─────────────────┐
│ Botão SAP       │
└────────┬────────┘
         │
         v
┌─────────────────────────────┐
│ listSapOrders()             │ (Frontend busca pedidos do SAP)
│ GET /api/sap/orders         │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│ setSapOrders([...])         │ (Armazena no estado local)
│ setUseSapSource(true)       │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│ grouped = useSapSource      │ (Merge condicional)
│   ? sapOrders               │
│   : ordersQuery.data        │
└─────────────────────────────┘
```

**Problemas:**
- ❌ Estado duplicado (sapOrders + ordersQuery)
- ❌ Sincronização manual
- ❌ Dois fluxos diferentes (WMS vs SAP)
- ❌ Complexidade na UI (troca de fonte)

---

### ✅ Fluxo Novo (Sync no Backend)

```
┌─────────────────┐
│ Botão Importar  │
└────────┬────────┘
         │
         v
┌─────────────────────────────┐
│ syncSapOrders()             │ (Backend sincroniza)
│ POST /api/sap/sync          │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│ Backend:                    │
│ 1. Busca pedidos do SAP     │
│ 2. Cria/atualiza no WMS     │
│ 3. Retorna { imported: N }  │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│ ordersQuery.refetch()       │ (Frontend busca do WMS)
│ GET /orders                 │
└────────┬────────────────────┘
         │
         v
┌─────────────────────────────┐
│ Kanban atualizado           │ (Única fonte: WMS)
│ Toast: "N pedidos           │
│        importados"          │
└─────────────────────────────┘
```

**Vantagens:**
- ✅ Única fonte de verdade (WMS Core)
- ✅ Sincronização automática no backend
- ✅ UI simplificada (sem troca de fonte)
- ✅ Menos estado local
- ✅ Mais fácil de testar e manter

---

## API Contract

### Novo Endpoint: `POST /api/sap/sync`

**Request:**
```json
POST /api/sap/sync
Content-Type: application/json
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "Sincronização concluída com sucesso",
  "imported": 15,
  "timestamp": "2026-02-03T14:30:00.000Z"
}
```

**Response (Error):**
```json
{
  "ok": false,
  "message": "Erro ao conectar com SAP",
  "imported": 0,
  "timestamp": "2026-02-03T14:30:00.000Z"
}
```

---

## Impacto no Backend

O backend precisa implementar:

1. **Endpoint `POST /api/sap/sync`:**
   - Conectar ao SAP Business One
   - Buscar pedidos abertos (`DocStatus = 'O'`)
   - Para cada pedido SAP:
     - Verificar se já existe no WMS (por `externalOrderId`)
     - Se não existe: criar via `POST /orders`
     - Se existe: atualizar (opcional, dependendo da lógica)
   - Retornar contador de pedidos importados

2. **Idempotência:**
   - Usar `externalOrderId` como chave única
   - Evitar duplicação de pedidos

3. **Mapeamento:**
   - SAP `DocEntry` → WMS `externalOrderId`
   - SAP `DocNum` → WMS metadata
   - SAP items → WMS items (SKU, quantity)
   - SAP customer → WMS `customerId`

---

## Validação

```bash
✓ npm run typecheck — sem erros
✓ npm run build — 270.95 KB (gzip: 86.05 kB)
✓ Lógica simplificada (menos estado local)
✓ UI mais limpa (sem troca de fonte)
```

---

## Próximos Passos

1. **Backend:** Implementar `POST /api/sap/sync`
2. **Testes:** Validar sincronização com dados reais
3. **Logs:** Adicionar observabilidade (quantos pedidos importados, erros, etc.)
4. **Agendamento:** Considerar sync automática (cron job) além do botão manual

---

**Resultado:** Integração SAP simplificada, com responsabilidade movida para o backend e UI mais limpa no frontend. ✅
