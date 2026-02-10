# 🌐 Guia de Acesso Rápido - WMS Platform

**Última atualização**: 2026-02-03

---

## 🖥️ Desenvolvimento Local (Localhost)

### Opção 1: Modo Desenvolvimento (Recomendado)

**Pré-requisitos**:
- Node.js 18+ instalado
- PostgreSQL rodando (ou via Docker)

#### 1. Iniciar Backend (Core + Gateway)

```bash
# Terminal 1: Core (FastAPI)
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"
npm run dev:core

# Terminal 2: Gateway (Node.js)
cd gateway
npm run dev

# Terminal 3: Worker (SAP Sync)
cd worker
npm run dev
```

**URLs**:
- Core API: http://localhost:8000
- Gateway API: http://localhost:3000
- Health checks:
  - http://localhost:8000/health
  - http://localhost:3000/health

#### 2. Iniciar Frontend

**Frontend Atual (Vite/React)**:
```bash
# Terminal 4
cd web
npm run dev
```
**URL**: http://localhost:5173

**Frontend Next.js** (em desenvolvimento):
```bash
# Terminal 4 (alternativo)
cd web-next
npm run dev
```
**URL**: http://localhost:3002

---

### Opção 2: Docker Compose Local

```bash
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# Iniciar toda a stack
docker compose -f deploy/docker-compose.yml up

# Ou em background
docker compose -f deploy/docker-compose.yml up -d

# Ver logs
docker compose -f deploy/docker-compose.yml logs -f

# Parar
docker compose -f deploy/docker-compose.yml down
```

**URLs**:
- Frontend: http://localhost:8080
- Gateway API: http://localhost:8080/api
- Core direto: http://localhost:8000 (não exposto por padrão)

---

## 🚀 Produção (PRD) - VPS Hostinger

### URLs de Acesso

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Frontend (Kanban)** | http://YOUR_VPS_IP:8080 | Dashboard principal |
| **API Gateway** | http://YOUR_VPS_IP:8080/api | API pública |
| **Health Check** | http://YOUR_VPS_IP:8080/health | Status do gateway |
| **SAP Health** | http://YOUR_VPS_IP:8080/api/sap/health | Status integração SAP |

### Acesso SSH ao Servidor

```bash
# Conectar via SSH
ssh root@YOUR_VPS_IP

# Ver status dos serviços
cd /opt/wms/current
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f web        # Frontend
docker compose logs -f gateway    # Gateway
docker compose logs -f core       # Core
docker compose logs -f worker     # Worker SAP

# Restart de serviços
docker compose restart web
docker compose restart gateway

# Rebuild completo (após mudanças)
docker compose build --no-cache
docker compose up -d
```

---

## 📊 Kanban Dashboard

### Acessar Kanban

#### **Produção** (Recomendado):
1. Abrir navegador
2. Ir para: **http://YOUR_VPS_IP:8080**
3. Verificar indicador no canto inferior: deve mostrar **"Fonte: API"** (não "Mock local")

#### **Localhost** (Desenvolvimento):
1. Iniciar frontend (ver seção acima)
2. Abrir navegador
3. Ir para: **http://localhost:5173** (Vite) ou **http://localhost:3002** (Next.js)

### Features do Kanban

**Colunas de Status**:
1. 🔵 **A Separar** - Pedidos novos
2. 🟡 **Em Separação** - Sendo coletados
3. 🟣 **Conferido** - Separação completa
4. 🔴 **Aguardando Cotação** - Aguardando frete
5. 🟢 **Aguardando Coleta** - Pronto para transportadora
6. 🔵 **Despachado** - Enviado

**Funcionalidades**:
- ✅ Drag & drop de cards entre colunas
- ✅ Filtros por status, cliente, data
- ✅ Modal com detalhes do pedido (clicar no card)
- ✅ Botão "Importar do SAP" (sync manual)
- ✅ Indicador de fonte de dados (API vs Mock)
- ✅ Toast notifications para ações

### Testando o Kanban

```bash
# 1. Verificar que frontend está rodando
curl -I http://localhost:5173  # Localhost
curl -I http://YOUR_VPS_IP:8080  # Produção

# 2. Verificar API está respondendo
curl http://localhost:3000/api/orders?limit=5  # Localhost
curl http://YOUR_VPS_IP:8080/api/orders?limit=5  # Produção

# 3. Verificar integração SAP
curl http://YOUR_VPS_IP:8080/api/sap/health
```

---

## 🔧 Troubleshooting

### Problema: Frontend não carrega

**Localhost**:
```bash
# Verificar se porta está em uso
netstat -ano | findstr "5173"

# Matar processo se necessário
taskkill /PID [PID] /F

# Reinstalar dependências
cd web
rm -rf node_modules
npm install
npm run dev
```

**Produção**:
```bash
ssh root@YOUR_VPS_IP
cd /opt/wms/current

# Ver logs do container web
docker compose logs web

# Restart do serviço
docker compose restart web

# Rebuild se necessário
docker compose build web
docker compose up -d web
```

### Problema: Kanban mostra "Mock local"

**Solução** (já aplicada, mas para referência):
```bash
# Verificar variável de ambiente
cat web/.env
# Deve ter: VITE_API_BASE_URL=/api

# Se não tiver, rebuild
cd web
npm run build
```

### Problema: Botão "Importar do SAP" não funciona

**Verificar**:
1. Backend SAP está configurado?
   ```bash
   curl http://YOUR_VPS_IP:8080/api/sap/health
   ```

2. Worker está rodando?
   ```bash
   docker compose logs worker | tail -50
   ```

3. Credenciais SAP estão corretas?
   ```bash
   cat /opt/wms/shared/.env | grep SAP_B1_
   ```

### Problema: API retorna 403/401

**Verificar headers**:
```bash
# Testar com headers de autenticação
curl -H "X-User-Id: dev-user" \
     -H "X-User-Role: ADMIN" \
     http://localhost:3000/api/orders
```

### Problema: Docker Compose não inicia

```bash
# Ver erro específico
docker compose -f deploy/docker-compose.yml up

# Verificar .env existe
ls -l /opt/wms/shared/.env

# Verificar sintaxe docker-compose.yml
docker compose -f deploy/docker-compose.yml config

# Limpar volumes (CUIDADO: perde dados)
docker compose -f deploy/docker-compose.yml down -v
```

---

## 📱 Atalhos Úteis

### Localhost (Windows)

Criar arquivo `start-wms.bat`:
```batch
@echo off
echo Iniciando WMS Platform...

start cmd /k "cd /d c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms && npm run dev:core"
timeout /t 5 /nobreak >nul

start cmd /k "cd /d c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms\gateway && npm run dev"
timeout /t 5 /nobreak >nul

start cmd /k "cd /d c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms\worker && npm run dev"
timeout /t 5 /nobreak >nul

start cmd /k "cd /d c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms\web && npm run dev"

echo Aguardando serviços iniciarem...
timeout /t 10 /nobreak >nul

start http://localhost:5173

echo WMS Platform iniciado!
echo Frontend: http://localhost:5173
echo Gateway: http://localhost:3000
echo Core: http://localhost:8000
pause
```

Executar: `start-wms.bat`

### Produção (SSH)

Criar alias no servidor:
```bash
# No servidor VPS
echo 'alias wms-logs="cd /opt/wms/current && docker compose logs -f"' >> ~/.bashrc
echo 'alias wms-status="cd /opt/wms/current && docker compose ps"' >> ~/.bashrc
echo 'alias wms-restart="cd /opt/wms/current && docker compose restart"' >> ~/.bashrc
source ~/.bashrc

# Usar
wms-logs
wms-status
wms-restart web
```

---

## 🎯 Quick Reference

### URLs Principais

| Ambiente | Frontend | API | Docs |
|----------|----------|-----|------|
| **Localhost** | http://localhost:5173 | http://localhost:3000 | http://localhost:8000/docs |
| **Produção** | http://YOUR_VPS_IP:8080 | http://YOUR_VPS_IP:8080/api | - |

### Portas Padrão

| Serviço | Porta Local | Porta Docker | Porta Exposta |
|---------|-------------|--------------|---------------|
| Frontend (Vite) | 5173 | 80 | 8080 (via nginx) |
| Frontend (Next.js) | 3002 | - | - |
| Gateway | 3000 | 3000 | 8080/api (via nginx) |
| Core | 8000 | 8000 | Não exposta |
| PostgreSQL | 5432 | 5432 | Não exposta |
| Redis | 6379 | 6379 | Não exposta |

### Comandos Essenciais

```bash
# DESENVOLVIMENTO
npm run dev:core          # Iniciar Core
npm run dev:gateway       # Iniciar Gateway
npm run dev:worker        # Iniciar Worker
npm run dev:web           # Iniciar Frontend

# PRODUÇÃO (no servidor)
docker compose ps         # Status
docker compose logs -f    # Logs
docker compose restart    # Restart
docker compose up -d      # Iniciar
docker compose down       # Parar

# TESTES
curl http://localhost:3000/health           # Localhost
curl http://YOUR_VPS_IP:8080/health      # Produção
curl http://YOUR_VPS_IP:8080/api/orders  # API
```

---

## 📞 Suporte Rápido

### Links Úteis

- **Documentação completa**: `INDICE_DOCUMENTACAO.md`
- **Análise E2E**: `ANALISE_E2E_COMPLETA.md`
- **Troubleshooting**: `docs/VALIDACAO_CADEIA_SAP.md`
- **Deploy**: `CORRECAO_SAP_RESUMO.md`

### Problemas Comuns

| Problema | Solução Rápida |
|----------|----------------|
| Frontend em branco | Ver console do browser (F12) |
| API não responde | Verificar logs: `docker compose logs gateway` |
| SAP não conecta | Verificar: `curl http://YOUR_VPS_IP:8080/api/sap/health` |
| Worker não sincroniza | Ver logs: `docker compose logs worker` |

---

## 🎨 Screenshots de Referência

### Kanban Dashboard (Produção)
**URL**: http://YOUR_VPS_IP:8080

**Deve mostrar**:
- 6 colunas de status
- Cards de pedidos arrastáveis
- Filtros no topo
- Botão "Importar do SAP"
- Indicador **"Fonte: API"** (canto inferior) ✅

### Health Check
**URL**: http://YOUR_VPS_IP:8080/health

**Resposta esperada**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T...",
  "uptime": 12345,
  "version": "0.2.0"
}
```

### SAP Health
**URL**: http://YOUR_VPS_IP:8080/api/sap/health

**Resposta esperada**:
```json
{
  "status": "ok",
  "sap_connected": true,
  "session_valid": true,
  "response_time_ms": 245
}
```

---

**Preparado por**: Equipe Técnica WMS  
**Data**: 2026-02-03  
**Versão**: 1.0
