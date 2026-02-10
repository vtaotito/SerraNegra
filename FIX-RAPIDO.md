# 🚀 Correção Rápida - Frontend no VPS

## ⚡ Problema

Frontend em `http://YOUR_VPS_IP:8080/` fazendo requisições erradas:
```
❌ http://YOUR_VPS_IP:8080/api/api/v1/catalog/items
```

---

## ✅ Solução

### No seu Windows (onde está o código)

```powershell
# 1. Transferir código atualizado para VPS
.\package-for-vps.ps1

# 2. Enviar para VPS
scp wms-deploy-*.tar.gz root@YOUR_VPS_IP:/home/wms/
```

### No VPS

```bash
# 1. SSH no servidor
ssh root@YOUR_VPS_IP

# 2. Extrair código atualizado
su - wms
cd /home/wms
tar -xzf wms-deploy-*.tar.gz

# 3. Executar script de correção
cd wms
bash fix-frontend-vps.sh
```

**Pronto!** 🎉

---

## 🧪 Testar

### Teste 1: API funcionando

```bash
curl http://localhost:8000/health
```

Deve retornar:
```json
{"status":"ok","timestamp":"..."}
```

### Teste 2: Endpoint com dados

```bash
curl -H "X-User-Id: dev-user" \
     -H "X-User-Role: SUPERVISOR" \
     http://localhost:8000/api/v1/catalog/items?limit=5
```

Deve retornar lista de produtos.

### Teste 3: Frontend no navegador

1. Acessar: `http://YOUR_VPS_IP:8080/produtos`
2. Abrir DevTools (F12) > Network
3. Verificar requisições:
   - URL deve ser: `http://localhost:8000/api/v1/catalog/items`
   - Status: 200
   - Produtos devem aparecer na tela

---

## 🔍 Se Ainda Houver Erro

### Erro: "Network Error" ou "ERR_CONNECTION_REFUSED"

**Causa**: API não está rodando

```bash
# No VPS
pm2 list

# Se API não estiver rodando:
cd /home/wms/wms/api
npm run dev

# Ou com PM2:
pm2 start ecosystem.config.js
pm2 save
```

### Erro: "404 Not Found"

**Causa**: Rota não existe ou frontend não reconstruído

```bash
# No VPS
cd /home/wms/wms/web-next
rm -rf .next
npm run build
pm2 restart web-next
```

### Erro: "CORS Error"

**Causa**: CORS não configurado (já deve estar corrigido)

```bash
# Verificar se @fastify/cors está instalado
cd /home/wms/wms/api
npm list @fastify/cors

# Se não estiver:
npm install @fastify/cors
pm2 restart wms-api
```

### Erro: URL ainda com `/api/api`

**Causa**: Código antigo ainda em uso

```bash
# Limpar tudo e rebuild
cd /home/wms/wms/web-next
rm -rf .next node_modules
npm install
npm run build
pm2 restart web-next

# Limpar cache do navegador (Ctrl+Shift+Del)
```

---

## 📋 Checklist

- [ ] Código atualizado transferido para VPS
- [ ] Script `fix-frontend-vps.sh` executado
- [ ] API rodando (porta 8000)
- [ ] Frontend buildado
- [ ] PM2 reiniciado
- [ ] Teste no navegador OK
- [ ] DevTools mostra URLs corretas

---

## 📝 Arquivos Alterados

1. `web-next/next.config.ts` - Rewrite corrigido ✅
2. `web-next/.env.production` - Criado ✅
3. `fix-frontend-vps.sh` - Script automático ✅

---

## 🆘 Suporte

Se nada funcionar, verifique logs:

```bash
# Logs da API
pm2 logs wms-api

# Logs do Frontend
pm2 logs web-next

# Ou se rodando manualmente:
cd /home/wms/wms/api
npm run dev  # Ver erros no console
```

---

**Tempo estimado**: 5-10 minutos  
**Última atualização**: 2026-02-03
