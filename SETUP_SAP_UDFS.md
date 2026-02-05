# 📝 Setup de UDFs no SAP B1 - Manual Passo a Passo

Este documento detalha como criar os User-Defined Fields (UDFs) necessários para a integração WMS no SAP Business One.

---

## 🎯 Objetivo

Criar campos customizados na tabela de Pedidos (Orders/ORDR) para rastrear o status e informações do WMS dentro do SAP B1.

---

## 📋 UDFs Necessários

| Nome | Tipo | Tamanho | Descrição |
|------|------|---------|-----------|
| `U_WMS_STATUS` | Alphanumeric | 100 | Status atual do pedido no WMS |
| `U_WMS_ORDERID` | Alphanumeric | 100 | ID interno do pedido no WMS |
| `U_WMS_LAST_EVENT` | Alphanumeric | 100 | Último evento processado |
| `U_WMS_LAST_TS` | Date/Time | - | Timestamp da última atualização |
| `U_WMS_CORR_ID` | Alphanumeric | 100 | Correlation ID para rastreamento |

---

## 🔧 Passo a Passo - Criação de UDFs

### 1. Abrir SAP Business One Client

1. Faça login no SAP B1 Client
2. Use credenciais de administrador

### 2. Acessar Customization Tools

1. No menu superior, clique em **Tools**
2. Selecione **Customization Tools**
3. Clique em **User-Defined Fields - Management**

![Menu Path](https://i.imgur.com/example.png)

### 3. Selecionar Tabela

1. Na janela "User-Defined Fields - Management"
2. Clique no dropdown **"Table"**
3. Selecione: **"Marketing Documents - Rows (ORDR)"**
   - ⚠️ **IMPORTANTE**: Escolha a tabela de **cabeçalho** (ORDR), não as linhas (RDR1)

### 4. Criar Primeiro UDF - U_WMS_STATUS

1. Clique no botão **"Add"** (ou **"Adicionar"**)
2. Preencha os campos:

   ```
   Name: WMS_STATUS
   Description: WMS Status
   Type: Alphanumeric
   Size: 100
   Valid Values: (deixe em branco)
   Default Value: (deixe em branco)
   Mandatory: No
   ```

3. Clique em **"Add"** ou **"OK"**

### 5. Criar UDF - U_WMS_ORDERID

1. Clique novamente em **"Add"**
2. Preencha:

   ```
   Name: WMS_ORDERID
   Description: WMS Order ID
   Type: Alphanumeric
   Size: 100
   Valid Values: (deixe em branco)
   Default Value: (deixe em branco)
   Mandatory: No
   ```

3. Clique em **"Add"** ou **"OK"**

### 6. Criar UDF - U_WMS_LAST_EVENT

1. Clique em **"Add"**
2. Preencha:

   ```
   Name: WMS_LAST_EVENT
   Description: WMS Last Event
   Type: Alphanumeric
   Size: 100
   Valid Values: (deixe em branco)
   Default Value: (deixe em branco)
   Mandatory: No
   ```

3. Clique em **"Add"** ou **"OK"**

### 7. Criar UDF - U_WMS_LAST_TS

1. Clique em **"Add"**
2. Preencha:

   ```
   Name: WMS_LAST_TS
   Description: WMS Last Timestamp
   Type: Date/Time
   Valid Values: (deixe em branco)
   Default Value: (deixe em branco)
   Mandatory: No
   ```

3. Clique em **"Add"** ou **"OK"**

### 8. Criar UDF - U_WMS_CORR_ID

1. Clique em **"Add"**
2. Preencha:

   ```
   Name: WMS_CORR_ID
   Description: WMS Correlation ID
   Type: Alphanumeric
   Size: 100
   Valid Values: (deixe em branco)
   Default Value: (deixe em branco)
   Mandatory: No
   ```

3. Clique em **"Add"** ou **"OK"**

---

## ✅ Validação

### Verificar UDFs Criados

1. Na janela "User-Defined Fields - Management"
2. Certifique-se de que a tabela **ORDR** está selecionada
3. Verifique se todos os 5 UDFs aparecem na lista:
   - ✅ U_WMS_STATUS
   - ✅ U_WMS_ORDERID
   - ✅ U_WMS_LAST_EVENT
   - ✅ U_WMS_LAST_TS
   - ✅ U_WMS_CORR_ID

### Testar Manualmente (Opcional)

1. Abra um Pedido de Venda (Sales Order)
2. No formulário do pedido, procure pela aba **"User-Defined Fields"** ou role até o final
3. Você deve ver os novos campos criados

---

## 🧪 Validação Automática

Após criar os UDFs, execute o script de validação:

```bash
npm run sap:validate-setup
```

**Resultado esperado**:
```
3️⃣  Verificação de UDFs
   --------------------------------------------------
   📋 Status dos UDFs:
      ✅ U_WMS_STATUS: (vazio)
      ✅ U_WMS_ORDERID: (vazio)
      ✅ U_WMS_LAST_EVENT: (vazio)
      ✅ U_WMS_LAST_TS: (vazio)
      ✅ U_WMS_CORR_ID: (vazio)

   ✅ Todos os 5 UDFs estão configurados!
```

---

## 📊 Uso dos UDFs na Integração

### Leitura (GET)

```typescript
// Service Layer query
GET /Orders(123)?$select=DocEntry,DocNum,U_WMS_STATUS,U_WMS_ORDERID

// Resposta
{
  "DocEntry": 123,
  "DocNum": 1001,
  "U_WMS_STATUS": "EM_SEPARACAO",
  "U_WMS_ORDERID": "WMS-2024-001"
}
```

### Escrita (PATCH)

```typescript
// Atualizar status
PATCH /Orders(123)
{
  "U_WMS_STATUS": "CONFERIDO",
  "U_WMS_LAST_EVENT": "CONFERIR",
  "U_WMS_LAST_TS": "2024-02-05T18:30:00Z",
  "U_WMS_CORR_ID": "corr-123-456"
}
```

---

## 🚨 Troubleshooting

### Problema: Não consigo ver o menu "Customization Tools"

**Solução**: Você precisa de permissões de administrador. Entre em contato com o administrador SAP da empresa.

### Problema: UDF não aparece na lista depois de criado

**Solução**: 
1. Feche e reabra o SAP B1 Client
2. Verifique se selecionou a tabela correta (ORDR)
3. Execute a query SQL no SQL Server:
   ```sql
   SELECT AliasID, Descr FROM CUFD WHERE TableID = 'ORDR' AND AliasID LIKE 'WMS%'
   ```

### Problema: Erro 400 ao tentar ler/escrever UDFs via Service Layer

**Possíveis causas**:
1. UDFs não foram criados corretamente
2. Nome do UDF está incorreto (deve começar com `U_`)
3. Service Layer precisa ser reiniciado após criação dos UDFs

**Solução**:
1. Validar nomes dos UDFs no SAP
2. Reiniciar IIS (onde roda o Service Layer)
3. Testar novamente com `npm run sap:validate-setup`

### Problema: UDF criado mas não aceita valores

**Solução**: Verifique:
1. Tipo de dado correto (Alphanumeric vs Date/Time)
2. Tamanho suficiente (100 caracteres recomendado)
3. Não está marcado como "Mandatory" se não for obrigatório

---

## 📖 Referências

- [SAP B1 SDK Help - User-Defined Fields](https://help.sap.com/doc/saphelp_sbo92/9.2/en-US/45/b1ff76446211d18ac90000e829fbfe/content.htm)
- [Service Layer API - UDFs](https://help.sap.com/doc/0831cbd5e8c54c2a9d1f12db7e17845e/10.0/en-US/Working_with_SAP_Business_One_Service_Layer.pdf)

---

## 📞 Suporte

Se tiver problemas na criação dos UDFs, entre em contato com:
- **SAP Partner/Consultor**: Para questões técnicas do SAP B1
- **Time de Desenvolvimento WMS**: Para questões de integração

---

**Documento criado**: 2026-02-05  
**Versão**: 1.0  
**Status**: Pronto para uso
