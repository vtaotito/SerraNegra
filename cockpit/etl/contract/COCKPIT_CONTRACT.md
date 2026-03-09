# Contrato de Dados — Cockpit Comercial

Documento único que define **abas do Excel**, **colunas**, **tipos**, **chaves** e **destino no DW**. Alterações somente via MR com revisão.

---

## Histórico de alterações

| Versão | Data       | Autor | Descrição |
|--------|------------|--------|-----------|
| 0.1.0  | (preencher) | (preencher) | Versão inicial do contrato — preencher nomes exatos das abas e colunas do Excel |
| 1.0.0  | 2026-03-05 | (extração automática) | Contrato preenchido com abas e colunas reais do ficheiro VOLUME COMERCIAL 10.12.xlsx (ver cockpit/etl/ingest/excel_structure.json e excel_catalog_ui.json) |
| 1.1.0  | 2026-03-05 | (revisão E2E) | Secções 3-8 preenchidas com dados reais (layouts pivot documentados); tipo MÊS corrigido para date; secção 9 expandida com 12 abas adicionais; aba FAT. MÊS ATUAL detalhada |

---

## Convenções

- **Nome na aba**: nome exato do cabeçalho da coluna no Excel (copiar/colar para evitar erros).
- **Tipo**: `string` | `integer` | `decimal` | `date` | `datetime` | `boolean`.
- **Obrigatório**: `S` = sim (nulo não permitido na carga), `N` = não.
- **Chave**: `PK` = parte da chave candidata da aba, `FK` = referência a outra aba/dimensão, `-` = atributo.
- **Destino DW**: tabela de staging e depois fato/dimensão (ex.: `stg_dados` → `FatoDocumentos`).

---

## 1) Aba: DADOS (documentos comerciais)

**Objetivo**: Linhas de documentos (vendas, NF, pedidos, etc.) para FatoDocumentos.  
**Grão**: uma linha = um registro (Documento + Item + Linha quando houver).  
**Chave candidata**: `(Nº do documento, Tipo de objeto, Data do documento, Código do cliente/fornecedor, Nº do item)`. Aba tem 72 colunas; primeiras 30 mapeadas abaixo (fonte: VOLUME COMERCIAL 10.12.xlsx).

| # | Nome na aba (Excel) | Tipo     | Obrigatório | Chave | Destino DW     | Observações |
|---|----------------------|----------|-------------|-------|----------------|-------------|
| 1 | A                   | number   | S           | PK    | FatoDocumentos  | Campo numérico (ex.: 912) |
| 2 | Nº do documento      | number   | S           | PK    | FatoDocumentos  | Número do documento (ex.: 448) |
| 3 | Tipo de objeto       | number   | S           | PK    | FatoDocumentos  | Tipo (ex.: 17) |
| 4 | Cancelado            | string   | N           | -     | FatoDocumentos  | "N" = não cancelado |
| 5 | Status do documento  | string   | N           | -     | FatoDocumentos  | Ex.: "C" |
| 6 | Data de lançamento   | date     | N           | -     | FatoDocumentos  | Data de lançamento |
| 7 | Data de vencimento   | date     | N           | -     | FatoDocumentos  | Data de vencimento |
| 8 | Data do documento    | date     | S           | PK    | FatoDocumentos  | Data do documento |
| 9 | MÊS                  | date     | N           | -     | FatoDocumentos  | Data início do mês (ex.: 2023-03-01); extrair mês no ETL |
|10 | Cód da cond de pgto  | number   | N           | -     | FatoDocumentos  | Cód. condição pagamento (ex.: -2) |
|11 | Forma de pagamento   | string   | N           | -     | FatoDocumentos  | Ex.: "Cartão Credito", "Transf. Banco" |
|12 | Código do cliente/fornecedor | string | S | FK    | FatoDocumentos  | Código cliente → DimCliente (ex.: C00700) |
|13 | Nome do PN           | string   | N           | -     | FatoDocumentos  | Nome do parceiro de negócio |
|14 | Código de grupo      | number   | N           | -     | FatoDocumentos  | Ex.: 100 |
|15 | Nome do grupo        | string   | N           | -     | FatoDocumentos  | Ex.: "Cliente Alcoólicos" |
|16 | COD                 | string   | N           | -     | FatoDocumentos  | Código categoria item (ex.: GN, TA) |
|17 | Nº do item           | string   | N           | PK    | FatoDocumentos  | Código do item → DimProduto |
|18 | Descrição do item/serviço | string | N | -     | FatoDocumentos  | Descrição completa |
|19 | Sub-Nome            | string   | N           | -     | FatoDocumentos  | Subdescrição |
|20 | Quantidade           | number   | N           | -     | FatoDocumentos  | Quantidade |
|21 | UNIT                 | number   | N           | -     | FatoDocumentos  | Unidade (ex.: 24) |
|22 | Quant. Real          | number   | N           | -     | FatoDocumentos  | Quantidade real (ex.: 96) |
|23 | EMBALA               | string   | N           | -     | FatoDocumentos  | Embalagem (ex.: FARDO, UND) |
|24 | LineTotal            | number   | N           | -     | FatoDocumentos  | Total da linha (R$) |
|25 | TotalGeral           | number   | N           | -     | FatoDocumentos  | Total geral (R$) |
|26 | % de desconto por linha | number | N           | -     | FatoDocumentos  | % desconto |
|27 | Código CFOP para documento | number | N        | -     | FatoDocumentos  | CFOP (ex.: 5101) |
|28 | Peso                 | number   | N           | -     | FatoDocumentos  | Peso (ex.: 42) |
|29 | Código de utilização para documento | number | N | -   | FatoDocumentos  | Cód. utilização (ex.: 10) |
|30 | DescriptionUsage     | string   | N           | -     | FatoDocumentos  | Uso (ex.: "Venda Garrafaria") |
|… | (colunas 31–72: ver excel_structure.json) | … | … | … | … | |

**Regras de negócio (documentos)**  
- Definir quais valores de `Cancelado` consideram o documento cancelado (ex.: "Y", "S", 1).  
- Moeda: assumir BRL; se houver múltiplas moedas, incluir coluna `Currency` e taxa no contrato.

---

## 2) Aba: ESTOQUE

**Objetivo**: Posição de estoque por item para FatoEstoque.  
**Grão**: COD + Nº do item (+ depósito se existir). Aba **ESTOQUE** tem 45 colunas; **Planilha6** tem 8 colunas (lista simples). **VLR. ESTOQUE** tem 8 colunas (item + valor).

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW  | Observações |
|---|----------------------|--------|-------------|-------|-------------|-------------|
| 1 | COD                 | string | S           | PK    | FatoEstoque | Código categoria (ex.: AR) |
| 2 | Nº do item          | string | S           | PK    | FatoEstoque | Código do item → DimProduto |
| 3 | DESCRIÇÃO           | string | N           | -     | FatoEstoque | Descrição |
| 4 | Em estoque          | number | N           | -     | FatoEstoque | Quantidade em estoque |
| 5 | Disponível          | number | N           | -     | FatoEstoque | Quantidade disponível |
| 6 | Estoque mínimo      | number | N           | -     | FatoEstoque | Estoque mínimo |
| 7 | unidade             | string | N           | -     | FatoEstoque | Unidade (ex.: UN) |
|… | (demais colunas em excel_structure.json) | … | … | … | … | |

**Planilha6** (lista itens): Nº do item, Descrição do item, Em estoque, Confirmado, Pedido, Disponível, Estoque mínimo, Unidade de medida de estoque.  
**VLR. ESTOQUE**: layout com Nº do item, código item (ex.: GN0000022), valor numérico.

---

## 3) Aba: CARTEIRA GERAL

**Objetivo**: Painel pivot de carteira de clientes por vendedor para FatoCarteira.  
**Layout**: Tabela pivot — headers são rótulos de indicadores, não nomes tradicionais de coluna. 50 073 linhas, 58 colunas (muitas Col_N genéricas).  
**Grão**: Vendedor + indicador (Vol. Clientes Perdidos, Atenção, 80/20, Gold, etc.).

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW  | Observações |
|---|----------------------|--------|-------------|-------|-------------|-------------|
| 1 | (Tudo)              | string | N           | -     | FatoCarteira | Filtro pivot (valor fixo) |
| 4 | VOL. CLIENTES PERDIDOS 90 DIAS | number | N | - | FatoCarteira | Volume de clientes perdidos últimos 90d |
| 6 | VOL. CLIENTES ATENÇÃO 90 DIAS | number | N | - | FatoCarteira | Volume de clientes em atenção 90d |
| 9 | TL. CLIENTES 80/20  | number | N           | -     | FatoCarteira | Total clientes regra 80/20 |
| 12 | TICKET MÉDIO CLIENTE 80/20 | number | N    | -     | FatoCarteira | Ticket médio clientes 80/20 |
| 16 | TL. CLIENTES GOLD   | number | N           | -     | FatoCarteira | Total clientes Gold |
| 20 | Nome do vendedor    | string | S           | FK    | FatoCarteira | → DimVendedor |
| 21 | (Tudo)              | string | N           | -     | FatoCarteira | Segundo filtro pivot |
| 22 | TOTAL DE CLIENTES   | number | N           | -     | FatoCarteira | Total clientes |
| 24 | MÉDIA - TICKET MÉDIO | number | N          | -     | FatoCarteira | Média ticket |
| 26 | MÉDIA - SKU         | number | N           | -     | FatoCarteira | Média SKU |
| 28 | VLT. FAT. 90 DIAS   | number | N           | -     | FatoCarteira | Variação faturamento 90d |
| 30 | MÉDIA FAT. MÊS      | number | N           | -     | FatoCarteira | Média faturamento mensal |

**Nota ETL**: Layout pivot — necessário "despivotar" antes de carregar no DW. Colunas Col_N intermediárias são separadores visuais e devem ser ignoradas.

---

## 4) Aba: CMV / ESTUDO DE MARGENS

**Objetivo**: Custos e margens para FatoCustos.  
**Layout**: Tabela pivot — 540 linhas, 13 colunas. Headers reais são Col_0 a Col_12; nomes lógicos estão na primeira linha de dados.  
**Grão**: Grupo + Mês + Região.

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW  | Observações |
|---|----------------------|--------|-------------|-------|-------------|-------------|
| 1 | Col_0               | string | N           | -     | FatoCustos  | Campo auxiliar |
| 2 | GRUPO               | string | S           | PK    | FatoCustos  | Grupo (filtro pivot: "MÊS", "Estado", "REGIÃO") |
| 3 | (Vários itens)      | date   | S           | PK    | FatoCustos  | Data/período (ex.: 2025-10-01) |
| 4 | Col_3 → "CMV GERAL" (dados) | string | N | -     | FatoCustos  | Valor CMV geral (na 1ª linha de dados) |
| 5 | Col_4 → "CMV A" (dados) | string | N | -     | FatoCustos  | Valor CMV tipo A (na 1ª linha de dados) |
| 6-13 | Col_5..Col_12    | string | N           | -     | FatoCustos  | Colunas adicionais de custo |

**Nota ETL**: Os headers Col_3 e Col_4 são genéricos; os nomes reais ("CMV GERAL", "CMV A") estão na `sampleRows[0]`. O ETL deve usar a primeira linha de dados como header real e descartar a linha 0. Filtros "Estado" e "REGIÃO" na coluna GRUPO.

---

## 5) Aba: CLIENTE (dimensão)

**Objetivo**: Análise de faturamento por cliente (pivot) para DimCliente / FatoClientes.  
**Layout**: Tabela pivot — 21 994 linhas, 35 colunas. Rótulos de linha = clientes, colunas = meses.  
**Grão**: Cliente (%abc) + Mês.

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW | Observações |
|---|----------------------|--------|-------------|-------|------------|-------------|
| 1 | Col_0 → "%abc" (dados) | string | N | - | DimCliente | Classificação ABC (1ª linha dados) |
| 2 | Soma de TotalGeral → "Rótulos de Linha" (dados) | string | S | PK | DimCliente | Nome/código do cliente |
| 3 | Rótulos de Coluna → datas mês (dados) | date | S | PK | FatoClientes | Mês (ex.: 2023-03-01) |
| 4-35 | Col_3..Col_29 → meses adicionais | number | N | - | FatoClientes | Valor faturado naquele mês |

**Nota ETL**: Layout pivot — a primeira linha de dados contém "%abc", "Rótulos de Linha" e datas mensais (2023-03 a 2025-10+). Despivotar meses em linhas: (cliente, mês, valor). Col_0 contém classificação ABC do cliente.

---

## 6) Aba: PRODUTO (dimensão)

**Objetivo**: Catálogo de produtos com análise de estoque e vendas para DimProduto.  
**Layout**: Tabela pivot/relatório — 217 linhas, 60 colunas. Headers mistos (Col_N genéricos + rótulos nomeados).  
**Grão**: Produto (item) + categorias de embalagem.

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW | Observações |
|---|----------------------|--------|-------------|-------|------------|-------------|
| 1 | Col_0               | string | N           | -     | DimProduto | Campo auxiliar |
| 2 | EMBALAGENS DE VIDRO (GARRAFAS, GARRAFÕES, MINIATURAS, ARTESANAL) | string | N | - | DimProduto | Categoria principal de produto |
| 3-18 | Col_2..Col_18    | string | N           | -     | DimProduto | Subcategorias/atributos |
| 19 | VENDA ESTOQUE ATUAL | number | N           | -     | DimProduto | Valor venda do estoque atual |
| 20 | CUSTO ESTOQUE ATUAL | number | N           | -     | DimProduto | Custo do estoque atual |
| 22 | VENDA P/ CLASSE 12 MESES | string | N      | -     | DimProduto | Venda por classe últimos 12 meses |
| 29 | VENDA ROLHAS/TAMPAS | string | N           | -     | DimProduto | Venda rolhas e tampas |

**Nota ETL**: Layout de relatório — muitas colunas Col_N contêm subcategorias de embalagem. Necessário normalizar: extrair código item, descrição, categoria e valores numéricos de venda/custo.

---

## 7) Aba: MAPA VENDEDORES (dimensão)

**Objetivo**: Mapa de desempenho de vendedores para DimVendedor.  
**Layout**: Tabela pivot/painel — 80 linhas, 29 colunas. Headers todos genéricos (Col_0..Col_28); nomes reais na primeira linha de dados.  
**Grão**: Vendedor (linhas) + indicadores de volume (colunas).

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW | Observações |
|---|----------------------|--------|-------------|-------|------------|-------------|
| 1 | Col_0 → "VOLUME DE VENDAS" (dados) | string | N | - | DimVendedor | Título/nome vendedor |
| 2-8 | Col_1..Col_7     | number | N           | -     | DimVendedor | Indicadores numéricos de volume |
| 9-28 | Col_8..Col_28   | string | N           | -     | DimVendedor | Atributos adicionais do vendedor |

**Nota ETL**: Todos os headers são Col_N — a primeira linha de dados (`sampleRows[0]`) contém "VOLUME DE VENDAS" como rótulo. O ETL deve usar a segunda linha de dados como referência para nomes de colunas, ou mapear manualmente conforme definido pelo negócio.

---

## 8) Aba: RESUMO COMERCIAL (reconciliação)

**Objetivo**: Indicadores consolidados por período para reconciliação e visão executiva.  
**Layout**: Tabela pivot/relatório — 80 linhas, 20 colunas. Headers mistos.  
**Grão**: Indicador + período mensal.

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Uso | Observações |
|---|----------------------|--------|-------------|-----|-------------|
| 1 | INDICADORES DE ESTOQUE | string | S | Chave de comparação | Nome do indicador (ex.: "DATA", "CUSTO ESTOQUE - CMV") |
| 2 | Col_1               | string | N           | Auxiliar | Campo intermediário |
| 3-7 | Col_2..Col_6      | date/number | N       | Períodos | Datas mensais (ex.: 2025-04-03 a 2025-08-03) |
| 8 | Col_7 → "%Evol" (dados) | string | N       | Evolução % | Percentual de evolução (1ª linha dados) |
| 9-20 | Col_8..Col_19    | string | N           | Extensão | Colunas adicionais de indicadores |

**Dados de amostra**: Linha "CUSTO ESTOQUE - CMV" com valor 7 012 707,16 na coluna do período.

**Nota ETL**: A primeira linha de dados contém "DATA" e datas mensais + "%Evol". O ETL deve tratar a primeira linha como header real. Os indicadores variam por linha (custo, faturamento, volume, etc.).

**Regra de reconciliação**:  
- Para o mesmo período, `SUM(FatoDocumentos.valor_bruto)` deve estar dentro de **2%** ou **R$ 1.000** do total desta aba.

---

## 9) Abas adicionais

Abas presentes no Excel que complementam a análise principal:

| Nome da aba | Linhas | Colunas | Objetivo | Destino DW | Prioridade |
|-------------|--------|---------|----------|------------|------------|
| 80-20       | 8 308  | 26      | Classificação 80/20 de clientes (Quant. Clientes Usuarios) | FatoClientes | Média |
| ESTUDO DE MARGENS | ~200 | 15 | Margens detalhadas por produto | FatoCustos | Alta |
| ESTUDO ESTOQUE | ~300 | 12 | Análise de estoque (COD, item, MÊS, estado) | FatoEstoque | Alta |
| Planilha6   | ~350   | 8       | Lista simples de itens com estoque (Nº do item, Em estoque, Disponível) | FatoEstoque | Média |
| VLR. ESTOQUE | ~300  | 8       | Valor monetário do estoque por item | FatoEstoque | Alta |
| SP          | 424    | 22      | Dados filtrados por São Paulo (pivot com "Nome do grupo2") | FatoDocumentos | Baixa |
| Planilha1   | 83     | 36      | Pivot por cidade e vendedor | FatoDocumentos | Baixa |
| Planilha2   | 38     | 15      | Pivot "Soma de TotalGeral" por mês (ago, set, out) | Reconciliação | Baixa |
| EVOL. QUANT | 391    | 99      | Evolução de quantidade real por COD (pivot mensal) | FatoDocumentos | Média |
| Plan7       | 215    | 14      | Garrafas Premium + Rolhas (totais e médias mês) | FatoProduto | Baixa |
| FAT. MÊS ATUAL | 10 | 15      | Meta vs real por vendedor com % performance | FatoVendedores | **Crítica** |
| GABARITO    | 629    | 17      | Tabela auxiliar (Nº do item, Sub-Nome, NameState, ICMS, REGIÃO, PESO) | DimProduto/DimDomínios | Alta |

### Aba FAT. MÊS ATUAL (detalhe — prioridade crítica)

Headers reais (via `sampleRows[0]`): VENDEDOR, VALOR (meta), SEMANA, DIA, 01ºSM, 02ºSM, 03ºSM, 04ºSM, TOTAL VAL. REAL, MÉDIA DIA, VOL. VEND, TICKET, PERF. %, PREV FECHAMENTO.

| # | Nome lógico | Tipo | Destino DW | Observações |
|---|-------------|------|------------|-------------|
| 1 | META (header) / VENDEDOR (dados) | string | DimVendedor | Nome vendedor (ex.: "Alef Santos") |
| 2 | VALOR (meta) | number | FatoVendedores | Meta em R$ (ex.: 220000) |
| 3 | SEMANA | number | FatoVendedores | Meta semanal |
| 4 | DIA | number | FatoVendedores | Meta diária |
| 6 | 01ºSM | number | FatoVendedores | Realizado 1ª semana |
| 7 | 02ºSM | number | FatoVendedores | Realizado 2ª semana |
| 8 | 03ºSM | number | FatoVendedores | Realizado 3ª semana |
| 9 | 04ºSM | string | FatoVendedores | Realizado 4ª semana (pode ser null) |
| 10 | TOTAL VAL. REAL | number | FatoVendedores | Total real acumulado |
| 11 | MÉDIA DIA | number | FatoVendedores | Média diária real |
| 12 | VOL. VEND | number | FatoVendedores | Volume vendido |
| 13 | TICKET | number | FatoVendedores | Ticket médio |
| 14 | PERF. % | number | FatoVendedores | Performance % (negativo = abaixo da meta) |
| 15 | PREV FECHAMENTO | number | FatoVendedores | Previsão de fechamento R$ |

### Aba GABARITO (detalhe — prioridade alta)

629 linhas, 17 colunas. Headers genéricos (Col_0..Col_16). Contém dados auxiliares: Nº do item, Sub-Nome, NameState, ICMS, REGIÃO, PESO. Deve alimentar DimProduto e DimDomínios.

---

## 10) Regras gerais de padronização (ETL)

- **Códigos**: trim, uppercase, remover caracteres invisíveis.  
- **Datas**: timezone único (ex.: America/Sao_Paulo); coluna "data documento" vs "data lançamento" vs "data vencimento" conforme definido acima.  
- **Moeda**: moeda base BRL; se houver `amount_original`, manter e adicionar `amount_base`.  
- **Nulos em chaves**: mapear para `unknown_customer`, `unknown_product`, `unknown_seller` etc. (registrar uso e alertar).  
- **Duplicidade**: rejeitar ou deduplicar por chave candidata; registros rejeitados em tabela de erros com motivo.

---

## 11) Checklist de validação antes de congelar

- [ ] Todas as abas do Excel que serão ingeridas estão listadas.  
- [ ] Nomes das colunas foram preenchidos com os nomes **exatos** do Excel (copiar/colar).  
- [ ] Tipos e obrigatoriedade conferidos.  
- [ ] Chaves candidatas definidas por aba.  
- [ ] Regra de reconciliação (aba RESUMO COMERCIAL) e threshold definidos.  
- [ ] Regras de "cancelado" e moeda documentadas.  
- [ ] Versão e histórico de alterações preenchidos.

---

*Documento vivo: após preencher os nomes exatos das abas e colunas no Excel, marcar a versão como 1.0.0 e usar este arquivo como referência única para ingestão e DW.*
