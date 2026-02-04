# ✅ Validação Manual das Correções

Como o PowerShell está com problemas, use este guia para validar manualmente as correções.

---

## 1. Verificar Gateway (index.ts)

**Arquivo:** `gateway/src/index.ts`

### ✅ O que deve existir:
```typescript
import { registerSapRoutes } from "./routes/sap.js";
...
await registerSapRoutes(app);
```

### ❌ O que NÃO deve existir:
- Rotas SAP inline (linhas com `app.get("/api/sap/...`)
- Rotas SAP inline (linhas com `app.patch("/api/sap/...`)
- Import de `getSapService`
- Import de `SapOrdersFilter`
- Import de `SapOrderStatusUpdate`

**Como verificar:**
1. Abra `gateway/src/index.ts`
2. Procure por `app.get("/api/sap/` → **NÃO deve encontrar**
3. Procure por `registerSapRoutes(app)` → **DEVE encontrar**

---

## 2. Verificar Endpoint /api/sap/sync

**Arquivo:** `gateway/src/routes/sap.ts`

### ✅ O que deve existir:
```typescript
app.post("/api/sap/sync", async (req, reply) => {
  // Sincroniza pedidos SAP → WMS
  ...
});
```

**Como verificar:**
1. Abra `gateway/src/routes/sap.ts`
2. Role até o final do arquivo
3. Procure por `app.post("/api/sap/sync"` → **DEVE encontrar**
4. Verifique se há lógica de sincronização (buscar pedidos SAP, criar no WMS)

---

## 3. Verificar Tipos SAP

**Arquivo:** `sap-connector/src/types.ts`

### ✅ O que deve existir em SapOrder:
```typescript
export type SapOrder = {
  DocEntry: number;
  DocNum: number;
  ...
  DocTotal?: number;        // ← DEVE ter
  DocCurrency?: string;     // ← DEVE ter
  ...
};
```

**Como verificar:**
1. Abra `sap-connector/src/types.ts`
2. Procure por `export type SapOrder`
3. Verifique se `DocTotal?:` existe
4. Verifique se `DocCurrency?:` existe

---

## 4. Verificar sapService.ts

**Arquivo:** `gateway/src/sapService.ts`

### ✅ O que deve existir:
```typescript
import { SapOrder, SapOrdersCollection } from "../../sap-connector/src/types.js";
```

### ❌ O que NÃO deve existir:
```typescript
import { ... } from "../../sap-connector/src/sapTypes.js"; // ← NÃO deve ter
```

**Como verificar:**
1. Abra `gateway/src/sapService.ts`
2. Veja as primeiras linhas (imports)
3. Verifique se importa de `types.js` → **SIM**
4. Verifique se importa de `sapTypes.js` → **NÃO**

---

## 5. Checklist Rápido

Marque cada item conforme verifica:

- [ ] `gateway/src/index.ts` não tem rotas SAP inline
- [ ] `gateway/src/index.ts` chama `registerSapRoutes(app)`
- [ ] `gateway/src/routes/sap.ts` tem endpoint `POST /api/sap/sync`
- [ ] `sap-connector/src/types.ts` tem `DocTotal` em SapOrder
- [ ] `sap-connector/src/types.ts` tem `DocCurrency` em SapOrder
- [ ] `gateway/src/sapService.ts` importa de `types.js` (não `sapTypes.js`)

---

## 6. Testar Funcionalmente

### Opção A: Compilar TypeScript

```bash
cd gateway
npm run build
```

**Resultado esperado:** Compilação sem erros

### Opção B: Iniciar Gateway

```bash
cd gateway
npm run dev
```

**Resultado esperado:** 
- Gateway inicia em `http://localhost:3000`
- Log: "Rotas SAP registradas"
- Sem erros no console

### Opção C: Testar Endpoint

```bash
curl http://localhost:3000/api/sap/health
```

**Resultado esperado:**
```json
{
  "status": "ok" ou "error",
  "message": "...",
  "timestamp": "..."
}
```

---

## ✅ Se Tudo Estiver OK

Você verá:
1. ✅ Código compila sem erros
2. ✅ Gateway inicia sem erros
3. ✅ Endpoint `/api/sap/health` responde
4. ✅ Endpoint `/api/sap/sync` existe no código
5. ✅ Tipos estão completos

**Próximo passo:** Testar com credenciais SAP reais!

---

## ❌ Se Algo Estiver Errado

Revise os arquivos indicados acima e compare com os exemplos.

Se precisar de ajuda, consulte:
- `REVIEW_AND_FIXES.md` - Detalhes das correções
- `FINAL_REPORT.md` - Relatório completo
