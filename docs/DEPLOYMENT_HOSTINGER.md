# Deploy (VPS Hostinger) — Node Gateway + FastAPI Core + Worker

## Objetivo
Descrever um deploy pragmático com:

- Docker Compose
- Nginx (TLS + reverse proxy)
- Postgres + Redis
- serviços: `gateway` (Node/TS), `core` (FastAPI), `worker` (jobs)

> Observabilidade (Prometheus/Grafana/Loki/Tempo) pode entrar como fase 2, sem travar o MVP.

## Topologia
- Internet → **Nginx** → `gateway` (HTTP)
- `gateway` → `core` (HTTP interno)
- `core`/`worker` → Postgres/Redis
- `worker` → SAP B1 Service Layer (via rede permitida)

## Variáveis e segredos (padrão)
Crie um arquivo `.env` no servidor (não versionar) com:

- `POSTGRES_URL=postgresql://...`
- `REDIS_URL=redis://...`
- `JWT_SECRET=...`
- `SAP_SL_BASE_URL=...`
- `SAP_SL_USERNAME=...`
- `SAP_SL_PASSWORD=...`
- `OTEL_EXPORTER_OTLP_ENDPOINT=...` (se habilitar)

## Docker Compose (esqueleto)
Sugestão de serviços:
- `nginx`
- `gateway`
- `core`
- `worker`
- `postgres`
- `redis`

## Regras de segurança operacional
- SSH apenas por chave
- Firewall liberando só `22`, `80`, `443`
- Fail2ban habilitado
- Backups automáticos do Postgres (snapshot + retenção)
- Rotação de segredos (JWT/SAP) e princípio de menor privilégio

## Checklist de go-live
- Healthchecks de `gateway` e `core`
- Migrações do banco automatizadas (rodar no `core` ou job separado)
- Logs estruturados com `X-Correlation-Id`
- Alertas básicos: container restart loop, Postgres down, Redis down
- Plano de rollback (tag de imagem anterior)

