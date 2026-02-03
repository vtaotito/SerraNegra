# Setup — Integração SAP B1 (Ambiente Development)

## Informações fornecidas

- **URL Base**: `https://REDACTED_SAP_HOST`
- **Service Layer**: `/b1s/v1`
- **Token/Credencial**: `REDACTED_TOKEN`

## Identificação do tipo de autenticação

O token fornecido parece ser:

1. **Token de sessão pré-gerado** (B1SESSION), ou
2. **Credencial codificada em hex** (possível formato: `base64(CompanyDB:Username:Password)` ou formato proprietário Autosky/SAP BTP)

### Testes recomendados

#### Opção 1: Token como B1SESSION (cookie direto)
Se o token for uma sessão válida pré-gerada:

```typescript
const client = new SapServiceLayerClient({
  baseUrl: "https://REDACTED_SAP_HOST/b1s/v1",
  credentials: {
    companyDb: "", // não usado se sessão existente
    username: "",
    password: ""
  }
});

// Sobrescrever cookie manualmente (antes de qualquer request):
// @ts-ignore acesso interno
client.cookieHeader = "B1SESSION=REDACTED_TOKEN";
```

#### Opção 2: Decode do token
Se o token for hex-encoded, decodifique primeiro:

```bash
# No Node.js REPL ou script:
Buffer.from('REDACTED_TOKEN', 'hex').toString('utf8')
```

Resultado pode revelar: `CompanyDB:Username:...` ou outro formato.

#### Opção 3: Bearer token (se API Gateway / SAP BTP)
Alguns ambientes Autosky usam autenticação via header `Authorization: Bearer <token>`:

```typescript
await client.get("/Orders?$top=1", {
  headers: {
    "Authorization": "Bearer REDACTED_TOKEN"
  }
});
```

## Passos para descobrir o método correto

1. **Testar endpoint de health/metadata** (sem auth):
   ```bash
   curl https://REDACTED_SAP_HOST/b1s/v1/$metadata
   ```

2. **Testar com token como Bearer**:
   ```bash
   curl -H "Authorization: Bearer REDACTED_TOKEN" \
     https://REDACTED_SAP_HOST/b1s/v1/Orders?\$top=1
   ```

3. **Testar com cookie B1SESSION**:
   ```bash
   curl -H "Cookie: B1SESSION=REDACTED_TOKEN" \
     https://REDACTED_SAP_HOST/b1s/v1/Orders?\$top=1
   ```

4. **Contatar suporte Autosky/SAP** se nenhum método funcionar.

## Atualização do .env

Após identificar o método, atualize `.env`:

```bash
SAP_B1_BASE_URL=https://REDACTED_SAP_HOST/b1s/v1
SAP_B1_COMPANY_DB=<obtido do decode ou suporte>
SAP_B1_USERNAME=<obtido do decode ou suporte>
SAP_B1_PASSWORD=<obtido do decode ou suporte>
SAP_B1_TOKEN=REDACTED_TOKEN
```

## Próximos passos

1. Validar conectividade (ver `examples/basic-usage.ts`)
2. Descobrir estrutura de UDFs/UDTs (se existirem)
3. Implementar polling incremental (conforme `sap-b1-integration-contract.md`)
