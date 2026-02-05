# 🚀 GUIA DE MIGRAÇÃO - React 18 → React 19

**Projeto**: WMS Frontend (Next.js)  
**Data**: 2026-02-05  
**Versão Atual**: React 18.3.1  
**Versão Alvo**: React 19.2.4

---

## 📋 RESUMO

### O que precisa ser feito:
1. ✅ Atualizar dependências (React, Next.js)
2. ✅ Remover `React.forwardRef` (3 arquivos)
3. ✅ Testar e validar

### Tempo estimado: **30 minutos**

---

## 🔧 PASSO 1: ATUALIZAR DEPENDÊNCIAS

### 1.1 Instalar React 19

```bash
cd web-next

# Atualizar React e React DOM
npm install react@19 react-dom@19

# Atualizar tipos
npm install -D @types/react@19 @types/react-dom@19

# Atualizar Next.js (para compatibilidade com React 19)
npm install next@latest eslint-config-next@latest

# Verificar versões instaladas
npm list react react-dom next
```

**Versões esperadas**:
- `react`: 19.x.x
- `react-dom`: 19.x.x
- `next`: 16.x.x
- `@types/react`: 19.x.x
- `@types/react-dom`: 19.x.x

---

## 🔧 PASSO 2: MIGRAR CÓDIGO

### 2.1 Arquivos a Modificar

**Total**: 3 arquivos
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/separator.tsx`

---

## 📝 PASSO 2.1: Atualizar button.tsx

### ANTES (React 18):

```typescript
import * as React from "react";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

### DEPOIS (React 19):

```typescript
import * as React from "react";

function Button({ 
  className, 
  variant, 
  size, 
  ref, 
  ...props 
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
}
Button.displayName = "Button";
```

**Mudanças**:
1. ❌ Removido `React.forwardRef`
2. ✅ `ref` agora é uma prop normal
3. ✅ Adicionado `ref` ao tipo de props

---

## 📝 PASSO 2.2: Atualizar card.tsx

### Componentes a migrar:
- `Card`
- `CardHeader`
- `CardTitle`
- `CardDescription`
- `CardContent`
- `CardFooter`

### Exemplo - Card:

**ANTES**:
```typescript
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";
```

**DEPOIS**:
```typescript
function Card({ 
  className, 
  ref, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { 
  ref?: React.Ref<HTMLDivElement> 
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow",
        className
      )}
      {...props}
    />
  );
}
Card.displayName = "Card";
```

**Aplicar o mesmo padrão para**:
- `CardHeader`
- `CardTitle`
- `CardDescription`
- `CardContent`
- `CardFooter`

---

## 📝 PASSO 2.3: Atualizar separator.tsx

**ANTES**:
```typescript
const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical";
  }
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
));
Separator.displayName = "Separator";
```

**DEPOIS**:
```typescript
function Separator({ 
  className, 
  orientation = "horizontal", 
  ref,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  );
}
Separator.displayName = "Separator";
```

---

## 🔧 PASSO 3: VALIDAÇÃO

### 3.1 TypeScript Check

```bash
npm run typecheck
```

**Esperado**: ✅ Sem erros

### 3.2 Build

```bash
npm run build
```

**Esperado**: ✅ Build bem-sucedido

### 3.3 Servidor Dev

```bash
npm run dev
```

**Esperado**: ✅ Servidor iniciado sem warnings

### 3.4 Teste Manual

Abrir `http://localhost:3002` e testar:
- ✅ Navegação funciona
- ✅ Botões funcionam
- ✅ Cards renderizam
- ✅ Separators aparecem
- ✅ Console sem erros

---

## 📊 CHECKLIST DE MIGRAÇÃO

### Pré-requisitos
- [ ] Commit do código atual (backup)
- [ ] Backend rodando (para testes)
- [ ] Terminal aberto em `web-next/`

### Atualização de Dependências
- [ ] `npm install react@19 react-dom@19`
- [ ] `npm install -D @types/react@19 @types/react-dom@19`
- [ ] `npm install next@latest eslint-config-next@latest`
- [ ] Verificar versões instaladas

### Migração de Código
- [ ] Atualizar `components/ui/button.tsx`
- [ ] Atualizar `components/ui/card.tsx` (6 componentes)
- [ ] Atualizar `components/ui/separator.tsx`

### Validação
- [ ] `npm run typecheck` ✅
- [ ] `npm run build` ✅
- [ ] `npm run dev` ✅
- [ ] Testar no navegador ✅

### Pós-migração
- [ ] Commit das mudanças
- [ ] Atualizar documentação
- [ ] Notificar equipe

---

## 🚨 TROUBLESHOOTING

### Erro: "Type error: Property 'ref' does not exist"

**Causa**: Tipo de props não inclui `ref`

**Solução**:
```typescript
// Adicionar ref ao tipo
type ButtonProps = {
  // ... outras props
  ref?: React.Ref<HTMLButtonElement>;
}
```

### Erro: "Cannot find module 'react/jsx-runtime'"

**Causa**: Versão incorreta do React

**Solução**:
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Build falha com erro de Next.js

**Causa**: Next.js incompatível com React 19

**Solução**:
```bash
# Atualizar Next.js para versão mais recente
npm install next@latest
```

---

## 🎯 BENEFÍCIOS DA MIGRAÇÃO

### Performance
- ✅ **React Compiler**: Otimizações automáticas
- ✅ **Menos re-renders**: Melhor memoization
- ✅ **Build menor**: Tree-shaking melhorado

### Developer Experience
- ✅ **Menos boilerplate**: Sem forwardRef
- ✅ **Tipos mais simples**: Ref como prop normal
- ✅ **Error messages melhores**: Stack traces mais claros

### Features Novas
- ✅ **use() hook**: Simplifica Context
- ✅ **useFormStatus**: Forms mais fáceis
- ✅ **useOptimistic**: UI otimista nativa
- ✅ **Server Components melhorados**: Streaming otimizado

---

## 📚 REFERÊNCIAS

- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19 Migration Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)

---

## ✅ CONCLUSÃO

**Dificuldade**: 🟢 FÁCIL  
**Tempo**: ⏱️ 30 minutos  
**Risco**: 🟢 BAIXO  
**Benefício**: 🟢 ALTO

**Recomendação**: ✅ **MIGRAR AGORA**

---

**Última atualização**: 2026-02-05  
**Próxima revisão**: Após migração
