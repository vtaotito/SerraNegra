# Setup — Integração SAP B1 (Ambiente Development)

## Informações fornecidas

- **URL Base**: `https://us-5e4539432-sca.autosky.app`
- **Service Layer**: `/b1s/v1`
- **Token/Credencial**: `5645523035446576656C6F706D656E743A4F3037333033303632373973521D0E558BB79E56856BEB417665C888AF2B2E`

## Identificação do tipo de autenticação

O token fornecido parece ser:

1. **Token de sessão pré-gerado** (B1SESSION), ou
2. **Credencial codificada em hex** (possível formato: `base64(CompanyDB:Username:Password)` ou formato proprietário Autosky/SAP BTP)

### Testes recomendados

#### Opção 1: Token como B1SESSION (cookie direto)
Se o token for uma sessão válida pré-gerada:

```typescript
const client = new SapServiceLayerClient({
  baseUrl: "https://us-5e4539432-sca.autosky.app/b1s/v1",
  credentials: {
    companyDb: "", // não usado se sessão existente
    username: "",
    password: ""
  }
});

// Sobrescrever cookie manualmente (antes de qualquer request):
// @ts-ignore acesso interno
client.cookieHeader = "B1SESSION=5645523035446576656C6F706D656E743A4F3037333033303632373973521D0E558BB79E56856BEB417665C888AF2B2E";
```

#### Opção 2: Decode do token
Se o token for hex-encoded, decodifique primeiro:

```bash
# No Node.js REPL ou script:
Buffer.from('5645523035446576656C6F706D656E743A4F3037333033303632373973521D0E558BB79E56856BEB417665C888AF2B2E', 'hex').toString('utf8')
```

Resultado pode revelar: `CompanyDB:Username:...` ou outro formato.

#### Opção 3: Bearer token (se API Gateway / SAP BTP)
Alguns ambientes Autosky usam autenticação via header `Authorization: Bearer <token>`:

```typescript
await client.get("/Orders?$top=1", {
  headers: {
    "Authorization": "Bearer 5645523035446576656C6F706D656E743A4F3037333033303632373973521D0E558BB79E56856BEB417665C888AF2B2E"
  }
});
```

## Passos para descobrir o método correto

1. **Testar endpoint de health/metadata** (sem auth):
   ```bash
   curl https://us-5e4539432-sca.autosky.app/b1s/v1/$metadata
   ```

2. **Testar com token como Bearer**:
   ```bash
   curl -H "Authorization: Bearer 5645523035446576656C6F706D656E743A4F3037333033303632373973521D0E558BB79E56856BEB417665C888AF2B2E" \
     https://us-5e4539432-sca.autosky.app/b1s/v1/Orders?\$top=1
   ```

3. **Testar com cookie B1SESSION**:
   ```bash
   curl -H "Cookie: B1SESSION=5645523035446576656C6F706D656E743A4F3037333033303632373973521D0E558BB79E56856BEB417665C888AF2B2E" \
     https://us-5e4539432-sca.autosky.app/b1s/v1/Orders?\$top=1
   ```

4. **Contatar suporte Autosky/SAP** se nenhum método funcionar.

## Atualização do .env

Após identificar o método, atualize `.env`:

```bash
SAP_B1_BASE_URL=https://us-5e4539432-sca.autosky.app/b1s/v1
SAP_B1_COMPANY_DB=<obtido do decode ou suporte>
SAP_B1_USERNAME=<obtido do decode ou suporte>
SAP_B1_PASSWORD=<obtido do decode ou suporte>
SAP_B1_TOKEN=5645523035446576656C6F706D656E743A4F3037333033303632373973521D0E558BB79E56856BEB417665C888AF2B2E
```

## Próximos passos

1. Validar conectividade (ver `examples/basic-usage.ts`)
2. Descobrir estrutura de UDFs/UDTs (se existirem)
3. Implementar polling incremental (conforme `sap-b1-integration-contract.md`)
