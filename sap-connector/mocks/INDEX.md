# 📑 SAP Mock - Índice Completo

## 🎯 Quick Links

| Você quer | Arquivo |
|-----------|---------|
| **Começar agora (3min)** | [`../../SAP_MOCK_QUICKSTART.md`](../../SAP_MOCK_QUICKSTART.md) |
| **Guia completo** | [`README.md`](./README.md) |
| **Resumo executivo** | [`../../SAP_MOCK_SUMMARY.md`](../../SAP_MOCK_SUMMARY.md) |
| **Código: Dados mock** | [`sapMockData.ts`](./sapMockData.ts) |
| **Código: Serviço mock** | [`sapMockService.ts`](./sapMockService.ts) |
| **Exemplo de uso** | [`../examples/test-mock-service.ts`](../examples/test-mock-service.ts) |
| **Exemplo integração WMS** | [`../examples/integration-example.ts`](../examples/integration-example.ts) |

---

## 📦 Estrutura de Arquivos

```
sap-connector/
│
├── mocks/                                    ← VOCÊ ESTÁ AQUI
│   ├── INDEX.md                              ← Este arquivo
│   ├── README.md                             ← Guia completo (300 linhas)
│   ├── sapMockData.ts                        ← Dados mock (450 linhas)
│   ├── sapMockService.ts                     ← Serviço mock (400 linhas)
│   ├── integration-example.ts                ← Exemplo WMS+SAP (200 linhas)
│   └── data/
│       ├── sample-orders.json                ← Pedidos JSON
│       ├── sample-items.json                 ← Produtos JSON
│       └── sample-stock.json                 ← Estoque JSON
│
├── examples/
│   └── test-mock-service.ts                  ← Exemplo completo (300 linhas)
│
├── src/
│   └── sapTypes.ts                           ← Tipos TypeScript
│
└── (raiz do projeto)
    ├── SAP_MOCK_QUICKSTART.md               ← Quick Start (3 min)
    └── SAP_MOCK_SUMMARY.md                  ← Resumo executivo
```

---

## 🚀 Fluxo de Uso

```
1. COMEÇAR
   ↓
   Ler: SAP_MOCK_QUICKSTART.md (3 min)
   ↓
2. EXECUTAR
   ↓
   Comando: npm run sap:mock
   ↓
3. ENTENDER
   ↓
   Ler: mocks/README.md (guia completo)
   ↓
4. USAR
   ↓
   Copiar código do exemplo
   ↓
5. INTEGRAR
   ↓
   Ver: integration-example.ts
```

---

## 📊 Conteúdo por Arquivo

### Documentação

| Arquivo | Propósito | Linhas | Tempo |
|---------|-----------|--------|-------|
| `SAP_MOCK_QUICKSTART.md` | Começar em 3 minutos | ~150 | 3 min |
| `SAP_MOCK_SUMMARY.md` | Resumo executivo | ~400 | 10 min |
| `README.md` | Guia completo | ~300 | 15 min |
| `INDEX.md` | Este arquivo | ~100 | 2 min |

### Código

| Arquivo | Propósito | Linhas | Tipo |
|---------|-----------|--------|------|
| `sapMockData.ts` | Dados estáticos | ~450 | TypeScript |
| `sapMockService.ts` | Serviço mock | ~400 | TypeScript |
| `test-mock-service.ts` | Exemplo de uso | ~300 | TypeScript |
| `integration-example.ts` | WMS + SAP | ~200 | TypeScript |

### Dados JSON

| Arquivo | Conteúdo | Formato |
|---------|----------|---------|
| `sample-orders.json` | 2 pedidos completos | JSON |
| `sample-items.json` | 8 produtos | JSON |
| `sample-stock.json` | Estoque de 1 produto | JSON |

---

## 🎓 Níveis de Aprendizado

### Nível 1: Iniciante (5 minutos)

1. Ler [`SAP_MOCK_QUICKSTART.md`](../../SAP_MOCK_QUICKSTART.md)
2. Executar `npm run sap:mock`
3. Ver output
4. Copiar exemplo básico

**Resultado**: Consegue usar o mock

---

### Nível 2: Intermediário (20 minutos)

1. Ler [`README.md`](./README.md)
2. Estudar [`sapMockService.ts`](./sapMockService.ts)
3. Executar `npm run sap:mock:integration`
4. Adaptar para seu projeto

**Resultado**: Integra mock com WMS

---

### Nível 3: Avançado (1 hora)

1. Ler [`SAP_MOCK_SUMMARY.md`](../../SAP_MOCK_SUMMARY.md)
2. Estudar [`sapMockData.ts`](./sapMockData.ts)
3. Criar dados customizados
4. Estender funcionalidades

**Resultado**: Domina o mock completamente

---

## 📝 Comandos NPM

```bash
# Testar o mock (exemplo completo)
npm run sap:mock

# Testar integração WMS + SAP
npm run sap:mock:integration

# Executar diretamente com tsx
tsx sap-connector/examples/test-mock-service.ts
tsx sap-connector/examples/integration-example.ts
```

---

## 🎯 Por Caso de Uso

### Quero testar importação de pedidos
→ Ver: `integration-example.ts`  
→ Executar: `npm run sap:mock:integration`

### Quero entender a API
→ Ler: `README.md` (seção "API Disponível")  
→ Executar: `npm run sap:mock`

### Quero criar testes unitários
→ Ver: `README.md` (seção "Casos de Uso - Testes")  
→ Usar: `sapMockService` no seu código de teste

### Quero gerar dados de teste
→ Ver: `sapMockService.ts` → método `generateRandomOrders()`  
→ Usar: `await sapMockService.generateRandomOrders(100)`

### Quero usar em desenvolvimento
→ Ver: `README.md` (seção "Desenvolvimento Local")  
→ Config: `.env` → `USE_SAP_MOCK=true`

---

## 🔍 Busca Rápida

**Procurando por**:

- **Clientes** → `sapMockData.ts` linha ~18
- **Produtos** → `sapMockData.ts` linha ~50
- **Depósitos** → `sapMockData.ts` linha ~120
- **Pedidos** → `sapMockData.ts` linha ~160
- **Estoque** → `sapMockData.ts` linha ~420
- **Login** → `sapMockService.ts` linha ~30
- **Get Orders** → `sapMockService.ts` linha ~60
- **Update Status** → `sapMockService.ts` linha ~150
- **Gerar aleatórios** → `sapMockService.ts` linha ~350

---

## 💡 Dicas

### Para Desenvolvedores

```typescript
// Importar
import { sapMockService } from './sap-connector/mocks/sapMockService';

// Usar
const orders = await sapMockService.getOrders({ status: 'open' });
```

### Para QA/Testes

```typescript
// Reset antes de cada teste
beforeEach(() => {
  sapMockService.resetData();
});

// Gerar dados de teste
await sapMockService.generateRandomOrders(100);
```

### Para Demos

```typescript
// Preparar ambiente
await sapMockService.generateRandomOrders(50);
const stats = sapMockService.getStats();
console.log(`Sistema com ${stats.totalOrders} pedidos`);
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| **Mock não encontrado** | Verificar caminho de import |
| **Tipos errados** | Importar de `sapTypes.ts` |
| **Dados resetados** | Usar `resetData()` manualmente |
| **Testes falhando** | Chamar `resetData()` no `beforeEach` |

---

## 📚 Referências Externas

- [SAP Service Layer Docs](https://help.sap.com/doc/0d2533ad95ba4ad7a702e83570a21c48/10.0/en-US/Working_with_SAP_Business_One_Service_Layer.pdf)
- [Orders WMS Mapping](../Orders-WMS-Mapping.md)
- [SAP Integration Contract](../../API_CONTRACTS/sap-b1-integration-contract.md)

---

## ✅ Checklist

### Começar Agora
- [ ] Ler QUICKSTART.md (3 min)
- [ ] Executar `npm run sap:mock`
- [ ] Ver 12 operações funcionando

### Entender
- [ ] Ler README.md (15 min)
- [ ] Estudar sapMockService.ts
- [ ] Ver exemplos de código

### Usar
- [ ] Copiar exemplo para seu projeto
- [ ] Adaptar para seus casos de uso
- [ ] Criar testes unitários

### Dominar
- [ ] Ler SUMMARY.md
- [ ] Estender com dados customizados
- [ ] Criar mocks adicionais

---

## 🎉 Pronto para Começar?

### Opção 1: Quick Start (3 minutos)
```bash
npm run sap:mock
```
Leia: [`SAP_MOCK_QUICKSTART.md`](../../SAP_MOCK_QUICKSTART.md)

### Opção 2: Guia Completo (15 minutos)
Leia: [`README.md`](./README.md)

### Opção 3: Resumo Executivo (10 minutos)
Leia: [`SAP_MOCK_SUMMARY.md`](../../SAP_MOCK_SUMMARY.md)

---

**Última atualização**: 2026-02-05  
**Versão**: 1.0.0  
**Status**: ✅ **COMPLETO**
