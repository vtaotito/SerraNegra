# 🚀 Deploy Imediato - Correção Frontend URLs

**Data**: 2026-02-03  
**Tempo estimado**: 10 minutos  
**Prioridade**: 🔴 URGENTE - Corrige erro `/api/api` duplicado

---

## 🎯 O Que Foi Corrigido

**Problema**: Frontend fazendo requisições com path duplicado:
```
❌ http://YOUR_VPS_IP:8080/api/api/v1/catalog/items
```

**Correção**: Removido rewrite desnecessário no `next.config.ts`
```
✅ http://localhost:8000/api/v1/catalog/items (requisição direta do frontend)
```

---

## ⚡ Quick Start

### 1️⃣ No Seu PC Windows (3 min)

```powershell
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# Criar pacote atualizado
.\package-for-vps.ps1

# Transferir para VPS
scp wms-deploy-*.tar.gz root@YOUR_VPS_IP:/home/wms/
```

### 2️⃣ No VPS (7 min)

```bash
# Conectar ao VPS
ssh root@YOUR_VPS_IP

# Trocar para usuário wms
su - wms

# Extrair código atualizado
cd /home/wms
tar -xzf wms-deploy-*.tar.gz

# Executar correção automática
cd wms
bash fix-frontend-vps.sh
```

**Pronto!** O script `fix-frontend-vps.sh` faz tudo automaticamente:
- ✅ Cria `.env.production` com URL correta
- ✅ Limpa cache
- ✅ Instala dependências
- ✅ Rebuilda frontend
- ✅ Reinicia PM2

### 3️⃣ Testar no Navegador (2 min)

```
1. Abrir: http://YOUR_VPS_IP:8080/produtos
2. F12 → Network tab
3. Verificar:
   ✅ Requisições para: localhost:8000/api/v1/catalog/items
   ✅ Status: 200 OK
   ✅ Produtos aparecem na tela
   ❌ NÃO deve ter /api/api duplicado
```

---

## ✅ Checklist Rápido

- [ ] `package-for-vps.ps1` executado
- [ ] Arquivo `.tar.gz` transferido via SCP
- [ ] SSH conectado ao VPS
- [ ] Código extraído
- [ ] `fix-frontend-vps.sh` executado com sucesso
- [ ] API rodando (porta 8000)
- [ ] Frontend rodando (porta 8080)
- [ ] http://YOUR_VPS_IP:8080/produtos carrega
- [ ] DevTools mostra URLs corretas (sem duplicação)
- [ ] Produtos/Estoque/Pedidos carregam

---

## 📋 Arquivos Modificados

1. ✅ `web-next/next.config.ts` - Rewrite removido quando API_BASE_URL definido
2. ✅ `web-next/.env.production` - Criado com `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
3. ✅ `fix-frontend-vps.sh` - Script automático de correção
4. ✅ `FIX-RAPIDO.md` - Guia de correção rápida
5. ✅ `FIX-FRONTEND-URLS.md` - Documentação completa
6. ✅ `test-vps-urls.ps1` - Script de teste (Windows)

---

## 🆘 Se Algo Falhar

### Erro: "Network Error" ou "ERR_CONNECTION_REFUSED"

```bash
# No VPS, verificar se API está rodando
curl http://localhost:8000/health

# Se não responder, iniciar API
pm2 list
pm2 start ecosystem.config.js
# ou
cd /home/wms/wms/api && npm run dev
```

### Erro: URLs ainda com `/api/api`

```bash
# No VPS, rebuild completo
cd /home/wms/wms/web-next
rm -rf .next node_modules
npm install
npm run build
pm2 restart web-next

# Limpar cache do navegador (Ctrl+Shift+Del)
```

### Erro: "404 Not Found"

```bash
# Verificar logs
pm2 logs web-next --lines 50
pm2 logs wms-api --lines 50

# Verificar se serviços estão rodando
pm2 status
netstat -tlnp | grep :8000
netstat -tlnp | grep :8080
```

### Ver Logs Detalhados

```bash
# Logs do Frontend
pm2 logs web-next --lines 100

# Logs da API
pm2 logs wms-api --lines 100

# Reiniciar tudo
pm2 restart all
```

---

## 🧪 Testes Manuais

### Teste 1: API Diretamente

```bash
# No VPS
curl http://localhost:8000/health

curl -H "X-User-Id: dev-user" \
     -H "X-User-Role: SUPERVISOR" \
     http://localhost:8000/api/v1/catalog/items?limit=5
```

Deve retornar dados JSON.

### Teste 2: Frontend

Navegador: `http://YOUR_VPS_IP:8080/produtos`

- Abrir DevTools (F12)
- Aba Network
- Ver requisições:
  - URL: `http://localhost:8000/api/v1/catalog/items?limit=50`
  - Status: 200
  - Response: Array de produtos

---

## 🎯 Alternativa: Deploy via Docker

Se preferir usar Docker em vez de PM2:

```bash
# No VPS
cd /home/wms/wms

# Build
docker compose build web core

# Restart
docker compose up -d web core

# Logs
docker compose logs -f web core
```

---

## 📄 Documentação Adicional

- **Correção rápida**: `FIX-RAPIDO.md`
- **Correção detalhada**: `FIX-FRONTEND-URLS.md`
- **Scripts de teste**: `test-vps-urls.ps1`
- **Deploy completo**: `DEPLOY-LOCALHOST-VPS.md`
- **Comandos úteis**: `COMANDOS-UTEIS.md`

---

## 📊 Status dos Serviços

Após deploy, verificar:

```bash
# PM2
pm2 status

# Deve mostrar:
# wms-api    │ online
# wms-gateway│ online (se configurado)
# web-next   │ online

# Portas
netstat -tlnp | grep -E ":(8000|8080|3000)"
```

---

## ✅ Conclusão

Após seguir estes passos:

1. ✅ URLs corretas (sem `/api/api`)
2. ✅ Frontend faz requisições diretas para API
3. ✅ CORS configurado corretamente
4. ✅ Produtos, Estoque e Pedidos carregam

**Tempo total**: ~10 minutos

---

**Status**: ✅ Pronto para deploy  
**Última atualização**: 2026-02-03 - Correção URLs duplicadas
