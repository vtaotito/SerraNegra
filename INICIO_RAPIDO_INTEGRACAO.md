# 🚀 Início Rápido: Página de Integração SAP B1

## 🎯 O Que Foi Criado

Frontend completo para gerenciar a integração com SAP Business One.

**URL**: `http://YOUR_VPS_IP:8080/integracao`

---

## ⚡ Deploy em 3 Comandos

### No servidor (VPS):

```bash
# 1. Parar, rebuild e subir
cd /root/wms
docker-compose -f deploy/docker-compose.yml down web gateway
docker-compose -f deploy/docker-compose.yml build web gateway
docker-compose -f deploy/docker-compose.yml up -d web gateway

# 2. Verificar logs
docker logs -f wms-web
# Ctrl+C para sair

# 3. Acessar
# http://YOUR_VPS_IP:8080/integracao
```

---

## 📱 Como Usar

### 1️⃣ Primeira Vez (Configurar SAP)

1. Acesse: `http://YOUR_VPS_IP:8080/integracao`
2. Clique na aba **"Configuração"**
3. Preencha:
   ```
   Service Layer URL: https://your-sap-server:50000
   Company Database: SBO_GARRAFARIASNEGRA
   Usuário: <seu_usuario_sap>
   Senha: <sua_senha_sap>
   ```
4. Clique **"Testar Conexão"** ✅
5. Se OK, clique **"Salvar Configuração"** 💾

### 2️⃣ Monitorar Status

1. Clique na aba **"Status"**
2. Veja:
   - ✅ Conexão SAP (verde = OK, vermelho = erro)
   - 📊 Última sincronização
   - 📦 Pedidos sincronizados
   - 🔄 Histórico

### 3️⃣ Sincronizar Manualmente

1. Na aba **"Status"**
2. Clique **"Sincronizar Agora"** 🔄
3. Aguarde toast de confirmação ✅
4. Veja histórico atualizado 📋

### 4️⃣ Ver Pedidos do SAP

1. Clique na aba **"Pedidos SAP"**
2. Veja lista de pedidos abertos 📦
3. Clique **"Atualizar"** para recarregar 🔄
4. Use **"Ver todos no WMS"** para detalhes completos 🔗

---

## 🎨 Visual da Interface

```
┌─────────────────────────────────────────────────┐
│  Integração SAP B1                              │
│  Configure e monitore a integração              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Status da Integração SAP                  │ │
│  │                                           │ │
│  │ Conexão SAP:    ✅ Conectado              │ │
│  │ Sessão:         ✅ Válida                 │ │
│  │ Latência:       120ms                     │ │
│  │                                           │ │
│  │ Última sincronização: há 2 minutos       │ │
│  │ Pedidos sincronizados: 15                │ │
│  │ Pedidos abertos no SAP: 23               │ │
│  │                                           │ │
│  │            [🔄 Sincronizar Agora]         │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Tabs ─────────────────────────────────┐   │
│  │  📊 Status │ ⚙️ Configuração │ 📦 Pedidos SAP │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [Conteúdo da aba selecionada]                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📊 Arquivos Criados

### Frontend (11 arquivos)
- ✅ `web-next/app/integracao/page.tsx` (principal)
- ✅ `web-next/features/integration/types.ts`
- ✅ `web-next/features/integration/hooks/useSapIntegration.ts`
- ✅ `web-next/features/integration/components/SapConfigForm.tsx`
- ✅ `web-next/features/integration/components/SapStatusCard.tsx`
- ✅ `web-next/features/integration/components/SapSyncHistory.tsx`
- ✅ `web-next/features/integration/components/SapOrdersPreview.tsx`
- ✅ `web-next/components/ui/tabs.tsx`
- ✅ `web-next/components/ui/input.tsx`
- ✅ `web-next/components/ui/label.tsx`
- ✅ `web-next/lib/api/endpoints.ts` (atualizado)

### Backend (1 arquivo)
- ✅ `gateway/src/routes/sap.ts` (4 endpoints adicionados)

### Documentação (3 arquivos)
- 📖 `INTEGRACAO_SAP_FRONTEND.md` (guia técnico completo)
- 🚀 `DEPLOY_INTEGRACAO_SAP.md` (guia de deployment)
- 📊 `RESUMO_INTEGRACAO_SAP.md` (resumo executivo)
- ⚡ `INICIO_RAPIDO_INTEGRACAO.md` (este arquivo)

---

## 🔗 Endpoints Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/sap/config` | GET | Configuração atual |
| `/api/sap/config` | PUT | Salvar configuração |
| `/api/sap/config/test` | POST | Testar conexão |
| `/api/sap/sync/status` | GET | Status da sincronização |
| `/api/sap/sync` | POST | Sincronização manual |
| `/api/sap/orders` | GET | Listar pedidos SAP |
| `/api/sap/health` | GET | Health check |

---

## 🧪 Testar Antes de Usar

### Via navegador:
1. Acesse `http://YOUR_VPS_IP:8080/integracao`
2. Veja se a página carrega sem erros
3. Abra o console do navegador (F12)
4. Verifique se não há erros

### Via cURL:
```bash
# Health check
curl http://YOUR_VPS_IP:8080/api/sap/health

# Configuração
curl http://YOUR_VPS_IP:8080/api/sap/config

# Status de sincronização
curl http://YOUR_VPS_IP:8080/api/sap/sync/status
```

---

## 🐛 Problemas Comuns

### ❌ Página não carrega
```bash
# Ver logs
docker logs wms-web --tail 50

# Reiniciar
docker-compose -f deploy/docker-compose.yml restart web
```

### ❌ Endpoint 404
```bash
# Ver logs
docker logs wms-gateway --tail 50

# Verificar rotas SAP
docker logs wms-gateway | grep "SAP"
```

### ❌ Teste de conexão falha
```bash
# Testar conectividade com SAP
curl -k https://your-sap-server:50000/b1s/v1/Login

# Verificar variáveis de ambiente
docker exec wms-gateway printenv | grep SAP
```

---

## 📞 Suporte

**Guias completos:**
- 📖 Técnico: `INTEGRACAO_SAP_FRONTEND.md`
- 🚀 Deploy: `DEPLOY_INTEGRACAO_SAP.md`
- 📊 Resumo: `RESUMO_INTEGRACAO_SAP.md`

**Logs:**
```bash
docker logs wms-web
docker logs wms-gateway
docker logs wms-worker
```

---

## ✅ Checklist de Sucesso

Deploy OK quando:
- [ ] ✅ Frontend acessível
- [ ] ✅ Página carrega sem erros
- [ ] ✅ Todas as 3 abas funcionam
- [ ] ✅ Teste de conexão responde
- [ ] ✅ Sincronização manual funciona
- [ ] ✅ Lista de pedidos carrega

---

## 🚀 Próximos Passos

1. **Deploy** (5 min)
2. **Configurar** credenciais SAP (2 min)
3. **Testar** conexão (1 min)
4. **Sincronizar** pedidos (1 min)
5. **Monitorar** status (contínuo)

---

**Tempo total estimado**: 10 minutos  
**Dificuldade**: Fácil  
**Status**: ✅ **Pronto para uso**

---

**Criado por**: Cursor AI Assistant  
**Data**: 2026-02-03  
**Versão**: 1.0
