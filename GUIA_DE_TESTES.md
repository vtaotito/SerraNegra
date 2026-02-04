# 🧪 Guia de Testes - WMS com Integração SAP B1

## 📋 Pré-requisitos

Antes de testar, certifique-se de que:

1. ✅ `.env` está configurado com credenciais SAP válidas
2. ✅ Gateway está rodando em `http://localhost:3000`
3. ✅ Frontend está rodando em `http://localhost:5173`

---

## 🚀 Como Iniciar os Serviços

### Opção 1: Manual (2 Terminais)

**Terminal 1 - Gateway:**
```bash
cd gateway
npm run dev
```

Aguarde ver: `Gateway online em :3000`

**Terminal 2 - Frontend:**
```bash
cd web
npm run dev
```

Aguarde ver: `Local: http://localhost:5173/`

### Opção 2: Script Automatizado (PowerShell)

```bash
.\start-dev.ps1
```

---

## ✅ Checklist de Testes

### 1. Teste de Carregamento Básico

**URL:** http://localhost:5173

**O que verificar:**
- [ ] Página carrega sem erros no console
- [ ] Dashboard Kanban é exibido
- [ ] Colunas de status aparecem:
  - A_SEPARAR
  - EM_SEPARACAO
  - CONFERIDO
  - AGUARDANDO_COTACAO
  - AGUARDANDO_COLETA
  - DESPACHADO

**Resultado esperado:**
- ✅ Interface carrega completamente
- ✅ Sem erros JavaScript no console (F12)

---

### 2. Teste de Filtros

**Localização:** Barra superior (FiltersBar)

**O que testar:**
- [ ] Campo "Busca" aceita texto
- [ ] Dropdown "SLA" tem opções (Todos, Atrasado, Vence em até 4h, OK)
- [ ] Dropdown "Transportadora" carrega opções
- [ ] Dropdown "Prioridade" tem opções (Todas, P1, P2, P3)
- [ ] Botão "Limpar filtros" aparece quando há filtros ativos

**Como testar:**
1. Digite algo no campo "Busca"
2. Verifique se botão "Limpar filtros" aparece
3. Clique em "Limpar filtros"
4. Verifique se campos voltam ao padrão

**Resultado esperado:**
- ✅ Todos os filtros funcionam
- ✅ "Limpar filtros" reseta tudo

---

### 3. 🔥 TESTE CRÍTICO: Botão "Importar do SAP"

**Localização:** Canto superior direito (ao lado dos filtros)

**O que verificar:**
- [ ] Botão "Importar do SAP" é visível
- [ ] Botão tem cor azul (btn-primary)
- [ ] Tooltip aparece ao passar o mouse: "Sincroniza pedidos do SAP para o WMS..."

**Como testar:**
1. Localize o botão "Importar do SAP" no canto superior direito
2. Clique no botão
3. Aguarde o processamento

**Resultado esperado (COM credenciais SAP configuradas):**
- ✅ Botão muda para "Importando..." com spinner
- ✅ Toast de sucesso aparece: "X pedido(s) importado(s) do SAP"
- ✅ Pedidos aparecem no kanban
- ✅ Fonte de dados muda para "WMS Core API"

**Resultado esperado (SEM credenciais SAP ou erro):**
- ⚠️ Toast de erro aparece com mensagem clara
- ⚠️ Botão volta ao estado normal

**Console do navegador (F12):**
```
POST http://localhost:3000/api/sap/sync
Status: 200 OK

Response:
{
  "ok": true,
  "message": "Sincronização concluída: 10 pedido(s) importado(s)",
  "imported": 10,
  "total": 10,
  "timestamp": "..."
}
```

---

### 4. Teste de Drag & Drop

**Pré-requisito:** Ter pelo menos 1 pedido no kanban

**Como testar:**
1. Clique e segure em um card de pedido na coluna "A_SEPARAR"
2. Arraste para a coluna "EM_SEPARACAO"
3. Solte o card

**Resultado esperado:**
- ✅ Card move visualmente para a nova coluna
- ✅ Toast de sucesso: "Pedido movido para 'EM_SEPARACAO'"
- ✅ Card permanece na nova coluna após refresh

**Console do navegador (F12):**
```
POST http://localhost:3000/orders/:orderId/events
Status: 200 OK
```

---

### 5. Teste de Detalhes do Pedido

**Como testar:**
1. Clique em qualquer card de pedido no kanban
2. Drawer (painel lateral) abre à direita

**O que verificar:**
- [ ] Drawer abre suavemente
- [ ] Informações do pedido são exibidas:
  - Order ID
  - Cliente
  - Status atual
  - Itens (SKU + quantidade)
  - Data de criação
- [ ] Botões de ação aparecem (se aplicável)
- [ ] Botão "X" fecha o drawer

**Resultado esperado:**
- ✅ Detalhes carregam corretamente
- ✅ Drawer fecha ao clicar em "X"

---

### 6. Teste de Conexão SAP (Backend)

**Como testar via curl:**

```bash
# Health check SAP
curl http://localhost:3000/api/sap/health
```

**Resultado esperado (COM credenciais):**
```json
{
  "status": "ok",
  "message": "Conexão com SAP OK",
  "timestamp": "2026-02-04T..."
}
```

**Resultado esperado (SEM credenciais):**
```json
{
  "status": "error",
  "message": "Erro de autenticação: ...",
  "timestamp": "2026-02-04T..."
}
```

---

### 7. Teste de Listagem de Pedidos SAP

**Como testar via curl:**

```bash
# Listar pedidos SAP
curl "http://localhost:3000/api/sap/orders?limit=5"
```

**Resultado esperado:**
```json
{
  "items": [
    {
      "orderId": "SAP-12345",
      "externalOrderId": "12345",
      "sapDocEntry": 12345,
      "sapDocNum": 12345,
      "customerId": "C001",
      "status": "A_SEPARAR",
      "items": [...],
      ...
    }
  ],
  "count": 5,
  "timestamp": "2026-02-04T..."
}
```

---

### 8. Teste de Sincronização SAP

**Como testar via curl:**

```bash
# Sincronizar pedidos
curl -X POST http://localhost:3000/api/sap/sync
```

**Resultado esperado:**
```json
{
  "ok": true,
  "message": "Sincronização concluída: 10 pedido(s) importado(s)",
  "imported": 10,
  "total": 10,
  "timestamp": "2026-02-04T..."
}
```

---

## 🐛 Troubleshooting - Problemas Comuns

### Problema 1: Botão "Importar do SAP" não aparece

**Possíveis causas:**
- `VITE_API_BASE_URL` não configurado no `.env` do frontend
- API não está rodando

**Solução:**
1. Crie `web/.env.local`:
```
VITE_API_BASE_URL=http://localhost:3000
```
2. Reinicie o frontend (`npm run dev`)

---

### Problema 2: Erro 404 ao clicar "Importar do SAP"

**Causa:** Endpoint `/api/sap/sync` não existe

**Solução:**
1. Verifique se as correções foram aplicadas (veja `VALIDACAO_MANUAL.md`)
2. Reinicie o gateway
3. Verifique logs do gateway

---

### Problema 3: Erro 503 "Erro ao conectar com SAP"

**Causa:** Credenciais SAP inválidas ou SAP inacessível

**Solução:**
1. Verifique `.env`:
   - `SAP_B1_BASE_URL` está correto?
   - `SAP_B1_USERNAME` está correto?
   - `SAP_B1_PASSWORD` está correto?
   - `SAP_B1_COMPANY_DB` está correto?
2. Teste conexão SAP: `curl http://localhost:3000/api/sap/health`
3. Veja logs do gateway para detalhes

---

### Problema 4: Pedidos não aparecem após importar

**Possíveis causas:**
- Não há pedidos abertos no SAP
- Erro ao criar pedidos no WMS Core
- WMS Core não está rodando

**Solução:**
1. Verifique logs do gateway
2. Verifique se WMS Core está rodando em `http://localhost:8000`
3. Teste manualmente:
```bash
curl http://localhost:8000/orders
```

---

## 📊 Resultados Esperados - Resumo

### Cenário 1: Tudo Configurado Corretamente ✅

- ✅ Frontend carrega sem erros
- ✅ Botão "Importar do SAP" visível
- ✅ Clique no botão → pedidos importados
- ✅ Toast: "X pedido(s) importado(s) do SAP"
- ✅ Pedidos aparecem no kanban
- ✅ Drag & drop funciona
- ✅ Detalhes do pedido funcionam

### Cenário 2: SAP Não Configurado ⚠️

- ⚠️ Frontend carrega normalmente
- ⚠️ Botão "Importar do SAP" visível
- ⚠️ Clique no botão → erro
- ⚠️ Toast: "Erro ao conectar com SAP" ou similar
- ℹ️ **Isso é esperado se não houver credenciais SAP**

### Cenário 3: Correções Não Aplicadas ❌

- ❌ Botão "Importar do SAP" não aparece, OU
- ❌ Clique no botão → erro 404, OU
- ❌ Erros no console JavaScript

**Solução:** Revise `VALIDACAO_MANUAL.md` e `REVIEW_AND_FIXES.md`

---

## 🎯 Checklist Final

Marque cada item após testar:

- [ ] Frontend carrega em http://localhost:5173
- [ ] Dashboard Kanban exibe corretamente
- [ ] Filtros funcionam
- [ ] Botão "Importar do SAP" está visível
- [ ] Clicar em "Importar do SAP" não dá erro 404
- [ ] Health check SAP responde (via curl)
- [ ] Drag & drop de pedidos funciona
- [ ] Drawer de detalhes funciona
- [ ] Sem erros no console JavaScript

---

## 📝 Como Reportar Problemas

Se algo não funcionar:

1. **Console do navegador (F12):**
   - Abra a aba "Console"
   - Copie qualquer erro vermelho

2. **Network (F12):**
   - Abra a aba "Network"
   - Clique em "Importar do SAP"
   - Encontre a requisição `POST /api/sap/sync`
   - Verifique Status Code e Response

3. **Logs do Gateway:**
   - Veja o terminal onde o gateway está rodando
   - Copie mensagens de erro

4. **Informações úteis:**
   - URL completa que está dando erro
   - Status code (404, 500, etc)
   - Mensagem de erro completa
   - Correlation ID (se houver)

---

**Última atualização:** 2026-02-04  
**Versão:** 1.0.0
