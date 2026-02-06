# Suite de Testes - WMS Orchestrator

Este diretório contém a suite completa de testes do WMS Orchestrator, organizada em 3 camadas: **Unit**, **Integration** e **E2E** (End-to-End).

---

## 📁 Estrutura

```
tests/
├── fixtures/                 # Massa de dados reutilizável
│   └── orders.ts            # Fixtures de pedidos, itens, tasks
│
├── unit/                    # Testes unitários (componentes isolados)
│   └── order.idempotency.unit.test.ts
│
├── integration/             # Testes de integração (múltiplos componentes)
│   └── tasks.and.scans.integration.test.ts
│
└── e2e/                     # Testes end-to-end (fluxo completo)
    ├── doubleCheck.edge-cases.e2e.test.ts
    ├── order-flow.e2e.test.ts
    └── order.concurrency.e2e.test.ts
```

---

## 🚀 Como Executar

### Todos os testes
```bash
npm test
```

### Com relatório de cobertura
```bash
npm run test:coverage
```

### Apenas testes E2E
```bash
npm test -- tests/e2e/**/*.test.ts
```

### Apenas testes Unit
```bash
npm test -- tests/unit/**/*.test.ts
```

### Apenas testes Integration
```bash
npm test -- tests/integration/**/*.test.ts
```

### Visualizar cobertura no navegador
```bash
# Windows
start coverage/index.html

# Mac
open coverage/index.html

# Linux
xdg-open coverage/index.html
```

---

## 🧪 Categorias de Testes

### 1️⃣ Unit Tests (Testes Unitários)
**Objetivo:** Testar componentes isolados (funções puras, lógica de domínio)

**Características:**
- ✅ Rápidos (< 10ms por teste)
- ✅ Sem dependências externas
- ✅ Foco em lógica de negócio

**Exemplos:**
- Idempotência de eventos (mesma chave + payload)
- Validação de permissões
- Cálculos de quantidades

### 2️⃣ Integration Tests (Testes de Integração)
**Objetivo:** Testar integração entre componentes (services + domain)

**Características:**
- ✅ Velocidade média (10-50ms por teste)
- ✅ Múltiplos componentes
- ✅ Fluxos parciais

**Exemplos:**
- Task + Scan (picking completo)
- Order + DoubleCheck (validação de sequência)

### 3️⃣ E2E Tests (Testes End-to-End)
**Objetivo:** Testar fluxo completo (pedido → picking → packing → expedição)

**Características:**
- ✅ Cobertura máxima (fluxo real de usuário)
- ✅ Validação de regras de negócio
- ✅ Casos de borda (edge cases)

**Exemplos:**
- Fluxo completo: A_SEPARAR → DESPACHADO
- Endereço/SKU/quantidade errados
- Concorrência (2 operadores no mesmo pedido)

---

## 🎯 Casos de Borda Cobertos

### ✅ Endereço Errado
```typescript
// tests/e2e/doubleCheck.edge-cases.e2e.test.ts
test("endereço errado", () => {
  // Escaneia ADDR-XX em vez de ADDR-01
  // ✅ Sistema rejeita com erro
});
```

### ✅ SKU Errado
```typescript
test("SKU errado", () => {
  // Escaneia SKU-999 que não existe no pedido
  // ✅ Sistema rejeita com erro "SKU não esperado"
});
```

### ✅ Quantidade Excedida
```typescript
test("quantidade excedida", () => {
  // Escaneia 3 unidades quando esperado era 2
  // ✅ Sistema detecta excedente
});
```

### ✅ Item Faltante Parcial
```typescript
test("item faltante parcial", () => {
  // Escaneia 1 unidade quando esperado era 2
  // ✅ Sistema aceita mas marca como incompleto
});
```

### ✅ Duplicidade/Idempotência (Scan Repetido)
```typescript
test("duplicidade/idempotência", () => {
  // Escaneia mesmo item 2x com mesma idempotencyKey
  // ✅ Segunda requisição é ignorada (não duplica)
});
```

### ✅ Concorrência (2 Operadores)
```typescript
test("concorrência: 2 operadores no mesmo pedido", () => {
  // Operador A e B leem pedido (versão 0)
  // A aplica evento → versão 1
  // B tenta aplicar com expectedVersion: 0
  // ✅ Sistema rejeita com WMS-CONC-001
});
```

---

## 🛡️ Regras de Negócio Validadas

Todos os testes validam as regras definidas em [SPEC.md](../SPEC.md):

| Regra | Descrição | Arquivo de Teste |
|-------|-----------|------------------|
| **RB-01** | Status como fonte de verdade | `order-flow.e2e.test.ts` |
| **RB-02** | Transições válidas | `orderStateMachine.test.ts` |
| **RB-03** | Imutabilidade de itens após separação | `orderService.ts` (impl) |
| **RB-04** | Auditoria obrigatória | `orderStateMachine.test.ts` |
| **RB-05** | Idempotência | `order.idempotency.unit.test.ts` |
| **RB-06** | Conferência após separação | `order-flow.e2e.test.ts` |
| **RB-07** | Cotação/Coleta/Despacho | `order-flow.e2e.test.ts` |

---

## 📊 Cobertura de Código

**Meta:** >85%  
**Atual:** 88.88% ✅

```
┌─────────────────────┬──────────┬──────────┬──────────┐
│ Camada              │ % Stmts  │ % Branch │ % Funcs  │
├─────────────────────┼──────────┼──────────┼──────────┤
│ doubleCheckService  │  88.11%  │  70.96%  │  100%    │
│ orderService        │  84.57%  │  80%     │  100%    │
│ taskService         │  95%     │  85.71%  │  100%    │
│ orderStateMachine   │  100%    │  83.33%  │  100%    │
└─────────────────────┴──────────┴──────────┴──────────┘
```

---

## 🧩 Fixtures (Massa de Dados)

### `fixtures/orders.ts`

Contém dados reutilizáveis para testes:

```typescript
export const fixtureOrderId = "order-e2e-1";
export const fixtureCustomerId = "cust-e2e-1";
export const fixtureShipToAddress = "ADDR-01";

export const fixtureItems: OrderItem[] = [
  { sku: "SKU-1", quantity: 2 },
  { sku: "SKU-2", quantity: 1 }
];

export const fixtureTaskIds = {
  picking: "task-picking-1",
  packing: "task-packing-1",
  shipping: "task-shipping-1"
};
```

**Benefícios:**
- ✅ Consistência entre testes
- ✅ Fácil manutenção
- ✅ Dados realistas

---

## 🔍 Como Escrever Novos Testes

### Exemplo: Teste Unitário

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { myFunction } from "../../wms-core/src/services/myService.js";

test("minha validação", () => {
  const result = myFunction({ input: "valor" });
  assert.equal(result.status, "esperado");
});
```

### Exemplo: Teste E2E

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { createOrder, applyOrderEvent } from "../../wms-core/src/services/orderService.js";
import { fixtureCustomerId, fixtureItems } from "../fixtures/orders.js";

test("fluxo completo", () => {
  // 1. Criar pedido
  const order = createOrder({
    id: "test-1",
    customerId: fixtureCustomerId,
    items: fixtureItems
  });
  
  // 2. Aplicar eventos
  const result = applyOrderEvent(order, {
    eventType: "INICIAR_SEPARACAO",
    actorId: "user-1",
    actorRole: "PICKER"
  });
  
  // 3. Validar resultado
  assert.equal(result.order.status, "EM_SEPARACAO");
});
```

---

## 🐛 Debug de Testes

### Ver output detalhado
```bash
npm test -- --reporter=spec
```

### Executar teste específico
```bash
npm test -- tests/e2e/order-flow.e2e.test.ts
```

### Adicionar logs no teste
```typescript
test("meu teste", () => {
  console.log("Debug:", { order, result });
  assert.equal(order.status, "A_SEPARAR");
});
```

---

## 📈 CI/CD

### GitHub Actions (exemplo)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## 📚 Referências

- [Node.js Test Runner](https://nodejs.org/api/test.html) - Documentação oficial
- [c8 Coverage](https://github.com/bcoe/c8) - Ferramenta de cobertura
- [SPEC.md](../SPEC.md) - Especificação do MVP
- [ANALISE_TESTES_E2E.md](./ANALISE_TESTES_E2E.md) - Análise completa da suite

---

## ✅ Checklist de Pull Request

Antes de abrir um PR, garanta que:

- [ ] Todos os testes passam (`npm test`)
- [ ] Cobertura >85% (`npm run test:coverage`)
- [ ] Testes novos para features novas
- [ ] Fixtures atualizadas (se necessário)
- [ ] README atualizado (se necessário)

---

**Última atualização:** 2026-02-03  
**Versão:** 1.0.0
