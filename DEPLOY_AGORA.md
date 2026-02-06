# 🚀 Deploy Imediato - Correções API e Frontend

**Data**: 2026-02-03  
**Tempo estimado**: 15 minutos  
**Prioridade**: 🔴 URGENTE

---

## ⚡ Quick Start

### 1️⃣ Commit (Seu PC - 2 min)

```bash
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

git add -A
git commit -m "fix: API URL e CORS para produção

- Frontend: path relativo /api (não mais localhost:8000)
- Core: CORS configurado
- docker-compose: usa web-next/Dockerfile

Resolve requisições falhando em produção"

git push origin main
```

### 2️⃣ Deploy (Servidor - 10 min)

```bash
ssh root@31.97.174.120

cd /opt/wms/current
git pull origin main

# Rebuild web + core
docker compose build --no-cache web core

# Restart
docker compose up -d web core

# Ver logs (Ctrl+C para sair)
docker compose logs -f web core
```

### 3️⃣ Testar (Browser - 3 min)

```
1. Abrir: http://31.97.174.120:8080
2. F12 → Network tab
3. Filtrar: fetch
4. Verificar:
   ✅ /api/v1/dashboard/metrics → 200 OK
   ✅ /api/v1/dashboard/orders → 200 OK
   ✅ Dashboard mostra dados
```

---

## ✅ Checklist Rápido

- [ ] Commit + push feito
- [ ] SSH conectado
- [ ] `git pull` executado
- [ ] `docker compose build` concluído
- [ ] `docker compose up -d` executado
- [ ] http://31.97.174.120:8080 carrega
- [ ] Network tab: requisições para `/api/*`
- [ ] Dashboard mostra métricas
- [ ] Console sem erros

---

## 🆘 Se algo falhar

```bash
# Ver logs detalhados
docker compose logs web --tail=100
docker compose logs core --tail=100

# Restart forçado
docker compose down
docker compose up -d

# Testar health
curl http://localhost:8080/health
curl http://localhost:8080/api/health
```

---

## 📄 Documentação Completa

Depois do deploy, ver:
- `CORRECAO_API_URL_COMPLETA.md` - Guia completo (20 min)
- `CORRECAO_FRONTEND_RESUMO.md` - Resumo frontend
- `ANALISE_E2E_ATUALIZADA.md` - Análise completa

---

**Status**: ✅ Pronto para deploy
