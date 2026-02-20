# Estrutura de Modulos do Projeto - Portal B2B de Pedidos

## Objetivo

Definir uma estrutura modular clara para o Portal B2B (cliente, vendedor e administracao),
aproveitando a base WMS ja existente e a integracao com SAP Business One via Service Layer.

## Modulos de negocio

### 1) Modulo Cliente B2B
- Login e area autenticada do cliente
- Catalogo de itens habilitados para o cliente
- Preco por cliente/item (preco especial)
- Criacao de pedido e acompanhamento de status
- Consulta de notas e pagamentos

### 2) Modulo Vendedor (Carteira)
- Lista de clientes da carteira
- Fila de pedidos/drafts para revisao
- Acompanhamento do funil (aprovacao -> faturamento -> entrega)

### 3) Modulo Administrativo
- Cadastro e governanca de clientes, itens e regras
- Parametrizacao de visibilidade de produtos por cliente
- Controle de sincronizacao SAP/WMS

### 4) Modulo Financeiro
- Consulta de faturas/notas
- Consulta de pagamentos recebidos
- Indicadores de inadimplencia e historico financeiro

## Mapeamento tecnico por camada

### Frontend (`web-next`)
- `features/orders` -> fluxo comercial e operacional de pedidos
- `features/products` -> catalogo de produtos
- `features/inventory` -> disponibilidade por deposito
- `features/integration` -> estado da integracao SAP
- `features/dashboard` -> visao consolidada

> Evolucao sugerida: criar submodulos `customers`, `sales` e `finance` em `web-next/features`
para refletir diretamente os modulos de negocio acima.

### Gateway (`gateway/src/routes/sap.ts`)
- Camada BFF para o frontend, encapsulando o Service Layer
- Novos endpoints do portal por modulo:
  - `GET /api/sap/business-partners`
  - `GET /api/sap/items`
  - `GET /api/sap/inventory`
  - `GET /api/sap/sales-persons`
  - `GET /api/sap/special-prices`
  - `GET /api/sap/drafts`
  - `GET /api/sap/invoices`
  - `GET /api/sap/incoming-payments`

### Servicos SAP (`gateway/src/services/sapEntitiesService.ts`)
- Metodos adicionados:
  - `listSalesPersons`
  - `listSpecialPrices`
  - `listDrafts`
  - `listInvoices`
  - `listIncomingPayments`
- Todos com fallback de consulta para maior compatibilidade entre versoes do Service Layer.

### Core API (`api`)
- Mantem dominio principal de pedidos/WMS e operacoes internas
- Pode consumir os dados sincronizados do SAP via rotas de sync existentes no gateway

## Matriz modulo -> endpoints SAP relevantes

| Modulo | Entidade SAP B1 | Endpoint Service Layer (base) |
|---|---|---|
| Cliente B2B | BusinessPartners | `/BusinessPartners` |
| Cliente B2B | Items | `/Items` |
| Cliente B2B | SpecialPrices | `/SpecialPrices` |
| Vendedor | Drafts | `/Drafts` |
| Vendedor | Orders | `/Orders` |
| Financeiro | Invoices | `/Invoices` |
| Financeiro | IncomingPayments | `/IncomingPayments` |
| Administrativo | SalesPersons | `/SalesPersons` |

## Estrutura alvo (alto nivel)

```text
/web-next/features
  /dashboard
  /integration
  /inventory
  /orders
  /products
  /customers        (sugerido)
  /sales            (sugerido)
  /finance          (sugerido)

/gateway/src
  /routes/sap.ts
  /services/sapEntitiesService.ts
  /services/sapOrdersService.ts
```

## Roadmap incremental

1. **M1 - Exposicao de dados SAP no gateway**  
   Concluido para entidades-chave do portal.

2. **M2 - Telas por modulo no frontend**  
   Implementar paginas e hooks para Cliente, Vendedor e Financeiro.

3. **M3 - Regras comerciais e aprovacao**  
   Workflow de aprovacao de pedidos/drafts por carteira.

4. **M4 - Indicadores e observabilidade**  
   Dashboard executivo com metricas de compra, faturamento e pendencias.
