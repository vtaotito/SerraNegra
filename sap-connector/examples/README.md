# 📚 Exemplos SAP Mock

Exemplos práticos de como usar o SAP B1 Mock Service em diferentes cenários.

---

## 📋 Índice de Exemplos

| Arquivo | Descrição | Tempo | Nível |
|---------|-----------|-------|-------|
| [`test-mock-service.ts`](#test-mock-servicets) | Demonstração completa do mock | 5 min | Iniciante |
| [`integration-example.ts`](#integration-examplets) | Integração WMS + SAP | 10 min | Intermediário |
| [`test-with-mock.test.ts`](#test-with-mocktestts) | Testes unitários | 15 min | Avançado |

---

## 🚀 Como Executar

### Método 1: NPM Scripts (Recomendado)

```bash
# Exemplo completo do mock
npm run sap:mock

# Exemplo de integração WMS
npm run sap:mock:integration
```

### Método 2: TSX Direto

```bash
# Qualquer exemplo
tsx sap-connector/examples/test-mock-service.ts
tsx sap-connector/examples/integration-example.ts

# Testes
npm test -- test-with-mock.test.ts
```

---

## 📖 Descrição dos Exemplos

### `test-mock-service.ts`

**Propósito**: Demonstração completa de todas as funcionalidades do mock

**O que faz**:
- ✅ Login/Logout
- ✅ Listar pedidos
- ✅ Buscar pedido por DocEntry
- ✅ Atualizar UDFs (campos WMS)
- ✅ Listar produtos
- ✅ Consultar estoque
- ✅ Listar depósitos
- ✅ Listar clientes
- ✅ Filtrar por status/cliente
- ✅ Gerar pedidos aleatórios
- ✅ Ver estatísticas

**Quando usar**: 
- Aprender como o mock funciona
- Ver todas as funcionalidades disponíveis
- Testar se está funcionando

**Output esperado**:
```
=== Exemplo Completo do SAP Mock Service ===

✅ 1. Login
  SessionId: mock-session-abc123

✅ 2. Listar Pedidos
  Total: 2 pedidos
  Pedido: 60 - C00369 - EUTIDES JACKSON SARMENTO

✅ 3. Buscar Pedido Específico
  DocEntry: 60
  Cliente: EUTIDES JACKSON SARMENTO
  Total: R$ 2850.50
  Linhas: 5

...
```

**Como adaptar para seu projeto**:
```typescript
import { sapMockService } from '../mocks/sapMockService';

// Usar qualquer método do exemplo
const orders = await sapMockService.getOrders({ status: 'open' });
```

---

### `integration-example.ts`

**Propósito**: Demonstra integração completa entre WMS e SAP usando o mock

**O que faz**:
- ✅ Busca pedidos abertos do SAP
- ✅ Converte para formato WMS
- ✅ Simula workflow completo (PENDING → PICKING → COMPLETE)
- ✅ Atualiza SAP a cada mudança de status
- ✅ Verifica estoque disponível

**Quando usar**:
- Desenvolver integração WMS + SAP
- Testar fluxo completo de pedidos
- Entender comunicação bidirecional

**Workflow Simulado**:
```
SAP (OPEN) 
    ↓
WMS (PENDING) → Atualiza SAP com U_WMS_STATUS
    ↓
WMS (PICKING) → Atualiza SAP com evento
    ↓
WMS (PICKED) → Atualiza SAP
    ↓
WMS (PACKING) → Atualiza SAP
    ↓
WMS (COMPLETE) → Atualiza SAP
```

**Output esperado**:
```
=== Integração WMS + SAP Mock ===

📦 Pedidos SAP recebidos: 2

🔄 Processando Pedido SAP 60
  Cliente: EUTIDES JACKSON SARMENTO
  Linhas: 5

✅ Convertido para WMS
  Pedido WMS: WMS-60
  Status: PENDING

📊 Verificando estoque...
  TP0000016 no 02.02: 500 disponíveis (OK)
  ...

🔄 Status: PENDING → Atualizado no SAP
🔄 Status: PICKING → Atualizado no SAP
🔄 Status: PICKED → Atualizado no SAP
🔄 Status: PACKING → Atualizado no SAP
🔄 Status: COMPLETE → Atualizado no SAP

✅ Pedido WMS-60 concluído!
```

**Como adaptar para seu projeto**:
```typescript
import { sapMockService } from '../mocks/sapMockService';
import { createOrderFromSap } from '../../core/models/Order';

// 1. Buscar do SAP
const sapOrders = await sapMockService.getOrders({ status: 'open' });

// 2. Converter para WMS
const wmsOrder = createOrderFromSap(sapOrders.value[0]);

// 3. Processar no WMS
await processOrderInWMS(wmsOrder);

// 4. Atualizar SAP
await sapMockService.updateOrderStatus(wmsOrder.externalId, {
  U_WMS_STATUS: wmsOrder.status,
  U_WMS_LAST_EVENT: 'Status atualizado',
  U_WMS_LAST_TS: new Date().toISOString()
});
```

---

### `test-with-mock.test.ts`

**Propósito**: Suite completa de testes unitários usando o mock

**O que faz**:
- ✅ Testes de autenticação
- ✅ Testes de busca de pedidos
- ✅ Testes de filtros
- ✅ Testes de atualização
- ✅ Testes de produtos
- ✅ Testes de estoque
- ✅ Testes de geração de dados
- ✅ Testes de reset
- ✅ Testes de workflow completo
- ✅ Testes de performance

**Quando usar**:
- Criar testes unitários
- Validar lógica de negócio
- Testar integração com SAP
- CI/CD

**Estrutura**:
```typescript
describe('SAP Mock Service', () => {
  
  beforeEach(() => {
    sapMockService.resetData(); // Garantir estado limpo
  });

  test('Deve fazer login', async () => {
    const result = await sapMockService.login('user', 'pass');
    expect(result.SessionId).toBeDefined();
  });

  test('Deve filtrar pedidos por status', async () => {
    const response = await sapMockService.getOrders({ status: 'open' });
    expect(response.value.length).toBeGreaterThan(0);
  });

  // ... mais testes
});
```

**Como executar**:
```bash
# Instalar Jest (se ainda não tiver)
npm install -D jest @types/jest ts-jest

# Executar testes
npm test

# Executar testes específicos
npm test -- test-with-mock

# Com cobertura
npm test -- --coverage
```

**Como adaptar para seu projeto**:
```typescript
import { sapMockService } from '../mocks/sapMockService';
import { myImportFunction } from '../../core/services/sapImporter';

describe('Minha Lógica de Importação', () => {
  
  beforeEach(() => {
    sapMockService.resetData();
  });

  test('Deve importar pedidos do SAP', async () => {
    // Arrange
    await sapMockService.generateRandomOrders(10);
    
    // Act
    const result = await myImportFunction();
    
    // Assert
    expect(result.imported).toBe(10);
  });

});
```

---

## 🎯 Escolhendo o Exemplo Certo

### Quero aprender o básico
→ Use: `test-mock-service.ts`  
→ Execute: `npm run sap:mock`

### Quero integrar com WMS
→ Use: `integration-example.ts`  
→ Execute: `npm run sap:mock:integration`

### Quero criar testes
→ Use: `test-with-mock.test.ts`  
→ Configure Jest e adapte os testes

### Quero usar em produção
→ Use: Qualquer exemplo como base  
→ Adapte para seu código

---

## 🔧 Configuração

### Requisitos

- Node.js 16+
- TypeScript
- `tsx` (já instalado no projeto)

### Variáveis de Ambiente

```bash
# Para usar o mock em vez do SAP real
USE_SAP_MOCK=true

# Configurar delay do mock (ms)
SAP_MOCK_DELAY=500
```

### Arquivo `.env`

```env
# Desenvolvimento local
USE_SAP_MOCK=true
SAP_MOCK_DELAY=300

# Produção
USE_SAP_MOCK=false
SAP_HOST=https://real-sap-server.com
SAP_PORT=50000
```

---

## 💡 Dicas de Uso

### 1. Reset de Dados

Sempre resete antes de cada teste:

```typescript
beforeEach(() => {
  sapMockService.resetData();
});
```

### 2. Geração de Dados

Para testes de carga:

```typescript
await sapMockService.generateRandomOrders(100);
```

### 3. Delays Customizados

Ajustar latência simulada:

```typescript
// No mock service (sapMockService.ts)
private async delay(ms: number = 300) { // Mudar aqui
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 4. Factory Pattern

Usar mock ou SAP real baseado em config:

```typescript
function createSapClient() {
  if (process.env.USE_SAP_MOCK === 'true') {
    return sapMockService;
  }
  return new RealSapClient();
}
```

### 5. Debugging

Ver estado atual do mock:

```typescript
const stats = sapMockService.getStats();
console.log('Mock stats:', stats);
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module"

```bash
# Verificar se está executando do diretório correto
cd c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms

# Verificar imports
import { sapMockService } from './sap-connector/mocks/sapMockService';
```

### Erro: "SessionId is not defined"

```typescript
// Sempre fazer login primeiro
await sapMockService.login('user', 'pass');

// Depois fazer outras operações
const orders = await sapMockService.getOrders();
```

### Testes falhando aleatoriamente

```typescript
// Garantir reset antes de cada teste
beforeEach(() => {
  sapMockService.resetData();
});
```

### Mock muito lento

```typescript
// Reduzir delay no sapMockService.ts
private async delay(ms: number = 100) { // Era 500
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 📊 Comparação dos Exemplos

| Feature | test-mock-service | integration-example | test-with-mock |
|---------|-------------------|---------------------|----------------|
| **Propósito** | Demonstração | Integração | Testes |
| **Complexidade** | Simples | Média | Avançada |
| **Tempo** | 5 min | 10 min | 15 min |
| **Nível** | Iniciante | Intermediário | Avançado |
| **Output** | Console logs | Console logs | Test results |
| **Interativo** | Não | Não | Sim (testes) |
| **Cobertura** | Todas APIs | Workflow WMS | Tudo + edge cases |

---

## 🎓 Próximos Passos

1. **Executar exemplos**: Rode todos os 3 exemplos para entender
2. **Ler documentação**: [`../mocks/README.md`](../mocks/README.md)
3. **Adaptar para seu projeto**: Copie exemplos e customize
4. **Criar testes**: Use `test-with-mock.test.ts` como base
5. **Integrar com WMS**: Use `integration-example.ts` como referência

---

## 📚 Documentação Relacionada

- [Guia Completo do Mock](../mocks/README.md)
- [Resumo Executivo](../../SAP_MOCK_SUMMARY.md)
- [Quick Start](../../SAP_MOCK_QUICKSTART.md)
- [Índice Geral](../mocks/INDEX.md)
- [Tipos SAP](../src/sapTypes.ts)
- [Dados Mock](../mocks/sapMockData.ts)
- [Serviço Mock](../mocks/sapMockService.ts)

---

## ❓ Perguntas Frequentes

### Como usar em desenvolvimento?

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';

const orders = await sapMockService.getOrders({ status: 'open' });
```

### Como usar em testes?

```typescript
import { sapMockService } from './sap-connector/mocks/sapMockService';

describe('Meus testes', () => {
  beforeEach(() => sapMockService.resetData());
  
  test('teste 1', async () => {
    const orders = await sapMockService.getOrders();
    expect(orders.value.length).toBeGreaterThan(0);
  });
});
```

### Como adicionar dados customizados?

Edite `../mocks/sapMockData.ts` e adicione seus dados nos arrays:

```typescript
export const mockOrders: SapOrder[] = [
  // Seus pedidos aqui
  {
    DocEntry: 999,
    CardCode: 'C999',
    // ... outros campos
  }
];
```

### Como trocar entre mock e SAP real?

Use variável de ambiente:

```typescript
const sapClient = process.env.USE_SAP_MOCK === 'true' 
  ? sapMockService 
  : realSapClient;
```

---

**Última atualização**: 2026-02-05  
**Versão**: 1.0.0  
**Status**: ✅ **COMPLETO**
