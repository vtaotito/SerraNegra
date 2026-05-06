# TODO Frontend — BI Cockpit Garrafaria Serra Negra (`painel`)

Documento único para rastrear implementações de frontend do cockpit BI no monorepo WMS. Cada checkbox usa ID **`GSN-BI-FE-*`** para correlacionar prompts, PRs e revisões.

---

## Context

- **Stack alvo:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query v5, Recharts, Zod, CVA + `clsx`/`tailwind-merge` (via `cn()` em `lib/utils.ts`), Sonner — tudo dentro de **`painel/`**.
- **Fonte de design:** onde existir especificação Figma, usar-a como referência visual; páginas atuais em `painel/app/business-intelligence/**` servem como baseline funcional até alinhamento com design tokens do DS leve do painel.
- **Servidor de desenvolvimento:** `cd painel && npm run dev` (porta **3003**, conforme `package.json`).
- **Orçamento de performance:** baseline elevado por **Recharts** em múltiplas vistas — medir Lighthouse/Web Vitals **nas rotas BI alteradas** e registrar valores (First Load JS, LCP, CLS na área de gráficos) em comentários de PR ou neste checklist; usar `dynamic` + slots de altura fixa onde já há padrão (ex.: `ExecutiveDashboardCharts` em `painel/app/business-intelligence/page.tsx`).
- **Acessibilidade:** meta **WCAG 2.1 AA** — teclado, foco visível (`Sheet`/drawers), contraste em tooltips/gráficos, alternativa textual quando fizer sentido.
- **Integração SAP B1:** **somente indirecta** via `GATEWAY_INTERNAL_URL` nos Route Handlers / SSR (`lib/gateway-fetch.ts`), alinhado a `lib/cockpit-api.ts`. **Proibido** no cliente: credenciais SAP, `B1SESSION`, chamadas `/b1s/v1`, `NEXT_PUBLIC_*` sensíveis. Contratos e campos: `API_CONTRACTS/sap-b1-integration-contract.md`, `docs/INTEGRATION_GUIDE.md`.
- **Route handlers BI atuais (painel):** `painel/app/api/bi/executive-summary/route.ts`, `painel/app/api/bi/rd/overview/route.ts`, `painel/app/api/bi/rd/contact/route.ts`. Novos endpoints: **só após** confirmar path no gateway e espelhar em `/api/bi/...`.
- **Estado global BI:** `DateRangeProvider` + `SalesPersonFilterProvider` em `painel/app/business-intelligence/layout.tsx`; queries em `painel/hooks/useCockpitQueries.ts` com `queryKey` estáveis (ex.: `useExecutiveSummary`).
- **Padrões de UI compartilhados:** `BIErrorBoundary`, `DataState` / `BiEmptyState`, `KPICard`, `ChartTooltip`, `lib/chart-theme.ts`, `lib/format.ts`, `lib/export-csv.ts` (export CSV onde já houver padrão).
- **RD Station:** hooks `useRdOverviewBi`, `useRdContactMarketing` — manter rótulos e tooltips que distinguem dados **SAP/agregados BI** de **marketing RD**.
- **Navegação BI:** prefixo `BI_ROUTE_PREFIX` em `lib/bi-routes.ts` (`/business-intelligence`). Subnav: `painel/app/business-intelligence/components/BISubnav.tsx` — auditar páginas existentes não listadas (ex.: `clientes`, `produtos`) para consistência de descoberta.

---

## Implementation Plan

- [ ] **GSN-BI-FE-PLAN-1** — Inventário incremental: mapear cada rota sob `painel/app/business-intelligence/` → fonte de dados (**route handler** `/api/bi/*` ou fetch interno existente → **path gateway** só no servidor); anotar gap de tipos (`lib/types.ts`, `cockpit-api.ts`, `lib/rd-bi-types.ts`).
- [ ] **GSN-BI-FE-PLAN-2** — Layout responsivo unificado **mobile-first** para todas as vistas BI: `BITopbar` filtros sticky/empilháveis em viewport estreito, grids de KPI fluidos (`min()`, `gap` consistentes), área de gráficos com altura mínima legível e skeleton sem CLS brusco.
- [ ] **GSN-BI-FE-PLAN-3** — Boundary de erro: manter uso de **`BIErrorBoundary`** no layout; onde uma sub-feature puder falhar isoladamente (ex.: apenas um gráfico), considerar subdivisões com recuperação (`ErrorState`/`onRetry`) sem derrubar a página inteira.
- [ ] **GSN-BI-FE-PLAN-4** — Performance: inventorizar páginas com Recharts/virtualização pesada → aplicar `next/dynamic` + `loading` + `motion-reduce:animate-none` onde faltar; revisar waterfalls (parâmetros vindos dos mesmos contextos devem disparar queries em paralelo quando possível).
- [ ] **GSN-BI-FE-PLAN-5** — QA de rede: garantir tratamento pt-BR de `fetch` falho/`!res.ok` em hooks e páginas, alinhado ao padrão de `useExecutiveSummary` / `useRdOverviewBi` (mensagem útil ao usuário).

---

## Arquitetura de componentes (hierarquias planejadas)

- [ ] **GSN-BI-FE-ARCH-1** — Padrão página: `Pagina BI` → `BITopbar` (contextos) → seção filtros/contexto local → zona **KPIs** (grid composável com `KPICard`) → zona **gráficos** (Recharts + `chart-theme`) → zona **detalhes** (tabelas, drawers).
- [ ] **GSN-BI-FE-ARCH-2** — Componentes presentacionais: extrair/atualizar subcomponentes (props estritas; sem `fetch` direto dentro de atomics) onde houver duplicação entre `pedidos`, `resumo`, `margens`, etc.
- [ ] **GSN-BI-FE-ARCH-3** — Drawers: `painel/components/cockpit/ClientDetailDrawer.tsx` — foco inicial ao abrir/trap dentro do painel onde aplicável ao padrão de `Sheet`; documentar uso com CTAs que abrem desde `clientes` / visão executiva.
- [ ] **GSN-BI-FE-ARCH-4** — Tabelas longas: adotar `@tanstack/react-virtual` em listagens que excedem ~80 linhas típicas de viewport mantendo linha clicável/teclável e `key` estável (**nunca índice**).
- [ ] **GSN-BI-FE-ARCH-5** — Separação de domínios em tipografia/cópia: labels de negócio em pt-BR; identificadores SAP (`DocNum`, `ItemCode`, depósitos) apenas quando API expuser e fizer sentido ao usuário (ver contratos SAP).

---

## Implementation Items — por área BI

### Shell e navegação

- [ ] **GSN-BI-FE-ITEM-NAV-1** — `BISubnav.tsx` / `BITopbar.tsx`: revisar navegação por teclado (Arrow/Home/End já parcialmente em subnav — estender onde faltar); `aria-current`/`aria-label` onde apropriado; contraste dos estados hover/focado.
- [ ] **GSN-BI-FE-ITEM-NAV-2** — Harmonizar lista de links com rotas existentes (`clientes`, `produtos`, `markup/[itemCode]`); evitar páginas “órfãs” sem entrada na subnav (decisão de produto + link único).

### Visão geral (`/business-intelligence`)

- [ ] **GSN-BI-FE-ITEM-OVERVIEW-1** — `page.tsx`: manter/estender uso de `dynamic` para charts; garantir período prévio + vendedor no `queryKey` coerentes com contextos (`useExecutiveSummary`).
- [ ] **GSN-BI-FE-ITEM-OVERVIEW-2** — `ExecutiveDashboardCharts.tsx`: estados loading/empty/erro granular; dados vazios ou série constante (evitar divisão por zero nos agregadores exibidos); tooltips acessíveis (`ChartTooltip`).

### Marketing & CRM (`/marketing`)

- [ ] **GSN-BI-FE-ITEM-MKT-1** — Consolidar uso de `useRdOverviewBi` + cópias que deixem claro que é funnel/contatos RD, não ERP cru.
- [ ] **GSN-BI-FE-ITEM-MKT-2** — Cruzamentos com período SAP: só quando UX e dados suportarem; não misturar series sem mesma granularidade temporal sem aviso textual.

### Comercial (`/pedidos`, `/comercial/dados`, `/estoque`, `/carteira`, `/vendedores`)

- [ ] **GSN-BI-FE-ITEM-COM-1** — Queries: uma hook por recurso; `queryKey` incluindo `dateFrom`, `dateTo`, `salesPersonCode` conforme filtros globais **evitando re-fetch divergente** entre abas relacionadas quando compartilham cache.
- [ ] **GSN-BI-FE-ITEM-COM-2** — Export CSV: usar `lib/export-csv.ts` onde houver ação equivalente já no restante do BI.
- [ ] **GSN-BI-FE-ITEM-COM-3** — Estoque/documentos: validar payloads com **Zod** em formulários/param parsing no cliente onde query params são relevantes para construir URLs de API interna.

### Financeiro (`/margens`, `/resumo`, `/faturamento`, `/precos`)

- [ ] **GSN-BI-FE-ITEM-FIN-1** — KPIs monetários sempre via `fmtBRL`/`lib/format.ts`; consistência pt-BR.
- [ ] **GSN-BI-FE-ITEM-FIN-2** — Gráficos com valores extremos ou negativos: domínios e tooltips não truncados de modo a impedir compreensão; alt text ou tabela resumo opcional para leitura alternativa onde indicado em auditoria.

### Cadastros e detalhes (`/markup`, `/markup/[itemCode]`, `/produtos`, `/clientes`)

- [ ] **GSN-BI-FE-ITEM-CAD-1** — Drill-down markup por item (`markup/[itemCode]`): rota dinâmica com feedback de carregamento e erro cordial ao usuário.

### Clientes 360 (`/clientes` + RD)

- [ ] **GSN-BI-FE-ITEM-C360-1** — `ClientRdInsights.tsx` / `useRdContactMarketing`: estados disabled/enabled quando e-mail indefinido; não vazar dados PII em logs.

---

## State management e integração

- [ ] **GSN-BI-FE-INT-1** — Manter servidor em TanStack Query; **não** introduzir Redux/Zustand para estado servidor sem decisão documentada em ADR/checklist produto.
- [ ] **GSN-BI-FE-INT-2** — Novos Route Handlers: template seguindo `executive-summary` — validação params, uso de `gatewayGet`/`gatewayPost`, respostas JSON com `error` string em pt-BR em falhas tratadas.
- [ ] **GSN-BI-FE-INT-3** — Se houver mutações futuras: definir política única `queryClient.invalidateQueries` por feature ao concluir sucesso (`onSuccess` na mutation correspondente).

---

## Performance

- [ ] **GSN-BI-FE-PERF-1** — Auditar todas as páginas BI por `motion-reduce` / `prefers-reduced-motion` em animações (pulse, transitions) onde `tailwind` permite.
- [ ] **GSN-BI-FE-PERF-2** — `staleTime`/`retry`: alinhar novos hooks a ordem de grandeza já usada (`useCockpitQueries.ts`) antes de aumentar churn no gateway.
- [ ] **GSN-BI-FE-PERF-3** — Medir antes/after ao adicionar dependências cliente; lista virtualizada só onde ganho perceptível ou necessidade de acessibilidade (scroll grandes).

---

## Acessibilidade

- [ ] **GSN-BI-FE-A11y-1** — Form controls em `BITopbar`/filtros: `<label>` associado ou `aria-labelledby`; erros associados ao campo com `aria-describedby` quando usar validação feedback.
- [ ] **GSN-BI-FE-A11y-2** — Foco gerenciável em overlays/drawers: ordem Tab lógica; retorno ao trigger ao fechar onde o padrão do componente não cobrir automaticamente.

---

## Proposed Code Changes (modelos orientativos)

> Ajustar sempre ao código real atual; estes são **exemplos** para LLM/agentes seguirem estrutura, não garantia de merge direto.

### Patch conceitual A — novo hook Query interno (`/api/bi/…`)

```diff
*** Begin Patch
*** Add File: painel/hooks/useExampleBi.ts
+"use client";
+
+import { useQuery } from "@tanstack/react-query";
+
+/** TODO GSN-BI-FE-DOC — documentar gateway path no route handler pai. */
+export function useExampleBi(params: { dateFrom: string; dateTo: string }) {
+  const q = new URLSearchParams(params);
+  return useQuery({
+    queryKey: ["bi", "example", params.dateFrom, params.dateTo],
+    queryFn: async () => {
+      const res = await fetch(`/api/bi/example?${q}`);
+      if (!res.ok) {
+        const j = await res.json().catch(() => ({}));
+        throw new Error(typeof j.error === "string" ? j.error : `Erro ${res.status}`);
+      }
+      return res.json();
+    },
+    staleTime: 60_000,
+    retry: 2,
+  });
+}
*** End Patch
```

### Patch conceitual B — Route Handler mínimo (servidor apenas)

```diff
*** Begin Patch
*** Add File: painel/app/api/bi/example/route.ts
+import { NextResponse } from "next/server";
+import { gatewayGet } from "@/lib/gateway-fetch";
+/** Zod opcional para query ou body quando necessário */
+
+export async function GET(req: Request) {
+  const { searchParams } = new URL(req.url);
+  const dateFrom = searchParams.get("dateFrom") ?? "";
+  const dateTo = searchParams.get("dateTo") ?? "";
+  if (!dateFrom || !dateTo) {
+    return NextResponse.json({ error: "dateFrom e dateTo são obrigatórios" }, { status: 400 });
+  }
+  try {
+    const data = await gatewayGet<unknown>("/bi/example", { dateFrom, dateTo });
+    return NextResponse.json(data);
+  } catch (e) {
+    const msg = e instanceof Error ? e.message : "Falha ao consultar dados";
+    return NextResponse.json({ error: msg }, { status: 502 });
+  }
+}
*** End Patch
```

### Bloco conceitual C — `dynamic` para seção pesada (padrão existente na visão geral)

```tsx
"use client";

import dynamic from "next/dynamic";

const HeavyChartBlock = dynamic(
  () =>
    import("./HeavyChartBlock").then((m) => ({ default: m.HeavyChartBlock })),
  {
    loading: () => (
      <div
        className="h-52 rounded-xl border border-cockpit-border bg-white animate-pulse motion-reduce:animate-none"
        aria-busy="true"
        aria-label="Carregando gráfico"
      />
    ),
    ssr: false,
  }
);
```

---

## Commands

```bash
cd painel && npm run dev          # porta 3003
cd painel && npm run build
cd painel && npm run typecheck
cd painel && npm run lint
```

---

## Frontend Quality Task Checklist (implementação pontual nas áreas tocadas)

- [ ] **GSN-BI-FE-QA-TS** — TypeScript (`npm run typecheck`) sem erros novos.
- [ ] **GSN-BI-FE-QA-LNT** — ESLint (`npm run lint`) sem erros novos.
- [ ] **GSN-BI-FE-QA-BP** — Breakpoints manualmente revisados (**320px–2560px**) nas páginas alteradas.
- [ ] **GSN-BI-FE-QA-KB** — Fluxos filtros/modais/drawers utilizáveis **só por teclado**.
- [ ] **GSN-BI-FE-QA-CONTR** — Contraste **AA** conferido na área modificada (ferramenta de contraste/DevTools).
- [ ] **GSN-BI-FE-QA-LH** — Lighthouse ou métrica equivalente registada para **pelo menos uma página BI típica** com muitos gráficos (valor numérico anotado: LCP/CLS onde aplicável ao layout).
- [ ] **GSN-BI-FE-QA-RM** — `prefers-reduced-motion` não quebra uso e reduz motion onde há animações decorativas.
- [ ] **GSN-BI-FE-QA-XB** — Smoke em **Chrome**, **Firefox**, **Safari**/WebKit onde disponível, **Edge**.
- [ ] **GSN-BI-FE-QA-BUNDLE** — Se novas libs foram adicionadas ao `package.json`: justificar/registrar impacto esperado ao bundle Analyzer ou comparação de build.

---

## Component Quality Task Checklist (red flags)

- [ ] **GSN-BI-FE-CQ-TYPES** — Props e payloads de API tipados; sem `any` gratuitos.
- [ ] **GSN-BI-FE-CQ-EFF** — Error boundary/tratamento de erro adequado ao escopo da feature.
- [ ] **GSN-BI-FE-CQ-STS** — Loading, vazio e erro explícitos (pt-BR).
- [ ] **GSN-BI-FE-CQ-KEY** — Listas dinâmicas com `key` estável (**nunca** índice puro quando ordem/itens mudam).

---

## Styling / Layout checklist

- [ ] **GSN-BI-FE-STY-TW** — Tailwind consistente com o restante do BI; usar `cn()` para variantes quando CVA já existir no componente pai.
- [ ] **GSN-BI-FE-STY-CLS** — Skeletons/regiões fixas onde gráficos montam tardio para minimizar CLS.

---

## Accessibility checklist (gráficos e dados densos)

- [ ] **GSN-BI-FE-A-QA-SEM** — HTML semântico nas seções principais (`main`, headings hierárquicos).
- [ ] **GSN-BI-FE-A-QA-ALT** — Onde recomendado pela auditoria, tabela textual resumo ao lado/abbaixo dos gráficos para leitor de tela.

---

## References (paths no repo)

| Recurso | Caminho |
|--------|---------|
| Layout BI | `painel/app/business-intelligence/layout.tsx` |
| Error boundary | `painel/app/business-intelligence/BIErrorBoundary.tsx` |
| Queries cockpit | `painel/hooks/useCockpitQueries.ts` |
| Gateway servidor | `painel/lib/gateway-fetch.ts` |
| Contrato SAP ↔ domínio | `API_CONTRACTS/sap-b1-integration-contract.md` |
| Guia integração | `docs/INTEGRATION_GUIDE.md` |
| Prefixo BI | `painel/lib/bi-routes.ts` |

---

## Registro de execução (implementado no código — 2026-05-06)

| ID | O que foi feito |
|----|------------------|
| **GSN-BI-FE-ITEM-NAV-1** | Subnav: **Home**/**End** para primeiro/último link; `focus-visible:ring` nos itens; ícones já com `aria-current` nos ativos. |
| **GSN-BI-FE-ITEM-NAV-2** | Inclusão explícita de **Clientes** (`/clientes`) e **Produtos** (`/produtos`) em Comercial, com ícones `Users` e `Layers`. |
| **GSN-BI-FE-A-QA-SEM** | Landmarks: conteúdo sob `<main id="bi-main" tabIndex={-1}>` em `layout.tsx` do BI. |
| **GSN-BI-FE-A11y-1** | `BITopbar`: `label htmlFor` + ids nos campos de data; `aria-invalid` / `aria-describedby` ligados a `role="alert"` no erro; foco visível em botões. |
| **GSN-BI-FE-A11y-2** | `ClientDetailDrawer`: foco inicial no botão fechar ao abrir; restauração do foco ao fechar (cleanup do efeito); overlay sem roubar tab; `aria-hidden` quando fechado; `motion-safe` nas transições. |
| **GSN-BI-FE-ITEM-OVERVIEW-2** | `ExecutiveDashboardCharts`: estado vazio para **Vendas por dia da semana** (`BiEmptyState`) em vez de gráfico vazio. |
| **GSN-BI-FE-ITEM-MKT-1** | `marketing/page.tsx`: bloco curto “Separação de origem” (RD vs SAP via backend). |
| **GSN-BI-FE-PERF-1** | `prefers-reduced-motion`: chevron do período com `motion-safe:rotate`; botão aplicar sem `active:scale` sem `motion-safe`; barra de refresh em `produtos` com `motion-reduce:animate-none`. |
| **GSN-BI-FE-PLAN-5** | `useRdContactMarketing`: mensagem pt-BR quando `!res.ok` mesmo sem `error` no JSON. |

## Registro de execução (sprint complementar — 2026-05-06, tarde)

| ID | O que foi feito |
|----|------------------|
| **GSN-BI-FE-PERF-1** | Padronização ampla `prefers-reduced-motion`: 120 transições (`transition-{colors,all,opacity,transform}`) prefixadas com `motion-safe:` em **14 arquivos** das páginas BI (`carteira`, `clientes`, `comercial/dados`, `estoque`, `faturamento`, `margens`, `markup`, `markup/[itemCode]`, `pedidos`, `precos`, `produtos`, `resumo`, `vendedores`) e em `components/Sidebar.tsx`; mantém ressalva existente em `motion-safe:` no que já estava correto. |
| **GSN-BI-FE-PERF-1** | Spinners com `motion-reduce:animate-none` adicionados em `pedidos/page.tsx` (botão Sync SAP), `produtos/page.tsx` (loading histórico) e `comercial/dados/page.tsx` (botão "Carregar mais"); ícones marcados com `aria-hidden` e wrapper de loading com `role="status"`/`aria-live="polite"`. |
| **GSN-BI-FE-PERF-1** | Componentes compartilhados: `KPICard` e `DataState.ErrorState` ganharam prefixo `motion-safe:` em `transition-colors` e `focus-visible:ring` no botão "Tentar novamente"; `BITopbar` (preset rápidos) e `comercial/dados` (loadMore) com `motion-safe:active:scale`. |
| **GSN-BI-FE-PLAN-3** | `BIErrorBoundary` agora aceita `area` (rótulo pt-BR concatenado na mensagem e no log) e `fallback?: ({ message, reset }) => ReactNode` para envoltórios granulares de sub-features sem derrubar a página. |
| **GSN-BI-FE-PLAN-4** | `marketing/page.tsx`: chart de funil RD extraído para `MarketingFunnelChart.tsx` e carregado via `next/dynamic` (`ssr:false` + skeleton de altura fixa com `aria-busy`/`aria-label`), seguindo o padrão já usado em `ExecutiveDashboardCharts`. Adicionado `aria-labelledby` na `<section>` e `<title>` no SVG do gráfico. |
| **GSN-BI-FE-PERF-2** | Hooks BI já estão com `staleTime` alinhado (60–120s) em `useExecutiveSummary`, `useRdOverviewBi`, `useRdContactMarketing` — checklist confirmado sem novas hooks adicionando churn no gateway. |
| **GSN-BI-FE-CQ-TYPES** | `MarketingFunnelChart` exportado com tipo explícito `MarketingFunnelChartRow` — sem `any` introduzido. Toda a base BI já está sob `tsc --noEmit` limpo. |
| **GSN-BI-FE-QA-TS** | `npm run typecheck` confirmado sem erros após todas as alterações. |

> Itens **GSN-BI-FE-QA-LH** (Lighthouse), **GSN-BI-FE-QA-BP** (breakpoints 320–2560px), **GSN-BI-FE-QA-KB**, **GSN-BI-FE-QA-CONTR** e **GSN-BI-FE-QA-XB** continuam dependendo de validação humana nos browsers (não automatizáveis no agente). **`npm run lint`** ainda solicita configurador interativo do Next neste ambiente — `next lint` é deprecated em Next 16 (rodar `npx eslint .` após migrar config local).

---

*Última geração: alinhamento ao estado do repositório (rotas BI, três handlers `/api/bi/*`, `useExecutiveSummary` + RD hooks).*
