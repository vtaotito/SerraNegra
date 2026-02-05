# 📑 Índice de Deploy - WMS Sistema

Guia centralizado com todos os recursos para executar localhost e VPS.

---

## 🚀 INÍCIO RÁPIDO

### Para Executar AGORA em Localhost:

```powershell
.\START-API.ps1
```

**Arquivo**: [`EXECUTE-AGORA.md`](EXECUTE-AGORA.md) ⭐

---

## 📚 Documentação Principal

### Guias de Início

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **[EXECUTE-AGORA.md](EXECUTE-AGORA.md)** ⭐ | Guia mais rápido (5 min) | Iniciar agora |
| **[README-IMPORTANTE.md](README-IMPORTANTE.md)** | Início rápido detalhado | Primeira vez |
| **[PROXIMOS-PASSOS-EXECUTAR.md](PROXIMOS-PASSOS-EXECUTAR.md)** | Plano completo de execução | Planejamento |

### Deploy e Configuração

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **[DEPLOY-LOCALHOST-VPS.md](DEPLOY-LOCALHOST-VPS.md)** | Guia completo localhost + VPS | Deploy completo |
| **[START-SERVERS.md](START-SERVERS.md)** | Como iniciar servidores | Operação diária |
| **[ecosystem.config.js](ecosystem.config.js)** | PM2 config para VPS | Deploy VPS |

### Troubleshooting

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **[QUICK-FIX.md](QUICK-FIX.md)** | Soluções rápidas | Problemas comuns |
| **[CORS-FIX.md](CORS-FIX.md)** | Correção de CORS | Erro de CORS |

### Documentação Técnica

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **[API-REST-SUMMARY.md](API-REST-SUMMARY.md)** | Resumo da API | Visão geral API |
| **[RESUMO-EXECUTIVO.md](RESUMO-EXECUTIVO.md)** | Resumo executivo completo | Apresentação |
| **[openapi-rest.yaml](openapi-rest.yaml)** | Especificação OpenAPI | Referência API |
| **[api/README.md](api/README.md)** | Documentação da API | Uso da API |
| **[api/INTEGRATION-EXAMPLE.md](api/INTEGRATION-EXAMPLE.md)** | Exemplos de integração | Como integrar |

---

## 🛠️ Scripts Disponíveis

### Windows (PowerShell)

| Script | Descrição | Uso |
|--------|-----------|-----|
| **[START-API.ps1](START-API.ps1)** ⭐ | Iniciar API automaticamente | `.\START-API.ps1` |
| **[test-dashboard.ps1](test-dashboard.ps1)** | Testar endpoints | `.\test-dashboard.ps1` |
| **[TEST-CORS.ps1](TEST-CORS.ps1)** | Testar CORS | `.\TEST-CORS.ps1` |
| **[package-for-vps.ps1](package-for-vps.ps1)** | Empacotar para VPS | `.\package-for-vps.ps1` |

### Linux/Mac (Bash)

| Script | Descrição | Uso |
|--------|-----------|-----|
| **[setup-vps.sh](setup-vps.sh)** | Setup inicial VPS | `sudo bash setup-vps.sh` |
| **[deploy-vps.sh](deploy-vps.sh)** | Deploy automático | `bash deploy-vps.sh` |
| **[TEST-CORS.sh](TEST-CORS.sh)** | Testar CORS | `bash TEST-CORS.sh` |

---

## 📋 Plano de Execução

### LOCALHOST (5 minutos)

```powershell
# 1. Iniciar
.\START-API.ps1

# 2. Testar
.\test-dashboard.ps1

# 3. Usar
# API disponível em http://localhost:8000
```

**Status**: ✅ Pronto

### VPS (30-60 minutos)

#### Fase 1: Setup VPS

```bash
# No VPS como root
bash setup-vps.sh
```

**Resultado**: VPS preparado com Node.js, PM2, Nginx

#### Fase 2: Empacotar e Enviar

```powershell
# No Windows
.\package-for-vps.ps1

# Enviar para VPS
scp wms-deploy-*.tar.gz wms@SEU_VPS_IP:/home/wms/
```

#### Fase 3: Deploy

```bash
# No VPS como usuário wms
cd /home/wms
tar -xzf wms-deploy-*.tar.gz
cd wms
bash deploy-vps.sh
```

**Resultado**: Aplicação rodando com PM2

#### Fase 4: Configurar Nginx e SSL

```bash
# Configurar Nginx
sudo nano /etc/nginx/sites-available/wms
# Copiar config de DEPLOY-LOCALHOST-VPS.md

sudo ln -s /etc/nginx/sites-available/wms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Configurar SSL
sudo certbot --nginx -d api.seudominio.com -d gateway.seudominio.com
```

**Resultado**: HTTPS ativo, acesso público

---

## ✅ Checklist por Ambiente

### Localhost

- [ ] Node.js >= 18.0.0 instalado
- [ ] Executei `.\START-API.ps1`
- [ ] API respondendo em http://localhost:8000/health
- [ ] Testes passando (`.\test-dashboard.ps1`)
- [ ] Frontend conectando

### VPS

#### Setup (Uma vez)
- [ ] VPS com Ubuntu 22.04
- [ ] DNS configurado (api.seudominio.com)
- [ ] Executei `setup-vps.sh` como root
- [ ] Node.js, PM2, Nginx instalados

#### Deploy (Cada atualização)
- [ ] Código empacotado (`package-for-vps.ps1`)
- [ ] Arquivo enviado via SCP
- [ ] Executei `deploy-vps.sh` como wms
- [ ] Build concluído sem erros
- [ ] PM2 rodando (`pm2 status`)
- [ ] Health checks passando

#### Produção
- [ ] Nginx configurado
- [ ] SSL ativo (HTTPS)
- [ ] Firewall configurado
- [ ] Logs monitorados
- [ ] Backups configurados

---

## 🎯 Fluxo Recomendado

```
1. Localhost ✅
   ↓
2. Testar localmente ✅
   ↓
3. Setup VPS
   ↓
4. Deploy VPS
   ↓
5. Configurar Nginx/SSL
   ↓
6. Testar VPS
   ↓
7. Integrar frontend
   ↓
8. Go-live! 🎉
```

---

## 📞 Próximos Passos Técnicos

Após deploy funcionando:

1. **Implementar Banco de Dados**
   - PostgreSQL
   - Substituir stub services
   - Migrations

2. **Configurar Cache**
   - Redis
   - Cache de catálogo
   - Session store

3. **Ativar SAP Polling**
   - Criar SQLQueries no SAP
   - Configurar UDFs
   - Ativar sincronização automática

4. **Monitoramento**
   - Prometheus
   - Grafana
   - Alertas

5. **Testes**
   - Unit tests
   - Integration tests
   - Load tests

---

## 🆘 Ajuda Rápida

### Onde Encontrar

- **Iniciar localhost**: `.\START-API.ps1`
- **Testar localhost**: `.\test-dashboard.ps1`
- **Problemas**: `QUICK-FIX.md`
- **CORS**: `CORS-FIX.md`
- **Deploy VPS**: `DEPLOY-LOCALHOST-VPS.md`
- **API docs**: `api/README.md`

### Comandos Úteis

```powershell
# Localhost
.\START-API.ps1                    # Iniciar
.\test-dashboard.ps1               # Testar
netstat -ano | findstr :8000       # Ver porta
```

```bash
# VPS
pm2 status                         # Status
pm2 logs                           # Logs
pm2 restart all                    # Reiniciar
curl http://localhost:8000/health  # Testar
```

---

## 📊 Status do Projeto

```
API REST ........................... ✅ 100%
JWT Authentication ................. ✅ 100%
RBAC .............................. ✅ 100%
CORS .............................. ✅ 100%
Gateway ........................... ✅ 100%
SAP Integration (estrutura) ........ ✅ 100%
Documentação ...................... ✅ 100%
Scripts de Deploy ................. ✅ 100%

Stub Services (em memória) ........ ⚠️  100%
Database (persistência) ........... ⏳ 0%
Cache (Redis) ..................... ⏳ 0%
SAP Polling (ativo) ............... ⏳ 0%
Monitoramento (Prometheus) ........ ⏳ 0%
Testes Automatizados .............. ⏳ 0%
```

**Pronto para deploy**: ✅ SIM

---

**Execute agora**: `.\START-API.ps1`

**Última atualização**: 2026-02-03
