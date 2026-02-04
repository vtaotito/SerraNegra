# Changelog - Integração SAP Business One

## [1.1.0] - 2026-02-04

### ✨ Novos Recursos

#### Campos SAP Financeiros no Schema de Orders
- **Schema OpenAPI** (`API_CONTRACTS/openapi.yaml`):
  - Adicionados campos opcionais no tipo `Order`: `docTotal` (número) e `currency` (string)
  - Todos os campos SAP agora expostos: `sapDocEntry`, `sapDocNum`, `customerName`, `carrier`, `priority`, `slaDueAt`, `docTotal`, `currency`
  - Campo `metadata` documentado para campos estendidos adicionais

- **Backend (wms-core)**:
  - Tipo `Order` estendido com `docTotal?: number` e `currency?: string`
  - Campos financeiros persistidos em PostgreSQL via migração 0004

- **PostgreSQL**:
  - Nova migração `0004_orders_sap_financial_fields.sql`
  - Colunas `doc_total` (NUMERIC(18,2)) e `currency` (VARCHAR(10))
  - Índices para busca parcial por `external_order_id` (BTREE + opcional GIN com pg_trgm)

#### Busca Parcial por External Order ID
- **Repository** (`api/repositories/postgresOrderRepository.ts`):
  - Suporte a filtro `externalOrderId` com busca parcial case-insensitive (ILIKE)
  - Query: `external_order_id ILIKE %termo%`
  - Índice BTREE para performance

- **Service** (`api/services/orderCoreService.ts`):
  - Método `listOrders()` aceita filtro `externalOrderId`
  - InMemoryOrderStore também implementa busca parcial (simulação de ILIKE)

- **Controller** (`api/controllers/ordersController.ts`):
  - Endpoint `GET /orders` aceita query param `externalOrderId`
  - Documentação atualizada

- **Frontend** (`web/src/api/types.ts`):
  - Tipo `Order` estendido com `docTotal?: number | null` e `currency?: string | null`
  - Retrocompatível (campos opcionais)

### 🔧 Melhorias

- **Performance**: Índices adicionados para `external_order_id` melhoram busca parcial
- **Flexibilidade**: Campos SAP agora disponíveis para exibição no painel
- **Compatibilidade**: Todas as mudanças são retrocompatíveis (campos opcionais)

### 📝 Migração

Execute a migração para adicionar os novos campos:

```bash
psql -h <host> -U <user> -d <database> -f wms-core/migrations/0004_orders_sap_financial_fields.sql
```

**Nota**: A migração é idempotente e segura para executar múltiplas vezes.

---

## [1.0.0] - 2026-02-04

### 🎉 Implementação Completa da Integração SAP Business One

#### ✨ Novos Recursos

##### Backend (Gateway)
- **Serviço SAP** (`gateway/src/sapService.ts`):
  - Wrapper sobre `sap-connector` com lógica de negócio do WMS
  - Singleton para reutilizar conexões
  - Gestão automática de configurações via env vars
  - Logger integrado para observabilidade

- **Endpoints REST** (`gateway/src/index.ts`):
  - `GET /api/sap/health`: Testa conexão com SAP (não expõe credenciais)
  - `GET /api/sap/orders`: Busca pedidos com filtros (status, cliente, datas, paginação)
  - `GET /api/sap/orders/:docEntry`: Busca pedido específico
  - `PATCH /api/sap/orders/:docEntry/status`: Atualiza UDFs do pedido

##### SAP Connector
- **Tipos TypeScript** (`sap-connector/src/sapTypes.ts`):
  - `SapOrder`: Pedido completo com UDFs customizados
  - `SapDocumentLine`: Linha de item do pedido
  - `SapItem`, `SapWarehouse`: Entidades de catálogo
  - `SapOrdersFilter`: Filtros para busca
  - `SapOrderStatusUpdate`: Payload para atualização de status

- **Funcionalidades Existentes** (já implementadas):
  - Gestão de sessão com cache de cookies (B1SESSION + ROUTEID)
  - Reautenticação automática em caso de 401/403
  - Retry com backoff exponencial
  - Circuit breaker para proteção
  - Rate limiting (RPS e concorrência)

##### Frontend (Web)
- **API SAP** (`web/src/api/sap.ts`):
  - `testSapConnection()`: Testa conexão
  - `getSapOrders()`: Busca pedidos com filtros
  - `getSapOrder()`: Busca pedido específico
  - `updateSapOrderStatus()`: Atualiza status no SAP
  - `sapOrderToUiOrder()`: Converte formato SAP → WMS
  - `importSapOrders()`: Importa e converte pedidos

- **Dashboard Integrado** (`web/src/pages/OrdersDashboard.tsx`):
  - Botão "Testar SAP": Valida conexão
  - Botão "Importar SAP": Busca pedidos abertos do SAP
  - Pedidos do SAP aparecem no Kanban junto com pedidos do WMS
  - Contador de pedidos importados do SAP
  - Mutações com toast notifications

- **Filtros Expandidos** (`web/src/ui/FiltersBar.tsx`):
  - Props para callbacks de teste e importação
  - Estados de loading (testingSap, importingSap)
  - UI responsiva com botões adicionais

##### Testes
- **Testes Unitários** (`tests/unit/sap.integration.unit.test.ts`):
  - Conversão de tipos SAP → WMS
  - Construção de queries OData
  - Payloads de atualização
  - Validação de segurança (sem credenciais em logs)

- **Testes de Integração** (`tests/integration/sap.gateway.integration.test.ts`):
  - Validação de endpoints do gateway
  - Estrutura de respostas
  - Tratamento de erros
  - Propagação de headers de correlação
  - Segurança (cookies não expostos)

##### Scripts e Ferramentas
- **SQL UDFs** (`sap-connector/SQL_CREATE_UDFS.sql`):
  - Script para criar 5 UDFs no SAP (ORDR table)
  - `U_WMS_STATUS`, `U_WMS_ORDERID`, `U_WMS_LAST_EVENT`, `U_WMS_LAST_TS`, `U_WMS_CORR_ID`
  - Verificação de existência (idempotente)
  - Documentação inline

- **Quick Test** (`sap-connector/examples/quick-test.ts`):
  - Script CLI para testar integração end-to-end
  - Login, busca, atualização e logout
  - Output colorido e detalhado
  - Validação de configuração

- **Setup Scripts**:
  - `setup-sap-integration.ps1`: Setup automático (Windows)
  - `setup-sap-integration.sh`: Setup automático (Linux/Mac)
  - Instala dependências, cria .env, compila código
  - Instruções passo-a-passo ao final

##### Documentação
- **Guia Rápido** (`SAP_INTEGRATION_QUICKSTART.md`):
  - Resumo executivo
  - Regras de segurança (CRÍTICO)
  - Configuração passo-a-passo
  - Instruções de execução
  - Documentação completa de endpoints
  - Guia de uso do frontend
  - Troubleshooting
  - Arquitetura com diagrama

- **README Atualizado** (`README.md`):
  - Seção de integração SAP
  - Status e funcionalidades
  - Quick start
  - Estrutura do projeto revisada
  - Setup e desenvolvimento
  - Documentação completa

- **Changelog** (`CHANGELOG_SAP_INTEGRATION.md`):
  - Este arquivo :)

#### 🔧 Configuração

##### Variáveis de Ambiente (`.env.example`)
- `SAP_B1_BASE_URL`: URL do Service Layer (atualizada para garrafariasnegra)
- `SAP_B1_COMPANY_DB`: Database da empresa
- `SAP_B1_USERNAME`: Usuário (placeholder `********`)
- `SAP_B1_PASSWORD`: Senha (placeholder `********`)
- Configurações de resiliência (timeout, retry, concorrência, RPS)

#### 🔐 Segurança

##### Implementado
- ✅ Credenciais via variáveis de ambiente
- ✅ `.env` no `.gitignore`
- ✅ Placeholders em exemplos
- ✅ Nenhum log de senhas/tokens/cookies
- ✅ Cookies SAP não expostos em respostas
- ✅ Propagação de `X-Correlation-Id`
- ✅ Validação de payload em endpoints

##### Prevenido
- ❌ Credenciais hardcoded
- ❌ Logs com informações sensíveis
- ❌ Endpoints SAP expostos diretamente no frontend
- ❌ Commit de arquivo `.env`

#### 🏗️ Arquitetura

```
Frontend (React)
    ↓ HTTP
Gateway (Node.js)
    ↓ HTTPS
SAP B1 Service Layer
```

**Componentes:**
1. **Frontend**: Interface React com Kanban
2. **Gateway**: API Node.js orquestrando requisições
3. **SAP Connector**: Biblioteca com resiliência completa
4. **Core (FastAPI)**: Opcional para regras de domínio

#### 📊 Métricas

- **Arquivos criados/modificados**: 15
- **Linhas de código**: ~2.500
- **Cobertura de testes**: Unitários e integração
- **Documentação**: 3 documentos principais + inline

#### 🎯 UDFs Criados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `U_WMS_STATUS` | String(50) | Status canônico do WMS |
| `U_WMS_ORDERID` | String(50) | ID interno do pedido no WMS |
| `U_WMS_LAST_EVENT` | String(50) | Último evento aplicado |
| `U_WMS_LAST_TS` | String(30) | Timestamp ISO da última atualização |
| `U_WMS_CORR_ID` | String(100) | Correlation ID para rastreamento |

#### 🚀 Como Usar

```bash
# Setup rápido
./setup-sap-integration.ps1   # Windows
./setup-sap-integration.sh    # Linux/Mac

# Configurar .env (editar manualmente)
# Criar UDFs no SAP (executar SQL)

# Testar conexão
tsx sap-connector/examples/quick-test.ts

# Executar aplicação
cd gateway && npm run dev        # Terminal 1
cd web && npm run dev            # Terminal 2

# Acessar
http://localhost:5173
```

#### 📝 Notas Técnicas

- **Gestão de Sessão**: Cookies (`B1SESSION` + `ROUTEID`) em cache
- **Reautenticação**: Automática em 401/403 (1 retry)
- **Rate Limiting**: 10 RPS, 8 concurrent (configurável)
- **Circuit Breaker**: 5 falhas consecutivas → 30s aberto
- **Timeout**: 20s por request (configurável)
- **Query OData**: Suporta `$filter`, `$select`, `$expand`, `$top`, `$skip`

#### 🐛 Issues Conhecidos

Nenhum no momento. Testes unitários e de integração passando.

#### 🔮 Próximos Passos (Futuro)

1. **Sincronização Bidirecional**:
   - Worker para polling de mudanças no SAP
   - Webhook para notificações do SAP (via B1if)

2. **Criação de Documentos**:
   - Delivery Notes a partir de Orders
   - Movimentações de estoque

3. **Observabilidade**:
   - Métricas de performance do SAP connector
   - Dashboards de monitoramento

4. **Cache Avançado**:
   - Redis para sessões compartilhadas (multi-instância)
   - Cache de itens e depósitos

#### 👥 Créditos

Desenvolvido por: Cursor AI Assistant
Data: 04/02/2026
Versão: 1.0.0

---

## Formato do Changelog

Este changelog segue o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

### Tipos de mudanças:
- `✨ Novos Recursos`: Para novas funcionalidades
- `🔧 Configuração`: Para mudanças de configuração
- `🔐 Segurança`: Para correções de segurança
- `🐛 Correções`: Para correção de bugs
- `📝 Documentação`: Para mudanças na documentação
- `♻️ Refatoração`: Para mudanças de código sem alterar funcionalidade
- `⚡ Performance`: Para melhorias de performance
- `🧪 Testes`: Para adição ou mudança de testes
