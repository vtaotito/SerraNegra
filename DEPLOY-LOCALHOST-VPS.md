# Guia de Deploy - Localhost e VPS

## 🎯 Visão Geral

Este guia cobre:
1. **Localhost** - Desenvolvimento local (Windows)
2. **VPS** - Deploy em produção (Linux)

---

## 📍 PARTE 1: LOCALHOST (Desenvolvimento)

### 1.1. Pré-requisitos

```powershell
# Verificar versões
node --version  # >= 18.0.0
npm --version   # >= 9.0.0
```

### 1.2. Estrutura de Serviços

```
WMS Sistema
├── API Core (8000) - API REST principal
├── Gateway (3000) - Proxy + SSE/WebSocket + SAP
├── Frontend (8080) - Interface web
└── SAP B1 (mock ou real) - Integração
```

### 1.3. Iniciar Serviços Localmente

#### **Terminal 1: API Core**

```powershell
# Iniciar API Core
.\START-API.ps1

# Ou manualmente:
cd api
npm install
npm run dev
```

Aguarde: `Core API online em :8000`

#### **Terminal 2: Gateway (Opcional)**

```powershell
cd gateway
npm install
npm run dev
```

Aguarde: `Gateway online em :3000`

#### **Terminal 3: Testar**

```powershell
# Testar API Core
.\test-dashboard.ps1

# Testar Gateway
curl http://localhost:3000/health

# Testar SAP Health
curl http://localhost:3000/api/sap/health
```

### 1.4. Configuração Local (.env)

#### `api/.env`

```bash
# API Core
API_PORT=8000
LOG_LEVEL=info
SERVICE_NAME=wms-core-api

# JWT
JWT_SECRET=dev-secret-dev-secret-dev-secret-dev-secret
JWT_EXPIRES_IN=8h
JWT_ISSUER=wms-api
JWT_AUDIENCE=wms-clients

# CORS - Permitir frontend local
CORS_ORIGINS=http://localhost:3000,http://localhost:8080,http://31.97.174.120:8080
```

#### `gateway/.env`

```bash
# Gateway
GATEWAY_PORT=3000
CORE_BASE_URL=http://localhost:8000
LOG_LEVEL=info
SERVICE_NAME=wms-gateway

# SAP (usar mock em desenvolvimento)
SAP_MODE=mock
SAP_BASE_URL=https://seu-sap.com:50000
SAP_USERNAME=your-username
SAP_PASSWORD=your-password
SAP_COMPANY_DB=SBO_GARRAFARIA_TST

# Segredos
INTERNAL_SHARED_SECRET=dev-internal-secret
```

### 1.5. Desenvolvimento com Hot Reload

```powershell
# API Core - Watch mode
cd api
npm run dev  # tsx watch

# Gateway - Watch mode
cd gateway
npm run dev  # tsx watch
```

Qualquer mudança nos arquivos .ts recarrega automaticamente.

---

## 🚀 PARTE 2: VPS (Produção)

### 2.1. Requisitos do VPS

- **OS**: Ubuntu 22.04 LTS (recomendado)
- **RAM**: Mínimo 2GB, recomendado 4GB
- **CPU**: Mínimo 2 cores
- **Disco**: 20GB disponível
- **Node.js**: 18.x ou superior
- **Portas abertas**: 80, 443, 8000, 3000

### 2.2. Preparar VPS

```bash
# SSH no VPS
ssh root@seu-vps-ip

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Instalar PM2 (gerenciador de processos)
npm install -g pm2

# Instalar nginx (proxy reverso)
apt install -y nginx

# Instalar certbot (SSL)
apt install -y certbot python3-certbot-nginx

# Criar usuário para aplicação (segurança)
adduser wms --disabled-password --gecos ""
```

### 2.3. Transferir Código para VPS

#### Opção A: Git (Recomendado)

```bash
# No VPS
su - wms
cd ~
git clone https://seu-repositorio.git wms
cd wms
```

#### Opção B: SCP (Manual)

```powershell
# No Windows (PowerShell)
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# Criar arquivo .tar.gz
tar -czf wms.tar.gz api/ gateway/ package.json tsconfig.json

# Enviar para VPS
scp wms.tar.gz wms@seu-vps-ip:/home/wms/

# No VPS
tar -xzf wms.tar.gz
```

### 2.4. Instalar Dependências no VPS

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
```

### 2.5. Configurar Variáveis de Ambiente (VPS)

```bash
# Criar .env para produção
nano /home/wms/wms/api/.env
```

**`api/.env` (Produção)**

```bash
# API Core
API_PORT=8000
NODE_ENV=production
LOG_LEVEL=info
SERVICE_NAME=wms-core-api

# JWT - USAR SECRET FORTE EM PRODUÇÃO
JWT_SECRET=seu-secret-super-seguro-e-aleatorio-minimo-32-caracteres
JWT_EXPIRES_IN=8h
JWT_ISSUER=wms-api
JWT_AUDIENCE=wms-clients

# CORS - APENAS DOMÍNIOS PERMITIDOS
CORS_ORIGINS=https://wms.seudominio.com,https://dashboard.seudominio.com

# Database (quando implementar)
DATABASE_URL=postgresql://wms:senha@localhost:5432/wms_prod
```

**`gateway/.env` (Produção)**

```bash
# Gateway
GATEWAY_PORT=3000
CORE_BASE_URL=http://localhost:8000
NODE_ENV=production
LOG_LEVEL=info
SERVICE_NAME=wms-gateway

# SAP - CREDENCIAIS REAIS
SAP_MODE=production
SAP_BASE_URL=https://seu-sap.com:50000
SAP_USERNAME=usuario-producao
SAP_PASSWORD=senha-super-segura
SAP_COMPANY_DB=SBO_PRODUCAO

# Segredos - GERAR NOVO
INTERNAL_SHARED_SECRET=secret-aleatorio-production-xyz123
```

### 2.6. Configurar PM2 (Gerenciador de Processos)

```bash
# Criar arquivo de configuração PM2
nano /home/wms/wms/ecosystem.config.js
```

**`ecosystem.config.js`**

```javascript
module.exports = {
  apps: [
    {
      name: 'wms-api',
      script: './api/dist/server.js',
      cwd: '/home/wms/wms',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        API_PORT: 8000
      },
      error_file: '/home/wms/logs/api-error.log',
      out_file: '/home/wms/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      watch: false,
      autorestart: true
    },
    {
      name: 'wms-gateway',
      script: './gateway/dist/index.js',
      cwd: '/home/wms/wms',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        GATEWAY_PORT: 3000
      },
      error_file: '/home/wms/logs/gateway-error.log',
      out_file: '/home/wms/logs/gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '300M',
      watch: false,
      autorestart: true
    }
  ]
};
```

```bash
# Criar pasta de logs
mkdir -p /home/wms/logs

# Iniciar aplicações com PM2
pm2 start ecosystem.config.js

# Configurar PM2 para iniciar no boot
pm2 startup
pm2 save

# Ver status
pm2 status
pm2 logs
```

### 2.7. Configurar Nginx (Proxy Reverso)

```bash
# Criar configuração nginx
sudo nano /etc/nginx/sites-available/wms
```

**`/etc/nginx/sites-available/wms`**

```nginx
# API Core
upstream wms_api {
    server localhost:8000;
    keepalive 64;
}

# Gateway
upstream wms_gateway {
    server localhost:3000;
    keepalive 64;
}

# API Backend
server {
    listen 80;
    server_name api.seudominio.com;

    # Logs
    access_log /var/log/nginx/wms-api-access.log;
    error_log /var/log/nginx/wms-api-error.log;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-User-Id, X-User-Role, X-User-Name, X-Correlation-Id, Idempotency-Key' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # OPTIONS preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-User-Id, X-User-Role, X-User-Name, X-Correlation-Id, Idempotency-Key' always;
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    location / {
        proxy_pass http://wms_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# Gateway + WebSocket
server {
    listen 80;
    server_name gateway.seudominio.com;

    access_log /var/log/nginx/wms-gateway-access.log;
    error_log /var/log/nginx/wms-gateway-error.log;

    location / {
        proxy_pass http://wms_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://wms_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # SSE
    location /events {
        proxy_pass http://wms_gateway;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Habilitar site
sudo ln -s /etc/nginx/sites-available/wms /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar nginx
sudo systemctl reload nginx
```

### 2.8. Configurar SSL (HTTPS)

```bash
# Obter certificados SSL gratuitos
sudo certbot --nginx -d api.seudominio.com -d gateway.seudominio.com

# Renovação automática (já configurado pelo certbot)
sudo certbot renew --dry-run
```

### 2.9. Configurar Firewall

```bash
# UFW (Ubuntu Firewall)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Verificar status
sudo ufw status
```

### 2.10. Monitoramento e Logs

```bash
# Ver logs em tempo real
pm2 logs

# Ver logs específicos
pm2 logs wms-api
pm2 logs wms-gateway

# Ver métricas
pm2 monit

# Ver status
pm2 status

# Reiniciar serviços
pm2 restart wms-api
pm2 restart wms-gateway
pm2 restart all

# Ver logs nginx
tail -f /var/log/nginx/wms-api-access.log
tail -f /var/log/nginx/wms-api-error.log
```

---

## 🔄 Deploy Contínuo

### Opção 1: Script de Deploy Automático

```bash
# Criar script de deploy
nano /home/wms/deploy.sh
```

**`deploy.sh`**

```bash
#!/bin/bash
set -e

echo "🚀 Iniciando deploy..."

# Ir para diretório
cd /home/wms/wms

# Atualizar código
echo "📥 Atualizando código..."
git pull origin main

# API Core
echo "🔨 Building API Core..."
cd api
npm install --production
npm run build
cd ..

# Gateway
echo "🔨 Building Gateway..."
cd gateway
npm install --production
npm run build
cd ..

# Reiniciar serviços
echo "♻️  Reiniciando serviços..."
pm2 restart wms-api
pm2 restart wms-gateway

echo "✅ Deploy concluído!"
pm2 status
```

```bash
# Tornar executável
chmod +x /home/wms/deploy.sh

# Executar deploy
./deploy.sh
```

### Opção 2: GitHub Actions (CI/CD)

```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: wms
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/wms/wms
            ./deploy.sh
```

---

## 📊 Health Checks e Testes

### Localhost

```powershell
# Health checks
curl http://localhost:8000/health
curl http://localhost:3000/health

# Testar endpoints
.\test-dashboard.ps1
```

### VPS

```bash
# Health checks
curl https://api.seudominio.com/health
curl https://gateway.seudominio.com/health

# Testar endpoints
curl -H "X-User-Id: test" \
     -H "X-User-Role: ADMIN" \
     https://api.seudominio.com/api/v1/dashboard/metrics
```

---

## 🔐 Segurança em Produção

### Checklist de Segurança

- [ ] JWT_SECRET forte e aleatório (mínimo 32 caracteres)
- [ ] CORS configurado apenas com domínios permitidos
- [ ] Credenciais SAP seguras (.env não commitado)
- [ ] Firewall configurado (apenas portas necessárias)
- [ ] SSL/HTTPS ativo (certbot)
- [ ] Usuário não-root para aplicação
- [ ] Logs monitorados
- [ ] Backups automáticos configurados
- [ ] Rate limiting implementado (futuro)
- [ ] Atualizações de segurança automáticas

---

## 🆘 Troubleshooting

### Localhost

```powershell
# Porta em uso
netstat -ano | findstr :8000
taskkill /F /PID <PID>

# Reinstalar dependências
cd api
Remove-Item -Recurse node_modules
npm install
```

### VPS

```bash
# Ver logs
pm2 logs
journalctl -u nginx -f

# Reiniciar serviços
pm2 restart all
sudo systemctl restart nginx

# Verificar portas
netstat -tulpn | grep -E '(8000|3000)'

# Testar nginx
sudo nginx -t

# Ver processos
pm2 status
ps aux | grep node
```

---

**Próximos Passos:**
1. Implementar banco de dados (PostgreSQL)
2. Configurar Redis para cache
3. Implementar fila de mensagens
4. Adicionar monitoramento (Prometheus + Grafana)
5. Configurar backups automáticos

**Última atualização**: 2026-02-03
