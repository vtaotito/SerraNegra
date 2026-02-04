# WMS Orchestrator — Artefatos (MVP)

Este workspace contém os artefatos do MVP do **WMS Orchestrator** (contratos e máquina de estados) e uma **integração completa com SAP Business One**.

## 🚀 Integração SAP Business One (COMPLETA)

**Status:** ✅ Implementado e testado

### Funcionalidades
- ✅ **Backend Gateway** (Node.js + TypeScript): Endpoints REST para SAP
- ✅ **SAP Connector**: Biblioteca robusta com gestão de sessão, retry, circuit breaker, rate limiting
- ✅ **Frontend**: Dashboard Kanban com importação de pedidos do SAP
- ✅ **Testes**: Unitários e de integração
- ✅ **Documentação**: Guia completo e scripts de setup

### Quick Start (Integração SAP)

```powershell
# Windows
.\setup-sap-integration.ps1
```

```bash
# Linux/Mac
chmod +x setup-sap-integration.sh
./setup-sap-integration.sh
```

Leia o guia completo: **[SAP_INTEGRATION_QUICKSTART.md](./SAP_INTEGRATION_QUICKSTART.md)**

## 📁 Estrutura do Projeto

### Core
- `SPEC.md`: Escopo e regras do MVP
- `STATE_MACHINE.json`: Máquina de estados do pedido
- `API_CONTRACTS/`: Contratos de API (OpenAPI + SAP B1)

### Integração SAP
- `sap-connector/`: Cliente SAP B1 (Service Layer) com resiliência completa
- `gateway/`: API Node.js com endpoints REST para SAP
- `web/`: Frontend React com dashboard Kanban
- `mappings/`: Mapeamentos SAP → WMS (Order, Item, Inventory)

### Core WMS
- `wms-core/`: Lógica de domínio (state machine, serviços)
- `core/`: FastAPI (opcional para regras de domínio)
- `collector/`: PWA do operador (offline-first)

### Testes
- `tests/unit/`: Testes unitários
- `tests/integration/`: Testes de integração
- `tests/e2e/`: Testes end-to-end

## 🛠️ Setup e Desenvolvimento

### 1. Configuração Inicial

```bash
# Instalar dependências
npm install

# Typecheck
npm run typecheck

# Build
npm run build
```

### 2. Configurar SAP Business One

#### Opção A: Setup Automático (Recomendado)

```powershell
# Windows
.\setup-sap-integration.ps1
```

```bash
# Linux/Mac
chmod +x setup-sap-integration.sh
./setup-sap-integration.sh
```

#### Opção B: Setup Manual

1. Copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edite `.env` com suas credenciais SAP:
   ```env
   SAP_B1_BASE_URL=https://seu-servidor:50000/b1s/v1
   SAP_B1_COMPANY_DB=SuaEmpresa
   SAP_B1_USERNAME=usuario
   SAP_B1_PASSWORD=senha
   ```

3. Crie os UDFs no SAP:
   - Execute o script: `sap-connector/SQL_CREATE_UDFS.sql`

4. Teste a conexão:
   ```bash
   tsx sap-connector/examples/quick-test.ts
   ```

### 3. Executar Aplicação

```bash
# Terminal 1: Gateway (API)
cd gateway
npm run dev

# Terminal 2: Frontend (Dashboard)
cd web
npm run dev

# Terminal 3 (Opcional): Core FastAPI
cd core
uvicorn app.main:app --reload
```

### 4. Acessar Dashboard

Abra no navegador: `http://localhost:5173`

- Clique em **"Testar SAP"** para validar conexão
- Clique em **"Importar SAP"** para buscar pedidos abertos
- Arraste pedidos entre as colunas do Kanban

## 🧪 Testes

```bash
# Todos os testes
npm test

# Testes unitários
npm test tests/unit/

# Testes de integração (requer gateway rodando)
SKIP_SAP_INTEGRATION=false npm test tests/integration/

# Testes E2E
npm test tests/e2e/
```

## 📚 Documentação

### Integração SAP
- **[SAP_INTEGRATION_QUICKSTART.md](./SAP_INTEGRATION_QUICKSTART.md)**: Guia completo da integração
- **[API_CONTRACTS/sap-b1-integration-contract.md](./API_CONTRACTS/sap-b1-integration-contract.md)**: Contrato de integração
- **[sap-connector/README.md](./sap-connector/README.md)**: API do connector

### Projeto
- **[SPEC.md](./SPEC.md)**: Especificação do MVP
- **[INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)**: Visão geral das entregas
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Arquitetura do sistema

## ⚠️ Segurança

**CRÍTICO:** Nunca commite credenciais!

- ✅ Use variáveis de ambiente (`.env`)
- ✅ Mantenha `.env` no `.gitignore`
- ✅ Use placeholders em exemplos (ex: `********`)
- ❌ NUNCA logue senhas, tokens ou cookies
- ❌ NUNCA hardcode credenciais no código

## 🤝 Contribuindo

1. Nunca commite credenciais
2. Sempre teste localmente antes de commitar
3. Mantenha logs sem informações sensíveis
4. Documente mudanças em CHANGELOG.md

## 📄 Licença

Propriedade da empresa. Uso interno apenas.

