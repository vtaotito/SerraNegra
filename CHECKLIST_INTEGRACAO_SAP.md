# ✅ Checklist: Deploy Página Integração SAP

## 📋 Antes do Deploy

### Dependências
- [x] ✅ `@radix-ui/react-tabs` instalado
- [x] ✅ `@radix-ui/react-label` instalado
- [x] ✅ Outras dependências já presentes

### Arquivos
- [x] ✅ Frontend: 11 arquivos criados/modificados
- [x] ✅ Backend: 4 endpoints adicionados
- [x] ✅ Documentação: 4 arquivos criados
- [x] ✅ Sem erros de lint

### Código
- [x] ✅ Componentes React funcionais
- [x] ✅ Tipos TypeScript definidos
- [x] ✅ Hooks customizados criados
- [x] ✅ Endpoints API implementados
- [x] ✅ Validação de formulários (Zod)

---

## 🚀 Durante o Deploy

### 1. Preparação (1 min)
```bash
cd /root/wms
```
- [ ] ⏳ Navegado para diretório do projeto

### 2. Parar Serviços (30s)
```bash
docker-compose -f deploy/docker-compose.yml down web gateway
```
- [ ] ⏳ Frontend (web) parado
- [ ] ⏳ Gateway parado

### 3. Build (3 min)
```bash
docker-compose -f deploy/docker-compose.yml build web gateway
```
- [ ] ⏳ Build do Frontend concluído
- [ ] ⏳ Build do Gateway concluído
- [ ] ⏳ Sem erros de build

### 4. Subir Serviços (30s)
```bash
docker-compose -f deploy/docker-compose.yml up -d web gateway
```
- [ ] ⏳ Frontend (web) iniciado
- [ ] ⏳ Gateway iniciado

### 5. Verificar Logs (1 min)
```bash
docker logs wms-web --tail 20
docker logs wms-gateway --tail 20
```
- [ ] ⏳ Frontend sem erros
- [ ] ⏳ Gateway com "Rotas SAP registradas"
- [ ] ⏳ Sem erros críticos

---

## ✅ Após o Deploy

### Testes Básicos (3 min)

#### 1. Frontend Acessível
```bash
curl -I http://YOUR_VPS_IP:8080/integracao
```
- [ ] ⏳ HTTP 200 OK
- [ ] ⏳ Página carrega no navegador
- [ ] ⏳ Sem erros no console (F12)

#### 2. Endpoints Respondendo
```bash
curl http://YOUR_VPS_IP:8080/api/sap/config
curl http://YOUR_VPS_IP:8080/api/sap/sync/status
curl http://YOUR_VPS_IP:8080/api/sap/health
```
- [ ] ⏳ `/config` retorna JSON
- [ ] ⏳ `/sync/status` retorna JSON
- [ ] ⏳ `/health` retorna status

#### 3. Interface Funcional
- [ ] ⏳ Aba "Status" carrega
- [ ] ⏳ Aba "Configuração" carrega
- [ ] ⏳ Aba "Pedidos SAP" carrega
- [ ] ⏳ Formulário de configuração visível
- [ ] ⏳ Botão "Sincronizar Agora" visível

---

## 🎯 Testes Funcionais (5 min)

### Configuração SAP
1. Abrir aba "Configuração"
   - [ ] ⏳ Formulário carregou
   - [ ] ⏳ 4 campos visíveis (URL, DB, User, Pass)

2. Preencher credenciais
   - [ ] ⏳ URL preenchida
   - [ ] ⏳ Database preenchido
   - [ ] ⏳ Usuário preenchido
   - [ ] ⏳ Senha preenchida

3. Testar conexão
   - [ ] ⏳ Botão "Testar Conexão" clicado
   - [ ] ⏳ Loading apareceu
   - [ ] ⏳ Resultado exibido (sucesso ✅ ou erro ❌)
   - [ ] ⏳ Toast apareceu

4. Salvar configuração
   - [ ] ⏳ Botão "Salvar" clicado
   - [ ] ⏳ Toast de confirmação
   - [ ] ⏳ Sem erros

### Status SAP
1. Abrir aba "Status"
   - [ ] ⏳ Card de status carregou
   - [ ] ⏳ Status da conexão exibido
   - [ ] ⏳ Última sincronização exibida
   - [ ] ⏳ Pedidos sincronizados exibidos
   - [ ] ⏳ Pedidos abertos no SAP exibidos

2. Sincronização manual
   - [ ] ⏳ Botão "Sincronizar Agora" clicado
   - [ ] ⏳ Loading apareceu
   - [ ] ⏳ Toast de sucesso/erro
   - [ ] ⏳ Histórico atualizado

### Pedidos SAP
1. Abrir aba "Pedidos SAP"
   - [ ] ⏳ Lista de pedidos carregou
   - [ ] ⏳ Pedidos exibidos (se houver)
   - [ ] ⏳ Colunas corretas (DocEntry, Cliente, Valor, Status)

2. Atualizar lista
   - [ ] ⏳ Botão "Atualizar" clicado
   - [ ] ⏳ Loading apareceu
   - [ ] ⏳ Lista recarregada

---

## 🔍 Validação de Qualidade

### Performance
- [ ] ⏳ Página carrega em < 3s
- [ ] ⏳ Transições suaves entre abas
- [ ] ⏳ Loading states em todas operações
- [ ] ⏳ Sem lag na digitação

### UX
- [ ] ⏳ Toasts informativos
- [ ] ⏳ Badges de status coloridos
- [ ] ⏳ Ícones relevantes (Lucide)
- [ ] ⏳ Textos claros e objetivos
- [ ] ⏳ Formulário validado (campos obrigatórios)

### Responsividade
- [ ] ⏳ Desktop (1920x1080)
- [ ] ⏳ Tablet (1024x768)
- [ ] ⏳ Mobile (375x667)

### Acessibilidade
- [ ] ⏳ Labels nos campos
- [ ] ⏳ Contraste adequado
- [ ] ⏳ Navegação por teclado (Tab)
- [ ] ⏳ Foco visível

---

## 🐛 Resolução de Problemas

### ❌ Frontend não carrega
```bash
# Verificar
docker ps | grep wms-web
docker logs wms-web --tail 50

# Solução
docker-compose -f deploy/docker-compose.yml restart web
```
- [ ] ⏳ Problema resolvido

### ❌ Endpoints 404
```bash
# Verificar
docker logs wms-gateway --tail 50 | grep SAP

# Solução
docker-compose -f deploy/docker-compose.yml restart gateway
```
- [ ] ⏳ Problema resolvido

### ❌ CORS Error
```bash
# Verificar
docker logs wms-core --tail 50 | grep CORS

# Solução (já aplicada)
# CORSMiddleware está configurado em core/app/main.py
```
- [ ] ⏳ Problema resolvido

### ❌ Teste de conexão falha
```bash
# Verificar
curl -k https://your-sap-server:50000/b1s/v1/Login

# Solução
# Verificar credenciais SAP
# Verificar firewall/rede
```
- [ ] ⏳ Problema resolvido

---

## 📊 Critérios de Sucesso

### Essenciais (obrigatório)
- [ ] ✅ Frontend acessível em http://YOUR_VPS_IP:8080/integracao
- [ ] ✅ 3 abas carregam sem erros
- [ ] ✅ Formulário de configuração funcional
- [ ] ✅ Teste de conexão retorna resposta
- [ ] ✅ Botão de sincronização funciona

### Desejáveis (importante)
- [ ] ✅ Status SAP exibido corretamente
- [ ] ✅ Lista de pedidos carrega (se houver conexão)
- [ ] ✅ Histórico de sincronizações visível
- [ ] ✅ Toasts funcionando
- [ ] ✅ Loading states em todas operações

### Opcionais (bônus)
- [ ] ✅ Sincronização automática (Worker)
- [ ] ✅ Métricas em tempo real
- [ ] ✅ Responsivo mobile
- [ ] ✅ Sem warnings no console

---

## 📝 Registro de Deploy

### Informações
- **Data**: _______________________
- **Hora**: _______________________
- **Responsável**: _______________________
- **Ambiente**: Produção (VPS)
- **URL**: http://YOUR_VPS_IP:8080/integracao

### Tempo de Deploy
- **Planejado**: 10 minutos
- **Real**: _______ minutos
- **Downtime**: _______ segundos

### Problemas Encontrados
- [ ] Nenhum
- [ ] _______________________
- [ ] _______________________

### Resolução
- [ ] N/A
- [ ] _______________________
- [ ] _______________________

### Status Final
- [ ] ✅ Sucesso total
- [ ] ⚠️ Sucesso parcial (especificar)
- [ ] ❌ Falha (rollback)

### Observações
```
_______________________________________________________
_______________________________________________________
_______________________________________________________
```

---

## 📞 Contatos

**Em caso de problemas:**
- Verificar logs: `docker logs wms-web`, `docker logs wms-gateway`
- Consultar documentação: `DEPLOY_INTEGRACAO_SAP.md`
- Revisar código: `web-next/app/integracao/page.tsx`

---

## ✅ Checklist Completo

**Total de Itens**: 78  
**Essenciais**: 15  
**Importantes**: 30  
**Opcionais**: 33

**Progresso**: [ ] 0% → [ ] 50% → [ ] 100% ✅

---

**Última atualização**: 2026-02-03  
**Versão**: 1.0  
**Status**: ✅ Pronto para deploy
