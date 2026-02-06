# 🔧 Correção: React Error #31 (Object Rendering)

## 🐛 Erro Original

```
Uncaught Error: Minified React error #31
Objects are not valid as a React child (found: object with keys {message, error, statusCode})
```

## 🔍 Causa Raiz

O erro ocorria porque a API retorna objetos de erro no formato:
```json
{
  "message": "Erro detalhado",
  "error": "Tipo do erro",
  "statusCode": 500
}
```

E o código estava tentando **renderizar esse objeto diretamente** no React, ao invés de extrair a mensagem como string.

### Locais Problemáticos

1. **Interceptor do Axios** (`lib/api/client.ts`)
   - Retornava `error.response?.data` diretamente (objeto)
   - Componentes tentavam renderizar isso no JSX

2. **Componentes de Integração**
   - `SapConfigForm.tsx` - Tratamento de erro no `catch`
   - `SapStatusCard.tsx` - Tratamento de erro na sincronização

## ✅ Correções Aplicadas

### 1. Interceptor do Axios (Principal)

**Arquivo**: `web-next/lib/api/client.ts`

**Antes** (errado):
```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    return Promise.reject({
      status: error.response?.status,
      message: error.response?.data || error.message,  // ❌ Pode ser objeto
      originalError: error,
    });
  }
);
```

**Depois** (correto):
```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // Extrair mensagem de erro
    let errorMessage = "Erro desconhecido";
    
    if (error.response?.data) {
      const data = error.response.data;
      // Se data é string, usar diretamente
      if (typeof data === "string") {
        errorMessage = data;
      }
      // Se data é objeto, extrair message/error/details
      else if (typeof data === "object") {
        errorMessage = data.message || data.error || data.details || data.detail || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Retornar erro formatado sempre como string ✅
    return Promise.reject(new Error(errorMessage));
  }
);
```

### 2. SapConfigForm.tsx

**Teste de Conexão**:
```typescript
} catch (error: any) {
  // ✅ Garantir que sempre é string
  const errorMessage = typeof error === 'string' 
    ? error 
    : error?.message || error?.error || "Erro ao testar conexão";
  
  setTestResult({
    success: false,
    message: String(errorMessage),  // ✅ Converter para string
  });
  toast.error("Erro ao testar conexão", {
    description: String(errorMessage),  // ✅ Converter para string
  });
}
```

**Salvar Configuração**:
```typescript
} catch (error: any) {
  const errorMessage = typeof error === 'string'
    ? error
    : error?.message || error?.error || "Erro ao salvar configuração";
  
  toast.error("Erro ao salvar configuração", {
    description: String(errorMessage),  // ✅ Sempre string
  });
}
```

### 3. SapStatusCard.tsx

**Sincronização**:
```typescript
} catch (error: any) {
  const errorMessage = typeof error === 'string'
    ? error
    : error?.message || error?.error || "Falha ao sincronizar com SAP";
  
  toast.error("Erro na sincronização", {
    description: String(errorMessage),  // ✅ Sempre string
  });
}
```

## 📋 Arquivos Modificados

```
✅ web-next/lib/api/client.ts (interceptor)
✅ web-next/features/integration/components/SapConfigForm.tsx (2 locais)
✅ web-next/features/integration/components/SapStatusCard.tsx (1 local)
```

## 🚀 Deploy Atualizado

### Script de Deploy (Recomendado)

```bash
# No servidor VPS
cd /root/wms

# 1. Sincronizar código
git pull origin main

# 2. Rebuild (com correções)
docker-compose -f deploy/docker-compose.yml down web gateway
docker builder prune -f
docker-compose -f deploy/docker-compose.yml build --no-cache web gateway
docker-compose -f deploy/docker-compose.yml up -d web gateway

# 3. Verificar
docker logs -f wms-web
```

### Verificação Rápida

```bash
# Container rodando
docker ps | grep wms-web

# Sem erros nos logs
docker logs wms-web --tail 50 | grep -i error

# Endpoint responde
curl -I http://localhost:3000/

# Testar no navegador
# http://31.97.174.120:8080/integracao
# F12 → Console → Sem erros
```

## ✅ Checklist de Validação

Após deploy, testar:

### 1. Página Carrega
- [ ] ✅ `http://31.97.174.120:8080/integracao` acessível
- [ ] ✅ Sem "Application error"
- [ ] ✅ Sem "React error #31"
- [ ] ✅ Console sem erros

### 2. Funcionalidades
- [ ] ✅ Formulário de configuração carrega
- [ ] ✅ Testar conexão com credenciais inválidas → mostra **mensagem de erro como texto**
- [ ] ✅ Salvar configuração → mostra mensagem (sucesso ou erro)
- [ ] ✅ Sincronizar → mostra mensagem (sucesso ou erro)

### 3. Mensagens de Erro
- [ ] ✅ Erros aparecem como **texto legível** (não `[object Object]`)
- [ ] ✅ Toasts funcionam corretamente
- [ ] ✅ Sem crashes ao ocorrer erro

## 🔍 Como Testar Erros

### Teste 1: Conexão SAP Inválida
```
1. Ir para aba "Configuração"
2. Preencher com URL inválida ou credenciais erradas
3. Clicar "Testar Conexão"
4. Verificar:
   ✅ Mensagem de erro aparece como TEXTO
   ✅ Não aparece "[object Object]"
   ✅ Console sem "React error #31"
```

### Teste 2: API Indisponível
```
1. Parar o gateway: docker stop wms-gateway
2. Tentar sincronizar
3. Verificar:
   ✅ Mensagem de erro clara (ex: "Network Error")
   ✅ Não trava a aplicação
   ✅ Console sem "React error #31"
4. Religar: docker start wms-gateway
```

### Teste 3: Endpoint Não Encontrado
```
1. Abrir DevTools (F12)
2. Aba Network
3. Executar ação qualquer
4. Verificar:
   ✅ Se retornar 404/500, a mensagem é exibida como texto
   ✅ Não renderiza objeto JSON
```

## 📊 Antes vs Depois

### Antes (com erro)
```javascript
// Erro retornado pela API
{
  "message": "Connection refused",
  "error": "ECONNREFUSED",
  "statusCode": 500
}

// ❌ Tentava renderizar diretamente
<p>{error}</p>  // [object Object]

// ❌ React Error #31
// Uncaught Error: Objects are not valid as a React child
```

### Depois (corrigido)
```javascript
// Erro retornado pela API (mesmo objeto)
{
  "message": "Connection refused",
  "error": "ECONNREFUSED",
  "statusCode": 500
}

// ✅ Extrai a mensagem primeiro
const errorMessage = error.message || error.error || "Erro desconhecido";

// ✅ Renderiza como string
<p>{String(errorMessage)}</p>  // "Connection refused"

// ✅ Sem erros React
```

## 🧪 Testes Realizados

- [x] ✅ Lint verificado (0 erros)
- [x] ✅ TypeScript compila sem erros
- [x] ✅ Tratamento de erro como string
- [x] ✅ Tratamento de erro como objeto
- [x] ✅ Tratamento de erro undefined
- [x] ✅ Toasts com mensagens corretas

## 📝 Notas Técnicas

### Por que isso aconteceu?

1. **Backend retorna objetos de erro**:
   ```json
   {
     "message": "...",
     "error": "...",
     "statusCode": 500
   }
   ```

2. **Axios passa isso para `error.response.data`**

3. **Código tentava renderizar diretamente**:
   ```tsx
   <p>{error.message}</p>  // Se error.message for objeto → ❌
   ```

4. **React não permite renderizar objetos** → Error #31

### Solução

1. **Interceptor extrai sempre string**:
   - Verifica tipo de `data`
   - Extrai `message`, `error`, `details` ou `detail`
   - Retorna `new Error(string)`

2. **Componentes convertem para string**:
   - `String(errorMessage)`
   - Fallback para mensagem padrão

3. **Resultado**: Sempre renderizamos texto ✅

## 🚨 Importante

### Sempre usar `String()` ao renderizar erros:

```typescript
// ❌ ERRADO (pode quebrar)
<p>{error.message}</p>
toast.error("Erro", { description: error.message });

// ✅ CORRETO
<p>{String(error.message || "Erro desconhecido")}</p>
toast.error("Erro", { description: String(error.message || "Erro") });
```

### Sempre verificar tipo no catch:

```typescript
catch (error: any) {
  // ✅ Sempre extrair string primeiro
  const errorMessage = typeof error === 'string'
    ? error
    : error?.message || error?.error || "Erro padrão";
  
  // ✅ Converter para string ao usar
  console.error(String(errorMessage));
  toast.error(String(errorMessage));
}
```

## ✅ Status

- **Causa identificada**: ✅
- **Correções aplicadas**: ✅
- **Testes realizados**: ✅
- **Lint verificado**: ✅
- **Pronto para deploy**: ✅

---

**Data**: 2026-02-03  
**Erro**: React Error #31 (Object as React child)  
**Solução**: Sempre extrair string de erros antes de renderizar  
**Arquivos modificados**: 3  
**Tempo de correção**: ~10 minutos
