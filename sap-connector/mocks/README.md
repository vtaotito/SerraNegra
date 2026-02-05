# 🎭 SAP B1 Mock Service

Mock completo e realista da API do SAP Business One Service Layer para desenvolvimento e testes sem necessidade de conexão com SAP real.

---

## 📦 O Que Está Incluído

### ✅ Dados Mock Realistas (`sapMockData.ts`)

| Categoria | Quantidade | Descrição |
|-----------|------------|-----------|
| **Clientes** | 5 | Business Partners reais da base REDACTED_COMPANY_DB |
| **Produtos** | 8 | Itens com códigos, descrições e preços realistas |
| **Depósitos** | 5 | Warehouses incluindo inativos |
| **Pedidos** | 6 | Orders com múltiplas linhas, status variados |
| **Estoque** | 8 produtos | Saldo por depósito com comprometido/disponível |

### ✅ Mock Service Completo (`sapMockService.ts`)

**Funcionalidades**:
- ✅ Login/Logout simulado
- ✅ CRUD completo de Orders
- ✅ Listagem de Items
- ✅ Consulta de Estoque
- ✅ Listagem de Warehouses
- ✅ Listagem de Business Partners
- ✅ Atualização de UDFs (U_WMS_*)
- ✅ Geração de dados aleatórios
- ✅ Filtros e paginação
- ✅ Delays de rede simulados

---

## 🚀 Como Usar

### Importar o Mock Service

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';
```

### Exemplo Básico

```typescript
// 1. Login
const session = await sapMockService.login(
  "REDACTED_USER",
  "REDACTED_PASSWORD",
  "REDACTED_COMPANY_DB"
);

// 2. Listar pedidos abertos
const orders = await sapMockService.getOrders({
  status: "open",
  limit: 10
});

console.log(`${orders.value.length} pedidos encontrados`);

// 3. Atualizar status WMS
await sapMockService.updateOrderStatus(60, {
  U_WMS_STATUS: "EM_SEPARACAO",
  U_WMS_ORDERID: "uuid-do-pedido"
});

// 4. Logout
await sapMockService.logout();
```

---

## 📊 Dados de Exemplo

### Clientes Disponíveis

| CardCode | CardName | Segmento | Cidade |
|----------|----------|----------|--------|
| C00369 | EUTIDES JACKSON SARMENTO | VAREJO | Fortaleza |
| C00512 | DISTRIBUIDORA NORDESTE LTDA | ATACADO | Fortaleza |
| C00789 | MARIA APARECIDA COMERCIO | VAREJO | Fortaleza |
| C01024 | SUPERMERCADO BOM PREÇO | ATACADO | Fortaleza |
| C01156 | JOSÉ ROBERTO SILVA - ME | VAREJO | Fortaleza |

### Produtos Disponíveis

| ItemCode | ItemName | UOM |
|----------|----------|-----|
| TP0000016 | TAMPA PLASTICA BRANCA 28MM - PCT C/100 | UN |
| GAR0001250 | GARRAFA PET 1250ML CRISTAL - UNIDADE | UN |
| ROT0050001 | ROTULO ADESIVO 50X100MM - ROLO C/1000 | RL |
| CX0048030 | CAIXA PAPELAO 48X30X30CM - 25 UNIDADES | PC |
| LAC0500001 | LACRE SEGURANÇA PLASTICO VERMELHO - PCT C/500 | PC |
| GAR0002000 | GARRAFA PET 2000ML CRISTAL - UNIDADE | UN |
| TP0000038 | TAMPA PLASTICA AZUL 38MM - PCT C/100 | UN |
| FIT0050001 | FITA ADESIVA TRANSPARENTE 50MM - ROLO | RL |

### Depósitos Disponíveis

| WarehouseCode | WarehouseName | Status |
|---------------|---------------|--------|
| 01.01 | DEPOSITO PRINCIPAL - AREA A | Ativo |
| 02.02 | DEPOSITO SECUNDARIO - AREA B | Ativo |
| 03.01 | DEPOSITO EXPEDICAO | Ativo |
| 04.01 | DEPOSITO QUARENTENA | Ativo |
| 99.99 | DEPOSITO OBSOLETO (DESATIVADO) | Inativo |

### Pedidos de Exemplo

| DocEntry | DocNum | Cliente | Total | Status | Linhas |
|----------|--------|---------|-------|--------|--------|
| 60 | 5 | C00369 | R$ 2.850,50 | Aberto | 3 |
| 61 | 6 | C00512 | R$ 15.680,00 | Aberto | 4 |
| 62 | 7 | C00789 | R$ 1.895,00 | Aberto | 2 |
| 58 | 3 | C01024 | R$ 8.950,00 | Fechado | 4 |
| 63 | 8 | C01156 | R$ 4.520,50 | Aberto | 4 |
| 59 | 4 | C00512 | R$ 12.450,00 | Fechado | 4 |

---

## 🔧 API Disponível

### Autenticação

```typescript
// Login
await sapMockService.login(username, password, companyDB);

// Logout
await sapMockService.logout();
```

### Orders

```typescript
// Listar pedidos
await sapMockService.getOrders({
  status: "open" | "closed" | "all",
  cardCode: "C00369",
  fromDate: "2026-02-01",
  toDate: "2026-02-10",
  limit: 50,
  skip: 0
});

// Buscar por DocEntry
await sapMockService.getOrderByDocEntry(60);

// Buscar linhas
await sapMockService.getOrderLines(60);

// Atualizar UDFs
await sapMockService.updateOrderStatus(60, {
  U_WMS_STATUS: "EM_SEPARACAO",
  U_WMS_ORDERID: "uuid",
  U_WMS_LAST_EVENT: "INICIAR_SEPARACAO",
  U_WMS_LAST_TS: new Date().toISOString()
});

// Criar pedido
await sapMockService.createOrder({
  CardCode: "C00369",
  DocTotal: 1000,
  DocumentLines: [...]
});
```

### Items

```typescript
// Listar produtos
await sapMockService.getItems({
  itemCode: "TP0000016",
  top: 10
});

// Buscar por código
await sapMockService.getItemByCode("GAR0001250");

// Consultar estoque
await sapMockService.getItemWarehouseInfo("TP0000016");
```

### Warehouses

```typescript
// Listar depósitos ativos
await sapMockService.getWarehouses();
```

### Business Partners

```typescript
// Listar clientes
await sapMockService.getBusinessPartners({
  cardCode: "C00369",
  cardType: "cCustomer"
});
```

### Utilidades

```typescript
// Gerar pedidos aleatórios
await sapMockService.generateRandomOrders(10);

// Resetar dados
sapMockService.resetData();

// Estatísticas
sapMockService.getStats();
```

---

## 🧪 Executar Exemplo

```bash
# Compilar TypeScript
npm run build

# Executar exemplo
node dist/sap-connector/examples/test-mock-service.js
```

Ou com tsx:

```bash
tsx sap-connector/examples/test-mock-service.ts
```

---

## 🎯 Casos de Uso

### 1. Desenvolvimento Local

```typescript
// Substituir SAP real pelo mock durante desenvolvimento
const useMock = process.env.NODE_ENV === 'development';

const sapClient = useMock 
  ? sapMockService 
  : new ServiceLayerClient(config);
```

### 2. Testes Unitários

```typescript
import { sapMockService } from './mocks/sapMockService';

describe('Order Processing', () => {
  beforeEach(() => {
    sapMockService.resetData();
  });

  it('should process order', async () => {
    const orders = await sapMockService.getOrders({ status: 'open' });
    expect(orders.value.length).toBeGreaterThan(0);
  });
});
```

### 3. Demonstrações

```typescript
// Gerar dados para demo
await sapMockService.generateRandomOrders(50);

// Mostrar estatísticas
const stats = sapMockService.getStats();
console.log(`${stats.totalOrders} pedidos disponíveis`);
```

### 4. Integração com WMS

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';
import { createOrderFromSap } from './wms-core/src/services/sapIntegrationService';

// Buscar pedidos do SAP (mock)
const sapOrders = await sapMockService.getOrders({ status: 'open' });

// Converter para WMS
for (const sapOrder of sapOrders.value) {
  const wmsOrder = createOrderFromSap({
    orderId: uuidv4(),
    sapOrder
  });
  
  await orderRepository.save(wmsOrder);
}
```

---

## 📝 Funcionalidades Especiais

### Delays de Rede Simulados

O mock simula latência de rede realista:
- Login: 300ms
- GET Orders: 500ms
- GET Order: 200ms
- PATCH Order: 300ms
- GET Items: 300ms

### Dados Consistentes

- Pedidos fechados mantêm UDFs de WMS preenchidos
- Estoque calculado corretamente (disponível = estoque - comprometido)
- Timestamps atualizados em modificações

### Geração de Dados Aleatórios

```typescript
// Gerar 100 pedidos aleatórios para teste de carga
const randomOrders = await sapMockService.generateRandomOrders(100);
```

---

## 🔄 Comparação: Mock vs SAP Real

| Feature | Mock | SAP Real |
|---------|------|----------|
| **Velocidade** | ⚡ Muito rápido | 🐌 Lento (rede) |
| **Disponibilidade** | ✅ Sempre | ⚠️ Depende de rede |
| **Setup** | ✅ Zero config | ❌ Credenciais necessárias |
| **Dados** | ✅ Consistentes | ⚠️ Podem mudar |
| **Testes** | ✅ Ideal | ❌ Não recomendado |
| **Produção** | ❌ Não usar | ✅ Obrigatório |

---

## 🐛 Troubleshooting

### Mock não encontrado

```bash
# Verificar caminho
ls sap-connector/mocks/sapMockService.ts

# Compilar TypeScript
npm run build
```

### Dados não resetam

```typescript
// Resetar manualmente
sapMockService.resetData();
```

### Erros de tipo

```typescript
// Importar tipos corretos
import type { SapOrder } from '../src/sapTypes';
```

---

## 📚 Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `sapMockData.ts` | Dados estáticos |
| `sapMockService.ts` | Serviço mock |
| `examples/test-mock-service.ts` | Exemplo completo |
| `../src/sapTypes.ts` | Tipos TypeScript |

---

## 🎓 Próximos Passos

1. **Usar no desenvolvimento** - Substituir SAP real durante dev
2. **Criar testes** - Usar mock em testes unitários
3. **Gerar mais dados** - Usar `generateRandomOrders()` para testes
4. **Integrar com WMS** - Testar importação de pedidos

---

**Versão**: 1.0.0  
**Data**: 2026-02-05  
**Status**: ✅ Pronto para Uso
