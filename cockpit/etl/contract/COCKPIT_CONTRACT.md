# Contrato de Dados — Cockpit Comercial

Documento único que define **abas do Excel**, **colunas**, **tipos**, **chaves** e **destino no DW**. Alterações somente via MR com revisão.

---

## Histórico de alterações

| Versão | Data       | Autor | Descrição |
|--------|------------|--------|-----------|
| 0.1.0  | (preencher) | (preencher) | Versão inicial do contrato — preencher nomes exatos das abas e colunas do Excel |
| 1.0.0  | 2026-03-05 | (extração automática) | Contrato preenchido com abas e colunas reais do ficheiro VOLUME COMERCIAL 10.12.xlsx (ver cockpit/etl/ingest/excel_structure.json e excel_catalog_ui.json) |

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
| 9 | MÊS                  | number   | N           | -     | FatoDocumentos  | Mês (numérico) |
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

**Objetivo**: Carteira de pedidos/oportunidades para FatoCarteira.  
**Grão**: Cliente + Produto (se existir) + DataPrevista + Status/Etapa.

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW  | Observações |
|---|----------------------|--------|-------------|-------|-------------|-------------|
| 1 | (ex.: CardCode / Cliente) | string | S | PK/FK | FatoCarteira | → DimCliente |
| 2 | (ex.: ItemCode / Produto) | string | N | PK    | FatoCarteira | Se houver por item |
| 3 | (ex.: DataPrevista / ExpectedDate) | date | N | PK  | FatoCarteira | Data prevista |
| 4 | (ex.: Status / Etapa) | string | N | - | FatoCarteira | Status da oportunidade |
| 5 | (ex.: Valor / Amount) | decimal | N | - | FatoCarteira | Valor da carteira |
| 6 | (ex.: Probabilidade) | decimal | N | - | FatoCarteira | Se existir para forecast |
|… | (adicionar outras colunas) | … | … | … | … | |

---

## 4) Aba: CMV / ESTUDO DE MARGENS

**Objetivo**: Custos e margens para FatoCustos.  
**Grão**: Produto + Período (mês) + estrutura de custo (se houver).

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW  | Observações |
|---|----------------------|--------|-------------|-------|-------------|-------------|
| 1 | (ex.: ItemCode / Produto) | string | S | PK | FatoCustos | → DimProduto |
| 2 | (ex.: AnoMes / Period) | string ou date | S | PK | FatoCustos | Período (ex.: 2026-01) |
| 3 | (ex.: CMV / Cost) | decimal | N | - | FatoCustos | Custo da mercadoria vendida |
| 4 | (ex.: CustoUnitario) | decimal | N | - | FatoCustos | Custo unitário (se existir) |
|… | (adicionar outras colunas) | … | … | … | … | |

---

## 5) Aba: CLIENTE (dimensão)

**Objetivo**: Cadastro de clientes para DimCliente.  
**Chave natural**: código do cliente (ex.: CardCode).

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW | Observações |
|---|----------------------|--------|-------------|-------|------------|-------------|
| 1 | (ex.: CardCode / CodCliente) | string | S | PK | DimCliente | Código natural |
| 2 | (ex.: CardName / Nome) | string | N | - | DimCliente | Nome/Razão social |
| 3 | (ex.: Segmento / GroupCode) | string | N | - | DimCliente | Segmento (SCD2) |
| 4 | (ex.: Regiao / Region) | string | N | - | DimCliente | Região (SCD2) |
| 5 | (ex.: Canal) | string | N | - | DimCliente | Canal (SCD2) |
| 6 | (ex.: ABC) | string | N | - | DimCliente | Classificação ABC |
| 7 | (ex.: SlpCode / VendedorPadrao) | string | N | FK | DimCliente | Vendedor padrão → DimVendedor |
|… | (adicionar outras colunas) | … | … | … | … | |

---

## 6) Aba: PRODUTO (dimensão)

**Objetivo**: Cadastro de produtos para DimProduto.  
**Chave natural**: código do item (ex.: ItemCode).

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW | Observações |
|---|----------------------|--------|-------------|-------|------------|-------------|
| 1 | (ex.: ItemCode / CodProduto) | string | S | PK | DimProduto | Código natural |
| 2 | (ex.: ItemName / Descricao) | string | N | - | DimProduto | Descrição |
| 3 | (ex.: Categoria / Family) | string | N | - | DimProduto | Categoria (SCD2) |
| 4 | (ex.: Unidade / UOM) | string | N | - | DimProduto | Unidade de medida |
| 5 | (ex.: Peso) | decimal | N | - | DimProduto | Peso unitário |
| 6 | (ex.: ABC) | string | N | - | DimProduto | Classificação ABC |
|… | (adicionar outras colunas) | … | … | … | … | |

---

## 7) Aba: MAPA VENDEDORES (dimensão)

**Objetivo**: Cadastro de vendedores para DimVendedor.  
**Chave natural**: código do vendedor (ex.: SlpCode).

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Chave | Destino DW | Observações |
|---|----------------------|--------|-------------|-------|------------|-------------|
| 1 | (ex.: SlpCode / CodVendedor) | string | S | PK | DimVendedor | Código natural |
| 2 | (ex.: SlpName / Nome) | string | N | - | DimVendedor | Nome |
| 3 | (ex.: Time / Team) | string | N | - | DimVendedor | Time |
| 4 | (ex.: Gerente) | string | N | - | DimVendedor | Gerente |
| 5 | (ex.: Regiao) | string | N | - | DimVendedor | Região |
| 6 | (ex.: Canal) | string | N | - | DimVendedor | Canal |
|… | (adicionar outras colunas) | … | … | … | … | |

---

## 8) Aba: RESUMO COMERCIAL (reconciliação)

**Objetivo**: Totais por período para **reconciliação** (comparar soma do DW com total declarado no Excel).  
**Uso**: Validação pós-carga; alerta se diferença > threshold.

| # | Nome na aba (Excel) | Tipo   | Obrigatório | Uso | Observações |
|---|----------------------|--------|-------------|-----|-------------|
| 1 | (ex.: Periodo / AnoMes) | string ou date | S | Chave de comparação | Período (mês) |
| 2 | (ex.: FaturamentoTotal / TotalVendas) | decimal | N | Comparar com SUM(FatoDocumentos) | Total declarado |
|… | (adicionar colunas de totais usados na reconciliação) | … | … | … | |

**Regra de reconciliação**:  
- Para o mesmo período, `SUM(FatoDocumentos.valor_bruto)` (ou métrica acordada) deve estar dentro de **X%** ou **R$ Y** do total desta aba. (Definir X e Y no contrato ou em config.)

---

## 9) Abas adicionais (opcional)

Se existirem outras abas no Excel (ex.: calendário, domínios de tipo de documento, condições de pagamento), listar abaixo com o mesmo formato: nome da aba, colunas, tipo, obrigatório, chave, destino.

| Nome da aba | Objetivo | Destino DW |
|-------------|----------|------------|
| (ex.: Calendario) | Datas para DimTempo | DimTempo (ou gerado por seed) |
| (ex.: TiposDocumento) | Domínios | DimDomínios |

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
