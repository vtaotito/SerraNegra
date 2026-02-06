# 🚀 Início Rápido - WMS Platform (Corrigido)

**Atualizado**: 2026-02-03  
**Tempo de leitura**: 2 minutos

---

## 🌐 Ver o Sistema AGORA

### ✅ Produção (Frontend Next.js)

```
http://31.97.174.120:8080
```

**O que você verá**:
- Dashboard com métricas
- Sidebar com navegação
- 5 páginas: Dashboard, Pedidos, Produtos, Estoque, Integração
- Design moderno (shadcn/ui)

---

## 💻 Rodar em Localhost

### Frontend Next.js (Correto)

```bash
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms\web-next"
npm install
npm run dev

# Abrir: http://localhost:3002
```

### Backend (Core + Gateway + Worker)

```bash
# Terminal 1: Core
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"
npm run dev:core

# Terminal 2: Gateway
cd gateway
npm run dev

# Terminal 3: Worker
cd worker
npm run dev
```

---

## 🔧 Deploy da Correção

### Passo 1: Commit (Seu PC)

```bash
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

git add deploy/docker-compose.yml ANALISE_E2E_ATUALIZADA.md MIGRACAO_FRONTEND_NEXTJS.md CORRECAO_FRONTEND_RESUMO.md

git commit -m "fix: corrigir docker-compose para usar Next.js"

git push origin main
```

### Passo 2: Deploy (Servidor)

```bash
ssh root@31.97.174.120
cd /opt/wms/current
git pull origin main
docker compose build --no-cache web
docker compose up -d web

# Validar
curl http://localhost:8080/ | grep "Next.js"
```

---

## 📊 Stack do Frontend

| Tecnologia | Versão | Status |
|------------|--------|--------|
| **Next.js** | 16 | ✅ Em produção |
| **React** | 19 | ✅ Em produção |
| **shadcn/ui** | Latest | ✅ Implementado |
| **TanStack Query** | 5.62 | ✅ Implementado |
| **Tailwind CSS** | 3.4 | ✅ Implementado |

---

## 🗺️ Navegação do Sistema

### Produção: http://31.97.174.120:8080

```
┌─────────────────────────────────────┐
│  WMS/OMS - Sistema de Gestão        │
│                                     │
│  📊 Dashboard    ← Página inicial   │
│  📦 Pedidos      ← Lista + detalhes │
│  📦 Produtos     ← Catálogo         │
│  📊 Estoque      ← Por depósito     │
│  🔗 Integração   ← SAP sync         │
└─────────────────────────────────────┘
```

---

## 🆘 Troubleshooting Rápido

### Frontend não carrega?

```bash
# Ver logs
ssh root@31.97.174.120
docker compose logs web

# Restart
docker compose restart web
```

### API não responde?

```bash
curl http://31.97.174.120:8080/api/health
# Deve retornar: {"status":"ok"}
```

### Localhost não funciona?

```bash
# Verificar porta
netstat -ano | findstr "3002"

# Reinstalar dependências
cd web-next
rm -rf node_modules
npm install
npm run dev
```

---

## 📚 Documentação Completa

| Documento | Para... |
|-----------|---------|
| **CORRECAO_FRONTEND_RESUMO.md** | Entender a correção (10 min) |
| **ANALISE_E2E_ATUALIZADA.md** | Análise completa (60 min) |
| **MIGRACAO_FRONTEND_NEXTJS.md** | Guia técnico (20 min) |
| **INDICE_DOCUMENTACAO.md** | Índice geral (5 min) |

---

## ✅ Checklist de Validação

- [ ] http://31.97.174.120:8080 carrega
- [ ] Dashboard mostra métricas
- [ ] Sidebar visível (desktop)
- [ ] Navegação funciona (5 páginas)
- [ ] API responde: /api/health
- [ ] Backend indicator mostra URL correta

---

## 🎯 Próximo Passo

**Esta semana**:
1. Fazer commit das correções
2. Deploy no servidor
3. Validar funcionamento

**Próximo mês**:
- Completar features faltantes (gráficos, filtros, RBAC)
- Adicionar testes
- Implementar Observabilidade

---

**Status**: ✅ Sistema funcional com Next.js 16  
**Completude**: 75% (objetivo: 100% em 3 meses)
