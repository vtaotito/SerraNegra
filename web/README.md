# WMS — Painel de Pedidos (Dashboard Web)

Frontend moderno e responsivo para **Logística + Comercial** com interface inspirada no Trello.

## ✨ Funcionalidades

### 🎯 Kanban por Status
- **6 colunas** baseadas na state machine do pedido (`A_SEPARAR` → `DESPACHADO`)
- **Drag & drop** entre colunas com mudança de status automática via API
- Animações suaves e feedback visual durante o arrasto
- Contador de pedidos por coluna

### 🔍 Filtros Avançados
- **Busca** por ID do pedido, ID externo ou cliente
- **SLA**: Todos / Atrasado / Vence em até 4h / OK
- **Transportadora**: filtro dinâmico baseado nos pedidos
- **Prioridade**: P1 (Alta), P2 (Média), P3 (Baixa)

### 📋 Detalhe do Pedido (Drawer)
- **Resumo**: status, transportadora, prioridade, SLA
- **Ações controladas por permissão**:
  - Transição automática (próximo evento da state machine)
  - Liberar onda (disponível em status específicos)
  - Reprocessar pedido
- **Itens** do pedido
- **Pendências** (divergências, problemas)
- **Histórico (audit trail)**: eventos, transições, ator, timestamp
- **Histórico de bipagem**: operador, SKU, quantidade, timestamp

### 🔐 Permissões por Perfil
- **Logística**: enviar eventos, liberar onda
- **Comercial**: reprocessar pedidos
- **Admin**: todas as permissões

### 🎨 UI/UX Moderna
- Design inspirado no **Trello** (clean, intuitivo, profissional)
- **Toast notifications** para feedback de ações (sucesso/erro)
- **Skeleton loaders** durante carregamento
- **Spinners** em botões durante processamento
- Animações suaves e micro-interações
- Responsivo (mobile-friendly)

## 🚀 Como rodar

### Pré-requisitos
- Node.js >= 18.0.0
- npm

### Instalação

```bash
cd web
npm install
```

### Configuração

Crie um arquivo `web/.env` baseado em `web/.env.example`:

```bash
# Base URL da API (OpenAPI em ../API_CONTRACTS/openapi.yaml)
VITE_API_BASE_URL=https://api.example.com

# Forçar uso de mock local (útil quando API não está rodando)
VITE_USE_MOCK=true
```

### Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:5173

### Build de Produção

```bash
npm run build
npm run preview
```

### Typecheck

```bash
npm run typecheck
```

## 🏗️ Arquitetura

### Estrutura de Pastas

```
web/
├── src/
│   ├── api/           # Camada de API (client, types, mock)
│   ├── auth/          # Autenticação e permissões
│   ├── pages/         # Páginas (OrdersDashboard)
│   ├── ui/            # Componentes de UI
│   │   ├── FiltersBar.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── OrderCard.tsx
│   │   ├── OrderDrawer.tsx
│   │   ├── SkeletonKanban.tsx
│   │   └── format.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Stack Tecnológico

- **React 18** + **TypeScript**
- **Vite** (build tool)
- **@tanstack/react-query** (data fetching, cache, mutations)
- **@dnd-kit** (drag & drop moderno e performático)
- **react-hot-toast** (toast notifications)
- CSS puro (sem framework, inspiração Trello)

### Integração com API

A camada de API (`src/api/orders.ts`) usa:
- `VITE_API_BASE_URL` para apontar para a API real
- Fallback automático para **mock local** (`src/api/mock.ts`) quando:
  - `VITE_USE_MOCK=true`
  - `VITE_API_BASE_URL` não está definido

O mock gera **36 pedidos** distribuídos pelos 6 status, com dados realistas (SLA, transportadora, prioridade, pendências, histórico de bipagem).

### Endpoints Utilizados

Baseado em `../API_CONTRACTS/openapi.yaml`:

- `GET /orders` — listar pedidos (com filtros)
- `GET /orders/{orderId}` — detalhe do pedido
- `GET /orders/{orderId}/history` — histórico (audit trail)
- `POST /orders/{orderId}/events` — enviar evento (transição de status)

Endpoints **fora do contrato MVP** (best-effort):
- `POST /orders/{orderId}/reprocess` — reprocessar pedido
- `POST /orders/{orderId}/wave/release` — liberar onda

## 🎨 Paleta de Cores (Trello-like)

```css
--bg-page: #f5f6f8
--bg-board: #ffffff
--bg-column: #f1f2f4
--bg-card: #ffffff

--text-primary: #172b4d
--text-secondary: #5e6c84
--text-muted: #8993a4

--primary: #0079bf (azul Trello)
--success: #61bd4f (verde)
--warn: #f2d600 (amarelo)
--danger: #eb5a46 (vermelho)
```

## 📝 Próximos Passos (Roadmap)

- [ ] Adicionar avatares de usuários
- [ ] Implementar filtro por data (criação/atualização)
- [ ] Adicionar visão de tabela (além do Kanban)
- [ ] Exportar pedidos (CSV/Excel)
- [ ] Notificações em tempo real (WebSocket)
- [ ] Modo escuro (dark mode)
- [ ] Testes automatizados (Vitest + Testing Library)

## 📄 Licença

Privado — uso interno.
