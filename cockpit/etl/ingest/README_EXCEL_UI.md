# Dados e estrutura do Excel para a UI do Cockpit

Ficheiro fonte: **VOLUME COMERCIAL 10.12.xlsx**.

## Ficheiros gerados

| Ficheiro | Uso |
|----------|-----|
| **excel_structure.json** | Estrutura completa extraída (todas as abas, cabeçalhos, tipos, amostras). Uso: ETL, validação, referência. |
| **excel_catalog_ui.json** | Catálogo curado para a **UI**: abas com `displayName`, `category`, colunas com `key`/`label`/`type`/`filterable`/`keyField`, e `navigation` (sidebar, filtros globais). |
| **excelCatalog.types.ts** | Tipos TypeScript (`SheetInfo`, `ColumnDef`, `ExcelCatalog`) para import no front. |
| **extract_excel_structure.py** | Script para re-extrair a estrutura (executar após alteração do Excel). |

## Uso na UI

1. **Sidebar / navegação**  
   Usar `excel_catalog_ui.json` → `navigation.sidebar` para construir o menu (label + path).

2. **Filtros globais**  
   Usar `navigation.filterFields` para os campos de filtro (período, cliente, produto, forma de pagamento, etc.). O `key` corresponde ao nome da coluna na aba **DADOS** (quando a API de métricas existir, os filtros serão aplicados por esses campos).

3. **Tabelas por aba**  
   Para cada aba (ex.: DADOS, ESTOQUE, Planilha6), usar `sheets[].columns` para definir colunas da tabela: `key` = id do campo, `label` = cabeçalho, `type` = string/number/date para formatação e ordenação.

4. **Tipos no front**  
   Copiar ou importar `excelCatalog.types.ts` no projeto do portal (ex.: `front-cockpit`) e tipar o objeto lido de `excel_catalog_ui.json` como `ExcelCatalog`.

5. **Dados reais**  
   Os dados das tabelas virão da **API de métricas** (a implementar); o catálogo serve apenas para configuração de colunas, filtros e rotas. As amostras em `excel_structure.json` podem ser usadas para mock no desenvolvimento.

## Abas principais (resumo)

- **DADOS** — Documentos/vendas (grão: linha); 72 colunas; origem de faturamento, volume, ticket.
- **ESTOQUE** / **Planilha6** — Posição de estoque por item; **VLR. ESTOQUE** — valor do estoque.
- **CLIENTE** — Layout pivot (clientes × períodos).
- **CARTEIRA GERAL** — Carteira/pipeline; layout pivot.
- **MAPA VENDEDORES** — Vendedores; layout pivot.
- **RESUMO COMERCIAL** — Totais para reconciliação.
- **CMV** / **ESTUDO DE MARGENS** / **ESTUDO ESTOQUE** — Análises (margem, CMV, estoque).
- **80-20** — Análise Pareto.

## Re-extrair estrutura

Sempre que o Excel for atualizado (novas abas ou colunas):

```bash
cd cockpit/etl/ingest
python extract_excel_structure.py
```

Em seguida, atualizar manualmente `excel_catalog_ui.json` (displayName, category, filterFields, sidebar) e o contrato em `cockpit/etl/contract/COCKPIT_CONTRACT.md` se necessário.
