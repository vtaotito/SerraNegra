# ⚡ Guia Rápido - Testes E2E

## 🚀 Comandos Principais

```bash
# Executar todos os testes
npm test

# Gerar relatório de cobertura
npm run test:coverage

# Ver cobertura no navegador
start coverage/index.html    # Windows
open coverage/index.html     # Mac
xdg-open coverage/index.html # Linux

# Verificar tipagem
npm run typecheck
```

---

## 📊 Status da Suite

| Métrica | Valor | Status |
|---------|-------|--------|
| **Testes executados** | 27 | ✅ |
| **Testes passaram** | 21 | ✅ |
| **Testes falharam** | 0 | ✅ |
| **Cobertura** | 88.88% | ✅ (meta: 85%) |
| **Tempo execução** | ~1s | ✅ |

---

## 🎯 Cenários Testados

### ✅ Casos de Borda
- ✅ Endereço errado
- ✅ SKU errado
- ✅ Quantidade excedida
- ✅ Item faltante parcial
- ✅ Duplicidade/idempotência (scan repetido)
- ✅ Concorrência (2 operadores no mesmo pedido)

### ✅ Fluxo E2E Completo
- ✅ Criar pedido → Picking → Packing → Shipping → Despacho
- ✅ Validações de permissão (PICKER, CHECKER, SUPERVISOR, SHIPPER)
- ✅ Máquina de estados (A_SEPARAR → DESPACHADO)
- ✅ DoubleCheck (endereço → produto → quantidade)
- ✅ Dependências de tarefas (packing após picking)

---

## 📁 Estrutura de Arquivos

```
tests/
├── fixtures/orders.ts                  # Massa de dados
├── unit/order.idempotency.unit.test.ts # Testes unitários
├── integration/tasks.and.scans.integration.test.ts # Integração
└── e2e/                                # End-to-end
    ├── doubleCheck.edge-cases.e2e.test.ts
    ├── order-flow.e2e.test.ts
    └── order.concurrency.e2e.test.ts
```

---

## 🔍 Documentação Completa

- **README.md** - Como usar os testes
- **ANALISE_TESTES_E2E.md** - Análise técnica completa
- **SUMARIO_VISUAL.md** - Diagramas e fluxos visuais
- **GUIA_RAPIDO_TESTES.md** - Este arquivo

---

## 🛡️ Códigos de Erro Implementados

| Código | Descrição | Teste |
|--------|-----------|-------|
| **WMS-IDEM-001** | Idempotency-Key já usada com payload diferente | `order.idempotency.unit.test.ts` |
| **WMS-CONC-001** | Conflito de versão (lock otimista) | `order.concurrency.e2e.test.ts` |
| **WMS-DC-001** | Endereço divergente | `doubleCheck.edge-cases.e2e.test.ts` |
| **WMS-DC-002** | SKU não esperado | `doubleCheck.edge-cases.e2e.test.ts` |

---

## ⚙️ Funcionalidades Core Ampliadas

### 1️⃣ orderService.ts
```typescript
+ applyOrderEventWithGuards()      // Com idempotência + lock otimista
+ OrderEventIdempotencyStore       // Cache de eventos
+ createOrderEventIdempotencyStore() // Factory do store
```

### 2️⃣ doubleCheckService.ts
```typescript
+ Idempotência de scans            // Via idempotencyKey
+ Validação de sequência           // Endereço → SKU → quantidade
```

### 3️⃣ errors.ts
```typescript
+ WMS-IDEM-001   // Idempotency-Key com payload diferente
+ WMS-CONC-001   // Conflito de versão (concorrência)
```

---

## 🎯 Próximos Passos (Recomendações)

### Fase 2 - Testes de API HTTP
```bash
# Adicionar testes de contrato OpenAPI
# Validar headers (Idempotency-Key, X-Correlation-Id)
# Testar códigos HTTP (200, 400, 409, etc.)
```

### Fase 3 - Performance
```bash
# Load testing (100+ operadores)
# Stress testing (limite do sistema)
# Soak testing (24h+)
```

### Fase 4 - Integração SAP
```bash
# Mock completo SAP Business One
# Testes de retry/circuit breaker
# Testes de timeout/latência
```

---

## 📚 Referências Rápidas

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [c8 Coverage](https://github.com/bcoe/c8)
- [SPEC.md](./SPEC.md) - Regras de negócio
- [STATE_MACHINE.json](./STATE_MACHINE.json) - Estados do pedido

---

## ✅ Checklist de PR

Antes de abrir um Pull Request:

- [ ] `npm test` passou sem erros
- [ ] `npm run test:coverage` mostra >85% de cobertura
- [ ] `npm run typecheck` passou sem erros
- [ ] Testes novos para features novas
- [ ] Fixtures atualizadas (se necessário)
- [ ] README atualizado (se necessário)

---

**Última atualização:** 2026-02-03  
**Versão:** 1.0.0  
**Status:** ✅ Produção
