# DW — Modelo Analítico

- **schema/** — DDL: tabelas de staging, dimensões (DimCliente, DimProduto, DimVendedor, DimTempo, DimDomínios) com SCD2, fatos (FatoDocumentos, FatoEstoque, FatoCarteira, FatoCustos), partições
- **migrations/** — Versões de schema (Flyway, Liquibase, ou scripts numerados)
- **seeds/** — Dados de referência (ex.: calendário DimTempo)

Grãos e estratégias conforme spec: documento+item+linha para documentos; produto+depósito+data para estoque; etc.
