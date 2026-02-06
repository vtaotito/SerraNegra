# 📚 Índice da Suite de Testes E2E

## 🎯 Documentos Principais

### 1. [README.md](./README.md) - Guia de Uso
**Para quem:** Desenvolvedores que vão executar/escrever testes  
**Conteúdo:**
- Como executar testes (unit, integration, e2e)
- Estrutura de diretórios
- Como escrever novos testes
- Debug e troubleshooting

### 2. [ANALISE_TESTES_E2E.md](./ANALISE_TESTES_E2E.md) - Análise Técnica Completa
**Para quem:** Tech Lead, QA Lead, arquitetos  
**Conteúdo:**
- Análise detalhada de cada cenário testado
- Métricas de cobertura por camada
- Implementações técnicas (idempotência, lock otimista)
- Regras de negócio validadas (SPEC.md)
- Checklist de entrega

### 3. [SUMARIO_VISUAL.md](./SUMARIO_VISUAL.md) - Diagramas e Fluxos
**Para quem:** Todos (visual e fácil de entender)  
**Conteúdo:**
- Diagrama de arquitetura da suite
- Fluxo E2E completo ilustrado
- Status visual (✅/❌)
- Casos de borda em formato visual

### 4. [GUIA_RAPIDO_TESTES.md](../GUIA_RAPIDO_TESTES.md) - Referência Rápida
**Para quem:** Desenvolvedores que precisam de comandos rápidos  
**Conteúdo:**
- Comandos principais (npm test, coverage, etc.)
- Status resumido da suite
- Checklist de PR
- Links para documentação detalhada

---

## 🗂️ Estrutura de Arquivos de Teste

```
tests/
│
├── 📄 INDEX.md                         ← Este arquivo (navegação)
├── 📄 README.md                        ← Guia de uso completo
├── 📄 ANALISE_TESTES_E2E.md            ← Análise técnica detalhada
├── 📄 SUMARIO_VISUAL.md                ← Diagramas e fluxos visuais
│
├── 📁 fixtures/                        ← Massa de dados reutilizável
│   └── orders.ts                       ← Pedidos, SKUs, endereços
│
├── 📁 unit/                            ← Testes unitários (isolados)
│   └── order.idempotency.unit.test.ts  ← Idempotência de eventos
│       ├─ Mesma chave + mesmo payload → cache
│       └─ Mesma chave + payload diferente → WMS-IDEM-001
│
├── 📁 integration/                     ← Testes de integração
│   └── tasks.and.scans.integration.test.ts  ← Picking + Scan
│       └─ Picking só conclui com quantidades corretas
│
└── 📁 e2e/                             ← Testes end-to-end (fluxo completo)
    │
    ├── doubleCheck.edge-cases.e2e.test.ts   ← Casos de borda
    │   ├─ test: endereço errado
    │   ├─ test: SKU errado
    │   ├─ test: quantidade excedida
    │   ├─ test: item faltante parcial
    │   └─ test: duplicidade/idempotência
    │
    ├── order-flow.e2e.test.ts          ← Fluxo completo
    │   └─ test: pedido → picking → packing → expedição
    │       ├─ Criação de pedido
    │       ├─ Criação de tarefas
    │       ├─ Scans (endereço → SKU → quantidade)
    │       ├─ Validação DoubleCheck
    │       ├─ Dependências de tarefas
    │       ├─ Transições de estado
    │       └─ Idempotência em cada etapa
    │
    └── order.concurrency.e2e.test.ts   ← Concorrência
        └─ test: 2 operadores no mesmo pedido
            ├─ Operador A lê pedido (versão 0)
            ├─ Operador B lê pedido (versão 0)
            ├─ A aplica evento → pedido (versão 1)
            └─ B tenta aplicar (expectedVersion: 0) → WMS-CONC-001
```

---

## 🎯 Navegação Rápida por Cenário

### 🔍 Procurando por...

#### "Como executar os testes?"
→ Vá para: [README.md](./README.md) - Seção "Como Executar"

#### "Quais casos de borda estão cobertos?"
→ Vá para: [ANALISE_TESTES_E2E.md](./ANALISE_TESTES_E2E.md) - Seção "Cenários Críticos"

#### "Como funciona a idempotência?"
→ Vá para: [ANALISE_TESTES_E2E.md](./ANALISE_TESTES_E2E.md) - Seção "Implementações Técnicas"

#### "Qual a cobertura de código?"
→ Vá para: [ANALISE_TESTES_E2E.md](./ANALISE_TESTES_E2E.md) - Seção "Métricas de Qualidade"

#### "Ver fluxo E2E completo ilustrado"
→ Vá para: [SUMARIO_VISUAL.md](./SUMARIO_VISUAL.md) - Seção "Fluxo E2E Completo"

#### "Comandos rápidos (cheat sheet)"
→ Vá para: [GUIA_RAPIDO_TESTES.md](../GUIA_RAPIDO_TESTES.md)

#### "Como escrever um novo teste?"
→ Vá para: [README.md](./README.md) - Seção "Como Escrever Novos Testes"

#### "Checklist de PR"
→ Vá para: [GUIA_RAPIDO_TESTES.md](../GUIA_RAPIDO_TESTES.md) - Seção "Checklist de PR"

---

## 📊 Status Atual

```
✅ 27 testes executados
✅ 21 testes passaram
✅ 0 falhas
✅ 88.88% de cobertura (meta: 85%)
✅ Tempo de execução: ~1 segundo
```

---

## 🚀 Início Rápido

```bash
# 1. Executar todos os testes
npm test

# 2. Gerar relatório de cobertura
npm run test:coverage

# 3. Ver cobertura no navegador
start coverage/index.html
```

---

## 🛠️ Arquivos Implementados no Core

Além dos testes, os seguintes arquivos do core foram ampliados:

| Arquivo | Mudanças | Funcionalidade |
|---------|----------|----------------|
| **wms-core/src/errors.ts** | +WMS-IDEM-001<br>+WMS-CONC-001 | Códigos de erro |
| **wms-core/src/services/orderService.ts** | +applyOrderEventWithGuards()<br>+OrderEventIdempotencyStore | Idempotência + Lock otimista |
| **wms-core/src/services/doubleCheckService.ts** | +validação de idempotencyKey | Scans idempotentes |

---

## 📝 Regras de Negócio (SPEC.md) Validadas

| ID | Regra | Status | Teste |
|----|-------|--------|-------|
| **RB-01** | Status como fonte de verdade | ✅ | `order-flow.e2e.test.ts` |
| **RB-02** | Transições válidas | ✅ | `orderStateMachine.test.ts` |
| **RB-03** | Imutabilidade de itens | ✅ | Implementação no core |
| **RB-04** | Auditoria obrigatória | ✅ | `orderStateMachine.test.ts` |
| **RB-05** | Idempotência | ✅ | `order.idempotency.unit.test.ts` |
| **RB-06** | Conferência após separação | ✅ | `order-flow.e2e.test.ts` |
| **RB-07** | Cotação/Coleta/Despacho | ✅ | `order-flow.e2e.test.ts` |

---

## 🎯 Casos de Uso Mapeados

### 1. Operador Normal (Fluxo Feliz)
**Teste:** `order-flow.e2e.test.ts`  
**Cenário:** Operador escaneia corretamente todos os itens  
**Resultado:** ✅ Pedido concluído (DESPACHADO)

### 2. Operador Escaneia Endereço Errado
**Teste:** `doubleCheck.edge-cases.e2e.test.ts` (endereço errado)  
**Cenário:** Operador escaneia ADDR-XX em vez de ADDR-01  
**Resultado:** ✅ Sistema rejeita com erro

### 3. Operador Escaneia SKU Inexistente
**Teste:** `doubleCheck.edge-cases.e2e.test.ts` (SKU errado)  
**Cenário:** Operador escaneia SKU-999 (não existe no pedido)  
**Resultado:** ✅ Sistema rejeita com erro "SKU não esperado"

### 4. Operador Escaneia Quantidade Maior
**Teste:** `doubleCheck.edge-cases.e2e.test.ts` (quantidade excedida)  
**Cenário:** Operador escaneia 3 unidades quando esperado era 2  
**Resultado:** ✅ Sistema detecta excedente

### 5. Operador Escaneia Quantidade Menor (Parcial)
**Teste:** `doubleCheck.edge-cases.e2e.test.ts` (item faltante parcial)  
**Cenário:** Operador escaneia 1 unidade quando esperado era 2  
**Resultado:** ✅ Sistema aceita mas marca como incompleto

### 6. Operador Escaneia Mesmo Item 2x (Duplicado)
**Teste:** `doubleCheck.edge-cases.e2e.test.ts` (duplicidade)  
**Cenário:** Operador escaneia mesmo item com mesma idempotencyKey  
**Resultado:** ✅ Segunda requisição ignorada (não duplica)

### 7. Dois Operadores no Mesmo Pedido (Concorrência)
**Teste:** `order.concurrency.e2e.test.ts`  
**Cenário:** Operador A e B tentam atualizar pedido simultaneamente  
**Resultado:** ✅ Sistema rejeita segundo operador (lock otimista)

### 8. Retry de Requisição (Idempotência)
**Teste:** `order.idempotency.unit.test.ts`  
**Cenário:** Cliente reenvia mesmo evento com mesma chave  
**Resultado:** ✅ Sistema retorna resultado em cache (sem duplicar)

---

## 🔗 Links Úteis

- [SPEC.md](../SPEC.md) - Especificação do MVP
- [STATE_MACHINE.json](../STATE_MACHINE.json) - Máquina de estados
- [API_CONTRACTS/openapi.yaml](../API_CONTRACTS/openapi.yaml) - Contrato HTTP
- [coverage/index.html](../coverage/index.html) - Relatório de cobertura interativo

---

## 📞 Suporte

Dúvidas sobre os testes? Consulte:

1. **README.md** - Guia de uso completo
2. **ANALISE_TESTES_E2E.md** - Análise técnica detalhada
3. **SUMARIO_VISUAL.md** - Diagramas e fluxos visuais
4. **GUIA_RAPIDO_TESTES.md** - Referência rápida

---

**Última atualização:** 2026-02-03  
**Versão:** 1.0.0  
**Status:** ✅ Produção
