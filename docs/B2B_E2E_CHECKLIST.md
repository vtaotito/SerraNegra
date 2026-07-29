# Checklist E2E — Cadastro B2B + Cotações (GSN)

Ambiente: Service Layer GSN + gateway + Painel + Portal B2B.

## Pré-requisitos

- [ ] `B2B_ADMIN_USER` / `B2B_ADMIN_PASSWORD` configurados no Painel
- [ ] Usuário Painel com role `comercial` e módulo `b2b`
- [ ] `EMAIL_COMMERCIAL` apontando para caixa de teste
- [ ] CNPJ de teste **fora** do SAP para cadastro novo
- [ ] BP publicado existente para teste de cotação

## 1. Cadastro novo

1. Portal → registrar empresa nova
2. Conferir e-mail “Cadastro recebido” (cliente) e “Novo cadastro B2B” (interno)
3. Painel → Cadastros B2B → abrir registro
4. Assumir análise → status `in_review` (+ e-mail opcional)
5. Escolher lista de preço (preview) + vendedor
6. **Aprovar e publicar**
7. SAP: `GET /BusinessPartners('{CardCode}')` → `PriceListNum`, `SalesPersonCode`, `Valid=tYES`
8. Conferir e-mail “Acesso liberado” + OTP (não deve ter chegado no passo 5 sem publish)

## 2. Cotação → pedido

1. Login portal com BP publicado
2. Carrinho → **Solicitar cotação**
3. SAP: `GET /Quotations({DocEntry})` com linhas e Comments contendo “Portal B2B”
4. Painel → Pedidos → aba Portal B2B → seção Cotações
5. Converter → pedido criado
6. SAP: `GET /Orders({DocEntry})` com `BaseType=23` nas linhas
7. Portal: lista mostra cotação convertida / pedido; e-mail com DocNum do pedido

## 3. Recusa de cotação

1. Nova cotação de teste
2. Painel → Recusar com motivo
3. SAP: cotação Cancel/Close
4. Cliente recebe e-mail com motivo

## 4. Sync OQUT

```bash
curl -X POST http://localhost:4000/api/sap/quotations/sync
```

Esperado: `{ ok: true, fetched: N, upserted: N }`.

## Falhas comuns

| Sintoma | Causa provável |
|---------|----------------|
| Publish 500 com UDF | Preencher UDFs fiscais na tela / `sap_error` |
| Quotation 400 Usage | Conferir `B2B_DEFAULT_USAGE` (default 10) |
| Convert falha BaseType | Ambiente pode exigir CopyTo — ver `docs/B2B_CADASTRO_E_COTACOES.md` |
| Sem preço no portal | BP sem `PriceListNum` ou item sem preço na lista |
