# 🚀 Próximos Passos - Plano de Execução

## 📍 Status Atual

✅ **Concluído:**
- API REST completa (40+ endpoints)
- JWT authentication + RBAC
- CORS configurado
- Gateway com SSE/WebSocket
- Integração SAP (estrutura base)
- Documentação completa

⏳ **Próximo:** Executar em Localhost e VPS

---

## 🎯 PLANO IMEDIATO (Localhost)

### Fase 1: Preparar Ambiente Local (10 min)

```powershell
# 1. Verificar requisitos
node --version  # >= 18.0.0
npm --version   # >= 9.0.0

# 2. Instalar dependências (se ainda não fez)
cd api
npm install
cd ..

cd gateway
npm install
cd ..
```

### Fase 2: Configurar Variáveis (.env)

#### `api/.env`

```bash
API_PORT=8000
LOG_LEVEL=info
JWT_SECRET=dev-secret-dev-secret-dev-secret-dev-secret
CORS_ORIGINS=http://localhost:3000,http://localhost:8080,http://31.97.174.120:8080
```

#### `gateway/.env`

```bash
GATEWAY_PORT=3000
CORE_BASE_URL=http://localhost:8000
SAP_MODE=mock
LOG_LEVEL=info
```

### Fase 3: Iniciar Serviços (3 terminais)

#### Terminal 1: API Core

```powershell
.\START-API.ps1
# Aguardar: "Core API online em :8000"
```

#### Terminal 2: Gateway

```powershell
cd gateway
npm run dev
# Aguardar: "Gateway online em :3000"
```

#### Terminal 3: Testes

```powershell
# Testar API
.\test-dashboard.ps1

# Testar Gateway
Invoke-RestMethod http://localhost:3000/health

# Testar SAP Health
Invoke-RestMethod http://localhost:3000/api/sap/health
```

### Fase 4: Verificar Funcionamento

```powershell
# ✅ API Core
curl http://localhost:8000/health

# ✅ Gateway
curl http://localhost:3000/health

# ✅ Dashboard Metrics
$headers = @{
    "X-User-Id" = "dev-user"
    "X-User-Role" = "SUPERVISOR"
}
Invoke-RestMethod http://localhost:8000/api/v1/dashboard/metrics -Headers $headers

# ✅ SAP Orders (mock)
Invoke-RestMethod http://localhost:3000/api/sap/orders?limit=10 -Headers $headers
```

---

## 🌐 PLANO VPS (Produção)

### Pré-requisitos VPS

- Ubuntu 22.04 LTS
- RAM: 4GB mínimo
- CPU: 2 cores mínimo
- Node.js 18.x
- Domínio configurado (api.seudominio.com)

### Fase 1: Preparar VPS (20 min)

```bash
# 1. Conectar via SSH
ssh root@SEU_VPS_IP

# 2. Atualizar sistema
apt update && apt upgrade -y

# 3. Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 4. Instalar ferramentas
npm install -g pm2
apt install -y nginx certbot python3-certbot-nginx git

# 5. Criar usuário
adduser wms --disabled-password --gecos ""
usermod -aG sudo wms

# 6. Configurar firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Fase 2: Transferir Código (5 min)

#### Opção A: Git (Recomendado)

```bash
# No VPS
su - wms
cd ~
git clone SEU_REPOSITORIO wms
cd wms
```

#### Opção B: SCP

```powershell
# No Windows
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"
tar -czf wms-deploy.tar.gz api gateway package.json

# Enviar
scp wms-deploy.tar.gz wms@SEU_VPS_IP:/home/wms/

# No VPS
tar -xzf wms-deploy.tar.gz
```

### Fase 3: Instalar e Buildar (10 min)

```bash
# No VPS como usuário wms
cd /home/wms/wms

# API Core
cd api
npm install --production
npm run build
cd ..

# Gateway
cd gateway
npm install --production
npm run build
cd ..

# Criar logs
mkdir -p /home/wms/logs
```

### Fase 4: Configurar Ambiente VPS

```bash
# API .env
cat > /home/wms/wms/api/.env <<EOF
API_PORT=8000
NODE_ENV=production
LOG_LEVEL=info
JWT_SECRET=$(openssl rand -base64 32)
CORS_ORIGINS=https://wms.seudominio.com,https://dashboard.seudominio.com
EOF

# Gateway .env
cat > /home/wms/wms/gateway/.env <<EOF
GATEWAY_PORT=3000
CORE_BASE_URL=http://localhost:8000
NODE_ENV=production
LOG_LEVEL=info
SAP_MODE=production
SAP_BASE_URL=https://seu-sap.com:50000
SAP_USERNAME=usuario-sap
SAP_PASSWORD=senha-sap
SAP_COMPANY_DB=SBO_PRODUCAO
EOF
```

### Fase 5: Configurar PM2

```bash
# Criar ecosystem.config.js
cat > /home/wms/wms/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: 'wms-api',
      script: './api/dist/server.js',
      cwd: '/home/wms/wms',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production', API_PORT: 8000 },
      error_file: '/home/wms/logs/api-error.log',
      out_file: '/home/wms/logs/api-out.log',
      max_memory_restart: '500M',
      autorestart: true
    },
    {
      name: 'wms-gateway',
      script: './gateway/dist/index.js',
      cwd: '/home/wms/wms',
      instances: 1,
      env: { NODE_ENV: 'production', GATEWAY_PORT: 3000 },
      error_file: '/home/wms/logs/gateway-error.log',
      out_file: '/home/wms/logs/gateway-out.log',
      max_memory_restart: '300M',
      autorestart: true
    }
  ]
};
EOF

# Iniciar aplicações
pm2 start ecosystem.config.js

# Configurar startup
pm2 startup
pm2 save
```

### Fase 6: Configurar Nginx

```bash
# Criar configuração
sudo tee /etc/nginx/sites-available/wms <<'EOF'
upstream wms_api {
    server localhost:8000;
    keepalive 64;
}

upstream wms_gateway {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://wms_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name gateway.seudominio.com;

    location / {
        proxy_pass http://wms_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://wms_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 86400;
    }
}
EOF

# Habilitar e reiniciar
sudo ln -s /etc/nginx/sites-available/wms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Fase 7: Configurar SSL (HTTPS)

```bash
# Obter certificados
sudo certbot --nginx \
  -d api.seudominio.com \
  -d gateway.seudominio.com \
  --non-interactive \
  --agree-tos \
  -m seu-email@exemplo.com
```

### Fase 8: Testar VPS

```bash
# Health checks
curl https://api.seudominio.com/health
curl https://gateway.seudominio.com/health

# Ver logs
pm2 logs
pm2 status
```

---

## 📋 Checklist de Execução

### Localhost

- [ ] Node.js >= 18.0.0 instalado
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivos `.env` criados
- [ ] API Core rodando (porta 8000)
- [ ] Gateway rodando (porta 3000)
- [ ] Testes passando (`.\test-dashboard.ps1`)
- [ ] Frontend conectando

### VPS

- [ ] VPS com Ubuntu 22.04
- [ ] Node.js 18.x instalado
- [ ] PM2 instalado globalmente
- [ ] Nginx instalado e configurado
- [ ] Código transferido para VPS
- [ ] Build executado (API + Gateway)
- [ ] PM2 ecosystem configurado
- [ ] Serviços iniciados com PM2
- [ ] Nginx configurado com proxy
- [ ] SSL/HTTPS ativo (certbot)
- [ ] Firewall configurado (ufw)
- [ ] Health checks funcionando
- [ ] Logs monitorados

---

## 🔄 Comandos Úteis

### Localhost

```powershell
# Iniciar tudo
.\START-API.ps1                    # Terminal 1
cd gateway && npm run dev          # Terminal 2

# Testar
.\test-dashboard.ps1

# Ver logs
# Os logs aparecem nos terminais
```

### VPS

```bash
# Ver status
pm2 status
pm2 logs

# Reiniciar
pm2 restart wms-api
pm2 restart wms-gateway
pm2 restart all

# Ver métricas
pm2 monit

# Ver logs nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Parar serviços
pm2 stop all
pm2 delete all
```

---

## 🆘 Problemas Comuns

### Localhost: "Porta 8000 em uso"

```powershell
netstat -ano | findstr :8000
taskkill /F /PID <PID>
```

### VPS: "pm2 command not found"

```bash
sudo npm install -g pm2
```

### VPS: "Cannot connect to API"

```bash
# Verificar se está rodando
pm2 status

# Ver logs de erro
pm2 logs wms-api --err

# Testar localmente no VPS
curl http://localhost:8000/health
```

### Nginx: "502 Bad Gateway"

```bash
# Verificar backend
pm2 status
curl http://localhost:8000/health

# Ver logs nginx
tail -f /var/log/nginx/error.log

# Testar config
sudo nginx -t
```

---

## 📊 Próximas Implementações

### Curto Prazo (1-2 semanas)

1. **Banco de Dados**
   - PostgreSQL para persistência
   - Migrations e seeds
   - Connection pooling

2. **Cache**
   - Redis para cache de catálogo
   - Session store
   - Rate limiting

3. **Filas**
   - BullMQ para jobs assíncronos
   - Worker para SAP sync
   - Dead letter queue

### Médio Prazo (2-4 semanas)

4. **Monitoramento**
   - Prometheus para métricas
   - Grafana para dashboards
   - AlertManager para alertas

5. **Logs**
   - Elasticsearch + Kibana
   - Log aggregation
   - Search e analytics

6. **Testes**
   - Jest para unit tests
   - Supertest para integration
   - K6 para load testing

### Longo Prazo (1-2 meses)

7. **CI/CD**
   - GitHub Actions
   - Deploy automático
   - Rollback automático

8. **Backup**
   - Backup automático DB
   - Snapshot VPS
   - Disaster recovery

9. **Escalabilidade**
   - Load balancer
   - Múltiplos workers
   - Kubernetes (opcional)

---

**Execute agora:**

```powershell
# Localhost
.\START-API.ps1

# VPS
# Use o guia DEPLOY-LOCALHOST-VPS.md
```

**Status:** ✅ Pronto para execução  
**Última atualização:** 2026-02-03
