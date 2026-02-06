# 🚀 Deploy Final: Página de Integração SAP (Todas Correções)

## 📋 Resumo das Correções

### Correção 1: Imports Incorretos
- ❌ `import { cn } from "@/lib/utils/cn"`
- ✅ `import { cn } from "@/lib/utils"`
- **Arquivos**: 5 componentes UI

### Correção 2: React Error #31 (Object Rendering)
- ❌ Renderizando objetos de erro diretamente
- ✅ Sempre extrair string antes de renderizar
- **Arquivos**: `client.ts`, `SapConfigForm.tsx`, `SapStatusCard.tsx`

## 🚀 Deploy Completo (Um Comando)

```bash
# No servidor VPS (SSH: root@REDACTED_VPS_IP)
cd /root/wms && \
git pull origin main && \
docker-compose -f deploy/docker-compose.yml down web gateway && \
docker builder prune -f && \
docker-compose -f deploy/docker-compose.yml build --no-cache web gateway && \
docker-compose -f deploy/docker-compose.yml up -d web gateway && \
echo "✅ Deploy concluído! Aguardando 30s..." && \
sleep 30 && \
docker logs wms-web --tail 20
```

## 📝 Passo a Passo Detalhado

### 1. Conectar no Servidor

```bash
# Windows (PowerShell)
ssh root@REDACTED_VPS_IP

# Linux/Mac
ssh root@REDACTED_VPS_IP
```

### 2. Atualizar Código

```bash
cd /root/wms
git pull origin main
```

**Verificar**:
```bash
# Ver último commit
git log --oneline -1

# Deve mostrar commits recentes com as correções
```

### 3. Parar Serviços

```bash
docker-compose -f deploy/docker-compose.yml down web gateway
```

**Saída esperada**:
```
Stopping wms-web      ... done
Stopping wms-gateway  ... done
Removing wms-web      ... done
Removing wms-gateway  ... done
```

### 4. Limpar Cache

```bash
docker builder prune -f
```

**Saída esperada**:
```
Total reclaimed space: XXX MB
```

### 5. Rebuild (Sem Cache)

```bash
docker-compose -f deploy/docker-compose.yml build --no-cache web gateway
```

**Tempo esperado**: 3-5 minutos

**Saída esperada** (últimas linhas):
```
Successfully built abc123def456
Successfully tagged wms-web:latest
Successfully built xyz789abc012
Successfully tagged wms-gateway:latest
```

### 6. Subir Serviços

```bash
docker-compose -f deploy/docker-compose.yml up -d web gateway
```

**Saída esperada**:
```
Creating wms-web      ... done
Creating wms-gateway  ... done
```

### 7. Aguardar Inicialização

```bash
echo "Aguardando 30 segundos..."
sleep 30
```

### 8. Verificar Logs

```bash
docker logs wms-web --tail 50
```

**O que procurar**:
- ✅ `Ready in Xs` ou `started server on`
- ✅ Sem mensagens de erro
- ❌ Sem "Cannot find module"
- ❌ Sem "Error"

## ✅ Checklist de Validação

### 1. Containers Rodando

```bash
docker ps | grep -E "wms-web|wms-gateway"
```

**Esperado**:
```
abc123  wms-web      Up 2 minutes  0.0.0.0:3000->3000/tcp
def456  wms-gateway  Up 2 minutes  0.0.0.0:3000->3000/tcp
```

### 2. Health Checks

```bash
# Frontend
curl -I http://localhost:3000/
# Esperado: HTTP/1.1 200 OK

# Gateway
curl http://localhost:3000/health
# Esperado: {"ok":true}

# API SAP
curl http://localhost:3000/api/sap/config
# Esperado: JSON com configuração
```

### 3. Testar no Navegador

1. **Acessar**: `http://REDACTED_VPS_IP:8080/integracao`
2. **Verificar**:
   - [ ] ✅ Página carrega completamente
   - [ ] ✅ Sem "Application error"
   - [ ] ✅ Sem "React error #31"
   - [ ] ✅ 3 abas visíveis (Status, Configuração, Pedidos SAP)

3. **Abrir DevTools** (F12):
   - [ ] ✅ Console sem erros vermelhos
   - [ ] ✅ Aba Network mostra requests bem-sucedidos
   - [ ] ✅ Sem warnings críticos

### 4. Testar Funcionalidades

#### Aba: Configuração
1. Preencher formulário:
   ```
   URL: https://REDACTED_SAP_HOST:50000
   Database: REDACTED_COMPANY_DB
   Usuário: REDACTED_USER
   Senha: REDACTED_PASSWORD
   ```
2. Clicar **"Testar Conexão"**
3. Verificar:
   - [ ] ✅ Toast aparece
   - [ ] ✅ Mensagem de sucesso OU erro como **texto** (não `[object Object]`)
   - [ ] ✅ Sem crash da aplicação

#### Aba: Status
1. Verificar se card de status carrega
2. Clicar **"Sincronizar Agora"**
3. Verificar:
   - [ ] ✅ Loading aparece
   - [ ] ✅ Toast de resultado (sucesso ou erro como texto)
   - [ ] ✅ Sem crash

#### Aba: Pedidos SAP
1. Verificar se lista carrega
2. Clicar **"Atualizar"**
3. Verificar:
   - [ ] ✅ Loading aparece
   - [ ] ✅ Lista atualiza ou mostra erro como texto
   - [ ] ✅ Sem crash

## 🐛 Troubleshooting

### Erro: "Application error" ainda aparece

```bash
# 1. Ver logs completos
docker logs wms-web --tail 100

# 2. Procurar por erro específico
docker logs wms-web 2>&1 | grep -i "error\|cannot\|failed"

# 3. Se necessário, entrar no container
docker exec -it wms-web sh

# 4. Verificar arquivos corrigidos
cat components/ui/card.tsx | grep "from.*utils"
cat lib/api/client.ts | grep -A 10 "interceptors.response"

exit
```

### Erro: "React error #31" ainda aparece

```bash
# Verificar se correção foi aplicada
docker exec -it wms-web sh

# Ver se o interceptor foi atualizado
cat lib/api/client.ts | grep -A 20 "Interceptor para tratamento"

# Deve mostrar a versão corrigida com:
# - errorMessage = ...
# - Promise.reject(new Error(errorMessage))

exit
```

### Erro: Página não carrega

```bash
# 1. Verificar se container está rodando
docker ps | grep wms-web

# 2. Reiniciar container
docker-compose -f deploy/docker-compose.yml restart web

# 3. Aguardar
sleep 20

# 4. Verificar novamente
docker logs wms-web --tail 30
```

### Erro: 404 nos endpoints SAP

```bash
# Verificar logs do gateway
docker logs wms-gateway --tail 50

# Procurar por "Rotas SAP registradas"
docker logs wms-gateway | grep "SAP"

# Se não aparecer, reiniciar gateway
docker-compose -f deploy/docker-compose.yml restart gateway
```

## 🔄 Rollback (Se Necessário)

```bash
# 1. Ver commits anteriores
cd /root/wms
git log --oneline -10

# 2. Voltar para commit anterior
git checkout <hash_do_commit_anterior>

# 3. Rebuild
docker-compose -f deploy/docker-compose.yml down
docker-compose -f deploy/docker-compose.yml build web gateway
docker-compose -f deploy/docker-compose.yml up -d
```

## 📊 Checklist Final

### Pré-Deploy
- [x] ✅ Código sincronizado (`git pull`)
- [x] ✅ Todas correções aplicadas (imports + error handling)
- [x] ✅ Lint OK (0 erros)
- [x] ✅ TypeScript compila

### Durante Deploy
- [ ] ⏳ Containers parados
- [ ] ⏳ Cache limpo
- [ ] ⏳ Build concluído sem erros
- [ ] ⏳ Containers iniciados
- [ ] ⏳ Health checks passando

### Pós-Deploy
- [ ] ✅ Frontend acessível
- [ ] ✅ Console sem erros
- [ ] ✅ Funcionalidades básicas OK
- [ ] ✅ Mensagens de erro como texto (não objetos)
- [ ] ✅ Toasts funcionando
- [ ] ✅ Sem crashes

## 📞 Suporte

Se tudo falhar:

1. **Capturar informações**:
   ```bash
   docker logs wms-web > logs-web.txt
   docker logs wms-gateway > logs-gateway.txt
   ```

2. **Compartilhar**:
   - Logs capturados
   - Mensagem de erro completa do console (F12)
   - Screenshot da tela

3. **Consultar documentação**:
   - `CORRECOES_APLICADAS.md`
   - `CORRECAO_REACT_ERROR_31.md`
   - `CORRECAO_ERRO_FRONTEND.md`

## 🎉 Sucesso!

Se tudo correu bem, você deve ver:

✅ Página de integração carregando corretamente  
✅ Formulário de configuração funcional  
✅ Teste de conexão funcionando  
✅ Sincronização manual operacional  
✅ Lista de pedidos SAP exibida  
✅ Mensagens de erro claras e legíveis  
✅ Console sem erros

---

**🌐 Acessar**: `http://REDACTED_VPS_IP:8080/integracao`

**⏱️ Tempo total de deploy**: 10-15 minutos  
**📊 Arquivos modificados**: 8  
**✅ Status**: Pronto para produção!
