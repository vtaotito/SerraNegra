# 🌐 URLs de Acesso - WMS Platform

## 📊 DASHBOARD WMS/OMS (Next.js)

### ✅ PRODUÇÃO (Use este!)
```
http://REDACTED_VPS_IP:8080
```
**Frontend**: Next.js 16 + React 19 + shadcn/ui  
**Features**: Dashboard, Pedidos, Produtos, Estoque, Integração

### 💻 LOCALHOST (Desenvolvimento)
```
http://localhost:3002
```
**Iniciar**: `cd web-next && npm run dev`

---

## 🔌 APIs

| Endpoint | Localhost | Produção |
|----------|-----------|----------|
| **Health Check** | http://localhost:3000/health | http://REDACTED_VPS_IP:8080/health |
| **Listar Pedidos** | http://localhost:3000/api/orders | http://REDACTED_VPS_IP:8080/api/orders |
| **SAP Health** | http://localhost:3000/api/sap/health | http://REDACTED_VPS_IP:8080/api/sap/health |
| **SAP Sync** | POST http://localhost:3000/api/sap/sync | POST http://REDACTED_VPS_IP:8080/api/sap/sync |

---

## 🚀 Acesso Rápido

### Ver Kanban em Produção
1. Abrir navegador
2. Ir para: **http://REDACTED_VPS_IP:8080**
3. ✅ Verificar: deve mostrar **"Fonte: API"**

### Acessar Servidor SSH
```bash
ssh root@REDACTED_VPS_IP
cd /opt/wms/current
docker compose logs -f
```

### Iniciar Localhost
```bash
# Windows (prompt de comando)
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# Terminal 1: Backend
npm run dev:core

# Terminal 2: Gateway  
cd gateway && npm run dev

# Terminal 3: Frontend
cd web && npm run dev

# Abrir: http://localhost:5173
```

---

## 📱 Bookmarks Recomendados

Salvar no navegador:

1. **Kanban Produção**: http://REDACTED_VPS_IP:8080
2. **API Health**: http://REDACTED_VPS_IP:8080/health
3. **SAP Status**: http://REDACTED_VPS_IP:8080/api/sap/health
4. **Kanban Local**: http://localhost:5173

---

## 🆘 Troubleshooting Rápido

**Kanban não carrega?**
```bash
ssh root@REDACTED_VPS_IP
docker compose ps
docker compose logs web
```

**Mostra "Mock local"?**
```bash
docker compose restart web
# Aguardar 10s e F5 no browser
```

**API não responde?**
```bash
curl http://REDACTED_VPS_IP:8080/health
docker compose logs gateway
```

---

**Criado**: 2026-02-03  
**Arquivo completo**: GUIA_ACESSO_RAPIDO.md
