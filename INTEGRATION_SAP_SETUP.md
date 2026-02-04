# Integração SAP Business One - Guia de Setup

Este documento descreve como configurar e usar a integração com SAP Business One via Service Layer.

## 📋 Índice

- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Rodar](#como-rodar)
- [Testes](#testes)
- [Endpoints da API](#endpoints-da-api)
- [Frontend](#frontend)
- [Troubleshooting](#troubleshooting)
- [Segurança](#segurança)

## 🔧 Pré-requisitos

- **Node.js** >= 18.0.0
- **SAP Business One** com Service Layer configurado e acessível
- Credenciais válidas (CompanyDB, Username, Password)
- Rede com acesso ao servidor SAP

## ⚙️ Configuração

### 1. Configurar variáveis de ambiente

**IMPORTANTE:** Nunca commite o arquivo `.env` com credenciais reais! O `.env` já está no `.gitignore`.

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais SAP:

```env
# Gateway (Node.js)
GATEWAY_PORT=3000
SERVICE_NAME=wms-gateway
LOG_LEVEL=info
INTERNAL_SHARED_SECRET=your-secret-here

# Core (FastAPI)
CORE_BASE_URL=http://localhost:8000

# SAP Business One
SAP_B1_BASE_URL=https://sap-garrafariasnegra-sl.skyinone.net:50000
SAP_B1_COMPANY_DB=SuaEmpresaDB
SAP_B1_USERNAME=manager
SAP_B1_PASSWORD=sua-senha-aqui

# Configurações opcionais (resiliência)
SAP_B1_TIMEOUT_MS=20000
SAP_B1_MAX_ATTEMPTS=5
SAP_B1_MAX_CONCURRENT=8
SAP_B1_MAX_RPS=10
```

**Notas:**
- `SAP_B1_BASE_URL`: URL do Service Layer **sem** `/b1s/v1` no final (será adicionado automaticamente)
- `SAP_B1_COMPANY_DB`: Nome do banco de dados da empresa no SAP
- `SAP_B1_USERNAME`: Usuário do SAP com permissões para acessar Orders
- `SAP_B1_PASSWORD`: Senha do usuário (**NUNCA** comite isso!)

### 2. Instalar dependências

```bash
# Instalar dependências do monorepo
npm install

# Instalar dependências do gateway
cd gateway
npm install
cd ..

# Instalar dependências do frontend
cd web
npm install
cd ..
```

### 3. Configurar UDFs no SAP (Opcional mas Recomendado)

Para rastrear o status WMS nos pedidos SAP, crie os seguintes User Defined Fields (UDFs) na tabela `ORDR` (Orders):

```sql
-- No SAP Business One Administration
-- Tools > Customization Tools > User-Defined Fields - Management

Tabela: ORDR (Marketing Documents - Orders)

UDFs recomendados:
- U_WMS_STATUS (String/30): Status canônico do WMS
- U_WMS_ORDERID (String/50): Order ID interno do WMS
- U_WMS_LAST_EVENT (String/50): Último evento aplicado
- U_WMS_LAST_TS (DateTime): Timestamp do último update
- U_WMS_CORR_ID (String/100): Correlation ID para rastreamento
```

## 📁 Estrutura do Projeto

```
wms/hse/
├── sap-connector/              # Módulo de conexão SAP (reutilizável)
│   └── src/
│       ├── serviceLayerClient.ts    # Cliente HTTP para Service Layer
│       ├── types.ts                  # Tipos TypeScript para SAP
│       ├── errors.ts                 # Erros customizados
│       └── utils/
│           ├── rateLimiter.ts        # Rate limiting
│           ├── circuitBreaker.ts     # Circuit breaker
│           └── backoff.ts            # Retry com backoff
│
├── gateway/                    # Gateway Node.js (Fastify)
│   └── src/
│       ├── index.ts                  # Entry point
│       ├── config/
│       │   └── sap.ts                # Configuração SAP
│       ├── services/
│       │   └── sapOrdersService.ts   # Lógica de negócio para pedidos
│       ├── routes/
│       │   └── sap.ts                # Rotas de integração SAP
│       ├── scripts/
│       │   └── test-sap-connection.ts # Script de teste manual
│       └── tests/
│           └── sap-health.test.ts    # Testes automatizados
│
└── web/                        # Frontend (React + Vite)
    └── src/
        ├── api/
        │   └── sap.ts                # Cliente API para SAP
        ├── ui/
        │   └── SapIntegrationPanel.tsx # Painel de integração SAP
        └── pages/
            └── OrdersDashboard.tsx   # Dashboard com kanban
```

## 🚀 Como Rodar

### 1. Testar conexão SAP (recomendado primeiro)

```bash
cd gateway
npm run test:sap
```

Este script irá:
- ✓ Validar variáveis de ambiente
- ✓ Testar login no SAP
- ✓ Listar primeiros 5 pedidos abertos
- ✓ Buscar detalhes de um pedido

Se tudo funcionar, você verá algo como:

```
=== Teste de Conexão SAP B1 ===

✓ Variáveis de ambiente configuradas
  Base URL: https://sap-garrafariasnegra-sl.skyinone.net:50000
  Company DB: SuaEmpresaDB
  Username: manager
  Password: ********

1. Criando cliente SAP...
   ✓ Cliente criado

2. Testando login...
   ✓ Login bem-sucedido: Conexão com SAP OK

3. Listando pedidos abertos (primeiros 5)...
   ✓ Encontrados 3 pedido(s)
   
   Primeiros pedidos:
   1. DocNum: 12345 | Cliente: C001 (Cliente Exemplo) | Status WMS: A_SEPARAR | Itens: 5

=== ✅ Teste concluído com sucesso ===
```

### 2. Iniciar o Gateway

```bash
cd gateway
npm run dev
```

O gateway estará disponível em `http://localhost:3000`

### 3. Iniciar o Frontend

Em outro terminal:

```bash
cd web
npm run dev
```

O frontend estará disponível em `http://localhost:5173` (ou outra porta indicada pelo Vite)

## 🧪 Testes

### Testes Automatizados

```bash
cd gateway
npm test
```

### Teste Manual via HTTP

Testar health check:

```bash
curl http://localhost:3000/api/sap/health
```

Listar pedidos:

```bash
curl http://localhost:3000/api/sap/orders?limit=10
```

Buscar pedido específico (substitua 123 pelo DocEntry real):

```bash
curl http://localhost:3000/api/sap/orders/123
```

Atualizar status (substitua 123 pelo DocEntry real):

```bash
curl -X PATCH http://localhost:3000/api/sap/orders/123/status \
  -H "Content-Type: application/json" \
  -d '{"status": "EM_SEPARACAO", "event": "INICIAR_SEPARACAO"}'
```

## 📡 Endpoints da API

### GET /api/sap/health

Testa conexão com SAP (faz login mas não retorna segredos).

**Response 200 (sucesso):**
```json
{
  "status": "ok",
  "message": "Conexão com SAP OK",
  "timestamp": "2026-02-04T10:30:00Z"
}
```

**Response 503 (falha):**
```json
{
  "status": "error",
  "message": "Falha no login do Service Layer (status 401)",
  "details": "...",
  "correlationId": "corr_abc123",
  "timestamp": "2026-02-04T10:30:00Z"
}
```

### GET /api/sap/orders

Lista pedidos do SAP.

**Query params:**
- `status` (opcional): Filtro por U_WMS_STATUS (ex: "A_SEPARAR", "EM_SEPARACAO")
- `limit` (opcional): Número máximo de resultados (default: 100)
- `docStatus` (opcional): Filtro por DocStatus SAP ("O" = Open, "C" = Closed)

**Response 200:**
```json
{
  "items": [
    {
      "orderId": "SAP-12345",
      "externalOrderId": "12345",
      "sapDocEntry": 12345,
      "sapDocNum": 12345,
      "customerId": "C001",
      "customerName": "Cliente Exemplo LTDA",
      "status": "A_SEPARAR",
      "items": [
        {
          "sku": "ITEM001",
          "quantity": 10,
          "description": "Produto Exemplo",
          "warehouse": "01"
        }
      ],
      "createdAt": "2026-02-01T10:00:00Z",
      "updatedAt": "2026-02-04T10:00:00Z"
    }
  ],
  "count": 1,
  "timestamp": "2026-02-04T10:30:00Z"
}
```

### GET /api/sap/orders/:docEntry

Busca um pedido específico pelo DocEntry.

**Response 200:**
```json
{
  "orderId": "SAP-12345",
  "externalOrderId": "12345",
  "sapDocEntry": 12345,
  "sapDocNum": 12345,
  "customerId": "C001",
  "customerName": "Cliente Exemplo LTDA",
  "status": "A_SEPARAR",
  "items": [...],
  "createdAt": "2026-02-01T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

**Response 404:**
```json
{
  "error": "Erro ao buscar pedido do SAP",
  "message": "Order not found",
  "correlationId": "corr_abc123",
  "timestamp": "2026-02-04T10:30:00Z"
}
```

### PATCH /api/sap/orders/:docEntry/status

Atualiza o status do pedido no SAP (via UDF U_WMS_STATUS).

**Body:**
```json
{
  "status": "EM_SEPARACAO",
  "event": "INICIAR_SEPARACAO"
}
```

**Response 200:**
```json
{
  "ok": true,
  "message": "Status atualizado para EM_SEPARACAO",
  "docEntry": 12345,
  "status": "EM_SEPARACAO",
  "timestamp": "2026-02-04T10:30:00Z"
}
```

## 🎨 Frontend

### Painel de Integração SAP

No dashboard (`/`), você verá um botão **"▶ Integração SAP"** no topo.

**Funcionalidades:**

1. **Testar Conexão SAP**: Valida credenciais e retorna status da conexão
2. **Sincronizar Pedidos**: Busca pedidos abertos do SAP e exibe no kanban
3. **Mover pedidos**: Arraste e solte pedidos entre colunas para atualizar status no SAP

**Como usar:**

1. Clique em "Testar Conexão SAP"
   - ✓ Verde = Conexão OK
   - ✗ Vermelho = Erro (verifique logs e .env)

2. Clique em "Sincronizar Pedidos"
   - Busca pedidos abertos (DocStatus = 'O') do SAP
   - Exibe no kanban agrupados por status WMS
   - Fonte de dados muda para "SAP Business One"

3. Arraste pedidos entre colunas para atualizar status
   - O sistema atualiza o UDF U_WMS_STATUS no SAP
   - Validação de transições via state machine

4. Clique em "voltar para WMS" para usar dados locais

## 🔍 Troubleshooting

### Erro: "Configuração SAP incompleta"

**Causa:** Variáveis de ambiente faltando no `.env`

**Solução:**
1. Verifique se o arquivo `.env` existe (copie de `.env.example` se necessário)
2. Confirme que todas as variáveis SAP estão preenchidas:
   - SAP_B1_BASE_URL
   - SAP_B1_COMPANY_DB
   - SAP_B1_USERNAME
   - SAP_B1_PASSWORD

### Erro: "Falha no login do Service Layer (status 401)"

**Causa:** Credenciais inválidas ou CompanyDB incorreto

**Solução:**
1. Verifique username e password no `.env`
2. Confirme o nome exato do CompanyDB (case-sensitive)
3. Teste login manual no navegador: `https://seu-servidor:50000/b1s/v1/Login`

### Erro: "ECONNREFUSED" ou "ETIMEDOUT"

**Causa:** Servidor SAP inacessível ou firewall bloqueando

**Solução:**
1. Verifique se a URL está correta (incluindo porta, geralmente 50000)
2. Teste ping/telnet para o servidor
3. Verifique firewall/VPN
4. Confirme que o Service Layer está rodando no SAP

### Erro: "certificate has expired" ou "self signed certificate"

**Causa:** Certificado SSL inválido ou self-signed

**Solução:**
- **Produção:** Use certificado válido
- **Dev/Test:** Ajuste em `sap-connector/src/serviceLayerClient.ts` (NÃO recomendado para produção)

### Pedidos não aparecem no kanban

**Causa:** Pedidos sem status WMS ou filtro incorreto

**Solução:**
1. Verifique se os pedidos têm `DocStatus = 'O'` (aberto)
2. Crie UDFs no SAP (veja seção de Configuração)
3. Verifique filtros no frontend

### Rate limit / 429 errors

**Causa:** Muitas requisições simultâneas ao SAP

**Solução:**
Ajuste no `.env`:
```env
SAP_B1_MAX_CONCURRENT=4    # Reduzir de 8 para 4
SAP_B1_MAX_RPS=5           # Reduzir de 10 para 5
```

## 🔒 Segurança

### ✅ Boas Práticas Implementadas

- ✓ Senhas **nunca** são logadas
- ✓ `.env` está no `.gitignore`
- ✓ `.env.example` usa placeholders (`********`)
- ✓ Cookies de sessão não são expostos na API
- ✓ HTTPS é usado (não desabilitamos SSL)
- ✓ Correlation ID para rastreabilidade
- ✓ Idempotência via Idempotency-Key

### ⚠️ Checklist de Segurança

Antes de ir para produção:

- [ ] Certificado SSL válido no Service Layer
- [ ] `.env` **nunca** commitado
- [ ] Senha forte e rotação periódica
- [ ] Usuário SAP com permissões mínimas necessárias
- [ ] Rate limits configurados adequadamente
- [ ] Logs sem informação sensível
- [ ] Firewall restringindo acesso ao Service Layer
- [ ] VPN ou túnel seguro entre WMS e SAP

## 📚 Referências

- [SAP Business One Service Layer Documentation](https://help.sap.com/viewer/68a2e87fb29941b5bf959a184d9c6727/10.0/en-US)
- [Contrato de Integração SAP B1](./API_CONTRACTS/sap-b1-integration-contract.md)
- [State Machine WMS](./STATE_MACHINE.json)

## 🤝 Suporte

Problemas ou dúvidas? Verifique:
1. Logs do gateway (`gateway/logs/`)
2. Correlation ID nos headers de resposta
3. Esta documentação
4. Contrato de integração SAP

---

**Última atualização:** 2026-02-04
