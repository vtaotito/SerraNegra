# WMS Orchestrator com Integração SAP B1

Sistema de gerenciamento de pedidos (WMS) com integração completa ao SAP Business One via Service Layer.

## 📖 Documentação

| Para... | Leia... | Tempo |
|---------|---------|-------|
| **👔 Visão executiva** | [`RESUMO_EXECUTIVO_E2E.md`](./RESUMO_EXECUTIVO_E2E.md) | 10 min |
| **💡 Proposta de valor (SAP + WMS + B2B + BI)** | [`docs/PROPOSTA_VALOR_E2E_SAP_WMS_B2B_POWERBI.md`](./docs/PROPOSTA_VALOR_E2E_SAP_WMS_B2B_POWERBI.md) | 15 min |
| **🗂️ Backlog executável priorizado** | [`docs/BACKLOG_EXECUTAVEL_PRIORIZADO_SAP_WMS_B2B_POWERBI.md`](./docs/BACKLOG_EXECUTAVEL_PRIORIZADO_SAP_WMS_B2B_POWERBI.md) | 20 min |
| **💼 Proposta comercial** | [`docs/PROPOSTA_COMERCIAL_SAP_WMS_B2B_POWERBI.md`](./docs/PROPOSTA_COMERCIAL_SAP_WMS_B2B_POWERBI.md) | 15 min |
| **👨‍💻 Análise técnica completa** | [`ANALISE_E2E_COMPLETA.md`](./ANALISE_E2E_COMPLETA.md) | 60 min |
| **📚 Índice de toda documentação** | [`INDICE_DOCUMENTACAO.md`](./INDICE_DOCUMENTACAO.md) | 5 min |
| **🚀 Começar a desenvolver** | Continue lendo abaixo | 15 min |

## 🚀 Quick Start

### 1. Configurar ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com suas credenciais SAP
# IMPORTANTE: Nunca comite o .env!
```

### 2. Instalar dependências

```bash
npm install
cd gateway && npm install && cd ..
cd web && npm install && cd ..
```

### 3. Testar conexão SAP

```bash
cd gateway
npm run test:sap
```

### 4. Iniciar serviços

Terminal 1 (Gateway):
```bash
cd gateway
npm run dev
```

Terminal 2 (Frontend):
```bash
cd web
npm run dev
```

## 📚 Documentação Completa

- **[INTEGRATION_SAP_SETUP.md](./INTEGRATION_SAP_SETUP.md)** - Guia completo de configuração e uso
- **[API_CONTRACTS/sap-b1-integration-contract.md](./API_CONTRACTS/sap-b1-integration-contract.md)** - Contrato de integração SAP

## 🏗️ Arquitetura

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Gateway   │─────▶│  SAP B1 SL  │
│   (React)   │      │  (Node.js)  │      │ (Service    │
│             │◀─────│             │◀─────│  Layer)     │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   WMS Core  │
                     │  (FastAPI)  │
                     └─────────────┘
```

## 📦 Componentes

- **sap-connector**: Módulo reutilizável para conexão com SAP Service Layer
  - Gerenciamento de sessão (cookies B1SESSION/ROUTEID)
  - Retry com backoff exponencial
  - Circuit breaker
  - Rate limiting
  
- **gateway**: API Gateway (Node.js + Fastify)
  - Endpoints REST para integração SAP
  - WebSocket/SSE para real-time updates
  - Correlation ID para rastreabilidade
  
- **web**: Frontend (React + Vite + TanStack Query)
  - Dashboard kanban interativo
  - Painel de integração SAP
  - Drag & drop para atualizar status
  
- **worker**: Worker para sincronização assíncrona (opcional)

## 🔒 Segurança

- ✓ Credenciais em variáveis de ambiente (`.env` no `.gitignore`)
- ✓ Senhas **nunca** logadas
- ✓ HTTPS obrigatório
- ✓ Idempotência via `Idempotency-Key`
- ✓ Correlation ID para auditoria

## 📡 Endpoints SAP

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/sap/health` | Testa conexão SAP |
| GET | `/api/sap/orders` | Lista pedidos |
| GET | `/api/sap/orders/:docEntry` | Busca pedido específico |
| PATCH | `/api/sap/orders/:docEntry/status` | Atualiza status |

## 🧪 Testes

### Testes WMS Core (Unit + Integration + E2E)
```bash
# Executar todos os testes
npm test

# Gerar relatório de cobertura
npm run test:coverage

# Visualizar cobertura no navegador
start coverage/index.html   # Windows
open coverage/index.html    # Mac
```

**Status dos Testes:**
- ✅ **27 testes** executados (21 passaram, 6 pulados)
- ✅ **88.88% de cobertura** (meta: 85%)
- ✅ **Casos de borda cobertos:** endereço/SKU/quantidade errados, idempotência, concorrência
- ✅ **Fluxo E2E completo:** pedido → picking → packing → expedição

📚 **Documentação completa:** [tests/INDEX.md](tests/INDEX.md)

### Testes Gateway SAP
```bash
# Teste automatizado
cd gateway
npm test

# Teste manual de conexão
npm run test:sap
```

## 🛠️ Tecnologias

- **Backend**: Node.js 18+, TypeScript, Fastify
- **Frontend**: React, Vite, TanStack Query, Tailwind CSS
- **SAP**: Service Layer REST API, OData
- **Resiliência**: Circuit breaker, rate limiting, retry com backoff

## 📝 Status WMS

Os pedidos seguem a state machine:

```
A_SEPARAR → EM_SEPARACAO → CONFERIDO → AGUARDANDO_COTACAO → AGUARDANDO_COLETA → DESPACHADO
```

Status são sincronizados no SAP via UDFs:
- `U_WMS_STATUS`: Status atual
- `U_WMS_ORDERID`: ID interno WMS
- `U_WMS_LAST_EVENT`: Último evento
- `U_WMS_LAST_TS`: Timestamp do último update
- `U_WMS_CORR_ID`: Correlation ID

## 🤝 Contribuindo

1. Nunca comite credenciais (`.env`)
2. Siga as convenções de código (TypeScript strict mode)
3. Adicione testes para novas funcionalidades
4. Atualize documentação quando necessário

## 📄 Licença

Proprietary - Uso interno

---

**Versão:** 0.1.0  
**Última atualização:** 2026-02-04
