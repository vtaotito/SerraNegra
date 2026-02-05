# WMS/OMS Frontend - Sistema de Gestão de Pedidos

Frontend moderno para sistema de gestão de pedidos com integração SAP Business One.

## 🚀 Stack Tecnológica

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: TailwindCSS + shadcn/ui
- **Data Fetching**: TanStack Query (React Query)
- **Tabelas**: TanStack Table
- **Forms**: React Hook Form + Zod
- **Datas**: date-fns
- **Ícones**: Lucide React
- **Gráficos**: Recharts

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn
- Backend WMS rodando em `http://localhost:8000`

## 🛠️ Instalação

```bash
# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env.local

# Editar .env.local com as configurações corretas
```

## 🔧 Configuração

### Variáveis de Ambiente (.env.local)

```bash
# API
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000

# Auth (desenvolvimento)
NEXT_PUBLIC_DEV_USER_ID=dev-user
NEXT_PUBLIC_DEV_USER_ROLE=SUPERVISOR
NEXT_PUBLIC_DEV_USER_NAME=Usuário Dev

# Features
NEXT_PUBLIC_ENABLE_MOCK=false
NEXT_PUBLIC_ENABLE_DEVTOOLS=true
```

## 🎯 Executar

### Desenvolvimento

```bash
npm run dev
```

Acesse: `http://localhost:3001`

### Produção

```bash
# Build
npm run build

# Start
npm run start
```

### Type Check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

## 📂 Estrutura do Projeto

```
web-next/
├── app/                      # App Router (Next.js 15)
│   ├── layout.tsx            # Layout raiz
│   ├── page.tsx              # Dashboard
│   ├── providers.tsx         # Providers (React Query)
│   ├── pedidos/              # Pedidos
│   ├── produtos/             # Produtos
│   └── estoque/              # Estoque
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── layout/               # Layout components (Sidebar, Topbar)
│   └── shared/               # Shared components
├── features/                 # Features por domínio
│   ├── orders/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── products/
│   ├── inventory/
│   └── dashboard/
├── lib/
│   ├── api/                  # API client, endpoints
│   ├── schemas/              # Zod schemas
│   ├── utils/                # Utilitários (cn, format)
│   └── constants/            # Constantes (status, colors)
└── styles/
    └── globals.css           # Estilos globais
```

## 🎨 Design System

### Cores de Status

- **A Separar**: Azul (`#3B82F6`)
- **Em Separação**: Âmbar (`#F59E0B`)
- **Conferido**: Violeta (`#8B5CF6`)
- **Aguardando Cotação**: Rosa (`#EC4899`)
- **Aguardando Coleta**: Verde (`#10B981`)
- **Despachado**: Ciano (`#06B6D4`)

### Status de Sincronização

- **Sincronizado**: Verde (`#10B981`)
- **Pendente**: Âmbar (`#F59E0B`)
- **Erro**: Vermelho (`#EF4444`)

## 🔐 Autenticação

### Modo Desenvolvimento (atual)

O sistema usa headers de autenticação configuráveis via `.env.local`:

```typescript
headers: {
  "X-User-Id": "dev-user",
  "X-User-Role": "SUPERVISOR",
  "X-User-Name": "Usuário Dev"
}
```

**Roles disponíveis**:
- `OPERADOR`: Visualização e scan
- `SUPERVISOR`: + Gestão de tarefas e estoque
- `COMERCIAL`: + Gestão de pedidos e clientes
- `ADMIN`: Acesso total

### Futuro (JWT)

Será implementado sistema de login com JWT Bearer Token.

## 📱 Responsividade

- **Mobile First**: Design otimizado para celular
- **Desktop**: Sidebar + Topbar
- **Mobile**: Bottom Navigation

## 🧪 Testes

(A implementar)

```bash
npm run test
```

## 📚 Documentação

- [Plano de Implementação](../FRONTEND_IMPLEMENTATION_PLAN.md)
- [Mapeamento SAP B1](../web/SAP_B1_MAPPING_FRONTEND.md)
- [API Backend](../api/README.md)

## 🚧 Status do Desenvolvimento

- [x] Setup inicial
- [x] Configuração do projeto
- [x] API Client
- [ ] Layout e Navegação
- [ ] Dashboard
- [ ] Pedidos
- [ ] Produtos
- [ ] Estoque
- [ ] Integração

## 👥 Contribuindo

(Em desenvolvimento)

## 📄 Licença

(A definir)

---

**Última atualização**: 2026-02-03
