# 🚀 Deploy: Página de Integração SAP B1

## ⚡ Deploy Rápido (5 minutos)

### 1. Build e Deploy do Frontend

```bash
# No servidor VPS (31.97.174.120)
cd /root/wms

# 1. Parar os serviços
docker-compose -f deploy/docker-compose.yml down web gateway

# 2. Instalar dependências (se necessário)
cd web-next
npm install @radix-ui/react-tabs @radix-ui/react-label

# 3. Build da imagem atualizada
cd ..
docker-compose -f deploy/docker-compose.yml build web gateway

# 4. Subir os serviços
docker-compose -f deploy/docker-compose.yml up -d web gateway

# 5. Verificar logs
docker logs -f wms-web
docker logs -f wms-gateway
```

### 2. Verificar Deployment

```bash
# Health check do frontend
curl http://localhost:3000/

# Health check do gateway
curl http://localhost:3000/health

# Testar endpoint SAP
curl http://localhost:3000/api/sap/health
```

### 3. Acessar Aplicação

🌐 **URL**: http://31.97.174.120:8080/integracao

## 📋 Checklist de Deployment

### Antes do Deploy
- [ ] ✅ Dependências instaladas (`@radix-ui/react-tabs`, `@radix-ui/react-label`)
- [ ] ✅ Variáveis de ambiente configuradas (`.env` no gateway)
- [ ] ✅ Código commitado no repositório
- [ ] ✅ Build local testado

### Durante o Deploy
- [ ] ⏸️ Serviços parados
- [ ] 🔨 Build das imagens concluído
- [ ] 🚀 Serviços iniciados
- [ ] 📋 Logs verificados

### Após o Deploy
- [ ] ✅ Frontend acessível
- [ ] ✅ Endpoints SAP respondendo
- [ ] ✅ Configuração SAP funcional
- [ ] ✅ Teste de sincronização bem-sucedido

## 🧪 Testes Pós-Deploy

### 1. Teste de Acesso
```bash
# Frontend
curl -I http://31.97.174.120:8080/integracao
# Esperado: HTTP/1.1 200 OK

# API Gateway
curl http://31.97.174.120:8080/api/sap/config
# Esperado: JSON com configuração (sem senha)
```

### 2. Teste de Configuração SAP

**Via Navegador:**
1. Acesse http://31.97.174.120:8080/integracao
2. Aba "Configuração"
3. Preencha:
   - URL: `https://sap-garrafariasnegra-sl.skyinone.net:50000`
   - Database: `SBO_GARRAFARIASNEGRA`
   - Usuário: `<seu_usuario>`
   - Senha: `<sua_senha>`
4. Clique "Testar Conexão"
5. ✅ Sucesso: mensagem verde
6. ❌ Erro: mensagem vermelha com detalhes

**Via cURL:**
```bash
curl -X POST http://31.97.174.120:8080/api/sap/config/test \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://sap-garrafariasnegra-sl.skyinone.net:50000",
    "companyDb": "SBO_GARRAFARIASNEGRA",
    "username": "usuario",
    "password": "senha"
  }'
```

### 3. Teste de Sincronização

**Via Navegador:**
1. Aba "Status"
2. Clique "Sincronizar Agora"
3. Aguarde toast de confirmação
4. Veja histórico atualizado

**Via cURL:**
```bash
curl -X POST http://31.97.174.120:8080/api/sap/sync \
  -H "X-Correlation-Id: test-$(date +%s)"
```

### 4. Teste de Pedidos SAP

**Via Navegador:**
1. Aba "Pedidos SAP"
2. Veja lista de pedidos abertos
3. Clique "Atualizar" para recarregar

**Via cURL:**
```bash
curl "http://31.97.174.120:8080/api/sap/orders?limit=10"
```

## 🐛 Troubleshooting

### Problema: Frontend não carrega

**Sintoma:**
- Página em branco
- Erro 502 Bad Gateway
- Loading infinito

**Solução:**
```bash
# 1. Verificar logs
docker logs wms-web --tail 100

# 2. Verificar se o serviço está rodando
docker ps | grep wms-web

# 3. Reiniciar serviço
docker-compose -f deploy/docker-compose.yml restart web

# 4. Verificar porta
netstat -tulpn | grep 3000
```

### Problema: Endpoints SAP retornam 404

**Sintoma:**
- `GET /api/sap/config` → 404
- `POST /api/sap/sync` → 404

**Solução:**
```bash
# 1. Verificar rotas SAP registradas
docker logs wms-gateway --tail 50 | grep "SAP"
# Esperado: "Rotas SAP registradas (com cache)"

# 2. Verificar build do gateway
docker-compose -f deploy/docker-compose.yml build gateway

# 3. Reiniciar gateway
docker-compose -f deploy/docker-compose.yml restart gateway

# 4. Testar health
curl http://localhost:3000/api/sap/health
```

### Problema: Teste de conexão falha

**Sintoma:**
- "Falha na conexão. Verifique as credenciais."
- Timeout
- CORS error

**Solução:**
```bash
# 1. Testar conectividade com SAP
curl -k https://sap-garrafariasnegra-sl.skyinone.net:50000/b1s/v1/Login

# 2. Verificar variáveis de ambiente
docker exec wms-gateway printenv | grep SAP

# 3. Verificar CORS no Core
docker logs wms-core --tail 50 | grep CORS

# 4. Verificar certificado SSL
openssl s_client -connect sap-garrafariasnegra-sl.skyinone.net:50000
```

### Problema: Sincronização não funciona

**Sintoma:**
- Botão clicado mas nada acontece
- Erro 500
- Pedidos não aparecem no WMS

**Solução:**
```bash
# 1. Verificar logs do Gateway
docker logs wms-gateway --tail 100 | grep sync

# 2. Verificar logs do Core
docker logs wms-core --tail 100

# 3. Verificar Worker
docker logs wms-worker --tail 100

# 4. Testar endpoint manualmente
curl -X POST http://localhost:3000/api/sap/sync -v

# 5. Verificar se pedidos existem no SAP
curl "http://localhost:3000/api/sap/orders?limit=5"
```

## 📊 Monitoramento

### Logs em Tempo Real
```bash
# Todos os serviços
docker-compose -f deploy/docker-compose.yml logs -f

# Apenas frontend
docker logs -f wms-web

# Apenas gateway
docker logs -f wms-gateway

# Apenas worker
docker logs -f wms-worker
```

### Métricas de Performance
```bash
# Status dos containers
docker stats

# Uso de recursos
docker system df

# Espaço em disco
df -h
```

## 🔄 Rollback (em caso de problema)

```bash
# 1. Parar serviços
docker-compose -f deploy/docker-compose.yml down web gateway

# 2. Voltar para versão anterior (git)
git checkout <commit_anterior>

# 3. Rebuild
docker-compose -f deploy/docker-compose.yml build web gateway

# 4. Subir novamente
docker-compose -f deploy/docker-compose.yml up -d web gateway
```

## ✅ Critérios de Sucesso

Deploy considerado bem-sucedido quando:

1. ✅ Frontend acessível em http://31.97.174.120:8080/integracao
2. ✅ Página carrega sem erros no console
3. ✅ Todas as 3 abas (Status, Configuração, Pedidos SAP) funcionam
4. ✅ Teste de conexão SAP retorna resposta (sucesso ou erro claro)
5. ✅ Sincronização manual pode ser disparada
6. ✅ Lista de pedidos SAP é exibida (se houver conexão SAP)
7. ✅ Nenhum erro CORS no console do navegador
8. ✅ Logs do Gateway/Core sem erros críticos

## 📞 Suporte

Se encontrar problemas:

1. **Verificar logs** primeiro (Gateway, Core, Worker)
2. **Testar endpoints** manualmente via cURL
3. **Consultar** `INTEGRACAO_SAP_FRONTEND.md` para detalhes técnicos
4. **Validar** variáveis de ambiente SAP

---

**Tempo estimado de deploy**: 5-10 minutos  
**Downtime esperado**: < 1 minuto  
**Rollback**: < 3 minutos
