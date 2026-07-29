# B2B — Cadastro de clientes e cotações (SAP)

## Fluxo de cadastro (novo PN)

| Etapa | Status local | Ação | Comunicação |
|-------|--------------|------|-------------|
| Solicitado | `pending` | Cliente envia formulário no portal | E-mail ao cliente + e-mail interno dedicado (`sendInternalNewRegistrationNotification`) |
| Em análise | `in_review` | Comercial assume no Painel (`POST …/review`) | E-mail opcional ao cliente |
| Rejeitado | `rejected` | Comercial rejeita com motivo | E-mail com motivo |
| Ativo | `published` | **Aprovar e publicar** (PriceList + vendedor) → `POST /BusinessPartners` | E-mail “acesso liberado” + OTP **somente após publish** |

UI: Painel → **Cadastros B2B** (`/b2b-cadastros`). Role: `admin` | `supervisor` | `comercial` (módulo `b2b`).

### Campos SAP no publish (BusinessPartners)

| Grupo | Campos | Obrigatório |
|-------|--------|-------------|
| Identidade | `CardCode`, `CardName`, `CardForeignName`, `FederalTaxID`, `CardType=cCustomer` | Sim |
| Contato | `EmailAddress`, `Phone1`, `ContactEmployees` | E-mail sim |
| Endereços | `BPAddresses` COB/ENT | Sim |
| Fiscal | IE (`U_TX_IE` / `inscricao_estadual`), UDFs `udf_bp` / `udf_addr` | IE (default ISENTO) |
| Comercial (aprovador) | `PriceListNum`, `SalesPersonCode`, `GroupCode`, `Currency` | **PriceListNum + SalesPersonCode** |
| Branch/pagamento | `BPBranchAssignment`, `BPPaymentMethods` | Defaults |

Sem BP publicado (`Valid` + lista de preço), o cliente **não compra**.

Listas de preço: Painel → **Listas de preço** (`/b2b-listas-preco`) ou picker na tela de aprovação. Endpoints: `GET /b2b/admin/price-lists`, `GET /b2b/admin/price-lists/:id/preview`.

---

## Fluxo cotação → pedido

1. Cliente envia carrinho no portal → gateway `POST /Quotations` (OQUT) + espelho `b2b_quotations`.
2. Painel (Pedidos → Portal B2B) lista cotações abertas.
3. **Aprovar → Pedido:** `POST /Orders` com `BaseType=23`, `BaseEntry`, `BaseLine`.
4. **Recusar:** `Cancel`/`Close` da cotação no SAP + e-mail ao cliente.

Path do carrinho permanece `POST /b2b/orders` (compatibilidade); semanticamente cria cotação.

### Endpoints admin

| Método | Path | Função |
|--------|------|--------|
| GET | `/b2b/admin/quotations` | Lista |
| GET/PATCH | `/b2b/admin/quotations/:id` | Detalhe / ajuste linhas |
| POST | `/b2b/admin/quotations/:id/convert` | Cotação → Pedido |
| POST | `/b2b/admin/quotations/:id/reject` | Recusa |

### Sync OQUT

`runQuotationsSync()` no scheduler (`dailySync`) lê `/Quotations` dos últimos 90 dias e faz upsert em `b2b_quotations` (não sobrescreve status locais `convertida` / `recusada`).

---

## Validação E2E (Service Layer GSN)

Checklist manual no ambiente GSN:

1. **Cadastro novo**
   - Registrar CNPJ de teste no portal → status `pending`.
   - Painel: assumir análise → `in_review`.
   - Selecionar lista de preço + vendedor → **Aprovar e publicar**.
   - Confirmar BP em `GET /BusinessPartners('…')` com `PriceListNum` e `SalesPersonCode`.
   - Conferir e-mail de liberação + OTP (não deve chegar no approve sem publish).

2. **Cotação**
   - Login com BP publicado → carrinho → **Solicitar cotação**.
   - Confirmar documento em `GET /Quotations({DocEntry})`.
   - Painel: converter → `GET /Orders({DocEntry})` com linhas baseadas na cotação (`BaseType` 23).
   - Recusar outra cotação → status fechado/cancelado no SAP + e-mail.

3. **Payload mínimo Quotation (referência)**

```json
{
  "CardCode": "Cxxxxx",
  "DocDueDate": "2026-08-05",
  "Comments": "Cotacao via Portal B2B",
  "BPL_IDAssignedToInvoice": 1,
  "DocumentLines": [
    {
      "ItemCode": "SKU",
      "Quantity": 10,
      "WarehouseCode": "01.02",
      "Usage": 10
    }
  ]
}
```

Se `UnitPrice` for omitido, o SAP usa a lista do BP (`resolveUnitPrices` envia preço só quando disponível).

4. **Conversão**

Linhas do pedido devem incluir `BaseType: 23`, `BaseEntry: <DocEntry OQUT>`, `BaseLine: <LineNum>`. Se o ambiente GSN exigir CopyTo em vez de BaseType, ajustar o handler `convert` em `gateway/src/routes/b2b.ts`.
