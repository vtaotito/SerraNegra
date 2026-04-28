# TODO — Frontend Developer (adaptado: Painel BI Garrafaria Serra Negra)

Documento de rastreio para evolução de UI/UX do **Business Intelligence** embutido no app **Painel** (`https://painel.garrafariaserranegra.com.br`), alinhado ao monorepo em `wms/painel/`.

---

## Prompt adaptado para o agente / desenvolvedor

Use este bloco como **system prompt** ou briefing quando a tarefa for especificamente o BI do painel GSN:

```text
Você é um(a) desenvolvedor(a) frontend sênior. O escopo é o módulo BI do projeto `painel` (Next.js App Router, React 19, Tailwind, Recharts), rotas sob `app/business-intelligence/`, com layout em `layout.tsx`, filtros globais em `DateRangeContext` e `SalesPersonFilterContext`, dados via `lib/cockpit-api.ts`, agregação executiva via `app/api/bi/executive-summary`, TanStack Query em `hooks/useCockpitQueries.ts` e fallback `useFetch` nas demais páginas.

Regras de execução:
- Trate cada item como tarefa com ID estável (ex.: GSN-FE-1.1) e checklist.
- Preserve o design system existente: tokens `cockpit.*` e `gsn.*` em `tailwind.config.ts` (acento #AA1A1B, bordas claras, superfícies brancas no BI do painel — diferente do Cockpit standalone documentado em `docs/COCKPIT_UI_VPS.md` com tema escuro).
- Priorize mobile-first: `BITopbar` e `BISubnav` já consideram touch e overlays; estenda o mesmo padrão às páginas filhas.
- Acessibilidade: WCAG 2.1 AA em contraste, foco visível, teclado nos date pickers e subnav, `aria-*` em gráficos onde aplicável (Recharts + leitores de tela limitados — preferir tabelas/resumos textuais complementares).
- Performance: a visão executiva consome resumo agregado via API interna; outras páginas podem ainda usar `limit: 50000` no cliente até haver endpoints equivalentes.
- Saída de planejamento: atualize este arquivo `TODO_frontend-developer.md` com checkboxes; patches propostos em blocos nomeados por caminho de arquivo.

Não misturar escopo com `cockpit/front-cockpit` salvo quando for reutilizar padrões documentados; o deploy público do painel integra BI em `/business-intelligence` (redirect permanente a partir de `/bussiness-inteligence`).
```

---

## Contexto do repositório


| Item                         | Valor                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **App**                      | `painel/` (`painel-garrafaria`)                                                                                     |
| **Framework**                | Next.js ^15.3, React 19, TypeScript 5                                                                               |
| **Estilo**                   | Tailwind 3.4, `tailwindcss-animate`, tokens `cockpit` / `gsn`                                                       |
| **Gráficos**                 | Recharts ^3.8                                                                                                       |
| **Dados**                    | `lib/cockpit-api.ts`, TanStack Query (`hooks/useCockpitQueries.ts`), `useFetch` legado                              |
| **BI — rotas**               | Prefixo `app/business-intelligence/` (redirect 308 de `/bussiness-inteligence/`*)                                   |
| **Layout BI**                | `ProtectedLayout` → `DateRangeProvider` → `SalesPersonFilterProvider` → `BITopbar` + `BISubnav` + `BIErrorBoundary` |
| **URL pública**              | `https://painel.garrafariaserranegra.com.br` (hub + login; BI após autenticação)                                    |
| **Design / requisitos**      | Sem Figma citado no repo; tokens em `tailwind.config.ts`; meta de acessibilidade AA e CWV como no prompt base       |
| **Orçamento de performance** | Alinhar ao prompt base (FCP, CLS, bundle); medir `next build` + Lighthouse no fluxo real com dados SAP              |


---

## Visão de evolução do produto (UX)

- **GSN-EVO-1.1 Narrativa por perfil**: ordem dos KPIs na visão executiva conforme `user.role` (`admin`/`supervisor` priorizam carteira/base; `operador` prioriza pedidos e quantidade). *Pendência opcional:* reordenar blocos inteiros (gráficos) por perfil.
- **GSN-EVO-1.2 Estado vazio útil**: `BiEmptyState` com orientação de período e SAP; uso nos gráficos da executiva.
- **GSN-EVO-1.3 Navegação BI**: `BISubnav` agrupado (Visão / Comercial / Financeiro / Cadastros), setas ← → no teclado.
- **GSN-EVO-1.4 Exportação e confiança**: CSV + copiar resumo nos rankings de vendedores e clientes (visão executiva), com `sonner`.
- **GSN-EVO-1.5 Consistência de nomenclatura**: pasta `app/business-intelligence/`, links internos atualizados, redirects permanentes em `next.config.ts` para a rota antiga.

---

## Plano de implementação

- **GSN-FE-PLAN-1.1 Design system e gráficos** — `lib/chart-theme.ts`, `components/cockpit/ChartTooltip.tsx` (`BiChartTooltip`), refator parcial em `faturamento/page.tsx` e blocos executivos.
- **GSN-FE-PLAN-1.2 Camada de dados e cache** — `@tanstack/react-query`, `QueryProvider` no `layout` raiz, `useExecutiveSummary` em `hooks/useCockpitQueries.ts`.
- **GSN-FE-PLAN-1.3 API agregada (backend + frontend)** — `GET /api/bi/executive-summary` agrega no servidor (menos payload no browser na visão executiva); `lib/bi/executive-aggregate.ts`, `lib/gateway-fetch.ts`.
- **GSN-FE-PLAN-1.4 Acessibilidade e motion** — `prefers-reduced-motion` em CSS global e classes `motion-reduce:`*; `BITopbar` com `aria-controls`, `role="dialog"`, `Escape`; `h1` único na página filha (título BI como `<p>` na topbar).
- **GSN-FE-PLAN-1.5 Robustez de UI** — `BIErrorBoundary` no `layout` do BI; loading com `dynamic()` + skeleton para gráficos executivos.

---

## Itens de implementação (componentes / arquivos)

- **GSN-FE-ITEM-1.1** `components/cockpit/ChartTooltip.tsx` — `BiChartTooltip` tipado, `React.memo`, `aria-live="polite"`.
- **GSN-FE-ITEM-1.2** `app/business-intelligence/page.tsx` — Query + resumo agregado, KPIs ordenados por perfil, `dynamic` para `ExecutiveDashboardCharts`, `h1` único, tabela com `scope` e `key={cardCode}`.
- **GSN-FE-ITEM-1.3** `app/business-intelligence/components/BISubnav.tsx` — grupos, `aria-current="page"`, teclado horizontal.
- **GSN-FE-ITEM-1.4** `app/business-intelligence/components/BITopbar.tsx` — `aria-controls`, painel com `id`, fechar com `Escape`.
- **GSN-FE-ITEM-1.5 Páginas com tabelas longas** — debounce 300 ms em **clientes**; `aria-live` no rodapé de resultados. *Pendência:* virtualização em `pedidos` / `estoque` com `@tanstack/react-virtual` quando > 100 linhas visíveis; estender exportação CSV a outras tabelas se desejado.

---

## Mudanças de código propostas (exemplos)

Implementadas no código; referências de path atualizadas para `painel/app/business-intelligence/`.

---

## Comandos

Execução local (Windows / repo root ou `painel/`):

```bash
cd painel
npm install
npm run dev
```

Qualidade:

```bash
cd painel
npm run lint
npm run typecheck
npm run build
```

CI (se pipeline existir no monorepo): repetir `lint`, `typecheck` e `build` na pasta `painel`.

---

## Checklist de qualidade (QA)

- **GSN-QA-1.1** TypeScript sem erros (`npm run typecheck`).
- **GSN-QA-1.2** Layout responsivo verificado em 320, 768, 1024, 1440 px no fluxo BI (subnav + picker + tabelas).
- **GSN-QA-1.3** Teclado: todos os links da subnav, botão de período, fechar overlay, retry em erro.
- **GSN-QA-1.4** Contraste AA amostral (KPI labels, `text-cockpit-muted`, botões).
- **GSN-QA-1.5** Lighthouse (Performance / Accessibility) no ambiente com dados realistas.
- **GSN-QA-1.6** Impacto de bundle medido após introduzir libs novas (Query, virtual).
- **GSN-QA-1.7** Chrome, Firefox, Edge; Safari se disponível.

---

## Checklist final (espelho do prompt base)

- Componentes principais renderizam sem regressão visual no tema claro do painel BI.
- Design responsivo 320px–2560px para o módulo BI.
- Elementos interativos com foco visível e ordem lógica (melhorias em subnav, picker, `:focus-visible` global).
- Contraste WCAG 2.1 AA nas áreas alteradas.
- CWV avaliados após otimizações de dados e code splitting.
- Bundle inicial dentro do orçamento acordado após mudanças.
- `prefers-reduced-motion` respeitado onde houver animação não essencial.
- `tsc` limpo após refatorações de tipos nos tooltips.

---

*Última atualização (2026-04-28): rotas `app/business-intelligence/`, agregação executiva via API interna, TanStack Query, redirects da URL antiga.*