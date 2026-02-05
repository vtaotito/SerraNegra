# 🎭 SAP Mock - Snippet para README Principal

**INSTRUÇÕES**: Copie e cole esta seção no `README.md` principal do projeto WMS para adicionar informações sobre o SAP Mock.

---

## 🎭 SAP B1 Mock Service

Sistema completo de mock para desenvolvimento e testes sem dependência do servidor SAP real.

### 🚀 Quick Start

```bash
# Executar exemplo completo
npm run sap:mock

# Ver integração WMS + SAP
npm run sap:mock:integration

# Testar factory pattern
npm run sap:factory
```

### 📚 Documentação

| Documento | Propósito | Tempo |
|-----------|-----------|-------|
| [`SAP_MOCK_README.md`](./SAP_MOCK_README.md) | Hub central | 10 min |
| [`SAP_MOCK_QUICKSTART.md`](./SAP_MOCK_QUICKSTART.md) | Quick start | 3 min |
| [`SAP_MOCK_SUMMARY.md`](./SAP_MOCK_SUMMARY.md) | Resumo técnico | 10 min |
| [`SAP_MOCK_CHECKLIST.md`](./SAP_MOCK_CHECKLIST.md) | Implementação | 3 horas |
| [`SAP_MOCK_INDEX.md`](./SAP_MOCK_INDEX.md) | Índice completo | 5 min |

### 💻 Código

```typescript
import { createSapClient } from './sap-connector/sapClientFactory';

// Cria automaticamente mock ou real baseado no .env
const sapClient = createSapClient();

// Usar normalmente
await sapClient.login('admin', 'password');
const orders = await sapClient.getOrders({ status: 'open' });
await sapClient.logout();
```

### ⚙️ Configuração

```env
# Desenvolvimento
USE_SAP_MOCK=true
SAP_MOCK_DELAY=500

# Produção
USE_SAP_MOCK=false
SAP_HOST=https://sap-server.com
```

### ✨ Funcionalidades

- ✅ 20+ métodos da API implementados
- ✅ Dados realistas (clientes, produtos, pedidos)
- ✅ Delays simulados para realismo
- ✅ Testes isolados e rápidos
- ✅ Factory pattern para troca mock/real
- ✅ 100% funcional e documentado

### 📊 O Que Inclui

- **2 clientes** - Dados reais do sistema
- **8 produtos** - Com estoque
- **4 depósitos** - Configurados
- **2 pedidos** - Completos + gerador de aleatórios
- **13 documentos** - ~18.000 palavras
- **4 exemplos** - Executáveis

### 🎯 Casos de Uso

- Desenvolvimento local sem SAP
- Testes unitários e integração
- CI/CD automatizado
- Demos e apresentações
- Onboarding de novos devs

### 📖 Mais Informações

Ver [`SAP_MOCK_README.md`](./SAP_MOCK_README.md) para documentação completa.

---
