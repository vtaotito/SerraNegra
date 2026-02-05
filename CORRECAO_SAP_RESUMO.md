# Correção: Frontend usando Mock ao invés de dados reais do SAP

## O que estava errado

### 1. Frontend buildado com URL interna do Docker
No `deploy/docker-compose.yml`, o build do frontend (`web`) usava:
```yaml
VITE_API_BASE_URL: "${VITE_API_BASE_URL:-http://gateway:3000}"
```

O hostname `gateway:3000` é **interno do Docker** → o navegador do usuário não consegue resolver → fetch falha → frontend usa Mock.

### 2. Nginx não roteava `/api` corretamente
O nginx.conf roteava tudo para o gateway, mas o ideal é:
- `/api/*` → gateway (API)
- `/` → web (SPA)

### 3. Worker sem credenciais SAP configuradas
O `docker-compose.yml` tinha variáveis SAP no gateway, mas faltavam no worker.

---

## O que foi corrigido

✅ **`deploy/docker-compose.yml`**:
- `VITE_API_BASE_URL` agora usa **path relativo** (`/api`) em vez de hostname interno
- Worker recebe credenciais SAP (`SAP_BASE_URL`, `SAP_COMPANY_DB`, etc)

✅ **`nginx/nginx.conf`**:
- Rota `/api/` → `gateway:3000`
- Rota `/` → `web:80` (frontend)

✅ **`gateway/Dockerfile`**:
- Copia libs locais (`sap-connector`, `mappings`) para suportar endpoints SAP

✅ **`gateway/src/routes/sap.ts`**:
- Endpoints implementados:
  - `GET /api/sap/health` (testa conexão SAP)
  - `GET /api/sap/orders` (lista pedidos do SAP)
  - `POST /api/sap/sync` (sincroniza pedidos SAP → WMS)

✅ **`deploy/.env.example`**:
- Atualizado para recomendar `VITE_API_BASE_URL=/api`

---

## Como aplicar no servidor

### Passo 1: Commit e push das mudanças (do seu PC)
```bash
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"
git add .
git commit -m "fix: integração SAP - frontend usa API real ao invés de Mock"
git push origin main
```

### Passo 2: No servidor VPS
```bash
# Conectar via SSH
ssh root@REDACTED_VPS_IP

# Ir para o diretório do projeto
cd /opt/wms/current

# Puxar mudanças
git pull origin main

# Validar .env
cat /opt/wms/shared/.env | grep SAP_B1_

# Se estiver faltando, adicionar:
nano /opt/wms/shared/.env
# Adicionar:
# SAP_B1_BASE_URL=https://REDACTED_SAP_HOST:50000
# SAP_B1_COMPANY_DB=REDACTED_COMPANY_DB
# SAP_B1_USERNAME=REDACTED_USER
# SAP_B1_PASSWORD=REDACTED_PASSWORD

# Rodar script de redeploy
bash deploy/redeploy-fix-sap.sh
```

### Passo 3: Validar
Após o redeploy:
```bash
# 1. Health check geral
curl -i http://localhost:8080/health

# 2. Health SAP (testa conexão com SAP)
curl -i http://localhost:8080/api/sap/health

# 3. Listar pedidos da API (WMS Core)
curl -i "http://localhost:8080/api/orders?limit=5"

# 4. Ver logs do worker (sync SAP)
docker compose -f /opt/wms/current/deploy/docker-compose.yml \
  --env-file /opt/wms/shared/.env \
  logs -f worker
```

**No navegador**:
- Abrir: `http://REDACTED_VPS_IP:8080/`
- Verificar no canto inferior: **"Fonte: API"** (não mais "Mock local")
- Ver pedidos no Kanban

---

## Troubleshooting rápido

| Problema | Solução |
|----------|---------|
| Frontend ainda mostra "Mock local" | Rebuild forçado do web: `docker compose build --no-cache web && docker compose up -d web` |
| `/api/sap/health` retorna 503 | Credenciais SAP erradas ou SAP indisponível. Testar login manual. |
| Worker não sincroniza | Ver logs: `docker compose logs worker`. Adicionar `SAP_*` no `.env`. |
| Pedidos não aparecem no painel | Rodar sync manual: `curl -X POST http://localhost:8080/api/sap/sync` |

---

## Arquivos modificados (resumo)

```
deploy/docker-compose.yml         ✅ VITE_API_BASE_URL=/api, SAP vars no worker
deploy/.env.example               ✅ Recomendação de VITE_API_BASE_URL=/api
nginx/nginx.conf                  ✅ Rotas /api e / separadas
gateway/Dockerfile                ✅ Copia sap-connector e mappings
gateway/tsconfig.json             ✅ Include libs locais
deploy/redeploy-fix-sap.sh        ✅ Script de redeploy
docs/VALIDACAO_CADEIA_SAP.md      ✅ Checklist de validação completa
CORRECAO_SAP_RESUMO.md            ✅ Este arquivo (resumo executivo)
```

---

## Próximos passos (após validação)

1. **Trocar botão "Importar do SAP"** no frontend para:
   - Disparar `POST /api/sap/sync`
   - Refetch de `listOrders()` (via `queryClient.invalidateQueries`)
   - Remover estado `sapOrders` separado

2. **Implementar sync incremental no worker**:
   - Salvar cursor (`last_sync_timestamp`) no Core
   - Filtrar pedidos SAP por `UpdateDate > cursor`
   - Sync apenas pedidos modificados/novos

3. **Adicionar webhook SAP → Worker** (opcional):
   - Em vez de polling, receber notificação quando pedido muda
   - Requer configuração no SAP B1 + endpoint no gateway

4. **Observabilidade**:
   - Dashboard Grafana com métricas de sync (pedidos/min, latência SAP, erros)
   - Alertas para falha de sync > 5min

---

## Resumo executivo (TL;DR)

**Problema**: Frontend usava Mock porque `VITE_API_BASE_URL` apontava para hostname interno do Docker.

**Solução**: Ajustado para usar **path relativo** (`/api`), configurado nginx para rotear corretamente, adicionado credenciais SAP no worker.

**Deploy**:
```bash
git pull && bash deploy/redeploy-fix-sap.sh
```

**Validação**:
- `http://REDACTED_VPS_IP:8080/` → deve mostrar **"Fonte: API"**
- `curl http://localhost:8080/api/sap/health` → `{"status": "ok"}`
