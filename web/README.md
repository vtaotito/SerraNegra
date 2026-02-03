# WMS — Painel de Pedidos (web)

Frontend web (Dashboard Logística + Comercial) com:

- Kanban por status (state machine do pedido)
- Filtros (SLA, transportadora, prioridade)
- Detalhe do pedido (itens, pendências, histórico)
- Ações controladas por permissão (ex.: liberar onda, reprocessar, transições)

## Como rodar

```bash
cd web
npm install
npm run dev
```

## Configuração de API

Crie `web/.env` baseado em `web/.env.example`.

- `VITE_API_BASE_URL`: base URL para a API do orquestrador
- `VITE_USE_MOCK=true`: força o uso do mock local

