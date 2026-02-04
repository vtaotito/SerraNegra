# 🐘 PostgreSQL Integration - Quick Start

## ⚡ TL;DR

```bash
# 1. Instalar
npm install pg @types/pg

# 2. Configurar
cp .env.postgres.example .env

# 3. Migrar
psql -U wms_user -d wms_db -f wms-core/migrations/0003_orders_extended_fields.sql

# 4. Rodar
npm run dev:core:postgres
```

---

## 📁 Arquivos Importantes

| Arquivo | O que faz |
|---------|-----------|
| `api/repositories/postgresOrderRepository.ts` | Implementação PostgreSQL |
| `api/server-postgres.ts` | Servidor com PostgreSQL |
| `POSTGRES_MIGRATION_GUIDE.md` | Guia completo |
| `POSTGRESQL_SUMMARY.md` | Resumo técnico |

---

## 🎯 O Que Mudou

### Antes
```typescript
// In-memory (dados perdidos ao reiniciar)
const store = new OrderStore(); // Map<string, Order>
```

### Depois
```typescript
// PostgreSQL (dados persistentes)
const pool = createDatabasePool(config);
const repository = new PostgresOrderRepository(pool);
const service = createOrderCoreService(repository);
```

---

## ✅ Features

- ✅ Persistência em PostgreSQL
- ✅ Transações ACID
- ✅ Idempotência nativa
- ✅ Índices otimizados
- ✅ Backward compatible

---

## 🚀 Comandos NPM

```bash
# Desenvolvimento (in-memory)
npm run dev:core

# Desenvolvimento (PostgreSQL)
npm run dev:core:postgres

# Produção
npm start
```

---

## 🔧 Configuração

Arquivo `.env`:

```bash
USE_POSTGRES=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wms_db
DB_USER=wms_user
DB_PASSWORD=sua_senha
```

---

## 📊 Status

| Feature | Status |
|---------|--------|
| OrderRepository | ✅ Completo |
| TaskRepository | ⏳ Próximo |
| ScanRepository | ⏳ Próximo |
| Testes | ⏳ Próximo |

---

## 📚 Documentação

- **Setup completo**: Ver [POSTGRES_MIGRATION_GUIDE.md](./POSTGRES_MIGRATION_GUIDE.md)
- **Detalhes técnicos**: Ver [POSTGRESQL_SUMMARY.md](./POSTGRESQL_SUMMARY.md)
- **Modelo de dados**: Ver [wms-core/reports/DATA_MODEL.md](./wms-core/reports/DATA_MODEL.md)

---

**Versão**: 1.0.0  
**Data**: 2026-02-03  
**Status**: ✅ Pronto para uso
