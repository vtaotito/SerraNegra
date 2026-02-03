# 🚀 Guia Rápido — Dashboard WMS

## ⚡ Início Rápido (2 minutos)

### 1. Instalar dependências

```bash
cd web
npm install
```

### 2. Rodar em modo desenvolvimento (com mock)

```bash
npm run dev
```

Acesse: **http://localhost:5173**

> 💡 Por padrão, o app usa **mock local** com 36 pedidos de exemplo.

---

## 🎮 Como Usar

### 🔄 Trocar Perfil
No canto superior direito, selecione:
- **Logística** → pode enviar eventos e liberar onda
- **Comercial** → pode reprocessar pedidos
- **Admin** → todas as permissões

### 🔍 Filtrar Pedidos
Use a barra de filtros para:
- Buscar por ID do pedido, cliente, etc.
- Filtrar por SLA (Atrasado / Vence em 4h / OK)
- Filtrar por Transportadora
- Filtrar por Prioridade (P1/P2/P3)

### 🖱️ Mover Pedidos (Drag & Drop)
1. **Arraste** um card de uma coluna para outra
2. O sistema valida a transição pela state machine
3. Se válida, envia o evento correspondente
4. Toast de sucesso/erro aparece
5. Kanban atualiza automaticamente

### 📋 Ver Detalhes
1. **Clique** em qualquer card
2. Drawer abre à direita com:
   - Resumo (status, transportadora, prioridade, SLA)
   - Ações (transição, liberar onda, reprocessar)
   - Itens do pedido
   - Pendências
   - Histórico completo (audit trail)
   - Histórico de bipagem

---

## 🔌 Conectar à API Real

### 1. Criar arquivo `.env`

```bash
cd web
cp .env.example .env
```

### 2. Editar `.env`

```bash
# Apontar para sua API
VITE_API_BASE_URL=https://api.example.com

# Remover ou comentar a linha abaixo
# VITE_USE_MOCK=true
```

### 3. Reiniciar o servidor

```bash
npm run dev
```

Agora o app usa a **API real** em vez do mock.

---

## 🏗️ Build de Produção

```bash
npm run build
```

Arquivos gerados em `dist/`:
- `index.html`
- `assets/index-*.css` (~10 KB gzipped)
- `assets/index-*.js` (~85 KB gzipped)

### Preview do Build

```bash
npm run preview
```

Acesse: **http://localhost:4173**

---

## 🧪 Validar TypeScript

```bash
npm run typecheck
```

Deve retornar **sem erros**.

---

## 📁 Estrutura Rápida

```
web/
├── src/
│   ├── api/              # Camada de API + mock
│   ├── auth/             # Permissões
│   ├── pages/            # OrdersDashboard
│   ├── ui/               # Componentes (Kanban, Drawer, etc.)
│   ├── App.tsx           # Root component
│   └── styles.css        # CSS global (Trello-like)
├── .env.example          # Template de configuração
├── package.json
└── README.md             # Documentação completa
```

---

## 🎯 Funcionalidades Principais

| Funcionalidade | Descrição |
|----------------|-----------|
| **Kanban** | 6 colunas por status com drag & drop |
| **Filtros** | Busca + SLA + Transportadora + Prioridade |
| **Drawer** | Detalhe completo do pedido |
| **Permissões** | Ações controladas por perfil |
| **Toast** | Feedback instantâneo de ações |
| **Loading** | Skeleton loaders + spinners |
| **Mock** | 36 pedidos de exemplo |

---

## 🐛 Troubleshooting

### Porta 5173 já em uso
```bash
# Matar processo na porta 5173
npx kill-port 5173

# Ou alterar porta no vite.config.ts
```

### Erro de TypeScript
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
npm run typecheck
```

### API não responde
```bash
# Forçar uso do mock
echo "VITE_USE_MOCK=true" > .env
npm run dev
```

---

## 📚 Documentação Completa

- **README.md** — Documentação técnica completa
- **IMPROVEMENTS.md** — Detalhes das melhorias de UI/UX
- **API_CONTRACTS/** — Contratos OpenAPI (raiz do projeto)

---

## 💡 Dicas

1. **Mock vs API Real**: O mock é perfeito para desenvolvimento e demos. Use a API real para testes de integração.

2. **Drag & Drop**: Só funciona para transições válidas pela state machine. Ex: "A separar" → "Em separação" ✅, mas "A separar" → "Despachado" ❌.

3. **Permissões**: Troque o perfil no topbar para testar diferentes permissões.

4. **Refetch Automático**: A cada 15 segundos, o app busca novos pedidos automaticamente.

5. **Toast Notifications**: Todas as ações (drag, botões) mostram feedback visual.

---

## 🎉 Pronto!

Agora você tem um dashboard moderno e funcional. Explore, teste e customize conforme necessário! 🚀
