# 🚀 Como Iniciar o WMS - Guia Rápido

## ⚡ Início Rápido (30 segundos)

### 1. Iniciar a API

**Abra PowerShell nesta pasta e execute:**

```powershell
.\START-API.ps1
```

Aguarde até ver:
```
Core API online em :8000
```

### 2. Testar API

**Em OUTRO terminal PowerShell:**

```powershell
.\test-dashboard.ps1
```

Deve mostrar ✓ em todos os testes.

### 3. Acessar do Frontend

Seu frontend em `http://YOUR_VPS_IP:8080` já pode fazer requisições:

```javascript
// Exemplo no frontend
fetch('http://localhost:8000/api/v1/dashboard/metrics', {
  headers: {
    'X-User-Id': 'dev-user',
    'X-User-Role': 'SUPERVISOR',
    'X-User-Name': 'Usuário Dev'
  }
})
```

## 📋 Checklist

- [ ] Node.js instalado? (`node --version` >= 18.0.0)
- [ ] API rodando? (`.\START-API.ps1`)
- [ ] Testes passando? (`.\test-dashboard.ps1`)
- [ ] Frontend conectando? (DevTools > Network)

## 🔧 Problemas?

### API não inicia

```powershell
# Reinstalar dependências
cd api
Remove-Item -Recurse -Force node_modules
npm install

# Voltar e iniciar
cd ..
.\START-API.ps1
```

### Porta 8000 em uso

```powershell
# Ver processos na porta
netstat -ano | findstr :8000

# Matar processo (substitua 12345 pelo PID)
taskkill /F /PID 12345
```

### CORS não funciona

- ✅ Já está configurado!
- Reinicie a API após qualquer mudança
- Limpe cache do navegador (Ctrl+Shift+Del)

## 📚 Documentação Completa

- **`QUICK-FIX.md`** - Solução de problemas
- **`START-SERVERS.md`** - Guia detalhado
- **`CORS-FIX.md`** - Explicação do CORS
- **`API-REST-SUMMARY.md`** - Resumo da API

## 🎯 Endpoints Disponíveis

### Dashboard
- `GET /api/v1/dashboard/metrics` - Métricas KPI
- `GET /api/v1/dashboard/orders` - Lista de pedidos
- `GET /api/v1/dashboard/tasks` - Lista de tarefas

### Catálogo
- `GET /api/v1/catalog/items` - Lista de itens
- `GET /api/v1/catalog/warehouses` - Lista de armazéns

### Pedidos
- `GET /api/v1/orders` - Lista de pedidos
- `POST /api/v1/orders` - Criar pedido
- `GET /api/v1/orders/{id}` - Detalhes do pedido

### Inventário
- `GET /api/v1/inventory` - Consultar inventário
- `POST /api/v1/inventory/adjustments` - Ajustar estoque
- `POST /api/v1/inventory/transfers` - Transferir estoque

### Remessas
- `GET /api/v1/shipments` - Lista de remessas
- `POST /api/v1/shipments` - Criar remessa

### Clientes
- `GET /api/v1/customers` - Lista de clientes
- `POST /api/v1/customers` - Criar cliente

## 🔑 Headers Obrigatórios

Todas as requisições devem incluir:

```
X-User-Id: dev-user
X-User-Role: SUPERVISOR (ou OPERADOR, COMERCIAL, ADMIN)
X-User-Name: Usuário Dev
```

Para POSTs, adicionar:

```
Idempotency-Key: <uuid>
Content-Type: application/json
```

## 📊 Dados de Teste

A API está usando **stub services** (dados fictícios em memória).

Para dados reais:
1. Implementar serviços com banco de dados
2. Conectar com SAP via gateway
3. Ver `api/services/stubServices.ts` para exemplos

## ⚙️ Configuração

### Variáveis de Ambiente

Criar arquivo `.env` na pasta `api/`:

```bash
API_PORT=8000
LOG_LEVEL=info
JWT_SECRET=seu-secret-seguro-aqui
CORS_ORIGINS=http://localhost:3000,http://YOUR_VPS_IP:8080
```

### Produção

Para produção, ajustar:

1. **CORS**: Especificar origens permitidas
2. **JWT**: Secret forte e seguro
3. **Database**: Substituir stubs por persistência real
4. **Logs**: Configurar sistema de logs
5. **Monitoramento**: Prometheus, Grafana, etc.

## 🆘 Suporte

Se nada funcionar:

1. Verificar logs ao iniciar API
2. Executar `.\test-dashboard.ps1` e capturar erros
3. Verificar DevTools > Network no navegador
4. Consultar `QUICK-FIX.md` para soluções comuns

---

**Versão**: 1.0.0  
**Status**: ✅ Pronto para uso  
**CORS**: ✅ Configurado  
**JWT**: ✅ Implementado  
**Última atualização**: 2026-02-03
