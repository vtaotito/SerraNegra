# Cockpit BI — UI e URL na VPS Hostinger (Serra Negra)

## URL de acesso

Após o deploy do stack na VPS, a interface do **Cockpit BI** fica disponível em:

- **HTTP:** `http://<IP-OU-DOMINIO-VPS>/cockpit`
- **HTTPS:** `https://<IP-OU-DOMINIO-VPS>/cockpit` (se Nginx estiver configurado com TLS)

Exemplos:
- `http://serranegra.seudominio.com/cockpit`
- `http://123.45.67.89:8080/cockpit` (se `WEB_PORT=8080`)

A raiz `/` continua a servir o front-end principal (web); o B2B em `/b2b`; a API em `/api/*`. O Cockpit é apenas mais uma aplicação sob o path **`/cockpit`**.

---

## O que a UI inclui (versão atual)

- **Layout:** Sidebar fixa (navegação) + topbar (período, busca, bookmarks, Chat/IA, status de dados).
- **Home (Visão executiva):** KPI cards (Faturamento, Volume, Margem %, Ticket, Carteira, Estoque, Rupturas), gráfico de tendência (faturamento), top clientes, cards “Insights para hoje”.
- **Páginas por módulo:** Documentos/Vendas, Estoque, Clientes, Carteira, Vendedores, CMV/Margens, Resumo Comercial — com tabelas de amostra e placeholders para dados reais (API de métricas a implementar).
- **Estilo:** Tema escuro (fundo #0d1117, superfícies #161b22), acento verde (#238636), tipografia Plus Jakarta Sans.

---

## Deploy na VPS (incluindo Cockpit)

O serviço **cockpit** já está no `docker-compose.yml` e no Nginx. Para subir (ou atualizar) tudo na Hostinger Serra Negra:

1. **No servidor** (ou via script de deploy):
   ```bash
   cd /opt/wms   # ou seu diretório de deploy
   git pull      # ou clone, se primeira vez
   docker compose build cockpit
   docker compose up -d
   ```

2. **Variáveis:** Não é necessário variável extra para o Cockpit; ele é estático (front-end). A porta exposta continua a do Nginx (ex.: `WEB_PORT=8080`).

3. **Healthcheck:** O container `wms-cockpit` responde em `http://localhost:3000/cockpit`. O Nginx encaminha `/cockpit` e `/cockpit/*` para esse serviço.

4. **Só reconstruir o Cockpit** (após alterações no front):
   ```bash
   docker compose build cockpit
   docker compose up -d cockpit
   ```

---

## Estrutura de rotas (Cockpit)

| Path (relativo a `/cockpit`) | Conteúdo |
|------------------------------|----------|
| `/cockpit` ou `/cockpit/`    | Home — Visão executiva |
| `/cockpit/comercial/dados`   | Documentos / Vendas |
| `/cockpit/estoque`           | Estoque |
| `/cockpit/clientes`         | Clientes |
| `/cockpit/carteira`          | Carteira Geral |
| `/cockpit/vendedores`        | Mapa de Vendedores |
| `/cockpit/margens`           | CMV / Margens |
| `/cockpit/resumo`            | Resumo Comercial |

---

## Próximos passos (backend)

- Ligar a UI à **API de métricas** (quando existir) para dados reais.
- Filtros globais (período, cliente, produto) persistidos e enviados à API.
- Autenticação e RLS (por exemplo, vendedor só vê sua carteira).

Com isso, você terá uma UI/UX moderna do Cockpit BI acessível na URL da VPS Hostinger Serra Negra em **`/cockpit`**.
