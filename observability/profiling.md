# Profiling e otimizações (Node/TypeScript)

Este repo é majoritariamente “biblioteca” (artefatos). Ainda assim, dá para fazer profiling de:

- **Listagens/filtros** (via o serviço que implementa `DashboardService`)
- **Sync SAP** (via `sap-connector`)

## 1) CPU profiling (V8)

Execute o processo com:

```bash
node --prof ./dist/<seu-entrypoint>.js
```

Após reproduzir o problema, gere o relatório:

```bash
node --prof-process isolate-*.log > cpu-profile.txt
```

Procure por:
- Hot paths de parsing/serialização JSON
- Ordenações/filtros em memória que poderiam ser empurrados pro banco
- Loops com normalização repetida (ex.: `trim().toUpperCase()` dentro de `map`)

## 2) Heap / vazamentos

```bash
node --inspect ./dist/<seu-entrypoint>.js
```

No Chrome DevTools:
- Memory → Take heap snapshot
- Compare snapshots (antes/depois) para detectar crescimento

Sinais comuns:
- caches sem TTL
- listas acumulando resultados de paginação
- promises “penduradas” (jobs sem await/cancel)

## 3) O que otimizar primeiro (heurística)

- **Listagens**:
  - paginação por cursor (evitar `OFFSET` alto)
  - índices alinhados aos filtros mais usados
  - limites hard (`limit` máximo)
  - evitar buscar colunas grandes quando não precisa

- **SAP sync**:
  - reduzir payload (campos) e usar endpoints mais específicos
  - batch/parallel com `maxConcurrent` controlado
  - backoff + jitter (já existe) e circuit breaker (já existe)
  - cache local de autenticação/session (já existe via cookie)

## 4) Instrumentação “para achar gargalo”

Mesmo antes do profiler, use:
- **traces**: para encontrar o span dominante (p95/p99)
- **métricas**: para apontar rota/endpoint e período
- **logs**: para correlacionar 1 request lento com seus IDs e entradas

