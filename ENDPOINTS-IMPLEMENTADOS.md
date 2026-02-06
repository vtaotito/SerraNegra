# 📋 Endpoints Implementados - Catálogo e Inventário

**Data**: 2026-02-03  
**Status**: ✅ Completo e Funcional  
**API Base URL**: `http://localhost:8000`

---

## 🎯 Resumo

Foram implementados **TODOS** os endpoints de:

1. **`/api/v1/catalog/items`** - CRUD completo de produtos
2. **`/api/v1/catalog/warehouses`** - CRUD completo de armazéns
3. **`/api/v1/inventory`** - Gestão de estoque com ajustes e transferências

---

## 📦 1. Catálogo de Produtos (`/api/v1/catalog/items`)

### 🔵 GET `/api/v1/catalog/items` - Listar Produtos

Lista produtos com filtros e paginação.

**Headers**:
```http
X-User-Id: dev-user
X-User-Role: SUPERVISOR
Accept: application/json
```

**Query Parameters**:
| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `search` | string | Busca em código, nome, descrição ou barcode | `Dell` |
| `categoryId` | string | Filtrar por categoria | `CAT-ELETRONICOS` |
| `active` | boolean | Filtrar por status ativo/inativo | `true` |
| `limit` | number | Limite de resultados (padrão: 50) | `10` |
| `cursor` | string | Cursor para paginação | `PROD-003` |

**Exemplo de Requisição**:
```bash
curl 'http://localhost:8000/api/v1/catalog/items?limit=5&active=true' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR'
```

**Resposta (200 OK)**:
```json
{
  "data": [
    {
      "itemCode": "PROD-001",
      "itemName": "Notebook Dell Inspiron 15",
      "description": "Notebook Intel Core i5, 8GB RAM, 256GB SSD",
      "barcode": "7891234567890",
      "uomCode": "UN",
      "uomName": "Unidade",
      "weight": 1.8,
      "volume": 0.05,
      "categoryId": "CAT-ELETRONICOS",
      "categoryName": "Eletrônicos",
      "active": true,
      "createdAt": "2026-02-03T10:00:00.000Z",
      "updatedAt": "2026-02-03T10:00:00.000Z"
    }
  ],
  "nextCursor": "PROD-005"
}
```

---

### 🔵 GET `/api/v1/catalog/items/{itemCode}` - Buscar Produto

Busca um produto específico por código.

**Exemplo**:
```bash
curl 'http://localhost:8000/api/v1/catalog/items/PROD-001' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR'
```

**Resposta (200 OK)**:
```json
{
  "itemCode": "PROD-001",
  "itemName": "Notebook Dell Inspiron 15",
  "description": "Notebook Intel Core i5, 8GB RAM, 256GB SSD",
  "barcode": "7891234567890",
  "uomCode": "UN",
  "weight": 1.8,
  "volume": 0.05,
  "categoryId": "CAT-ELETRONICOS",
  "active": true,
  "createdAt": "2026-02-03T10:00:00.000Z",
  "updatedAt": "2026-02-03T10:00:00.000Z"
}
```

**Erro 404**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Item não encontrado."
  }
}
```

---

### 🟢 POST `/api/v1/catalog/items` - Criar Produto

Cria um novo produto.

**Headers**:
```http
Content-Type: application/json
X-User-Id: dev-user
X-User-Role: SUPERVISOR
```

**Body**:
```json
{
  "itemCode": "PROD-NEW-001",
  "itemName": "Produto Teste",
  "description": "Descrição do produto teste",
  "barcode": "1234567890123",
  "uomCode": "UN",
  "weight": 0.5,
  "volume": 0.01,
  "categoryId": "CAT-TESTE",
  "active": true
}
```

**Exemplo**:
```bash
curl -X POST 'http://localhost:8000/api/v1/catalog/items' \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR' \
  -d '{
    "itemCode": "PROD-NEW-001",
    "itemName": "Produto Teste",
    "description": "Descrição do produto teste",
    "active": true
  }'
```

**Resposta (201 Created)**:
```json
{
  "itemCode": "PROD-NEW-001",
  "itemName": "Produto Teste",
  "description": "Descrição do produto teste",
  "uomCode": "UN",
  "uomName": "Unidade",
  "active": true,
  "createdAt": "2026-02-03T15:30:00.000Z",
  "updatedAt": "2026-02-03T15:30:00.000Z"
}
```

**Validações**:
- ✅ `itemCode` é obrigatório e único
- ✅ `itemName` é obrigatório
- ✅ `weight` e `volume` não podem ser negativos
- ✅ Soft delete: não pode criar item com código já existente

---

### 🟡 PATCH `/api/v1/catalog/items/{itemCode}` - Atualizar Produto

Atualiza um produto existente (atualização parcial).

**Exemplo**:
```bash
curl -X PATCH 'http://localhost:8000/api/v1/catalog/items/PROD-001' \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR' \
  -d '{
    "description": "Nova descrição atualizada",
    "weight": 2.0
  }'
```

**Resposta (200 OK)**:
```json
{
  "itemCode": "PROD-001",
  "itemName": "Notebook Dell Inspiron 15",
  "description": "Nova descrição atualizada",
  "weight": 2.0,
  "active": true,
  "createdAt": "2026-02-03T10:00:00.000Z",
  "updatedAt": "2026-02-03T15:35:00.000Z"
}
```

---

### 🔴 DELETE `/api/v1/catalog/items/{itemCode}` - Deletar Produto

Desativa um produto (soft delete).

**Exemplo**:
```bash
curl -X DELETE 'http://localhost:8000/api/v1/catalog/items/PROD-NEW-001' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: ADMIN'
```

**Resposta (204 No Content)**: *Sem corpo*

**Nota**: ⚠️ O produto não é deletado fisicamente, apenas marcado como `active: false`.

---

## 🏭 2. Armazéns (`/api/v1/catalog/warehouses`)

### 🔵 GET `/api/v1/catalog/warehouses` - Listar Armazéns

Lista armazéns com filtros e paginação.

**Query Parameters**:
| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `search` | string | Busca em código, nome, cidade | `Principal` |
| `type` | string | Filtrar por tipo | `PRINCIPAL`, `SECUNDARIO`, `TERCEIROS` |
| `active` | boolean | Filtrar por status | `true` |
| `limit` | number | Limite de resultados | `10` |
| `cursor` | string | Cursor para paginação | `WH-SEC-01` |

**Exemplo**:
```bash
curl 'http://localhost:8000/api/v1/catalog/warehouses?limit=5' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR'
```

**Resposta (200 OK)**:
```json
{
  "data": [
    {
      "warehouseCode": "WH-PRINCIPAL",
      "warehouseName": "Armazém Principal",
      "location": "Galpão A - Setor Norte",
      "address": "Rua Industrial, 1000",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01310-100",
      "type": "PRINCIPAL",
      "active": true,
      "createdAt": "2026-02-03T10:00:00.000Z",
      "updatedAt": "2026-02-03T10:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

---

### 🔵 GET `/api/v1/catalog/warehouses/{warehouseCode}` - Buscar Armazém

### 🟢 POST `/api/v1/catalog/warehouses` - Criar Armazém

**Body**:
```json
{
  "warehouseCode": "WH-NEW-01",
  "warehouseName": "Novo Armazém",
  "location": "Galpão C",
  "address": "Rua Teste, 100",
  "city": "Rio de Janeiro",
  "state": "RJ",
  "zipCode": "20000-000",
  "type": "SECUNDARIO",
  "active": true
}
```

### 🟡 PATCH `/api/v1/catalog/warehouses/{warehouseCode}` - Atualizar Armazém

### 🔴 DELETE `/api/v1/catalog/warehouses/{warehouseCode}` - Deletar Armazém

---

## 📦 3. Inventário/Estoque (`/api/v1/inventory`)

### 🔵 GET `/api/v1/inventory` - Listar Estoque

Lista registros de estoque com filtros.

**Query Parameters**:
| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `itemCode` | string | Filtrar por produto | `PROD-001` |
| `warehouseCode` | string | Filtrar por armazém | `WH-PRINCIPAL` |
| `batchNumber` | string | Filtrar por lote | `BATCH-2026-001` |
| `minQuantity` | number | Quantidade mínima | `10` |
| `includeReserved` | boolean | Incluir quantidade reservada na filtragem | `true` |
| `limit` | number | Limite de resultados | `10` |
| `cursor` | string | Cursor para paginação | `PROD-001\|WH-PRINCIPAL` |

**Exemplo**:
```bash
curl 'http://localhost:8000/api/v1/inventory?limit=5&includeReserved=true' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR'
```

**Resposta (200 OK)**:
```json
{
  "data": [
    {
      "itemCode": "PROD-001",
      "itemName": "Notebook Dell Inspiron 15",
      "warehouseCode": "WH-PRINCIPAL",
      "warehouseName": "Armazém Principal",
      "quantityAvailable": 50,
      "quantityReserved": 5,
      "quantityInTransit": 10,
      "batchNumber": "BATCH-2026-001",
      "location": "A-01-01",
      "lastUpdated": "2026-02-03T10:00:00.000Z"
    }
  ],
  "nextCursor": "PROD-001|WH-SEC-01"
}
```

---

### 🔵 GET `/api/v1/inventory/{itemCode}/{warehouseCode}` - Buscar Estoque Específico

Busca estoque de um produto em um armazém específico.

**Exemplo**:
```bash
curl 'http://localhost:8000/api/v1/inventory/PROD-001/WH-PRINCIPAL' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR'
```

**Resposta (200 OK)**:
```json
{
  "itemCode": "PROD-001",
  "itemName": "Notebook Dell Inspiron 15",
  "warehouseCode": "WH-PRINCIPAL",
  "warehouseName": "Armazém Principal",
  "quantityAvailable": 50,
  "quantityReserved": 5,
  "quantityInTransit": 10,
  "batchNumber": "BATCH-2026-001",
  "location": "A-01-01",
  "lastUpdated": "2026-02-03T10:00:00.000Z"
}
```

---

### 🟢 POST `/api/v1/inventory/adjustments` - Ajustar Estoque

Realiza ajuste de estoque (adicionar, remover ou definir quantidade).

**Headers**:
```http
Content-Type: application/json
X-User-Id: dev-user
X-User-Role: SUPERVISOR
```

**Body**:
```json
{
  "itemCode": "PROD-001",
  "warehouseCode": "WH-PRINCIPAL",
  "quantity": 10,
  "adjustmentType": "ADD",
  "reason": "Recebimento de fornecedor",
  "batchNumber": "BATCH-2026-001",
  "location": "A-01-01",
  "notes": "Entrada ref NF-12345"
}
```

**Tipos de Ajuste** (`adjustmentType`):
- **`ADD`**: Adiciona quantidade ao estoque existente
- **`REMOVE`**: Remove quantidade do estoque (valida se há disponível)
- **`SET`**: Define quantidade absoluta (inventário)

**Exemplo - Adicionar**:
```bash
curl -X POST 'http://localhost:8000/api/v1/inventory/adjustments' \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR' \
  -d '{
    "itemCode": "PROD-001",
    "warehouseCode": "WH-PRINCIPAL",
    "quantity": 20,
    "adjustmentType": "ADD",
    "reason": "Recebimento de fornecedor"
  }'
```

**Resposta (201 Created)**:
```json
{
  "adjustmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "itemCode": "PROD-001",
  "warehouseCode": "WH-PRINCIPAL",
  "previousQuantity": 50,
  "newQuantity": 70,
  "adjustmentType": "ADD",
  "adjustedAt": "2026-02-03T15:40:00.000Z",
  "actorId": "dev-user"
}
```

**Exemplo - Remover**:
```bash
curl -X POST 'http://localhost:8000/api/v1/inventory/adjustments' \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR' \
  -d '{
    "itemCode": "PROD-001",
    "warehouseCode": "WH-PRINCIPAL",
    "quantity": 5,
    "adjustmentType": "REMOVE",
    "reason": "Produto danificado"
  }'
```

**Exemplo - Definir (Inventário)**:
```bash
curl -X POST 'http://localhost:8000/api/v1/inventory/adjustments' \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR' \
  -d '{
    "itemCode": "PROD-001",
    "warehouseCode": "WH-PRINCIPAL",
    "quantity": 100,
    "adjustmentType": "SET",
    "reason": "Contagem de inventário"
  }'
```

**Validações**:
- ✅ `itemCode`, `warehouseCode`, `quantity`, `adjustmentType`, `reason` são obrigatórios
- ✅ `quantity` deve ser positiva para `ADD` e `REMOVE`
- ✅ `quantity` não pode ser negativa para `SET`
- ✅ `REMOVE` valida se há quantidade disponível suficiente
- ✅ Cria registro de estoque automaticamente se não existir

---

### 🟢 POST `/api/v1/inventory/transfers` - Transferir Entre Armazéns

Transfere quantidade de um armazém para outro.

**Body**:
```json
{
  "itemCode": "PROD-001",
  "fromWarehouseCode": "WH-PRINCIPAL",
  "toWarehouseCode": "WH-SEC-01",
  "quantity": 10,
  "reason": "Reposição de estoque",
  "batchNumber": "BATCH-2026-001",
  "notes": "Transferência programada"
}
```

**Exemplo**:
```bash
curl -X POST 'http://localhost:8000/api/v1/inventory/transfers' \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: dev-user' \
  -H 'X-User-Role: SUPERVISOR' \
  -d '{
    "itemCode": "PROD-002",
    "fromWarehouseCode": "WH-PRINCIPAL",
    "toWarehouseCode": "WH-SEC-01",
    "quantity": 15,
    "reason": "Reposição de filial"
  }'
```

**Resposta (202 Accepted)**:
```json
{
  "transferId": "x1y2z3w4-a5b6-7890-cdef-123456789abc",
  "status": "PENDING",
  "itemCode": "PROD-002",
  "fromWarehouse": "WH-PRINCIPAL",
  "toWarehouse": "WH-SEC-01",
  "quantity": 15,
  "batchNumber": "TRF-x1y2z3w4",
  "createdAt": "2026-02-03T15:45:00.000Z"
}
```

**Status da Transferência**:
- **`PENDING`**: Transferência criada, aguardando processamento
- **`IN_TRANSIT`**: Em trânsito (futuro)
- **`COMPLETED`**: Concluída (futuro)
- **`CANCELLED`**: Cancelada (futuro)

**Comportamento**:
1. **Origem**: Quantidade deduzida de `quantityAvailable`, adicionada a `quantityInTransit`
2. **Destino**: Quantidade adicionada a `quantityInTransit` (aguardando recebimento)
3. **Status**: Fica como `PENDING` até confirmação futura

**Validações**:
- ✅ `itemCode`, `fromWarehouseCode`, `toWarehouseCode`, `quantity`, `reason` obrigatórios
- ✅ Armazéns de origem e destino devem ser diferentes
- ✅ `quantity` deve ser maior que zero
- ✅ Valida se há estoque disponível na origem
- ✅ Cria/atualiza registros de estoque em ambos os armazéns

---

## 🧪 Testando os Endpoints

### Setup Rápido

```bash
# 1. Iniciar API
cd c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms\api
npm run dev

# 2. Aguardar mensagem:
# "Core API online em :8000"
# "Stores inicializadas com dados de exemplo"
# "- Catálogo: 5 itens, 3 armazéns"
# "- Inventário: 6 registros de estoque"
```

### Script de Teste Completo (PowerShell)

Criar arquivo `test-catalog-inventory.ps1`:

```powershell
# Headers padrão
$headers = @{
    "Content-Type" = "application/json"
    "X-User-Id" = "dev-user"
    "X-User-Role" = "SUPERVISOR"
}

Write-Host "🧪 Testando Endpoints de Catálogo e Inventário" -ForegroundColor Cyan
Write-Host ""

# 1. Listar produtos
Write-Host "1️⃣  GET /api/v1/catalog/items" -ForegroundColor Blue
$items = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/catalog/items?limit=3" -Headers $headers
Write-Host "   ✅ $($items.data.Count) produtos retornados" -ForegroundColor Green
Write-Host ""

# 2. Buscar produto específico
Write-Host "2️⃣  GET /api/v1/catalog/items/PROD-001" -ForegroundColor Blue
$item = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/catalog/items/PROD-001" -Headers $headers
Write-Host "   ✅ $($item.itemName)" -ForegroundColor Green
Write-Host ""

# 3. Listar armazéns
Write-Host "3️⃣  GET /api/v1/catalog/warehouses" -ForegroundColor Blue
$warehouses = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/catalog/warehouses" -Headers $headers
Write-Host "   ✅ $($warehouses.data.Count) armazéns retornados" -ForegroundColor Green
Write-Host ""

# 4. Listar inventário
Write-Host "4️⃣  GET /api/v1/inventory" -ForegroundColor Blue
$inventory = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/inventory?limit=5" -Headers $headers
Write-Host "   ✅ $($inventory.data.Count) registros de estoque" -ForegroundColor Green
foreach ($inv in $inventory.data) {
    Write-Host "   - $($inv.itemCode): $($inv.quantityAvailable) un em $($inv.warehouseCode)" -ForegroundColor Gray
}
Write-Host ""

# 5. Ajustar estoque (ADD)
Write-Host "5️⃣  POST /api/v1/inventory/adjustments (ADD)" -ForegroundColor Blue
$adjustBody = @{
    itemCode = "PROD-001"
    warehouseCode = "WH-PRINCIPAL"
    quantity = 25
    adjustmentType = "ADD"
    reason = "Teste de entrada"
} | ConvertTo-Json

$adjust = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/inventory/adjustments" `
    -Method Post -Headers $headers -Body $adjustBody
Write-Host "   ✅ Ajuste realizado: $($adjust.previousQuantity) → $($adjust.newQuantity)" -ForegroundColor Green
Write-Host ""

# 6. Transferir estoque
Write-Host "6️⃣  POST /api/v1/inventory/transfers" -ForegroundColor Blue
$transferBody = @{
    itemCode = "PROD-002"
    fromWarehouseCode = "WH-PRINCIPAL"
    toWarehouseCode = "WH-SEC-01"
    quantity = 10
    reason = "Teste de transferência"
} | ConvertTo-Json

$transfer = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/inventory/transfers" `
    -Method Post -Headers $headers -Body $transferBody
Write-Host "   ✅ Transferência criada: ID=$($transfer.transferId.Substring(0,8))... Status=$($transfer.status)" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Todos os testes concluídos!" -ForegroundColor Green
```

Execute:
```powershell
.\test-catalog-inventory.ps1
```

---

## 📊 Dados de Exemplo (Seed)

### Produtos

| Código | Nome | Categoria | Peso (kg) | Status |
|--------|------|-----------|-----------|--------|
| PROD-001 | Notebook Dell Inspiron 15 | Eletrônicos | 1.8 | ✅ |
| PROD-002 | Mouse Logitech MX Master 3 | Periféricos | 0.14 | ✅ |
| PROD-003 | Teclado Mecânico Keychron K2 | Periféricos | 0.55 | ✅ |
| PROD-004 | Monitor LG UltraWide 29" | Monitores | 4.5 | ✅ |
| PROD-005 | Webcam Logitech C920 | Periféricos | 0.16 | ✅ |

### Armazéns

| Código | Nome | Tipo | Cidade |
|--------|------|------|--------|
| WH-PRINCIPAL | Armazém Principal | PRINCIPAL | São Paulo |
| WH-SEC-01 | Armazém Secundário - Centro | SECUNDARIO | São Paulo |
| WH-TERCEIROS | CD Terceiros - Logística XYZ | TERCEIROS | Jundiaí |

### Estoque Inicial

| Produto | Armazém | Disponível | Reservado | Em Trânsito |
|---------|---------|-----------|-----------|-------------|
| PROD-001 | WH-PRINCIPAL | 50 | 5 | 10 |
| PROD-001 | WH-SEC-01 | 20 | 2 | 0 |
| PROD-002 | WH-PRINCIPAL | 150 | 10 | 30 |
| PROD-003 | WH-PRINCIPAL | 80 | 8 | 0 |
| PROD-004 | WH-PRINCIPAL | 30 | 3 | 15 |
| PROD-005 | WH-PRINCIPAL | 100 | 5 | 20 |

---

## 🔒 Autenticação e Autorização

Todos os endpoints requerem:

**Headers obrigatórios**:
```http
X-User-Id: <user-id>
X-User-Role: <role>
```

**Roles permitidas**:
- `OPERADOR`: Apenas leitura
- `SUPERVISOR`: Leitura + ajustes de estoque
- `COMERCIAL`: Leitura + criar/atualizar produtos
- `ADMIN`: Acesso total (incluindo DELETE)

---

## ⚙️ Funcionalidades Implementadas

### ✅ Validações de Negócio

- [x] Código único para produtos e armazéns
- [x] Nomes obrigatórios
- [x] Peso e volume não negativos
- [x] Quantidade disponível para operações de remoção
- [x] Armazéns diferentes para transferências
- [x] Quantities positivas

### ✅ Persistência

- [x] Store in-memory completo
- [x] Seed com dados de exemplo
- [x] CRUD completo
- [x] Soft delete (marca como inativo)

### ✅ Histórico

- [x] Registro de todas as movimentações
- [x] Tracking de ajustes (ADD/REMOVE/SET)
- [x] Tracking de transferências
- [x] Timestamps de criação e atualização
- [x] Actor ID (quem fez a operação)

### ✅ Features Avançadas

- [x] Paginação com cursor
- [x] Busca full-text em múltiplos campos
- [x] Filtros combinados
- [x] Quantidades segregadas (disponível/reservado/em trânsito)
- [x] Batch numbers para rastreabilidade
- [x] Localização física (endereço no armazém)

---

## 📝 Próximos Passos (Futuro)

### Melhorias Possíveis

1. **Persistência Real**:
   - Substituir `CatalogStore` e `InventoryStore` por implementações com PostgreSQL
   - Usar `ProductService` e `StockService` do `wms-core/services`

2. **Integração SAP**:
   - Sincronizar produtos do SAP automaticamente
   - Consultar estoque real do SAP
   - Webhook para notificações de mudanças

3. **Features Adicionais**:
   - Confirmar recebimento de transferências (endpoint separado)
   - Cancelar transferências
   - Histórico detalhado de movimentações (endpoint GET)
   - Reserva de estoque para pedidos
   - Alerts de estoque baixo
   - Relatórios de movimentação

4. **Validações Extras**:
   - Verificar se produto existe no catálogo antes de criar estoque
   - Verificar se armazém existe antes de operações
   - Validar unidades de medida

---

## 🆘 Troubleshooting

### Erro: "Item não encontrado"
**Causa**: Código de produto não existe  
**Solução**: Listar produtos disponíveis com `GET /api/v1/catalog/items`

### Erro: "Quantidade insuficiente"
**Causa**: Tentando remover mais do que há disponível  
**Solução**: Consultar estoque com `GET /api/v1/inventory/{itemCode}/{warehouseCode}`

### Erro: "Item já existe"
**Causa**: Código de produto já cadastrado  
**Solução**: Usar código diferente ou atualizar o produto existente com PATCH

### Erro: "Armazéns devem ser diferentes"
**Causa**: Tentando transferir para o mesmo armazém  
**Solução**: Especificar armazéns diferentes em `fromWarehouseCode` e `toWarehouseCode`

---

## 📖 Referências

- **OpenAPI Spec**: `openapi-rest.yaml`
- **Código Fonte**:
  - Controllers: `api/controllers/catalogController.ts`, `api/controllers/inventoryController.ts`
  - Services: `api/services/catalogService.ts`, `api/services/inventoryService.ts`
  - DTOs: `api/dtos/catalog.ts`, `api/dtos/inventory.ts`
- **Testes**: `test-catalog-inventory.ps1`

---

**Status**: ✅ Pronto para uso em desenvolvimento  
**Última atualização**: 2026-02-03  
**Versão API**: v1
