  # 🎭 SAP B1 Mock Service - Documentação Principal

Sistema completo de mock para SAP Business One Service Layer, incluindo dados realistas, serviço simulado, exemplos práticos e integração com WMS.

---

## 🚀 Quick Start (3 minutos)

```bash
# 1. Executar exemplo completo
npm run sap:mock

# 2. Ver integração com WMS
npm run sap:mock:integration

# 3. Usar factory pattern
npm run sap:factory
```

**Primeiro uso?** → Leia: [`SAP_MOCK_QUICKSTART.md`](./SAP_MOCK_QUICKSTART.md)

---

## 📚 Documentação

### 🎯 Por Objetivo

| Quero | Documento | Tempo |
|-------|-----------|-------|
| **Começar agora** | [`SAP_MOCK_QUICKSTART.md`](./SAP_MOCK_QUICKSTART.md) | 3 min |
| **Entender tudo** | [`sap-connector/mocks/README.md`](./sap-connector/mocks/README.md) | 15 min |
| **Ver resumo executivo** | [`SAP_MOCK_SUMMARY.md`](./SAP_MOCK_SUMMARY.md) | 10 min |
| **Navegar arquivos** | [`sap-connector/mocks/INDEX.md`](./sap-connector/mocks/INDEX.md) | 2 min |
| **Ver exemplos** | [`sap-connector/examples/README.md`](./sap-connector/examples/README.md) | 5 min |

### 📂 Por Categoria

#### Documentação Geral
- **Quick Start**: Começar em 3 minutos ([`SAP_MOCK_QUICKSTART.md`](./SAP_MOCK_QUICKSTART.md))
- **Resumo Executivo**: Visão geral completa ([`SAP_MOCK_SUMMARY.md`](./SAP_MOCK_SUMMARY.md))
- **Guia Completo**: Documentação detalhada ([`sap-connector/mocks/README.md`](./sap-connector/mocks/README.md))
- **Índice**: Navegação rápida ([`sap-connector/mocks/INDEX.md`](./sap-connector/mocks/INDEX.md))

#### Código Fonte
- **Dados Mock**: Arrays de pedidos, produtos, etc ([`sap-connector/mocks/sapMockData.ts`](./sap-connector/mocks/sapMockData.ts))
- **Serviço Mock**: Simulação da API SAP ([`sap-connector/mocks/sapMockService.ts`](./sap-connector/mocks/sapMockService.ts))
- **Factory**: Alternar mock/real ([`sap-connector/sapClientFactory.ts`](./sap-connector/sapClientFactory.ts))
- **Tipos**: Definições TypeScript ([`sap-connector/src/sapTypes.ts`](./sap-connector/src/sapTypes.ts))

#### Exemplos
- **Exemplo Completo**: Todas as funcionalidades ([`sap-connector/examples/test-mock-service.ts`](./sap-connector/examples/test-mock-service.ts))
- **Integração WMS**: Workflow completo ([`sap-connector/examples/integration-example.ts`](./sap-connector/examples/integration-example.ts))
- **Testes Unitários**: Suite de testes ([`sap-connector/examples/test-with-mock.test.ts`](./sap-connector/examples/test-with-mock.test.ts))
- **Factory Pattern**: Uso do factory ([`sap-connector/examples/use-factory.ts`](./sap-connector/examples/use-factory.ts))
- **Guia de Exemplos**: Documentação dos exemplos ([`sap-connector/examples/README.md`](./sap-connector/examples/README.md))

#### Dados JSON
- **Pedidos**: Sample orders ([`sap-connector/mocks/data/sample-orders.json`](./sap-connector/mocks/data/sample-orders.json))
- **Produtos**: Sample items ([`sap-connector/mocks/data/sample-items.json`](./sap-connector/mocks/data/sample-items.json))
- **Estoque**: Sample stock ([`sap-connector/mocks/data/sample-stock.json`](./sap-connector/mocks/data/sample-stock.json))

#### Configuração
- **Variáveis de Ambiente**: Exemplo de `.env` ([`.env.example`](./.env.example))

---

## 🎓 Guias de Aprendizado

### 👶 Nível 1: Iniciante (10 minutos)

**Objetivo**: Entender o básico e executar o mock

1. Ler [`SAP_MOCK_QUICKSTART.md`](./SAP_MOCK_QUICKSTART.md) (3 min)
2. Executar `npm run sap:mock` (2 min)
3. Ver output no console (5 min)

**Resultado**: ✅ Consegue usar o mock

---

### 🎯 Nível 2: Intermediário (30 minutos)

**Objetivo**: Integrar mock com seu código WMS

1. Ler [`sap-connector/mocks/README.md`](./sap-connector/mocks/README.md) (15 min)
2. Executar `npm run sap:mock:integration` (5 min)
3. Estudar [`sap-connector/examples/integration-example.ts`](./sap-connector/examples/integration-example.ts) (10 min)

**Resultado**: ✅ Integra mock com WMS

---

### 🚀 Nível 3: Avançado (1 hora)

**Objetivo**: Dominar completamente o sistema de mock

1. Ler [`SAP_MOCK_SUMMARY.md`](./SAP_MOCK_SUMMARY.md) (10 min)
2. Estudar [`sap-connector/mocks/sapMockData.ts`](./sap-connector/mocks/sapMockData.ts) (15 min)
3. Estudar [`sap-connector/mocks/sapMockService.ts`](./sap-connector/mocks/sapMockService.ts) (20 min)
4. Criar dados customizados (15 min)

**Resultado**: ✅ Domina o mock completamente

---

## 💻 Como Usar

### Opção 1: Uso Direto (Simples)

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';

// Login
await sapMockService.login('admin', 'password');

// Buscar pedidos
const orders = await sapMockService.getOrders({ status: 'open' });

// Processar
for (const order of orders.value) {
  console.log(`Pedido ${order.DocNum}: ${order.CardName}`);
}

// Logout
await sapMockService.logout();
```

### Opção 2: Factory Pattern (Recomendado)

```typescript
import { createSapClient } from './sap-connector/sapClientFactory';

// Cria automaticamente mock ou real baseado no .env
const sapClient = createSapClient();

// Usar normalmente
await sapClient.login('admin', 'password');
const orders = await sapClient.getOrders({ status: 'open' });
await sapClient.logout();
```

### Opção 3: Singleton Pattern (Produção)

```typescript
import { getSapClient } from './sap-connector/sapClientFactory';

// Sempre retorna mesma instância
const sapClient = getSapClient();

await sapClient.login('admin', 'password');
const orders = await sapClient.getOrders();
await sapClient.logout();
```

---

## 🔧 Configuração

### 1. Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Configure:

```env
# Usar mock em desenvolvimento
USE_SAP_MOCK=true
SAP_MOCK_DELAY=500

# Usar SAP real em produção
# USE_SAP_MOCK=false
# SAP_HOST=https://sap-server.com
# SAP_USERNAME=manager
# SAP_PASSWORD=secret
```

### 2. NPM Scripts

Adicione ao `package.json` (já incluídos):

```json
{
  "scripts": {
    "sap:mock": "tsx sap-connector/examples/test-mock-service.ts",
    "sap:mock:integration": "tsx sap-connector/examples/integration-example.ts",
    "sap:factory": "tsx sap-connector/examples/use-factory.ts"
  }
}
```

---

## 📊 Dados Disponíveis

### Clientes (2)
- **C00369**: EUTIDES JACKSON SARMENTO
- **C20018**: MANOELA COSTA AGUILAR DOS SANTOS

### Produtos (8)
- **TP0000016**: TAMPA PLASTICA BRANCA 28MM
- **LG0000016**: LUVA GRANITO 28MM
- **TUABO5011E**: TUBO ABS MARROM 50MM
- **REDENFERRU4**: REDUCAO CURTA FERRULE 4"
- E mais...

### Depósitos (4)
- **02.02**: Armazém
- **02.03**: Expedição
- **02.04**: Logística
- **02.05**: Transferência

### Pedidos (2 + geradores)
- **DocEntry 60**: 5 linhas, R$ 2.850,50
- **DocEntry 61**: 3 linhas, R$ 1.245,00
- Gerador de pedidos aleatórios disponível

---

## 🎯 Casos de Uso

### 1. Desenvolvimento Local

```typescript
// Configurar .env
USE_SAP_MOCK=true

// Usar no código
const sapClient = createSapClient();
```

### 2. Testes Unitários

```typescript
describe('Importação SAP', () => {
  beforeEach(() => {
    sapMockService.resetData();
  });

  test('deve importar pedidos', async () => {
    const orders = await sapMockService.getOrders();
    expect(orders.value.length).toBeGreaterThan(0);
  });
});
```

### 3. Integração WMS

```typescript
// Buscar do SAP
const sapOrders = await sapClient.getOrders({ status: 'open' });

// Converter para WMS
const wmsOrder = createOrderFromSap(sapOrders.value[0]);

// Processar
await processOrder(wmsOrder);

// Atualizar SAP
await sapClient.updateOrderStatus(wmsOrder.externalId, {
  U_WMS_STATUS: 'COMPLETE',
  U_WMS_LAST_EVENT: 'Finalizado',
  U_WMS_LAST_TS: new Date().toISOString()
});
```

### 4. Demos e Apresentações

```typescript
// Gerar dados de demonstração
await sapMockService.generateRandomOrders(50);

// Ver estatísticas
const stats = sapMockService.getStats();
console.log(`Sistema com ${stats.totalOrders} pedidos`);
```

---

## 🛠️ Comandos NPM

```bash
# Exemplo completo
npm run sap:mock

# Integração WMS + SAP
npm run sap:mock:integration

# Factory pattern
npm run sap:factory

# Testes unitários (após configurar Jest)
npm test

# Build (para uso em produção)
npm run sap:build
```

---

## 📁 Estrutura de Arquivos

```
wms/
│
├── SAP_MOCK_README.md              ← VOCÊ ESTÁ AQUI
├── SAP_MOCK_QUICKSTART.md          ← Quick Start (3 min)
├── SAP_MOCK_SUMMARY.md             ← Resumo Executivo
├── .env.example                    ← Configuração
│
└── sap-connector/
    │
    ├── mocks/
    │   ├── INDEX.md                ← Navegação
    │   ├── README.md               ← Guia Completo
    │   ├── sapMockData.ts          ← Dados (450 linhas)
    │   ├── sapMockService.ts       ← Serviço (400 linhas)
    │   ├── integration-example.ts  ← Exemplo WMS
    │   └── data/
    │       ├── sample-orders.json
    │       ├── sample-items.json
    │       └── sample-stock.json
    │
    ├── examples/
    │   ├── README.md               ← Guia de Exemplos
    │   ├── test-mock-service.ts    ← Exemplo completo
    │   ├── integration-example.ts  ← WMS + SAP
    │   ├── test-with-mock.test.ts  ← Testes unitários
    │   └── use-factory.ts          ← Factory pattern
    │
    ├── src/
    │   └── sapTypes.ts             ← Tipos TypeScript
    │
    └── sapClientFactory.ts         ← Factory (mock/real)
```

---

## 🔍 Busca Rápida

**Procurando por**:

| O que | Onde |
|-------|------|
| Como começar | [`SAP_MOCK_QUICKSTART.md`](./SAP_MOCK_QUICKSTART.md) |
| Exemplo completo | [`sap-connector/examples/test-mock-service.ts`](./sap-connector/examples/test-mock-service.ts) |
| Integração WMS | [`sap-connector/examples/integration-example.ts`](./sap-connector/examples/integration-example.ts) |
| Testes | [`sap-connector/examples/test-with-mock.test.ts`](./sap-connector/examples/test-with-mock.test.ts) |
| API Reference | [`sap-connector/mocks/README.md`](./sap-connector/mocks/README.md) |
| Dados mock | [`sap-connector/mocks/sapMockData.ts`](./sap-connector/mocks/sapMockData.ts) |
| Serviço mock | [`sap-connector/mocks/sapMockService.ts`](./sap-connector/mocks/sapMockService.ts) |
| Factory | [`sap-connector/sapClientFactory.ts`](./sap-connector/sapClientFactory.ts) |
| Configuração | [`.env.example`](./.env.example) |

---

## 💡 Dicas

### Para Desenvolvedores

✅ Use factory pattern para alternar mock/real  
✅ Configure `USE_SAP_MOCK=true` em desenvolvimento  
✅ Estude `integration-example.ts` para ver workflow completo  

### Para QA/Testes

✅ Use `resetData()` antes de cada teste  
✅ Gere dados com `generateRandomOrders()`  
✅ Veja `test-with-mock.test.ts` para exemplos  

### Para Demos

✅ Gere 50+ pedidos para dados realistas  
✅ Use `getStats()` para mostrar estatísticas  
✅ Configure delay baixo para demos rápidas  

---

## ❓ FAQ

### Como alterno entre mock e SAP real?

Use `.env`:
```env
USE_SAP_MOCK=true   # mock
USE_SAP_MOCK=false  # real
```

### Como adiciono dados customizados?

Edite `sap-connector/mocks/sapMockData.ts` e adicione nos arrays.

### Como uso em testes?

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';

beforeEach(() => sapMockService.resetData());

test('meu teste', async () => {
  const orders = await sapMockService.getOrders();
  expect(orders.value.length).toBe(2);
});
```

### Como simulo erros?

Implemente lógica condicional no mock service ou crie um mock especializado.

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| **Mock não encontrado** | Verifique path de import |
| **Tipos errados** | Importe de `sapTypes.ts` |
| **Testes falhando** | Use `resetData()` no `beforeEach` |
| **Mock muito lento** | Reduza `SAP_MOCK_DELAY` no `.env` |

---

## 🎉 Começar Agora

Escolha seu caminho:

### 🚀 Rápido (3 minutos)
```bash
npm run sap:mock
```
Leia: [`SAP_MOCK_QUICKSTART.md`](./SAP_MOCK_QUICKSTART.md)

### 📚 Completo (15 minutos)
Leia: [`sap-connector/mocks/README.md`](./sap-connector/mocks/README.md)

### 🔗 Integração (10 minutos)
```bash
npm run sap:mock:integration
```
Estude: [`sap-connector/examples/integration-example.ts`](./sap-connector/examples/integration-example.ts)

---

## 📞 Suporte

- **Documentação completa**: Veja seção [Documentação](#-documentação)
- **Exemplos práticos**: Veja [`sap-connector/examples/`](./sap-connector/examples/)
- **API Reference**: Veja [`sap-connector/mocks/README.md`](./sap-connector/mocks/README.md)

---

**Última atualização**: 2026-02-05  
**Versão**: 1.0.0  
**Status**: ✅ **COMPLETO E DOCUMENTADO**
