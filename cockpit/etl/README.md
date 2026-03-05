# ETL — Ingestão e Staging

- **contract/** — **Contrato de dados** (abas, colunas, tipos, chaves). Fonte única: `contract/COCKPIT_CONTRACT.md`
- **ingest/** — Captura do arquivo Excel (SharePoint/OneDrive/local), hash, metadados (autor, data, caminho), histórico de versões
- **staging/** — Schemas e cargas por aba (landing zone); validação de schema, checksum, logs
- **jobs/** — Orquestração (agendamento, gatilho sob demanda, webhook quando disponível)

**Passo 1 (contrato):** preencher `contract/COCKPIT_CONTRACT.md` com os nomes exatos das abas e colunas do seu Excel; depois congelar a versão (ex.: 1.0.0).
