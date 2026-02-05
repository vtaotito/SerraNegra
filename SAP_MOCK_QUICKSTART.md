# ⚡ SAP Mock - Quick Start (3 minutos)

## 🎯 Executar Agora (1 comando)

```bash
npm run sap:mock
```

**Output esperado**: Exemplo completo com 12 operações do SAP simuladas

---

## 📦 Dados Disponíveis

### Pedidos (6)

```javascript
DocEntry: 60, DocNum: 5  → Cliente: EUTIDES JACKSON SARMENTO  → R$ 2.850,50 (3 itens)
DocEntry: 61, DocNum: 6  → Cliente: DISTRIBUIDORA NORDESTE   → R$ 15.680,00 (4 itens) 🔥 URGENTE
DocEntry: 62, DocNum: 7  → Cliente: MARIA APARECIDA         → R$ 1.895,00 (2 itens)
DocEntry: 58, DocNum: 3  → Cliente: SUPERMERCADO BOM PREÇO  → R$ 8.950,00 (FECHADO)
DocEntry: 63, DocNum: 8  → Cliente: JOSÉ ROBERTO SILVA      → R$ 4.520,50 (4 itens)
DocEntry: 59, DocNum: 4  → Cliente: DISTRIBUIDORA NORDESTE  → R$ 12.450,00 (FECHADO)
```

### Produtos (8)

```
TP0000016   → Tampa Plástica Branca 28mm
GAR0001250  → Garrafa PET 1250ml Cristal
ROT0050001  → Rótulo Adesivo 50x100mm
CX0048030   → Caixa Papelão 48x30x30cm
LAC0500001  → Lacre Segurança Vermelho
GAR0002000  → Garrafa PET 2000ml Cristal
TP0000038   → Tampa Plástica Azul 38mm
FIT0050001  → Fita Adesiva Transparente
```

### Clientes (5)

```
C00369  → EUTIDES JACKSON SARMENTO (Varejo)
C00512  → DISTRIBUIDORA NORDESTE LTDA (Atacado)
C00789  → MARIA APARECIDA COMERCIO (Varejo)
C01024  → SUPERMERCADO BOM PREÇO (Atacado)
C01156  → JOSÉ ROBERTO SILVA - ME (Varejo)
```

---

## 💻 Uso no Código (Copy & Paste)

### Exemplo Mínimo

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';

// Login
await sapMockService.login("user", "pass", "db");

// Listar pedidos
const orders = await sapMockService.getOrders({ status: "open" });

console.log(`${orders.value.length} pedidos abertos`);

// Logout
await sapMockService.logout();
```

### Integração com WMS

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';
import { createOrderFromSap } from './wms-core/src/services/sapIntegrationService';
import { v4 as uuidv4 } from 'uuid';

// Buscar pedidos do SAP (mock)
const sapOrders = await sapMockService.getOrders({ status: 'open' });

// Converter e salvar no WMS
for (const sapOrder of sapOrders.value) {
  const wmsOrder = createOrderFromSap({
    orderId: uuidv4(),
    sapOrder
  });
  
  await orderRepository.save(wmsOrder);
  
  console.log(`✓ Pedido #${sapOrder.DocNum} importado → ${wmsOrder.id}`);
}
```

### Atualizar Status

```typescript
// Atualizar UDFs do SAP quando pedido mudar no WMS
await sapMockService.updateOrderStatus(60, {
  U_WMS_STATUS: "EM_SEPARACAO",
  U_WMS_ORDERID: "uuid-do-pedido-wms",
  U_WMS_LAST_EVENT: "INICIAR_SEPARACAO",
  U_WMS_LAST_TS: new Date().toISOString()
});
```

---

## 🧪 Testes (Copy & Paste)

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';

describe('SAP Integration', () => {
  beforeEach(() => {
    sapMockService.resetData();
  });

  it('should list open orders', async () => {
    const orders = await sapMockService.getOrders({ status: 'open' });
    expect(orders.value.length).toBe(4);
  });

  it('should update order status', async () => {
    await sapMockService.updateOrderStatus(60, {
      U_WMS_STATUS: 'EM_SEPARACAO'
    });
    
    const order = await sapMockService.getOrderByDocEntry(60);
    expect(order.U_WMS_STATUS).toBe('EM_SEPARACAO');
  });
});
```

---

## 🎯 Casos de Uso Rápidos

### 1. Listar Pedidos Abertos

```typescript
const orders = await sapMockService.getOrders({ status: "open" });
// Retorna 4 pedidos
```

### 2. Buscar Pedido Específico

```typescript
const order = await sapMockService.getOrderByDocEntry(60);
// Retorna pedido com 3 linhas
```

### 3. Consultar Estoque

```typescript
const stock = await sapMockService.getItemWarehouseInfo("TP0000016");
// Retorna estoque em 3 depósitos
```

### 4. Gerar Pedidos de Teste

```typescript
const randomOrders = await sapMockService.generateRandomOrders(100);
// Gera 100 pedidos aleatórios
```

### 5. Filtrar por Cliente

```typescript
const orders = await sapMockService.getOrders({ 
  cardCode: "C00512"  // DISTRIBUIDORA NORDESTE
});
// Retorna 2 pedidos
```

---

## 📊 API em 1 Minuto

| O que você quer | Código |
|-----------------|--------|
| **Login** | `await sapMockService.login("u", "p", "db")` |
| **Pedidos abertos** | `await sapMockService.getOrders({ status: "open" })` |
| **Pedido específico** | `await sapMockService.getOrderByDocEntry(60)` |
| **Atualizar status** | `await sapMockService.updateOrderStatus(60, { U_WMS_STATUS: "X" })` |
| **Listar produtos** | `await sapMockService.getItems({ top: 10 })` |
| **Consultar estoque** | `await sapMockService.getItemWarehouseInfo("TP0000016")` |
| **Listar clientes** | `await sapMockService.getBusinessPartners()` |
| **Gerar dados** | `await sapMockService.generateRandomOrders(100)` |
| **Reset** | `sapMockService.resetData()` |
| **Estatísticas** | `sapMockService.getStats()` |

---

## 🎨 Toggle: Mock ↔ Real

```typescript
// Variável de ambiente
const useMock = process.env.USE_SAP_MOCK === 'true';

// Factory
const sap = useMock 
  ? sapMockService 
  : new ServiceLayerClient(config);

// Usar (API idêntica)
const orders = await sap.getOrders({ status: 'open' });
```

**Configuração**:
```bash
# .env
USE_SAP_MOCK=true    # Usar mock
USE_SAP_MOCK=false   # Usar SAP real
```

---

## ✨ Recursos Especiais

### Delays Realistas
```
Login: 300ms
GET Orders: 500ms
GET Order: 200ms
PATCH: 300ms
```

### Dados Consistentes
- Estoque calculado corretamente
- Timestamps atualizados
- UDFs preservados

### Geração Aleatória
```typescript
// 100 pedidos aleatórios em segundos
const orders = await sapMockService.generateRandomOrders(100);
```

---

## 📝 Checklist de 1 Minuto

- [ ] Executar: `npm run sap:mock`
- [ ] Ver 12 operações do SAP funcionando
- [ ] Copiar exemplo de código
- [ ] Testar no seu projeto
- [ ] Ler documentação completa (opcional)

---

## 📚 Próximos Passos

1. **Experimentar**: `npm run sap:mock`
2. **Integrar**: `npm run sap:mock:integration`
3. **Usar em testes**: Importar no seu código
4. **Ler docs**: `sap-connector/mocks/README.md`

---

## 🎉 Pronto!

Você tem **6 pedidos reais**, **8 produtos**, **5 clientes** e **estoque completo** para testar seu WMS **sem SAP real**!

```bash
npm run sap:mock  # ← Comece aqui! 🚀
```

---

**Tempo de setup**: < 1 minuto  
**Comandos**: 1  
**Status**: ✅ **FUNCIONA AGORA**
