# 🚀 Deploy no Hostinger VPS via MCP

## 📋 Pré-requisitos

1. Conta Hostinger com VPS ativo
2. Token de API da Hostinger
3. Credenciais SAP Business One

## 🔧 Configuração de Variáveis de Ambiente

O projeto precisa das seguintes variáveis de ambiente configuradas no Hostinger MCP:

### Variáveis Obrigatórias

```bash
# Portas
WEB_PORT=8080

# Segurança
INTERNAL_SHARED_SECRET=your-secret-key-here
POSTGRES_PASSWORD=your-postgres-password-here

# SAP Business One
SAP_B1_BASE_URL=https://seu-servidor-sap.com:50000
SAP_B1_COMPANY_DB=SUA_EMPRESA_DB
SAP_B1_USERNAME=seu_usuario
SAP_B1_PASSWORD=sua_senha
```

### Variáveis Opcionais

```bash
# Logs
LOG_LEVEL=info

# Configurações SAP
SAP_B1_TIMEOUT_MS=20000
SAP_B1_MAX_ATTEMPTS=5
SAP_B1_MAX_CONCURRENT=8
SAP_B1_MAX_RPS=10
```

## 📦 Deploy via MCP (Hostinger API)

### 1. Criar arquivo .env no servidor

Acesse o VPS via SSH e crie o arquivo:

```bash
ssh root@31.97.174.120
cd /docker/serranegra/
nano .env
```

Cole o conteúdo do arquivo `.env.deploy` com suas credenciais reais.

### 2. Deploy via MCP Tools

O deploy é feito automaticamente via Hostinger MCP quando você faz push no repositório GitHub.

```bash
git add .
git commit -m "Atualiza configuração"
git push
```

O MCP detecta as mudanças e reconstrói os containers automaticamente.

## 🏗️ Stack Completa

O `docker-compose.yaml` contém todos os serviços:

| Serviço | Porta Interna | Descrição |
|---------|---------------|-----------|
| **nginx** | 8080 (externa) → 80 | Reverse proxy (frontend + API) |
| **web** | 80 | Frontend React/Vite |
| **gateway** | 3000 | API Gateway (Node.js) |
| **core** | 8000 | Core WMS (Python/FastAPI) |
| **worker** | - | Worker de sincronização SAP |
| **postgres** | 5432 | Banco de dados |
| **redis** | 6379 | Cache e fila |

## 🌐 Rotas

Após o deploy, o sistema estará disponível em:

- **Frontend**: `http://31.97.174.120:8080/`
- **API Gateway**: `http://31.97.174.120:8080/api/`
- **Health Check**: `http://31.97.174.120:8080/health`

## 🔒 Segurança

⚠️ **IMPORTANTE**: Antes de fazer deploy em produção:

1. Altere `INTERNAL_SHARED_SECRET` para um valor seguro
2. Altere `POSTGRES_PASSWORD` para uma senha forte
3. Considere usar HTTPS com certificado SSL
4. Configure firewall para limitar acesso às portas

## 🧪 Testando a Integração SAP

Após o deploy, você pode testar a conexão SAP através do dashboard:

1. Acesse `http://31.97.174.120:8080/`
2. Clique em "Testar Conexão SAP"
3. Se bem-sucedido, clique em "Importar do SAP"

Os pedidos do SAP B1 aparecerão no dashboard!

## 🐛 Troubleshooting

### Verificar logs dos containers

```bash
ssh root@31.97.174.120
cd /docker/serranegra/
docker-compose logs -f gateway
docker-compose logs -f core
docker-compose logs -f worker
```

### Verificar status dos serviços

```bash
docker-compose ps
```

### Reiniciar serviços

```bash
docker-compose restart gateway
docker-compose restart core
```

### Ver variáveis de ambiente

```bash
docker-compose config
```

## 📚 Documentação Adicional

- [SAP Integration Quickstart](./SAP_INTEGRATION_QUICKSTART.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Architecture](./docs/ARCHITECTURE.md)
