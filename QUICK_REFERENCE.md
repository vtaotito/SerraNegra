# Guia Rápido de Comandos - Integração SAP

## 🎯 Comandos Mais Usados

### Configuração Inicial (uma vez)

```bash
# 1. Copiar e editar .env
cp .env.example .env
# Edite o .env com suas credenciais SAP

# 2. Instalar tudo
npm install
cd gateway && npm install && cd ..
cd web && npm install && cd ..
```

### Desenvolvimento (diário)

```bash
# Terminal 1 - Gateway
cd gateway
npm run dev

# Terminal 2 - Frontend
cd web
npm run dev
```

### Testar SAP

```bash
# Teste completo de conexão (recomendado antes de iniciar)
cd gateway
npm run test:sap

# Teste unitário
npm test
```

### Verificar Health

```bash
# Via curl
curl http://localhost:3000/api/sap/health

# Via browser
# Abra: http://localhost:3000/api/sap/health
```

## 🔧 Comandos de Troubleshooting

### Ver logs do gateway

```bash
# Durante desenvolvimento (console)
cd gateway
npm run dev

# Ver logs estruturados
# Os logs aparecem no console com níveis: debug, info, warn, error
```

### Testar endpoints manualmente

```bash
# Health check
curl http://localhost:3000/api/sap/health

# Listar pedidos
curl http://localhost:3000/api/sap/orders?limit=5

# Buscar pedido específico (substitua 123)
curl http://localhost:3000/api/sap/orders/123

# Atualizar status (substitua 123)
curl -X PATCH http://localhost:3000/api/sap/orders/123/status \
  -H "Content-Type: application/json" \
  -d '{"status":"EM_SEPARACAO","event":"INICIAR_SEPARACAO"}'
```

### Verificar credenciais SAP (sem expor senha)

```bash
# No PowerShell
cd gateway
$env:SAP_B1_BASE_URL
$env:SAP_B1_COMPANY_DB
$env:SAP_B1_USERNAME
# NÃO rode: $env:SAP_B1_PASSWORD (segurança!)
```

### Recompilar TypeScript

```bash
# Gateway
cd gateway
npm run build

# Raiz (sap-connector + wms-core)
npm run build
```

## 📦 Build para Produção

```bash
# 1. Build gateway
cd gateway
npm run build
# Output: gateway/dist/

# 2. Build frontend
cd web
npm run build
# Output: web/dist/

# 3. Iniciar em produção
cd gateway
npm start
```

## 🐛 Debug

### Ativar logs detalhados

Edite `.env`:
```env
LOG_LEVEL=debug
```

Reinicie o gateway.

### Verificar porta em uso

```bash
# PowerShell
Get-NetTCPConnection -LocalPort 3000

# Se precisar matar processo
Stop-Process -Id <PID>
```

### Limpar node_modules e reinstalar

```bash
# Se algo estranho acontecer
rm -rf node_modules
rm -rf gateway/node_modules
rm -rf web/node_modules
npm install
cd gateway && npm install && cd ..
cd web && npm install && cd ..
```

## 🔍 Verificar Estado do Sistema

### Frontend rodando?

Abra: http://localhost:5173 (ou porta indicada)

### Gateway rodando?

```bash
curl http://localhost:3000/health
# Deve retornar: {"ok":true}
```

### SAP acessível?

```bash
curl http://localhost:3000/api/sap/health
# 200 = OK
# 503 = Erro de conexão
```

## 📋 Checklist Pré-Deploy

- [ ] `.env` configurado corretamente
- [ ] `npm run test:sap` passou
- [ ] Health check retorna 200
- [ ] Pedidos aparecem no frontend
- [ ] Atualização de status funciona
- [ ] Logs não contêm senhas
- [ ] `.env` NÃO está no git (`git status` para verificar)

## 🚨 Erros Comuns e Soluções Rápidas

### "ECONNREFUSED"
```bash
# Verifique se SAP_B1_BASE_URL está correta
# Teste: curl https://seu-servidor:50000/b1s/v1/
```

### "401 Unauthorized"
```bash
# Credenciais erradas. Verifique .env:
# - SAP_B1_USERNAME
# - SAP_B1_PASSWORD
# - SAP_B1_COMPANY_DB
```

### "Port 3000 already in use"
```bash
# Mude a porta no .env
GATEWAY_PORT=3001
```

### Frontend não carrega pedidos SAP
```bash
# Verifique web/.env ou web/.env.local:
VITE_API_BASE_URL=http://localhost:3000
```

## 🔄 Workflow Típico

```bash
# 1. Manhã - Iniciar ambiente
cd gateway && npm run test:sap  # Garantir que SAP está OK
npm run dev                     # Terminal 1

cd ../web && npm run dev        # Terminal 2

# 2. Durante o dia - Desenvolver
# Editar código, salvar, hot-reload automático

# 3. Testar mudanças
npm test                        # Testes automatizados
curl http://localhost:3000/api/sap/orders  # Teste manual

# 4. Fim do dia - Commitar
git status                      # Garantir que .env NÃO está aqui
git add .
git commit -m "feat: ..."
git push
```

## 📞 Ajuda Adicional

- Documentação completa: [INTEGRATION_SAP_SETUP.md](./INTEGRATION_SAP_SETUP.md)
- Contrato SAP: [API_CONTRACTS/sap-b1-integration-contract.md](./API_CONTRACTS/sap-b1-integration-contract.md)
- State Machine: [STATE_MACHINE.json](./STATE_MACHINE.json)

---

**Dica:** Salve este arquivo nos favoritos! 📌
