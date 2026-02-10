# 🔧 Correção de URLs do Frontend

## 🎯 Problema Identificado

O frontend em `http://YOUR_VPS_IP:8080/` estava fazendo requisições para:
```
http://YOUR_VPS_IP:8080/api/api/v1/catalog/items  ❌
```

### Problemas:

1. **Path duplicado**: `/api/api` em vez de `/api`
2. **URL errada**: Frontend fazendo requisição para si mesmo (porta 8080) em vez da API (porta 8000)
3. **localhost não funciona**: Frontend está em VPS, mas tentando acessar `localhost:8000`

---

## ✅ Correções Aplicadas

### 1. Corrigido `next.config.ts`

**Antes:**
```typescript
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/:path*`
      // Isso duplicava o /api!
    }
  ];
}
```

**Depois:**
```typescript
async rewrites() {
  // Se API_BASE_URL definido, não usar rewrite
  // (axios faz requisição direta)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return [];
  }
  
  // Apenas para produção sem API_BASE_URL
  return [
    {
      source: "/api/:path*",
      destination: "http://gateway:3000/:path*"
    }
  ];
}
```

---

## 🎯 Configurações por Ambiente

### Cenário 1: Frontend e API no Mesmo Computador (Desenvolvimento)

**Situação**: Desenvolvendo localmente no Windows

**Configuração**: `web-next/.env.local`
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Fluxo**:
```
Frontend (localhost:3000 ou 8080)
  ↓ axios requisição
API Core (localhost:8000)
```

**Como testar**:
```powershell
# Terminal 1: API
cd api
npm run dev

# Terminal 2: Frontend
cd web-next
npm run dev

# Acessar: http://localhost:3000
```

---

### Cenário 2: Frontend no VPS, API no VPS (Produção)

**Situação**: Ambos rodando no mesmo VPS (YOUR_VPS_IP)

**Configuração**: `web-next/.env.production`
```bash
# API está no mesmo servidor (localhost para o VPS)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Fluxo**:
```
VPS (YOUR_VPS_IP)
├── Frontend Next.js (porta 8080)
│    ↓ http://localhost:8000
└── API Core (porta 8000)
```

**Deploy no VPS**:
```bash
# No VPS
cd /home/wms/wms

# Build frontend
cd web-next
npm install
npm run build
npm start  # Ou usar PM2

# API já está rodando via PM2
pm2 status
```

---

### Cenário 3: Frontend no VPS, API em Outro VPS (Distribuído)

**Situação**: Frontend e API em servidores diferentes

**Configuração**: `web-next/.env.production`
```bash
# API está em outro servidor
NEXT_PUBLIC_API_BASE_URL=https://api.seudominio.com
```

**Fluxo**:
```
Frontend VPS (YOUR_VPS_IP:8080)
  ↓ HTTPS
API VPS (outro-ip) via Nginx + SSL
```

---

### Cenário 4: Frontend no VPS, API no Computador Local (Não Recomendado)

**Situação**: Isso NÃO funciona por padrão (rede privada + CORS)

**Problema**: VPS não consegue acessar `localhost` do seu computador

**Soluções**:

#### Opção A: Túnel SSH (Temporário)
```bash
# No seu computador Windows
ssh -R 8000:localhost:8000 wms@YOUR_VPS_IP
```

Isso expõe seu `localhost:8000` no VPS.

#### Opção B: Ngrok (Desenvolvimento)
```powershell
# No Windows
ngrok http 8000
# Copia URL: https://xxxx.ngrok.io
```

No VPS:
```bash
NEXT_PUBLIC_API_BASE_URL=https://xxxx.ngrok.io
```

#### Opção C: Colocar API também no VPS (Recomendado)
```bash
# Deploy completo no VPS
bash setup-vps.sh
bash deploy-vps.sh
```

---

## 🚀 Solução Recomendada para Seu Caso

Como seu frontend está em `http://YOUR_VPS_IP:8080/`, você tem 2 opções:

### Opção A: Deploy Completo no VPS (Recomendado)

```bash
# 1. SSH no VPS
ssh root@YOUR_VPS_IP

# 2. Setup (se ainda não fez)
bash setup-vps.sh

# 3. Transferir código
# No Windows:
.\package-for-vps.ps1
scp wms-deploy-*.tar.gz root@YOUR_VPS_IP:/home/wms/

# 4. Deploy no VPS
ssh wms@YOUR_VPS_IP
cd /home/wms
tar -xzf wms-deploy-*.tar.gz
cd wms
bash deploy-vps.sh

# 5. Verificar
curl http://localhost:8000/health
pm2 status
```

Depois, no frontend no VPS:
```bash
# web-next/.env.production
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Opção B: Expor API do Windows para VPS (Temporário)

```powershell
# No Windows, criar túnel SSH reverso
ssh -R 8000:localhost:8000 wms@YOUR_VPS_IP

# Manter este terminal aberto
```

No VPS, configurar frontend:
```bash
# No VPS
cd /home/wms/wms/web-next
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.production
pm2 restart web-next
```

---

## 📋 Checklist de Correção

- [x] Corrigido `next.config.ts` (removido rewrite quando API_BASE_URL definido)
- [ ] Decidir onde rodar API (Windows local ou VPS)
- [ ] Configurar `.env.production` no frontend
- [ ] Reiniciar frontend: `pm2 restart web-next` (se no VPS)
- [ ] Testar: acessar `http://YOUR_VPS_IP:8080/produtos`
- [ ] Verificar DevTools > Network para confirmar URLs corretas

---

## 🧪 Testar Após Correção

### No VPS (se API também estiver no VPS)

```bash
# Health check API
curl http://localhost:8000/health

# Health check Frontend
curl http://localhost:8080  # Ou porta que o Next.js usa

# Testar endpoint direto
curl -H "X-User-Id: dev-user" \
     -H "X-User-Role: SUPERVISOR" \
     http://localhost:8000/api/v1/catalog/items?limit=10
```

### No Navegador

1. Abrir: `http://YOUR_VPS_IP:8080/produtos`
2. Abrir DevTools (F12) > Network
3. Ver requisições para `/api/v1/catalog/items`
4. Verificar:
   - URL correta (sem duplicação)
   - Status 200
   - Dados retornados

---

## 🔍 Debugging

### Ver qual URL está sendo chamada

No navegador (DevTools > Network):
- Olhar coluna "Name"
- Clicar na requisição
- Ver "Headers" > "General" > "Request URL"

Deve ser:
```
✅ http://localhost:8000/api/v1/catalog/items?limit=50
```

Não deve ser:
```
❌ http://YOUR_VPS_IP:8080/api/api/v1/catalog/items
❌ http://localhost:8000/api/api/v1/catalog/items
```

### Se ainda estiver errado

```bash
# No VPS, reconstruir frontend
cd /home/wms/wms/web-next
npm run build
pm2 restart web-next

# Limpar cache do navegador
# Ctrl+Shift+Del > Limpar tudo
```

---

## 📝 Arquivos Alterados

- ✅ `web-next/next.config.ts` - Corrigido rewrite
- 📝 `web-next/.env.production` - Você precisa criar/ajustar

---

## ⚡ Ação Imediata

**Se API e Frontend estão no mesmo VPS:**

```bash
# No VPS
cd /home/wms/wms/web-next

# Criar/editar .env.production
cat > .env.production <<EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEV_USER_ID=dev-user
NEXT_PUBLIC_DEV_USER_ROLE=SUPERVISOR
NEXT_PUBLIC_DEV_USER_NAME=Usuário Dev
EOF

# Rebuild
npm run build

# Reiniciar (se usando PM2)
pm2 restart web-next

# Ou iniciar
npm start
```

**Se API está no Windows e Frontend no VPS:**

Não é recomendado. Melhor fazer deploy completo no VPS.

---

**Status**: ✅ Correção aplicada  
**Próximo**: Configurar `.env.production` e reiniciar frontend  
**Última atualização**: 2026-02-03
