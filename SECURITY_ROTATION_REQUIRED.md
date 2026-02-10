# ROTACAO DE CREDENCIAIS OBRIGATORIA

## Data: 2026-02-10
## Motivo: Credenciais foram expostas em arquivos versionados no Git

---

## CREDENCIAIS QUE DEVEM SER ROTACIONADAS IMEDIATAMENTE

### 1. SAP B1 - Senha do usuario
- **Usuario**: lorenzo.naves
- **Acao**: Alterar senha no SAP B1 Client (menu: Administracao > Usuarios)
- **Prioridade**: CRITICA

### 2. SAP B1 - Token de sessao
- **Token exposto**: (hex token longo)
- **Acao**: Token de sessao expira automaticamente, mas recomenda-se invalidar todas as sessoes ativas
- **Prioridade**: ALTA

### 3. VPS Hostinger - Acesso SSH
- **IP**: 31.97.174.120
- **Usuario**: root
- **Acao**: 
  - Alterar senha root: `passwd`
  - Desabilitar login por senha SSH: configurar apenas chave publica
  - Considerar trocar porta SSH (de 22 para outra)
- **Prioridade**: CRITICA

### 4. PostgreSQL - Senha do banco
- **Senhas expostas**: `wms_secret_2026`, `wms_postgres_prod_2026`
- **Acao**: 
  - Alterar no servidor: `ALTER USER wms_user WITH PASSWORD 'nova_senha_forte';`
  - Atualizar no `.env` do VPS: `/opt/wms/.env`
  - Reiniciar containers: `docker-compose restart`
- **Prioridade**: ALTA

### 5. Internal Shared Secret
- **Valores expostos**: `dev-internal-secret`, `wms-prod-secret-2026-change-me`
- **Acao**: Gerar novo secret: `openssl rand -base64 32`
- **Prioridade**: MEDIA

---

## ACOES JA REALIZADAS

- [x] Credenciais removidas de TODOS os arquivos do repositorio (60+ arquivos)
- [x] Historico Git limpo com `git filter-repo` (credenciais removidas de todos os commits)
- [x] Force push realizado para sobrescrever historico no GitHub
- [x] `.gitignore` atualizado para prevenir futuras exposicoes
- [x] Arquivos `.env` removidos do tracking Git
- [x] Arquivos `.example` limpos com placeholders

## ACOES PENDENTES

- [ ] **Rotacionar senha SAP B1** (lorenzo.naves)
- [ ] **Rotacionar senha root VPS** (31.97.174.120)
- [ ] **Rotacionar senha PostgreSQL** no VPS
- [ ] **Gerar novo Internal Shared Secret** para producao
- [ ] **Configurar autenticacao SSH por chave publica** (desabilitar senha)
- [ ] **Verificar se algum fork do repositorio tem o historico antigo**
- [ ] **Solicitar garbage collection no GitHub** (contato: support@github.com)

---

## COMO CONFIGURAR CREDENCIAIS POS-ROTACAO

### No ambiente local (desenvolvimento)
```bash
# Copiar template
cp .env.postgres.example .env

# Editar com novas credenciais
# NUNCA commitar o .env!
```

### No VPS (producao)
```bash
ssh root@SEU_VPS_IP
cd /opt/wms
nano .env
# Editar com novas credenciais
docker-compose down
docker-compose up -d --build
```

---

## NOTA SOBRE O GITHUB

Mesmo apos force push, o GitHub pode manter caches dos commits antigos por algum tempo.
Para garantir a remocao completa:

1. Contatar GitHub Support: https://support.github.com/
2. Solicitar garbage collection no repositorio `vtaotito/SerraNegra`
3. Informar que houve exposicao de credenciais e que o historico foi reescrito

---

**IMPORTANTE**: Este documento NAO contem as credenciais em si, apenas referencia o que precisa ser rotacionado.
