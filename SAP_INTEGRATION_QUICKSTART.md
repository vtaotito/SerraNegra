# SAP Business One Integration - Guia Rápido

## 📋 Resumo

Integração completa com SAP Business One via Service Layer, expondo funcionalidades para o WMS através de:

- **Backend Gateway** (Node.js + TypeScript): Endpoints REST para comunicação com SAP
- **SAP Connector**: Biblioteca robusta com gestão de sessão, retry, circuit breaker
- **Frontend**: Interface para testar conexão e importar pedidos do SAP

## 🔐 Segurança (CRÍTICO)

### ⚠️ NUNCA faça:
- ❌ Commitar arquivo `.env` com credenciais reais
- ❌ Logar senhas, tokens ou cookies em logs
- ❌ Expor endpoints SAP diretamente no frontend
- ❌ Hardcodar credenciais no código

### ✅ SEMPRE faça:
- ✅ Use variáveis de ambiente (`.env`)
- ✅ Mantenha `.env` no `.gitignore`
- ✅ Use placeholders em exemplos (ex: `********`)
- ✅ Propague `X-Correlation-Id` para rastreabilidade

## 🚀 Configuração

### 1. Configurar variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais SAP (NÃO commitar):

```env
# SAP Business One Service Layer
SAP_B1_BASE_URL=https://your-sap-server:50000/b1s/v1
SAP_B1_COMPANY_DB=SuaEmpresaDB
SAP_B1_USERNAME=seu_usuario
SAP_B1_PASSWORD=sua_senha_segura

# Configurações opcionais
SAP_B1_TIMEOUT_MS=20000
SAP_B1_MAX_ATTEMPTS=5
SAP_B1_MAX_CONCURRENT=8
SAP_B1_MAX_RPS=10
```

### 2. Instalar dependências

```bash
npm install
cd gateway && npm install
cd ../web && npm install
```

### 3. Compilar TypeScript

```bash
npm run build
```

## 🏃 Executando

### Gateway (Node.js)

```bash
cd gateway
npm run dev
```

O gateway estará disponível em `http://localhost:3000`

### Frontend (React)

```bash
cd web
npm run dev
```

O frontend estará disponível em `http://localhost:5173`

### Core (FastAPI) - Opcional

```bash
cd core
uvicorn app.main:app --reload
```

## 📡 Endpoints da API

### 1. Health Check

Testa conexão com SAP (não expõe credenciais)

```http
GET /api/sap/health
```

**Resposta:**
```json
{
  "ok": true,
  "message": "Conexão com SAP OK",
  "timestamp": "2026-02-04T10:30:00.000Z"
}
```

### 2. Listar Pedidos

Busca pedidos do SAP com filtros

```http
GET /api/sap/orders?status=open&limit=100&cardCode=C001
```

**Query params:**
- `status`: `open` | `closed` | `all` (padrão: `open`)
- `cardCode`: Filtrar por cliente
- `fromDate`: Data inicial (ISO)
- `toDate`: Data final (ISO)
- `limit`: Limite de resultados (padrão: 100)
- `skip`: Pular registros (paginação)

**Resposta:**
```json
{
  "orders": [
    {
      "DocEntry": 123,
      "DocNum": 456,
      "CardCode": "C001",
      "CardName": "Cliente Exemplo",
      "DocumentStatus": "bost_Open",
      "DocumentLines": [
        {
          "LineNum": 0,
          "ItemCode": "SKU-001",
          "Quantity": 10,
          "WarehouseCode": "WH01"
        }
      ],
      "U_WMS_STATUS": "A_SEPARAR",
      "U_WMS_ORDERID": "WMS-123"
    }
  ],
  "count": 1,
  "timestamp": "2026-02-04T10:30:00.000Z"
}
```

### 3. Buscar Pedido Específico

```http
GET /api/sap/orders/123
```

**Resposta:**
```json
{
  "order": {
    "DocEntry": 123,
    "DocNum": 456,
    "CardCode": "C001",
    ...
  },
  "timestamp": "2026-02-04T10:30:00.000Z"
}
```

### 4. Atualizar Status WMS

Atualiza UDFs do pedido no SAP

```http
PATCH /api/sap/orders/123/status
Content-Type: application/json

{
  "status": "EM_SEPARACAO",
  "orderId": "WMS-123",
  "lastEvent": "INICIAR_SEPARACAO"
}
```

**Resposta:**
```json
{
  "ok": true,
  "message": "Status atualizado com sucesso",
  "docEntry": 123,
  "status": "EM_SEPARACAO",
  "timestamp": "2026-02-04T10:30:00.000Z"
}
```

## 💻 Usando o Frontend

### 1. Testar Conexão SAP

1. Abra o dashboard (`http://localhost:5173`)
2. Clique no botão **"Testar SAP"**
3. Verifique a notificação de sucesso/erro

### 2. Importar Pedidos do SAP

1. No dashboard, clique no botão **"Importar SAP"**
2. Os pedidos abertos serão buscados do SAP
3. Pedidos aparecerão no Kanban como "A_SEPARAR"
4. Você pode arrastar os pedidos entre as colunas

### 3. Sincronizar Status com SAP

Quando um pedido importado do SAP muda de status no WMS:
- O status é atualizado automaticamente no SAP (via UDF `U_WMS_STATUS`)
- Os campos `U_WMS_ORDERID`, `U_WMS_LAST_EVENT` e `U_WMS_LAST_TS` também são atualizados

## 🧪 Testes

### Testes Unitários

```bash
npm test tests/unit/sap.integration.unit.test.ts
```

### Testes de Integração

**IMPORTANTE:** Requerem gateway rodando

```bash
# Iniciar gateway
cd gateway && npm run dev

# Em outro terminal, executar testes
SKIP_SAP_INTEGRATION=false npm test tests/integration/sap.gateway.integration.test.ts
```

Para pular testes de integração:
```bash
SKIP_SAP_INTEGRATION=true npm test
```

## 🏗️ Arquitetura

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend  │────────▶│   Gateway   │────────▶│  SAP B1 SL  │
│  (React)    │  HTTP   │  (Node.js)  │  HTTPS  │ Service Lyr │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              │ (Opcional)
                              ▼
                        ┌─────────────┐
                        │  Core (API) │
                        │  (FastAPI)  │
                        └─────────────┘
```

### Componentes

1. **Frontend (`web/`)**: Interface React com Kanban
2. **Gateway (`gateway/`)**: API Node.js que orquestra requisições
3. **SAP Connector (`sap-connector/`)**: Biblioteca com:
   - Gestão de sessão (login/logout automático)
   - Retry com backoff exponencial
   - Circuit breaker para proteção
   - Rate limiting (RPS e concorrência)
4. **Core (`core/`)**: FastAPI para regras de domínio (opcional)

## 📝 UDFs Customizados

Os seguintes UDFs devem ser criados na tabela `Orders` (ORDR) do SAP:

| Campo | Tipo | Tamanho | Descrição |
|-------|------|---------|-----------|
| `U_WMS_STATUS` | String | 50 | Status canônico do WMS |
| `U_WMS_ORDERID` | String | 50 | ID interno do pedido no WMS |
| `U_WMS_LAST_EVENT` | String | 50 | Último evento aplicado |
| `U_WMS_LAST_TS` | DateTime | - | Timestamp da última atualização |
| `U_WMS_CORR_ID` | String | 100 | Correlation ID para rastreamento |

## 🔧 Troubleshooting

### Erro: "Variáveis de ambiente SAP não configuradas"

**Solução:** Certifique-se de que o arquivo `.env` existe e contém todas as variáveis necessárias.

### Erro: "Falha no login do Service Layer"

**Possíveis causas:**
- Credenciais incorretas
- Service Layer offline
- Certificado SSL inválido
- CompanyDB incorreto

**Solução:** Verifique as variáveis `SAP_B1_USERNAME`, `SAP_B1_PASSWORD` e `SAP_B1_COMPANY_DB`.

### Erro: "Sessão do SAP expirada"

**Normal!** O connector reautentica automaticamente. Se persistir, verifique logs.

### Erro: "Circuit breaker aberto"

**Causa:** Muitas falhas consecutivas ao SAP.

**Solução:** 
1. Verifique status do SAP
2. Aguarde 30 segundos (timeout padrão)
3. Tente novamente

### Pedidos não aparecem no Kanban

**Solução:**
1. Verifique se o gateway está rodando
2. Clique em "Importar SAP"
3. Verifique console do navegador para erros

## 📚 Referências

- [Contrato de Integração](./API_CONTRACTS/sap-b1-integration-contract.md)
- [Documentação do Service Layer](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5ba1580e54bed96f5/bd4c66b33b9141439de4dae093ee1393.html)
- [OpenAPI Spec](./API_CONTRACTS/openapi.yaml)

## 🤝 Contribuindo

1. Nunca commite credenciais
2. Sempre teste localmente antes de commitar
3. Mantenha logs sem informações sensíveis
4. Documente mudanças em CHANGELOG.md

## 📄 Licença

Propriedade da empresa. Uso interno apenas.
