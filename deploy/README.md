# Deploy Agent (Hostinger VPS)

Este pacote prepara o servidor e faz deploy versionado via Docker Compose.

## Estrutura no servidor

- `/opt/wms/releases/<timestamp>`: releases por data/hora
- `/opt/wms/shared/.env`: variaveis de ambiente
- `/opt/wms/current`: symlink para o release ativo

## Preparar servidor

```bash
sudo BASE_DIR=/opt/wms DEPLOY_USER=deploy WITH_UFW=true ./deploy/prepare-server.sh
```

## Configurar ambiente

Copie o `.env.example` e ajuste:

```bash
cp deploy/.env.example /opt/wms/shared/.env
```

## Deploy

Execute no servidor a partir do repositorio:

```bash
./deploy/deploy.sh
```

## Rollback manual

```bash
./deploy/rollback.sh /opt/wms/releases/20260203153000
```

## Observacoes

- O deploy cria um release por timestamp.
- Healthcheck verifica `http://localhost:<WEB_PORT>/healthz`.
- Em falha, o script tenta rollback automatico para o release anterior.
