# 🔧 Correção: Erro no Frontend (Application Error)

## 🐛 Problema

```
Application error: a client-side exception has occurred 
while loading REDACTED_VPS_IP (see the browser console for more information).
```

## 🔍 Causas Possíveis

1. **Dependências não instaladas** no servidor
2. **Arquivos não sincronizados** (mudanças locais não estão no servidor)
3. **Build desatualizado**
4. **Erro de importação** em componentes

## ✅ Solução Rápida (5 min)

### Opção 1: Rebuild Completo

```bash
# No servidor VPS (SSH)
cd /root/wms

# 1. Parar todos os serviços
docker-compose -f deploy/docker-compose.yml down

# 2. Limpar cache de build
docker builder prune -f

# 3. Rebuild forçado (sem cache)
docker-compose -f deploy/docker-compose.yml build --no-cache web gateway

# 4. Subir novamente
docker-compose -f deploy/docker-compose.yml up -d

# 5. Verificar logs
docker logs -f wms-web
```

### Opção 2: Sincronizar Código (se mudanças locais)

```bash
# No seu PC (PowerShell)
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# 1. Verificar se há mudanças não commitadas
git status

# 2. Adicionar arquivos novos
git add web-next/
git add gateway/src/

# 3. Commit
git commit -m "feat: adiciona página de integração SAP"

# 4. Push para repositório
git push origin main

# 5. No servidor, fazer pull
ssh root@REDACTED_VPS_IP
cd /root/wms
git pull origin main

# 6. Rebuild
docker-compose -f deploy/docker-compose.yml down web gateway
docker-compose -f deploy/docker-compose.yml build web gateway
docker-compose -f deploy/docker-compose.yml up -d web gateway
```

### Opção 3: Transferir Arquivos Diretamente (SCP)

```bash
# No seu PC (PowerShell)
# Transferir apenas os arquivos novos

# 1. Compactar arquivos locais
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"
tar -czf web-next-update.tar.gz web-next/

# 2. Enviar para servidor
scp web-next-update.tar.gz root@REDACTED_VPS_IP:/root/

# 3. No servidor, extrair e rebuild
ssh root@REDACTED_VPS_IP
cd /root/wms
tar -xzf ../web-next-update.tar.gz
docker-compose -f deploy/docker-compose.yml down web
docker-compose -f deploy/docker-compose.yml build --no-cache web
docker-compose -f deploy/docker-compose.yml up -d web
```

## 🔍 Diagnóstico Detalhado

### 1. Verificar Logs do Container

```bash
# Logs completos
docker logs wms-web --tail 100

# Filtrar erros
docker logs wms-web 2>&1 | grep -i error
docker logs wms-web 2>&1 | grep -i "cannot find module"
docker logs wms-web 2>&1 | grep -i "module not found"
```

### 2. Verificar Dependências no Container

```bash
# Entrar no container
docker exec -it wms-web sh

# Verificar package.json
cat package.json | grep radix

# Verificar node_modules
ls -la node_modules/@radix-ui/

# Verificar arquivos criados
ls -la features/integration/
ls -la components/ui/tabs.tsx
ls -la components/ui/input.tsx
ls -la components/ui/label.tsx

# Sair
exit
```

### 3. Verificar Build no Container

```bash
# Ver se o build foi bem-sucedido
docker exec -it wms-web ls -la .next/

# Ver se standalone foi criado
docker exec -it wms-web ls -la .next/standalone/

# Ver static files
docker exec -it wms-web ls -la .next/static/
```

### 4. Verificar Console do Navegador

1. Abra `http://REDACTED_VPS_IP:8080/integracao`
2. Pressione **F12** (DevTools)
3. Aba **Console**
4. Veja a mensagem de erro completa

Erros comuns:
- `Cannot find module '@radix-ui/react-tabs'` → Dependências faltando
- `Cannot find module '@/features/integration/...'` → Arquivos não copiados
- `Hydration error` → Problema de SSR
- `undefined is not an object` → Problema de import

## 🛠️ Correções Específicas

### Erro: "Cannot find module '@radix-ui/react-tabs'"

**Causa**: Dependências não instaladas no container

**Solução**:
```bash
# No servidor
cd /root/wms/web-next

# Verificar package.json
cat package.json | grep -A 2 radix

# Se não estiver lá, adicionar
npm install @radix-ui/react-tabs @radix-ui/react-label

# Commit package.json e package-lock.json
cd ..
git add web-next/package*.json
git commit -m "deps: adiciona radix-ui tabs e label"

# Rebuild
docker-compose -f deploy/docker-compose.yml build --no-cache web
docker-compose -f deploy/docker-compose.yml up -d web
```

### Erro: "Cannot find module '@/features/integration/...'"

**Causa**: Arquivos novos não foram copiados para o servidor

**Solução**:
```bash
# Verificar se arquivos existem no servidor
cd /root/wms
ls -la web-next/features/integration/

# Se não existir, criar estrutura
mkdir -p web-next/features/integration/{components,hooks}

# Copiar arquivos do seu PC ou git pull
git pull origin main

# Rebuild
docker-compose -f deploy/docker-compose.yml build --no-cache web
docker-compose -f deploy/docker-compose.yml up -d web
```

### Erro: "Hydration failed"

**Causa**: Diferença entre SSR e client-side render

**Solução**: Adicionar `"use client"` no topo do componente

```typescript
// web-next/app/integracao/page.tsx
"use client";  // ← Já está adicionado

import { AppLayout } from "@/components/layout/AppLayout";
// ...
```

### Erro: "fetch failed" ou "CORS"

**Causa**: Endpoints do backend não estão disponíveis

**Solução**:
```bash
# Verificar se gateway está rodando
docker ps | grep gateway

# Verificar logs do gateway
docker logs wms-gateway --tail 50

# Verificar se rotas SAP estão registradas
docker logs wms-gateway | grep "SAP"

# Reiniciar gateway se necessário
docker-compose -f deploy/docker-compose.yml restart gateway
```

## 📝 Checklist de Correção

### Antes de Rebuild
- [ ] Código sincronizado (git pull ou scp)
- [ ] package.json atualizado com dependências
- [ ] Arquivos novos existem no servidor
- [ ] .env configurado (se necessário)

### Durante Rebuild
- [ ] Cache limpo (`--no-cache`)
- [ ] Build concluído sem erros
- [ ] Container iniciado com sucesso
- [ ] Healthcheck passando

### Após Rebuild
- [ ] Frontend acessível (HTTP 200)
- [ ] Página carrega sem erro
- [ ] Console do navegador sem erros
- [ ] Funcionalidades básicas funcionam

## 🚀 Deploy Corrigido (Script Completo)

```bash
#!/bin/bash

echo "🔧 Iniciando correção do frontend..."

# Parar serviços
echo "⏸️  Parando serviços..."
docker-compose -f deploy/docker-compose.yml down web gateway

# Limpar cache
echo "🧹 Limpando cache de build..."
docker builder prune -f

# Verificar arquivos
echo "📁 Verificando arquivos..."
if [ ! -d "web-next/features/integration" ]; then
    echo "❌ ERRO: Arquivos de integração não encontrados!"
    echo "Execute: git pull origin main"
    exit 1
fi

# Verificar dependências
echo "📦 Verificando dependências..."
if ! grep -q "@radix-ui/react-tabs" web-next/package.json; then
    echo "❌ ERRO: Dependências Radix UI não encontradas!"
    echo "Execute: cd web-next && npm install @radix-ui/react-tabs @radix-ui/react-label"
    exit 1
fi

# Rebuild
echo "🔨 Fazendo rebuild (isso pode levar alguns minutos)..."
docker-compose -f deploy/docker-compose.yml build --no-cache web gateway

# Subir
echo "🚀 Subindo serviços..."
docker-compose -f deploy/docker-compose.yml up -d web gateway

# Aguardar inicialização
echo "⏳ Aguardando inicialização (30s)..."
sleep 30

# Verificar
echo "✅ Verificando status..."
docker ps | grep wms-web
docker ps | grep wms-gateway

echo ""
echo "📋 Logs do frontend:"
docker logs wms-web --tail 20

echo ""
echo "🌐 Teste de acesso:"
curl -I http://localhost:3000/

echo ""
echo "✅ Deploy concluído!"
echo "🌐 Acesse: http://REDACTED_VPS_IP:8080/integracao"
```

Salve como `fix-deploy.sh` e execute:
```bash
chmod +x fix-deploy.sh
./fix-deploy.sh
```

## 📞 Se Nada Funcionar

### Rollback para Versão Anterior

```bash
# Voltar para commit anterior
git log --oneline -10  # Ver últimos commits
git checkout <commit_hash_anterior>

# Rebuild
docker-compose -f deploy/docker-compose.yml down
docker-compose -f deploy/docker-compose.yml build web gateway
docker-compose -f deploy/docker-compose.yml up -d
```

### Reset Completo

```bash
# ⚠️ CUIDADO: Remove TUDO e reconstrói do zero

# Parar tudo
docker-compose -f deploy/docker-compose.yml down -v

# Remover imagens
docker rmi wms-web wms-gateway

# Limpar tudo
docker system prune -af --volumes

# Rebuild do zero
docker-compose -f deploy/docker-compose.yml build
docker-compose -f deploy/docker-compose.yml up -d
```

## 📊 Validação Final

Após correção, validar:

```bash
# 1. Container rodando
docker ps | grep wms-web
# ✅ Status: Up

# 2. Logs sem erro
docker logs wms-web --tail 50
# ✅ Sem "Error" ou "Cannot find module"

# 3. Healthcheck
docker inspect wms-web | grep -A 10 Health
# ✅ Status: healthy

# 4. Endpoint responde
curl -I http://localhost:3000/
# ✅ HTTP/1.1 200 OK

# 5. Página carrega
curl http://localhost:3000/integracao
# ✅ HTML retornado (sem erro)

# 6. Browser
# ✅ Página carrega
# ✅ Console sem erros
# ✅ Componentes renderizados
```

---

**Tempo estimado de correção**: 5-10 minutos  
**Causa mais comum**: Código não sincronizado entre local e servidor  
**Solução mais rápida**: Rebuild com `--no-cache`
