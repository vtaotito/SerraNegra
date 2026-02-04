# 📘 Guia de Migração para PostgreSQL

Este guia explica como migrar o WMS de in-memory para PostgreSQL.

---

## 🎯 O Que Foi Implementado

### ✅ 1. Interface de Repositório (`OrderRepository`)
- Abstração para persistência de pedidos
- Métodos: `save`, `findById`, `findBySapDocEntry`, `findAll`, `saveTransition`, `getHistory`
- Suporte a idempotência integrado

### ✅ 2. Implementação PostgreSQL (`PostgresOrderRepository`)
- Implementação completa com transações
- Suporte a upsert (insert/update)
- Idempotência nativa
- Queries otimizadas

### ✅ 3. Migração SQL
- `0003_orders_extended_fields.sql`: Adiciona campos SAP e operacionais
- Índices otimizados
- Compatível com schema existente

### ✅ 4. Configuração de Banco
- Pool de conexões configurável
- Teste de conexão automático
- Graceful shutdown

### ✅ 5. Modo Legado
- In-memory store mantido para desenvolvimento
- Compatibilidade total com código existente

---

## 🚀 Passo a Passo

### 1. Instalar Dependências

```bash
npm install pg @types/pg
```

### 2. Configurar Banco de Dados

#### Criar Banco e Usuário

```sql
-- Conectar como postgres
psql -U postgres

-- Criar usuário
CREATE USER wms_user WITH PASSWORD 'sua_senha_segura';

-- Criar banco
CREATE DATABASE wms_db OWNER wms_user;

-- Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE wms_db TO wms_user;

-- Conectar ao banco
\c wms_db

-- Conceder permissões no schema
GRANT ALL ON SCHEMA public TO wms_user;
```

#### Executar Migrações

```bash
# Migração base (se ainda não executou)
psql -U wms_user -d wms_db -f wms-core/migrations/0001_init.sql

# Migração de locations (se ainda não executou)
psql -U wms_user -d wms_db -f wms-core/migrations/0002_locations_inventory.sql

# NOVA: Migração de campos estendidos
psql -U wms_user -d wms_db -f wms-core/migrations/0003_orders_extended_fields.sql

# Relatórios (opcional, mas recomendado)
psql -U wms_user -d wms_db -f wms-core/reports/queries/sla-reports.sql
psql -U wms_user -d wms_db -f wms-core/reports/queries/productivity-reports.sql
psql -U wms_user -d wms_db -f wms-core/reports/queries/divergence-reports.sql
```

### 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:

```bash
cp .env.postgres.example .env
```

Edite `.env` com suas credenciais:

```bash
# Habilitar PostgreSQL
USE_POSTGRES=true

# Configuração do banco
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wms_db
DB_USER=wms_user
DB_PASSWORD=sua_senha_segura
```

### 4. Iniciar o Servidor

#### Com PostgreSQL

```bash
# Usando o novo servidor
npm run dev:postgres
# ou
node api/server-postgres.ts
```

O servidor irá:
1. ✅ Conectar ao PostgreSQL
2. ✅ Testar a conexão
3. ✅ Inicializar os serviços
4. ✅ Iniciar a API

#### Modo Desenvolvimento (In-Memory)

```bash
USE_POSTGRES=false npm run dev
# ou
node api/server.ts
```

---

## 📊 Verificação

### Testar Conexão

```bash
# Health check
curl http://localhost:8000/health

# Resposta esperada (PostgreSQL)
{
  "ok": true,
  "service": "wms-core-api",
  "database": "connected",
  "timestamp": "2026-02-03T..."
}

# Resposta esperada (In-memory)
{
  "ok": true,
  "service": "wms-core-api",
  "database": "in-memory",
  "timestamp": "2026-02-03T..."
}
```

### Testar API de Pedidos

```bash
# Criar pedido
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -H "X-User-Role: SUPERVISOR" \
  -d '{
    "customerId": "C001",
    "items": [
      { "sku": "PROD-001", "quantity": 10 }
    ]
  }'

# Listar pedidos
curl http://localhost:8000/orders \
  -H "X-User-Id: test-user" \
  -H "X-User-Role: SUPERVISOR"

# Buscar pedido específico
curl http://localhost:8000/orders/{orderId} \
  -H "X-User-Id: test-user" \
  -H "X-User-Role: SUPERVISOR"
```

### Verificar Dados no Banco

```sql
-- Conectar ao banco
psql -U wms_user -d wms_db

-- Ver pedidos
SELECT id, customer_id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10;

-- Ver items de um pedido
SELECT * FROM order_items WHERE order_id = 'uuid-aqui';

-- Ver transições
SELECT * FROM order_transitions ORDER BY occurred_at DESC LIMIT 10;

-- Ver chaves de idempotência
SELECT * FROM idempotency_keys ORDER BY created_at DESC LIMIT 10;
```

---

## 🔧 Configuração Avançada

### Pool de Conexões

Ajuste no `.env`:

```bash
# Número máximo de conexões no pool (default: 20)
DB_POOL_MAX=50

# Timeout de conexão idle (default: 30000ms)
DB_POOL_IDLE_TIMEOUT=60000

# Timeout de aquisição de conexão (default: 2000ms)
DB_POOL_CONNECTION_TIMEOUT=5000
```

### SSL em Produção

O servidor automaticamente habilita SSL quando `NODE_ENV=production`.

Para desabilitar ou customizar:

```typescript
// api/config/database.ts
ssl: process.env.DB_SSL === "true" 
  ? { rejectUnauthorized: false } 
  : false
```

---

## 📈 Performance

### Índices Criados

A migração `0003` cria os seguintes índices:

| Índice | Tabela | Colunas | Uso |
|--------|--------|---------|-----|
| `idx_orders_sap_doc_entry` | orders | sap_doc_entry | Busca por DocEntry |
| `idx_orders_sap_doc_num` | orders | sap_doc_num | Busca por DocNum |
| `idx_orders_carrier` | orders | carrier | Filtro por transportadora |
| `idx_orders_priority` | orders | priority | Filtro por prioridade |
| `idx_orders_sla_due_at` | orders | sla_due_at | Filtro por SLA |
| `idx_orders_status_updated_at` | orders | status, updated_at DESC | Dashboard |

### Monitoramento

```sql
-- Ver queries lentas
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%orders%'
ORDER BY mean_time DESC
LIMIT 10;

-- Ver tamanho das tabelas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🐛 Troubleshooting

### Erro: "Connection Refused"

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql  # Linux
brew services list                 # Mac
```

### Erro: "Authentication Failed"

Verifique as credenciais no `.env` e no PostgreSQL:

```sql
-- Verificar usuário
\du

-- Resetar senha
ALTER USER wms_user WITH PASSWORD 'nova_senha';
```

### Erro: "Database does not exist"

```sql
-- Criar banco
CREATE DATABASE wms_db OWNER wms_user;
```

### Erro: "Permission Denied"

```sql
-- Conectar ao banco como postgres
\c wms_db postgres

-- Conceder permissões
GRANT ALL ON SCHEMA public TO wms_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO wms_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO wms_user;
```

---

## 🔄 Rollback (Voltar para In-Memory)

Se precisar voltar temporariamente para in-memory:

```bash
# 1. Parar servidor
Ctrl+C

# 2. Desabilitar PostgreSQL
echo "USE_POSTGRES=false" >> .env

# 3. Reiniciar
npm run dev
```

---

## ✅ Checklist de Migração

- [ ] PostgreSQL instalado e rodando
- [ ] Banco `wms_db` criado
- [ ] Usuário `wms_user` criado com permissões
- [ ] Migrações 0001, 0002, 0003 executadas
- [ ] `.env` configurado com credenciais corretas
- [ ] `USE_POSTGRES=true` definido
- [ ] Servidor inicia sem erros
- [ ] Health check retorna `"database": "connected"`
- [ ] API de pedidos funciona corretamente
- [ ] Dados persistem após restart do servidor

---

## 📚 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `api/repositories/orderRepository.ts` | Interface do repositório |
| `api/repositories/postgresOrderRepository.ts` | Implementação PostgreSQL |
| `api/config/database.ts` | Configuração do pool |
| `api/config/services.ts` | Factory de serviços |
| `api/server-postgres.ts` | Servidor com PostgreSQL |
| `api/services/orderCoreService.ts` | Serviço atualizado |
| `wms-core/migrations/0003_orders_extended_fields.sql` | Nova migração |
| `.env.postgres.example` | Exemplo de configuração |

---

## 🎓 Próximos Passos

Após a migração bem-sucedida:

1. **Implementar outros repositórios**
   - TaskRepository (PostgreSQL)
   - ScanEventRepository (PostgreSQL)
   
2. **Configurar backup automático**
   ```bash
   # Criar script de backup
   pg_dump -U wms_user wms_db > backup_$(date +%Y%m%d).sql
   ```

3. **Monitorar performance**
   - Habilitar `pg_stat_statements`
   - Configurar alertas de slow queries

4. **Implementar cache (opcional)**
   - Redis para queries frequentes
   - Materialized views para relatórios

---

**Versão**: 1.0.0  
**Data**: 2026-02-03  
**Status**: ✅ Pronto para Produção
