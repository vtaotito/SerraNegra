# 🛠️ Comandos Úteis - WMS Sistema

Referência rápida de comandos para operação diária.

---

## 💻 LOCALHOST (Windows PowerShell)

### Iniciar Serviços

```powershell
# API Core (porta 8000)
.\START-API.ps1

# Gateway (porta 3000)
cd gateway
npm run dev
```

### Testar

```powershell
# Health check
Invoke-RestMethod http://localhost:8000/health

# Testes completos
.\test-dashboard.ps1

# Teste CORS
.\TEST-CORS.ps1

# Teste específico
$headers = @{
    "X-User-Id" = "dev-user"
    "X-User-Role" = "SUPERVISOR"
}
Invoke-RestMethod http://localhost:8000/api/v1/dashboard/metrics -Headers $headers
```

### Gerenciar Portas

```powershell
# Ver processos na porta 8000
netstat -ano | findstr :8000

# Matar processo (substitua <PID>)
taskkill /F /PID <PID>

# Ver todas as portas em uso
netstat -ano | findstr LISTENING
```

### Build e Typecheck

```powershell
# Typecheck (verificar erros TypeScript)
npm run typecheck

# Build
npm run build

# Limpar e reinstalar
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### Logs

```powershell
# Logs aparecem no terminal onde rodou npm run dev
# Ou use:
npm run dev 2>&1 | Tee-Object -FilePath logs.txt
```

---

## 🐧 VPS (Linux)

### PM2 - Gerenciar Serviços

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs

# Ver logs apenas de erros
pm2 logs --err

# Ver logs de serviço específico
pm2 logs wms-api
pm2 logs wms-gateway

# Reiniciar
pm2 restart wms-api
pm2 restart wms-gateway
pm2 restart all

# Parar
pm2 stop wms-api
pm2 stop all

# Deletar
pm2 delete wms-api
pm2 delete all

# Monitorar recursos
pm2 monit

# Ver informações detalhadas
pm2 show wms-api

# Salvar configuração atual
pm2 save

# Logs persistentes
pm2 flush  # Limpar logs
tail -f /home/wms/logs/api-out.log
tail -f /home/wms/logs/api-error.log
```

### Nginx

```bash
# Testar configuração
sudo nginx -t

# Recarregar (sem downtime)
sudo systemctl reload nginx

# Reiniciar
sudo systemctl restart nginx

# Ver status
sudo systemctl status nginx

# Ver logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Ver configuração ativa
sudo nginx -T
```

### Deploy

```bash
# Deploy completo
bash deploy-vps.sh

# Deploy manual passo a passo
cd /home/wms/wms

# Atualizar código
git pull origin main

# Build API
cd api
npm install --production
npm run build
cd ..

# Build Gateway
cd gateway
npm install --production
npm run build
cd ..

# Reiniciar
pm2 restart all
```

### Health Checks

```bash
# Local (no VPS)
curl http://localhost:8000/health
curl http://localhost:3000/health

# Externo (do seu computador)
curl https://api.seudominio.com/health
curl https://gateway.seudominio.com/health

# Com detalhes
curl -v https://api.seudominio.com/health
```

### Sistema

```bash
# Ver uso de recursos
htop  # ou top
df -h  # Espaço em disco
free -h  # Memória

# Ver processos Node.js
ps aux | grep node

# Ver portas abertas
netstat -tulpn | grep LISTEN
ss -tulpn | grep LISTEN

# Ver conexões ativas
netstat -an | grep ESTABLISHED
```

### Firewall (UFW)

```bash
# Ver status
sudo ufw status

# Ver regras numeradas
sudo ufw status numbered

# Permitir porta
sudo ufw allow 8080/tcp

# Remover regra
sudo ufw delete <número>

# Habilitar/desabilitar
sudo ufw enable
sudo ufw disable
```

### SSL/Certbot

```bash
# Renovar certificados (automático a cada 90 dias)
sudo certbot renew

# Testar renovação
sudo certbot renew --dry-run

# Ver certificados instalados
sudo certbot certificates

# Forçar renovação
sudo certbot renew --force-renewal
```

---

## 🔍 Troubleshooting

### Servidor não inicia

```bash
# Ver logs de erro
pm2 logs wms-api --err

# Ver logs completos
pm2 logs wms-api --lines 100

# Executar manualmente para ver erro
cd /home/wms/wms/api
node dist/server.js
```

### "502 Bad Gateway" no Nginx

```bash
# Verificar se backend está rodando
pm2 status
curl http://localhost:8000/health

# Ver logs nginx
sudo tail -f /var/log/nginx/error.log

# Reiniciar tudo
pm2 restart all
sudo systemctl restart nginx
```

### Alta CPU/Memória

```bash
# Ver consumo por processo
pm2 monit

# Ver top consumers
htop

# Reiniciar serviço problemático
pm2 restart wms-api

# Ver logs para identificar problema
pm2 logs wms-api --lines 200
```

### Conexão com SAP falha

```bash
# Testar health check SAP
curl http://localhost:3000/api/sap/health

# Ver logs do gateway
pm2 logs wms-gateway

# Verificar variáveis de ambiente
pm2 show wms-gateway | grep env

# Testar conectividade SAP
curl -v https://seu-sap.com:50000/b1s/v1/
```

---

## 📊 Monitoramento Diário

### Checklist Matinal

```bash
# 1. Status dos serviços
pm2 status

# 2. Health checks
curl http://localhost:8000/health
curl http://localhost:3000/health

# 3. Ver logs recentes
pm2 logs --lines 50

# 4. Uso de recursos
free -h
df -h

# 5. Certificados SSL
sudo certbot certificates | grep -E "(Expiry|Domains)"
```

### Se Tudo OK

```
✅ Serviços online
✅ Health checks 200
✅ Sem erros nos logs
✅ Recursos adequados
✅ SSL válido
```

---

## 🔄 Deploy de Atualização

### Localhost (Desenvolvimento)

```powershell
# Parar servidor (Ctrl+C no terminal)
# Fazer mudanças no código
# Reiniciar
.\START-API.ps1
```

### VPS (Produção)

```bash
# Opção 1: Script automático
bash deploy-vps.sh

# Opção 2: Git + Deploy
git pull origin main
bash deploy-vps.sh

# Opção 3: Zero-downtime reload (futuro)
pm2 reload wms-api
```

---

## 📈 Métricas e Performance

```bash
# PM2 - Ver métricas
pm2 monit

# Ver uptime
pm2 status

# Ver uso de memória
pm2 status | grep -E "(memory|cpu)"

# Logs de performance (quando implementado)
# curl http://localhost:8000/metrics  # Prometheus
```

---

## 🔐 Segurança

```bash
# Ver usuários logados
who
w

# Ver últimos logins
last -n 20

# Ver tentativas de login falhadas
sudo grep "Failed password" /var/log/auth.log | tail -20

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Ver portas expostas externamente
sudo netstat -tulpn | grep LISTEN
```

---

**Referência Rápida**: Mantenha este arquivo aberto enquanto opera o sistema.

**Última atualização**: 2026-02-03
