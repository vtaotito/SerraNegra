# Extensão do Schema de Orders - Campos SAP e Busca Parcial

## Resumo

Este documento descreve as alterações implementadas para estender o schema de `GET /orders` com campos SAP financeiros e busca parcial por `externalOrderId`.

## Alterações Realizadas

### 1. Schema OpenAPI (`API_CONTRACTS/openapi.yaml`)

**Campos adicionados ao tipo `Order`:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `docTotal` | number | Não | Valor total do pedido (DocTotal do SAP) |
| `currency` | string | Não | Código da moeda (ex: BRL, USD) |
| `slaDueAt` | string (date-time) | Não | Data limite (DocDueDate no SAP) |
| `metadata` | object | Não | Campos estendidos adicionais |

**Campos SAP já existentes (documentados):**
- `sapDocEntry`: DocEntry do SAP B1
- `sapDocNum`: DocNum do SAP B1  
- `customerName`: CardName do SAP
- `carrier`: Transportadora
- `priority`: Prioridade (P1, P2, P3)

### 2. Tipo Order do Core (`wms-core/src/domain/order.ts`)

```typescript
export type Order = {
  // ... campos existentes
  docTotal?: number;    // Novo
  currency?: string;    // Novo
  metadata?: Record<string, unknown>;
};
```

### 3. PostgreSQL - Migração 0004

**Arquivo:** `wms-core/migrations/0004_orders_sap_financial_fields.sql`

**Alterações:**
- Adiciona colunas `doc_total` (NUMERIC(18,2)) e `currency` (VARCHAR(10))
- Cria índices para busca parcial por `external_order_id`:
  - Índice GIN com pg_trgm (se extensão disponível)
  - Índice BTREE (fallback, ainda performático)

**Como executar:**
```bash
psql -h <host> -U <user> -d <database> -f wms-core/migrations/0004_orders_sap_financial_fields.sql
```

### 4. Repository (`api/repositories/postgresOrderRepository.ts`)

**Método `findAll()` atualizado:**
- Aceita filtro `externalOrderId?: string`
- Usa `ILIKE` para busca case-insensitive parcial
- Query: `external_order_id ILIKE '%termo%'`

**Método `findById()` atualizado:**
- Retorna campos `doc_total` e `currency`

**Método `save()` atualizado:**
- Persiste campos `doc_total` e `currency`

### 5. Service (`api/services/orderCoreService.ts`)

**Método `listOrders()` atualizado:**
- Aceita filtro `externalOrderId?: string`
- Implementação para InMemoryOrderStore (fallback)

### 6. Controller (`api/controllers/ordersController.ts`)

**Endpoint `GET /orders` atualizado:**
- Query param `externalOrderId` passa para service
- Documentação inline atualizada

### 7. Frontend (`web/src/api/types.ts`)

**Tipo `Order` atualizado:**
```typescript
export type Order = {
  // ... campos existentes
  docTotal?: number | null;   // Novo
  currency?: string | null;   // Novo
};
```

## Exemplos de Uso

### Buscar pedidos com valor total

```bash
GET /orders?status=A_SEPARAR
```

**Resposta:**
```json
{
  "items": [
    {
      "orderId": "123e4567-e89b-12d3-a456-426614174000",
      "externalOrderId": "SAP-12345",
      "customerId": "C001",
      "customerName": "Cliente Exemplo",
      "status": "A_SEPARAR",
      "docTotal": 1500.50,
      "currency": "BRL",
      "slaDueAt": "2026-02-10T18:00:00Z",
      "items": [
        { "sku": "PROD-001", "quantity": 10 }
      ],
      "createdAt": "2026-02-04T10:00:00Z",
      "updatedAt": "2026-02-04T10:00:00Z"
    }
  ],
  "nextCursor": null
}
```

### Buscar pedidos por External Order ID parcial

```bash
GET /orders?externalOrderId=SAP-123
```

Retorna todos os pedidos cujo `externalOrderId` contenha "SAP-123" (ex: "SAP-12345", "SAP-123XX").

## Compatibilidade

✅ **Retrocompatível**: Todos os novos campos são opcionais  
✅ **Frontend não quebra**: Tipos estendidos sem remover campos existentes  
✅ **Migração idempotente**: Segura para executar múltiplas vezes  

## Performance

### Índices criados:
1. **BTREE em `external_order_id`**: Suporta ILIKE com performance aceitável
2. **GIN com pg_trgm** (opcional): Melhor performance para buscas textuais

### Recomendações:
- Para bases com > 100k pedidos, considere habilitar `pg_trgm`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```

## Testes

Execute os testes para validar:

```bash
npm test -- ordersController
npm test -- postgresOrderRepository
```

## Checklist de Implantação

- [x] Schema OpenAPI atualizado
- [x] Tipos do core estendidos
- [x] Migração SQL criada
- [x] Repository atualizado
- [x] Service atualizado
- [x] Controller atualizado
- [x] Frontend types atualizado
- [x] Documentação atualizada
- [x] CHANGELOG atualizado
- [ ] Executar migração em dev/staging
- [ ] Executar migração em produção
- [ ] Validar busca parcial funcionando
- [ ] Validar campos SAP no painel

## Próximos Passos

1. **Exibir campos no painel**: Atualizar `web/src/ui/KanbanBoard.tsx` para mostrar `docTotal` e `currency`
2. **Filtros avançados**: Adicionar filtros por valor total (range) e moeda
3. **Métricas**: Dashboard com totais por moeda

## Suporte

Em caso de dúvidas, consulte:
- `API_CONTRACTS/openapi.yaml` - Contrato completo
- `SAP_INTEGRATION_QUICKSTART.md` - Guia de integração SAP
- `CHANGELOG_SAP_INTEGRATION.md` - Histórico de mudanças
