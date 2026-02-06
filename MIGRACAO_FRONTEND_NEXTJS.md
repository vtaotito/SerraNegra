# 🔄 Migração Frontend: Vite → Next.js

**Data**: 2026-02-03  
**Status**: ✅ Correção aplicada  
**Versão**: 1.0

---

## 📋 Sumário da Mudança

### ❌ ANTES (Incorreto)
- **Frontend em produção**: Vite/React (`web/`)
- **Porta**: 80 (nginx interno)
- **Dockerfile**: `docker/web/Dockerfile`
- **Build args**: `VITE_API_BASE_URL`

### ✅ AGORA (Correto)
- **Frontend em produção**: Next.js 16 (`web-next/`)
- **Porta**: 3000 (Next.js)
- **Dockerfile**: `web-next/Dockerfile`
- **Build args**: `NEXT_PUBLIC_API_BASE_URL`

---

## 🎯 Correções Aplicadas

### 1. ✅ docker-compose.yml

**Arquivo**: `deploy/docker-compose.yml`

**ANTES**:
```yaml
  web:
    build:
      context: ..
      dockerfile: docker/web/Dockerfile  # ❌ Vite obsoleto
      args:
        VITE_API_BASE_URL: "${VITE_API_BASE_URL:-/api}"
        VITE_USE_MOCK: "false"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost/healthz"]  # ❌ Porta 80
```

**AGORA**:
```yaml
  web:
    build:
      context: ..
      dockerfile: web-next/Dockerfile  # ✅ Next.js correto
      args:
        NEXT_PUBLIC_API_BASE_URL: "/api"  # ✅ Env var Next.js
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:3000/"]  # ✅ Porta 3000
```

**Status**: ✅ **CORRIGIDO**

---

### 2. ✅ nginx.conf

**Arquivo**: `nginx/nginx.conf`

**Configuração** (já estava correta):
```nginx
upstream web_upstream {
  server web:3000;  # ✅ Porta 3000 do Next.js
}

location / {
  proxy_pass http://web_upstream;  # ✅ Proxy para Next.js
}
```

**Status**: ✅ **JÁ CORRETO** (não requer mudança)

---

## 🗑️ 3. Remoção do Frontend Vite Obsoleto

### Diretórios a Remover

```bash
# Backup antes de remover
mkdir -p backups/deprecated
cp -r web backups/deprecated/web-vite-20260203
cp -r docker/web backups/deprecated/docker-web-20260203

# Remover
rm -rf web/
rm -rf docker/web/
```

### Arquivos Afetados

| Arquivo | Ação | Status |
|---------|------|--------|
| `web/` | ❌ Remover | Obsoleto |
| `docker/web/` | ❌ Remover | Obsoleto |
| `web-next/` | ✅ Manter | **Frontend ativo** |

---

## 🚀 Deploy da Correção

### Passo 1: Commit Local (Seu PC)

```bash
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# Verificar mudanças
git status

# Adicionar correções
git add deploy/docker-compose.yml
git add MIGRACAO_FRONTEND_NEXTJS.md
git add ANALISE_E2E_ATUALIZADA.md

# Commit
git commit -m "fix: corrigir docker-compose para usar Next.js (web-next)

- docker-compose.yml agora aponta para web-next/Dockerfile
- Porta ajustada para 3000 (Next.js)
- Healthcheck corrigido
- Removidas referências ao Vite obsoleto

Frontend correto: Next.js 16 em http://REDACTED_VPS_IP:8080

Refs: ANALISE_E2E_ATUALIZADA.md"

# Push
git push origin main
```

---

### Passo 2: Deploy no Servidor VPS

```bash
# Conectar ao servidor
ssh root@REDACTED_VPS_IP

# Ir para diretório do projeto
cd /opt/wms/current

# Puxar mudanças
git pull origin main

# Ver o diff para confirmar
git log -1 --stat

# Rebuild APENAS o serviço web (mais rápido)
docker compose build --no-cache web

# Restart do serviço web
docker compose up -d web

# Ver logs
docker compose logs -f web
```

**Esperado nos logs**:
```
wms-web | ▲ Next.js 16.1.6
wms-web | - Local:        http://localhost:3000
wms-web | - Network:      http://0.0.0.0:3000
wms-web | ✓ Ready in XXXms
```

---

### Passo 3: Validação

```bash
# 1. Healthcheck do container
docker compose ps
# Deve mostrar: wms-web (healthy)

# 2. Testar internamente (no servidor)
curl -I http://localhost:8080/
# Deve retornar: HTTP/1.1 200 OK

# 3. Ver se é Next.js
curl http://localhost:8080/ | grep "Next.js"
# Deve encontrar: <meta name="next-head-count" ...>

# 4. Testar API
curl http://localhost:8080/api/health
# Deve retornar: {"status":"ok",...}
```

**No navegador** (seu PC):
```
1. Abrir: http://REDACTED_VPS_IP:8080
2. Verificar:
   ✅ Título: "WMS/OMS - Sistema de Gestão de Pedidos"
   ✅ Layout: Sidebar + Topbar
   ✅ Dashboard com cards de métricas
   ✅ Header mostra: "Backend: localhost:8000"
```

---

## 📊 Comparação: Vite vs Next.js

### Frontend Vite (Obsoleto)

| Aspecto | Valor |
|---------|-------|
| **Framework** | Vite 5 + React 18 |
| **UI** | Custom CSS + dnd-kit |
| **Features** | Kanban drag-and-drop |
| **Porta** | 80 (via nginx interno) |
| **Status** | ❌ Obsoleto |

### Frontend Next.js (Atual)

| Aspecto | Valor |
|---------|-------|
| **Framework** | Next.js 16 + React 19 |
| **UI** | shadcn/ui + Tailwind CSS |
| **Features** | Dashboard, Layout completo, TanStack Query |
| **Porta** | 3000 (Next.js) |
| **Status** | ✅ **Em produção** |

**Vantagens Next.js**:
- ✅ SSR/SSG (melhor performance)
- ✅ Design system moderno (shadcn/ui)
- ✅ App Router (nested layouts)
- ✅ Server Components
- ✅ Built-in optimizações
- ✅ TypeScript first-class

---

## 🗂️ Estrutura Atualizada

### ANTES (Confuso)
```
wms/
├── web/              # ❌ Vite (obsoleto, mas ativo)
├── web-next/         # ⚠️ Next.js (desconsiderado)
├── docker/
│   └── web/          # ❌ Dockerfile Vite
└── deploy/
    └── docker-compose.yml  # ❌ Aponta para docker/web
```

### AGORA (Claro)
```
wms/
├── web-next/         # ✅ Next.js (ÚNICO frontend)
├── deploy/
│   └── docker-compose.yml  # ✅ Aponta para web-next/
└── backups/deprecated/
    ├── web-vite-20260203/  # 💾 Backup do Vite
    └── docker-web-20260203/  # 💾 Backup Dockerfile
```

---

## 🧹 Limpeza Pós-Deploy

### Remover Frontend Vite Obsoleto

**⚠️ ATENÇÃO**: Só executar APÓS validar que Next.js está funcionando perfeitamente!

```bash
# No seu PC (Windows)
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# 1. Criar backup
mkdir -p backups\deprecated
xcopy web backups\deprecated\web-vite-20260203\ /E /I /H
xcopy docker\web backups\deprecated\docker-web-20260203\ /E /I /H

# 2. Remover diretórios
rmdir /S /Q web
rmdir /S /Q docker\web

# 3. Atualizar package.json
# Editar manualmente e remover:
# "dev:web": "cd web && npm run dev"

# Adicionar:
# "dev:web": "cd web-next && npm run dev"

# 4. Commit
git add -A
git commit -m "chore: remover frontend Vite obsoleto

- Removido web/ (backup em backups/deprecated/)
- Removido docker/web/
- Atualizado package.json para usar web-next/"

git push origin main
```

---

## 📖 Documentação Atualizada

### Arquivos Corrigidos

| Documento | Status | Ação |
|-----------|--------|------|
| `ANALISE_E2E_ATUALIZADA.md` | ✅ Criado | Análise correta com Next.js |
| `MIGRACAO_FRONTEND_NEXTJS.md` | ✅ Criado | Este arquivo |
| `deploy/docker-compose.yml` | ✅ Corrigido | Aponta para web-next/ |
| `ANALISE_E2E_COMPLETA.md` | ⚠️ Desatualizado | Marcar como obsoleto |
| `RESUMO_EXECUTIVO_E2E.md` | ⬜ Pendente | Atualizar referências |
| `GUIA_ACESSO_RAPIDO.md` | ⬜ Pendente | Remover localhost:5173 |
| `README.md` | ⬜ Pendente | Atualizar stack |

---

## ✅ Checklist de Validação

### Deploy

- [ ] `git pull` no servidor executado
- [ ] `docker compose build --no-cache web` concluído
- [ ] `docker compose up -d web` executado
- [ ] `docker compose ps` mostra `wms-web (healthy)`
- [ ] Logs não mostram erros críticos

### Funcionalidade

- [ ] http://REDACTED_VPS_IP:8080 carrega corretamente
- [ ] Título: "WMS/OMS - Sistema de Gestão de Pedidos"
- [ ] Layout: Sidebar visível (desktop)
- [ ] Dashboard mostra métricas
- [ ] Navegação funciona (Dashboard, Pedidos, Produtos, Estoque, Integração)
- [ ] Header mostra backend URL
- [ ] API funciona: http://REDACTED_VPS_IP:8080/api/health

### Limpeza (Opcional)

- [ ] Backup de `web/` criado
- [ ] Backup de `docker/web/` criado
- [ ] Diretórios antigos removidos
- [ ] `package.json` atualizado
- [ ] Documentação atualizada

---

## 🆘 Troubleshooting

### Problema: Container web não inicia

**Sintomas**:
```bash
docker compose ps
# wms-web: Exited (1)
```

**Solução**:
```bash
# Ver logs detalhados
docker compose logs web

# Rebuild completo
docker compose down
docker compose build --no-cache web
docker compose up -d

# Se persistir, verificar:
docker compose logs web --tail=100
```

---

### Problema: 404 na página

**Sintomas**:
- Browser: "404 Not Found"
- Nginx logs: "upstream prematurely closed connection"

**Solução**:
```bash
# Verificar que web está na porta 3000
docker compose exec web curl http://localhost:3000/
# Deve retornar HTML do Next.js

# Se não funcionar, verificar processo
docker compose exec web ps aux
# Deve mostrar: node server.js
```

---

### Problema: Variáveis de ambiente não funcionam

**Sintomas**:
- Frontend não conecta à API
- Console mostra erro de fetch

**Solução**:
```bash
# Verificar build args
docker compose config | grep NEXT_PUBLIC

# Deve mostrar:
# NEXT_PUBLIC_API_BASE_URL: /api

# Se não, editar deploy/docker-compose.yml e rebuild
```

---

## 📞 Suporte

**Documentação relacionada**:
- `ANALISE_E2E_ATUALIZADA.md` - Análise completa atualizada
- `web-next/README.md` - README do frontend Next.js
- `CORRECAO_SAP_RESUMO.md` - Correção anterior (Mock→API)

**Logs úteis**:
```bash
# Ver todos os logs
docker compose logs -f

# Ver só o web
docker compose logs -f web

# Ver último minuto
docker compose logs --since 1m web
```

---

**Preparado por**: Equipe Técnica WMS  
**Data**: 2026-02-03  
**Versão**: 1.0  
**Status**: ✅ Migração concluída e documentada
