# ✅ Checklist de Setup - PostgreSQL

## 📋 Pré-requisitos

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL 14+ instalado e rodando
- [ ] Cliente psql disponível
- [ ] Acesso de administrador ao PostgreSQL

---

## 🔧 Setup do Banco de Dados

### 1. Criar Usuário e Banco

```sql
-- Conectar como postgres
psql -U postgres

-- Criar usuário
CREATE USER wms_user WITH PASSWORD 'sua_senha_segura';

-- Criar banco
CREATE DATABASE wms_db OWNER wms_user;

-- Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE wms_db TO wms_user;
GRANT ALL ON SCHEMA public TO wms_user;
```

**Status**: [ ] Concluído

---

### 2. Executar Migrações

```bash
# Migração base
psql -U wms_user -d wms_db -f wms-core/migrations/0001_init.sql

# Migração locations/inventory
psql -U wms_user -d wms_db -f wms-core/migrations/0002_locations_inventory.sql

# NOVA: Migração campos estendidos
psql -U wms_user -d wms_db -f wms-core/migrations/0003_orders_extended_fields.sql
```

**Status**: 
- [ ] 0001_init.sql executado
- [ ] 0002_locations_inventory.sql executado
- [ ] 0003_orders_extended_fields.sql executado

---

### 3. Verificar Tabelas

```sql
psql -U wms_user -d wms_db

-- Listar tabelas
\dt

-- Deve mostrar:
-- orders
-- order_items
-- order_transitions
-- tasks
-- task_lines
-- scan_events
-- idempotency_keys
-- locations
-- location_assignments
-- inventory_snapshot
-- location_movements
-- inventory_adjustments
```

**Status**: [ ] Todas as tabelas criadas

---

## 📦 Setup da Aplicação

### 4. Instalar Dependências

```bash
npm install pg @types/pg
```

**Status**: [ ] Concluído

---

### 5. Configurar Ambiente

```bash
# Copiar exemplo
cp .env.postgres.example .env

# Editar com suas credenciais
nano .env  # ou seu editor favorito
```

Verificar que o `.env` contém:

```bash
USE_POSTGRES=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wms_db
DB_USER=wms_user
DB_PASSWORD=sua_senha_aqui
```

**Status**: [ ] .env configurado corretamente

---

### 6. Testar Conexão

```bash
# Testar conexão direta
psql -U wms_user -d wms_db -c "SELECT 1"

# Deve retornar:
#  ?column? 
# ----------
#         1
```

**Status**: [ ] Conexão OK

---

## 🚀 Iniciar Aplicação

### 7. Iniciar Servidor

```bash
npm run dev:core:postgres
```

**Logs esperados**:
```
✓ Conexão com PostgreSQL OK
✓ PostgreSQL configurado e conectado
✓ OrderCoreService configurado com PostgreSQL
Core API online em :8000 (PostgreSQL)
```

**Status**: [ ] Servidor iniciado com sucesso

---

### 8. Testar Health Check

```bash
curl http://localhost:8000/health
```

**Resposta esperada**:
```json
{
  "ok": true,
  "service": "wms-core-api",
  "database": "connected",
  "timestamp": "2026-02-03T..."
}
```

**Status**: [ ] Health check OK

---

### 9. Testar API de Pedidos

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
```

**Resposta esperada**:
```json
{
  "orderId": "uuid-gerado",
  "status": "A_SEPARAR",
  "createdAt": "2026-02-03T..."
}
```

**Status**: [ ] Criação de pedido OK

---

### 10. Verificar Dados no Banco

```sql
psql -U wms_user -d wms_db

-- Ver pedidos criados
SELECT id, customer_id, status, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 5;

-- Ver items
SELECT * FROM order_items LIMIT 5;
```

**Status**: [ ] Dados persistidos corretamente

---

## 🎯 Testes Adicionais

### 11. Testar Idempotência

```bash
# Enviar mesma requisição 2x com Idempotency-Key
IDEM_KEY="test-$(date +%s)"

# Primeira chamada
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -H "X-User-Role: SUPERVISOR" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"customerId":"C002","items":[{"sku":"P002","quantity":5}]}'

# Segunda chamada (deve retornar mesmo resultado)
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -H "X-User-Role: SUPERVISOR" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"customerId":"C002","items":[{"sku":"P002","quantity":5}]}'
```

**Status**: [ ] Idempotência funcionando

---

### 12. Testar Transição de Estado

```bash
# Pegar ID do pedido criado
ORDER_ID="uuid-do-pedido"

# Aplicar evento
curl -X POST "http://localhost:8000/orders/$ORDER_ID/events" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: picker-01" \
  -H "X-User-Role: PICKER" \
  -d '{
    "type": "INICIAR_SEPARACAO"
  }'
```

**Status**: [ ] Transição de estado OK

---

### 13. Verificar Histórico

```bash
curl "http://localhost:8000/orders/$ORDER_ID/history" \
  -H "X-User-Id: test" \
  -H "X-User-Role: SUPERVISOR"
```

**Status**: [ ] Histórico de transições OK

---

## 🎨 Extras (Opcional)

### 14. Instalar Relatórios

```bash
psql -U wms_user -d wms_db -f wms-core/reports/queries/sla-reports.sql
psql -U wms_user -d wms_db -f wms-core/reports/queries/productivity-reports.sql
psql -U wms_user -d wms_db -f wms-core/reports/queries/divergence-reports.sql
```

**Status**: [ ] Relatórios instalados

---

### 15. Testar Relatório

```sql
psql -U wms_user -d wms_db

-- Ver pedidos em risco
SELECT * FROM report_orders_at_risk LIMIT 5;

-- Ver inventário atual
SELECT * FROM v_inventory_current LIMIT 5;
```

**Status**: [ ] Relatórios funcionando

---

## 📊 Resultado Final

### Checklist Geral

- [ ] PostgreSQL configurado
- [ ] Banco e usuário criados
- [ ] Todas as migrações executadas
- [ ] Dependências instaladas
- [ ] .env configurado
- [ ] Conexão testada
- [ ] Servidor inicia sem erros
- [ ] Health check retorna "connected"
- [ ] API de pedidos funciona
- [ ] Dados persistem no banco
- [ ] Idempotência funciona
- [ ] Transições de estado funcionam
- [ ] Histórico disponível
- [ ] (Opcional) Relatórios instalados

### Status Geral

**Total concluído**: ____ / 14 (ou 15 com relatórios)

---

## 🐛 Problemas Comuns

### Erro: "Connection Refused"
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql  # Linux
brew services list                 # Mac
```

### Erro: "Authentication Failed"
```bash
# Resetar senha do usuário
sudo -u postgres psql
ALTER USER wms_user WITH PASSWORD 'nova_senha';
```

### Erro: "Database does not exist"
```sql
-- Criar banco
CREATE DATABASE wms_db OWNER wms_user;
```

### Erro: "Permission Denied"
```sql
-- Conceder permissões
GRANT ALL ON SCHEMA public TO wms_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO wms_user;
```

---

## 📞 Ajuda

Se algum item falhar, consulte:
- **Guia Completo**: [POSTGRES_MIGRATION_GUIDE.md](./POSTGRES_MIGRATION_GUIDE.md)
- **Resumo Técnico**: [POSTGRESQL_SUMMARY.md](./POSTGRESQL_SUMMARY.md)
- **Quick Start**: [README_POSTGRES.md](./README_POSTGRES.md)

---

**Versão**: 1.0.0  
**Última atualização**: 2026-02-03
