# Setup — Integração SAP B1 (Ambiente Development)

## Informações necessárias

- **URL Base**: Obtenha com o administrador SAP (ex: `https://your-sap-server:50000`)
- **Service Layer**: `/b1s/v1`
- **Credenciais**: Usuário e senha do SAP B1

## Identificação do tipo de autenticação

O SAP B1 Service Layer suporta:

1. **Autenticação por sessão** (Login → Cookie B1SESSION) — **Método recomendado**
2. **Token pré-gerado** (B1SESSION cookie direto)

### Configuração

#### Opção 1: Autenticação por sessão (recomendado)

```typescript
const client = new SapServiceLayerClient({
  baseUrl: "https://your-sap-server:50000/b1s/v1",
  credentials: {
    companyDb: "YOUR_COMPANY_DB",
    username: "your_username",
    password: "your_password"
  }
});
```

#### Opção 2: Token pré-gerado

```typescript
const client = new SapServiceLayerClient({
  baseUrl: "https://your-sap-server:50000/b1s/v1",
  credentials: {
    companyDb: "",
    username: "",
    password: ""
  }
});
// Sobrescrever cookie manualmente:
// @ts-ignore acesso interno
client.cookieHeader = "B1SESSION=YOUR_SESSION_TOKEN";
```

## Passos para validar a conexão

1. **Testar endpoint de metadata** (sem auth):
   ```bash
   curl https://your-sap-server:50000/b1s/v1/$metadata
   ```

2. **Testar com credenciais**:
   ```bash
   curl -X POST https://your-sap-server:50000/b1s/v1/Login \
     -H "Content-Type: application/json" \
     -d '{"CompanyDB":"YOUR_COMPANY_DB","UserName":"your_user","Password":"your_pass"}'
   ```

## Atualização do .env

Configure as variáveis de ambiente no arquivo `.env`:

```bash
SAP_B1_BASE_URL=https://your-sap-server:50000/b1s/v1
SAP_B1_COMPANY_DB=YOUR_COMPANY_DB
SAP_B1_USERNAME=your_username
SAP_B1_PASSWORD=your_password
```

> **IMPORTANTE**: Nunca commite o arquivo `.env` com credenciais reais.

## Próximos passos

1. Validar conectividade (ver `examples/basic-usage.ts`)
2. Descobrir estrutura de UDFs/UDTs (se existirem)
3. Implementar polling incremental (conforme `sap-b1-integration-contract.md`)
