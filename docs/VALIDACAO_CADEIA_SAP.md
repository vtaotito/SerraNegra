# Validação da Cadeia Completa: SAP → Worker → Core → Gateway → Web

## Objetivo
Garantir que os pedidos do SAP B1 apareçam no painel WMS via sincronização automática.

## Fluxo completo
```
SAP B1 Service Layer
  ↓ (polling a cada 30s)
Worker (sync job)
  ↓ POST /internal/sap/orders
Core (FastAPI + Postgres)
  ↓ GET /orders
Gateway (Node/TS)
  ↓ GET /api/orders
Web (React) - Dashboard Kanban
```

## Checklist de validação (passo a passo)

### 1. SAP B1 Service Layer (fonte de verdade)
**Teste manual (fora do sistema)**:
```bash
# Login
curl -X POST https://your-sap-server:50000/b1s/v1/Login \
  -H "Content-Type: application/json" \
  -d '{
    "CompanyDB": "YOUR_COMPANY_DB",
    "UserName": "your_username",
    "Password": "your_password"
  }'
```

Espera: `200 OK` + cookies (SessionId).

**Listar pedidos**:
```bash
curl -X GET "https://your-sap-server:50000/b1s/v1/Orders?\$top=5&\$select=DocEntry,DocNum,CardCode" \
  -H "Cookie: B1SESSION=<session_id>" \
  -H "X-Correlation-Id: test-manual-$(date +%s)"
```

Espera: `200 OK` + array com `value: [ { DocEntry, DocNum, CardCode, ... } ]`.

---

### 2. Worker (sync job)
**No servidor (via docker compose)**:
```bash
cd /opt/wms/current
docker compose -f deploy/docker-compose.yml --env-file /opt/wms/shared/.env logs -f worker
```

Espera ver logs:
```json
{"service":"wms-worker","level":"info","msg":"Worker iniciado.","intervalSeconds":30,"sapConfigured":true}
{"service":"wms-worker","correlationId":"...","msg":"Iniciando sync SAP -> Core."}
{"service":"wms-worker","correlationId":"...","msg":"Core sync respondeu.","status":200}
```

**Se aparecer erro "SAP não configurado"**: ajuste `/opt/wms/shared/.env` com `SAP_B1_*`.

---

### 3. Core (FastAPI + Postgres)
**Teste direto**:
```bash
curl -i http://localhost:8000/health
curl -i "http://localhost:8000/orders?limit=5" \
  -H "X-Correlation-Id: test-core-$(date +%s)"
```

Espera: `200 OK` + `{"items": [...], "nextCursor": null}`.

**Validar que pedidos SAP foram sincronizados**:
```bash
curl -s "http://localhost:8000/orders" | jq '.items[] | {orderId, externalOrderId, status, sapDocEntry}'
```

Espera ver pedidos com `sapDocEntry` (número do SAP) e `status: "A_SEPARAR"`.

---

### 4. Gateway (Node/TS)
**Teste endpoints**:
```bash
# Health
curl -i http://localhost:3000/health

# Listar pedidos (proxy para o core)
curl -i "http://localhost:3000/orders?limit=5" \
  -H "X-Correlation-Id: test-gw-$(date +%s)"

# Health SAP
curl -i http://localhost:3000/api/sap/health

# Listar pedidos do SAP (direto do SAP via gateway)
curl -i "http://localhost:3000/api/sap/orders?limit=5"
```

Espera:
- `/health` → `200 OK {"ok": true}`
- `/orders` → `200 OK {"items": [...]}`
- `/api/sap/health` → `200 OK {"status": "ok", "message": "Conexão com SAP OK"}`
- `/api/sap/orders` → `200 OK {"items": [...], "count": N}`

---

### 5. Nginx (reverse proxy)
**Do servidor ou do seu PC**:
```bash
# Health do nginx
curl -i http://YOUR_VPS_IP:8080/health

# API via nginx (rota /api)
curl -i "http://YOUR_VPS_IP:8080/api/orders?limit=5"

# Frontend via nginx (rota /)
curl -i http://YOUR_VPS_IP:8080/
```

Espera:
- `/health` → `200 OK "ok"`
- `/api/orders` → `200 OK {"items": [...]}`
- `/` → `200 OK` (HTML do SPA)

---

### 6. Web (React - Dashboard Kanban)
**No navegador**:
- Abra `http://YOUR_VPS_IP:8080/`
- Veja no canto inferior: `Fonte: API` (não mais "Mock local")
- Veja pedidos no Kanban

**DevTools (Console)**:
- Abrir Network → procurar request para `/api/orders`
- Status deve ser `200 OK`
- Response: `{"items": [...], "nextCursor": null}`

**Se ainda aparecer "Mock local"**:
- Frontend foi buildado com `VITE_API_BASE_URL` errado.
- Reconstrua o web com build arg correto:
  ```bash
  cd /opt/wms/current
  docker compose -f deploy/docker-compose.yml --env-file /opt/wms/shared/.env build web
  docker compose -f deploy/docker-compose.yml --env-file /opt/wms/shared/.env up -d web
  ```

---

## Troubleshooting rápido

| Problema | Causa | Solução |
|----------|-------|---------|
| Frontend usa Mock | `VITE_API_BASE_URL` vazio ou errado no build | Ajustar `.env` e rebuild web |
| `/api/orders` retorna 502/503 | Gateway ou Core não está rodando | Ver logs: `docker compose logs gateway core` |
| `/api/sap/health` retorna 503 | Credenciais SAP erradas ou SAP indisponível | Verificar `SAP_B1_*` no `.env` e testar login manual |
| Worker não sincroniza | Variáveis SAP não estão no worker | Adicionar `SAP_BASE_URL` etc no `.env` e restart worker |
| Pedidos aparecem mas sem dados SAP | Sync não rodou ainda ou falhou | Ver logs do worker e rodar sync manual via `/api/sap/sync` |

---

## Teste end-to-end rápido
1. **No servidor**: `docker compose -f /opt/wms/current/deploy/docker-compose.yml --env-file /opt/wms/shared/.env ps`
   - Todos devem estar `Up (healthy)`.
2. **Trigger sync manual** (do seu PC ou servidor):
   ```bash
   curl -X POST http://YOUR_VPS_IP:8080/api/sap/sync \
     -H "Content-Type: application/json" \
     -H "X-Correlation-Id: manual-sync-$(date +%s)"
   ```
3. **Abrir painel**: `http://YOUR_VPS_IP:8080/`
4. **Verificar "Fonte: API"** e pedidos no Kanban.

---

## Próximo passo (após validação)
- Trocar botão "Importar do SAP" para apenas disparar `/api/sap/sync` e refetch, sem manter `sapOrders` separado.
- Implementar delta incremental no worker (cursor por `UpdateDate/UpdateTime`).
