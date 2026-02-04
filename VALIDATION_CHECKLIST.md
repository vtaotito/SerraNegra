# ✅ Checklist de Validação - Integração SAP

Use este checklist para validar se a integração foi configurada corretamente.

## 📋 Pré-requisitos

- [ ] Node.js >= 18.0.0 instalado
- [ ] Acesso à rede do SAP Business One
- [ ] Credenciais SAP válidas (CompanyDB, Username, Password)
- [ ] Service Layer SAP rodando e acessível

## 🔧 Configuração

### Variáveis de Ambiente

- [ ] Arquivo `.env` criado (copiado de `.env.example`)
- [ ] `SAP_B1_BASE_URL` configurado corretamente
- [ ] `SAP_B1_COMPANY_DB` preenchido
- [ ] `SAP_B1_USERNAME` preenchido
- [ ] `SAP_B1_PASSWORD` preenchido
- [ ] `.env` **NÃO** está versionado (verificar `git status`)

### Dependências

- [ ] `npm install` executado na raiz
- [ ] `cd gateway && npm install` executado
- [ ] `cd web && npm install` executado
- [ ] Sem erros de instalação

## 🧪 Testes

### 1. Teste de Conexão SAP

```bash
cd gateway
npm run test:sap
```

**Resultado esperado:**
```
=== ✅ Teste concluído com sucesso ===
```

- [ ] ✓ Login bem-sucedido
- [ ] ✓ Pedidos listados (ou mensagem de "nenhum pedido aberto")
- [ ] ✓ Detalhes de pedido recuperados (se houver pedidos)
- [ ] ✓ **Nenhuma senha aparece nos logs**

Se falhou, veja [Troubleshooting](#troubleshooting).

### 2. Health Check do Gateway

```bash
cd gateway
npm run dev
```

Em outro terminal:
```bash
curl http://localhost:3000/health
```

**Resultado esperado:**
```json
{"ok":true}
```

- [ ] Gateway iniciou sem erros
- [ ] Health check retornou `{"ok":true}`
- [ ] Logs aparecem estruturados no console

### 3. Health Check SAP via API

```bash
curl http://localhost:3000/api/sap/health
```

**Resultado esperado (sucesso):**
```json
{
  "status": "ok",
  "message": "Conexão com SAP OK",
  "timestamp": "..."
}
```

- [ ] Status code 200
- [ ] Campo `status` = "ok"
- [ ] Mensagem positiva

**Resultado esperado (falha de conexão):**
```json
{
  "status": "error",
  "message": "...",
  "timestamp": "..."
}
```

- [ ] Status code 503
- [ ] Campo `status` = "error"
- [ ] Mensagem de erro clara (sem expor senha)

### 4. Listar Pedidos SAP

```bash
curl http://localhost:3000/api/sap/orders?limit=5
```

**Resultado esperado:**
```json
{
  "items": [...],
  "count": N,
  "timestamp": "..."
}
```

- [ ] Status code 200
- [ ] Campo `items` é um array
- [ ] Cada item tem: `orderId`, `sapDocEntry`, `sapDocNum`, `status`, `items`
- [ ] Se houver pedidos no SAP, `count` > 0

## 🎨 Frontend

### 1. Iniciar Frontend

```bash
cd web
npm run dev
```

- [ ] Frontend inicia sem erros
- [ ] URL disponível (ex: http://localhost:5173)
- [ ] Navegador abre automaticamente

### 2. Dashboard Kanban

Abra http://localhost:5173

- [ ] Dashboard carrega
- [ ] Colunas do kanban aparecem
- [ ] Filtros funcionam

### 3. Painel de Integração SAP

- [ ] Botão "▶ Integração SAP" aparece no topo
- [ ] Clicar expande o painel
- [ ] Painel mostra:
  - [ ] Botão "Testar Conexão SAP"
  - [ ] Botão "Sincronizar Pedidos"
  - [ ] Seção de informações

### 4. Testar Conexão SAP (Frontend)

Clique em "Testar Conexão SAP"

**Resultado esperado (sucesso):**
- [ ] Mensagem verde: "✓ Conexão com SAP OK"

**Resultado esperado (falha):**
- [ ] Mensagem vermelha: "✗ [descrição do erro]"

### 5. Sincronizar Pedidos

Clique em "Sincronizar Pedidos"

**Resultado esperado (com pedidos):**
- [ ] Mensagem: "✓ N pedido(s) carregado(s) do SAP"
- [ ] Pedidos aparecem no kanban abaixo
- [ ] Agrupados por status (A_SEPARAR, EM_SEPARACAO, etc)
- [ ] Indicador de fonte muda para "SAP Business One"

**Resultado esperado (sem pedidos):**
- [ ] Mensagem: "✓ 0 pedido(s) carregado(s) do SAP"
- [ ] Kanban vazio (normal se não houver pedidos abertos no SAP)

### 6. Arrastar Pedido (Atualizar Status)

**Pré-requisito:** Ter pelo menos 1 pedido no kanban (sincronizado do SAP)

1. Arraste um pedido da coluna "A_SEPARAR" para "EM_SEPARACAO"

**Resultado esperado:**
- [ ] Toast verde: "Pedido movido para 'EM_SEPARACAO'"
- [ ] Pedido move visualmente para a nova coluna
- [ ] Após alguns segundos, pedido permanece na nova coluna (atualização persistida)

2. Verifique no SAP (opcional)

Abra o pedido no SAP B1 e verifique:
- [ ] Campo `U_WMS_STATUS` = "EM_SEPARACAO"
- [ ] Campo `U_WMS_LAST_EVENT` = "INICIAR_SEPARACAO" (ou o evento correspondente)
- [ ] Campo `U_WMS_LAST_TS` atualizado

## 🔍 Validações de Segurança

### Logs

- [ ] Logs do gateway **NÃO** contêm senha SAP
- [ ] Logs **NÃO** contêm cookies (B1SESSION, ROUTEID)
- [ ] Logs contêm `correlationId` para rastreamento
- [ ] Nível de log configurável via `LOG_LEVEL` no .env

### Arquivos

- [ ] `.env` está no `.gitignore`
- [ ] `git status` **NÃO** mostra `.env` como pendente
- [ ] `.env.example` usa placeholders (`********`)

### API

- [ ] Resposta de `/api/sap/health` **NÃO** expõe senha
- [ ] Resposta de `/api/sap/orders` **NÃO** expõe credenciais
- [ ] Headers de response **NÃO** contêm `Set-Cookie`

## 🚨 Troubleshooting

### ❌ Teste de conexão falha com "ECONNREFUSED"

**Causa:** SAP não acessível

**Verificar:**
- [ ] `SAP_B1_BASE_URL` está correto (incluindo porta, ex: `:50000`)
- [ ] Servidor SAP está ligado
- [ ] Service Layer está rodando no SAP
- [ ] Firewall/VPN não está bloqueando

**Testar:**
```bash
curl https://sap-garrafariasnegra-sl.skyinone.net:50000/b1s/v1/
```

### ❌ Teste de conexão falha com "401 Unauthorized"

**Causa:** Credenciais inválidas

**Verificar:**
- [ ] `SAP_B1_USERNAME` está correto (case-sensitive)
- [ ] `SAP_B1_PASSWORD` está correto
- [ ] `SAP_B1_COMPANY_DB` está correto (case-sensitive)
- [ ] Usuário tem permissão para acessar Orders no SAP

**Testar no navegador:**
Abra: `https://seu-servidor:50000/b1s/v1/Login`
Faça POST com body JSON manualmente para validar credenciais.

### ❌ "Configuração SAP incompleta"

**Causa:** Variáveis faltando no `.env`

**Solução:**
1. Abra `.env`
2. Verifique se **todas** essas variáveis estão preenchidas:
   - SAP_B1_BASE_URL
   - SAP_B1_COMPANY_DB
   - SAP_B1_USERNAME
   - SAP_B1_PASSWORD

### ❌ Pedidos não aparecem no kanban

**Causa:** Pedidos sem status WMS ou filtro incorreto

**Verificar:**
- [ ] Há pedidos abertos no SAP (`DocStatus = 'O'`)
- [ ] UDFs criados no SAP (veja [INTEGRATION_SAP_SETUP.md](./INTEGRATION_SAP_SETUP.md))
- [ ] Filtro no frontend não está muito restritivo

**Testar diretamente:**
```bash
curl http://localhost:3000/api/sap/orders?docStatus=O&limit=100
```

### ❌ Frontend não carrega pedidos SAP

**Causa:** URL do backend incorreta

**Verificar:**
- [ ] Arquivo `web/.env` ou `web/.env.local` existe
- [ ] Contém: `VITE_API_BASE_URL=http://localhost:3000`
- [ ] Frontend foi reiniciado após alterar .env

**Solução:**
```bash
cd web
echo "VITE_API_BASE_URL=http://localhost:3000" > .env.local
npm run dev
```

### ❌ Erro ao atualizar status (drag & drop)

**Causa:** UDFs não existem no SAP

**Verificar:**
- [ ] UDFs criados na tabela ORDR do SAP:
  - U_WMS_STATUS
  - U_WMS_ORDERID
  - U_WMS_LAST_EVENT
  - U_WMS_LAST_TS
  - U_WMS_CORR_ID

**Solução:**
Criar UDFs no SAP (veja seção de Configuração no [INTEGRATION_SAP_SETUP.md](./INTEGRATION_SAP_SETUP.md)).

## ✅ Critérios de Sucesso

Marque quando **TODOS** os itens abaixo estiverem OK:

- [ ] Teste `npm run test:sap` passa com sucesso
- [ ] Health check retorna status 200
- [ ] Listar pedidos retorna dados do SAP
- [ ] Frontend carrega e exibe painel SAP
- [ ] Sincronizar pedidos funciona
- [ ] Drag & drop atualiza status no SAP
- [ ] **Nenhuma senha aparece em logs ou responses**
- [ ] `.env` não está versionado no git

## 🎉 Parabéns!

Se todos os itens acima foram marcados, sua integração SAP está funcionando corretamente! 🚀

---

**Próximos passos:**
1. Testar com volume real de pedidos
2. Monitorar performance e ajustar rate limits se necessário
3. Configurar ambiente de produção com credenciais seguras
4. Treinar usuários no novo dashboard

---

**Precisa de ajuda?**
- Documentação completa: [INTEGRATION_SAP_SETUP.md](./INTEGRATION_SAP_SETUP.md)
- Referência rápida: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- Resumo da implementação: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
