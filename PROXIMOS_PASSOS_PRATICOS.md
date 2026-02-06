# 🎯 Próximos Passos Práticos - WMS Platform

**Data**: 2026-02-03  
**Baseado em**: Análise E2E completa  
**Status**: ✅ Plano de ação validado

---

## 📋 Esta Semana (P0: Crítico)

### Segunda-feira (3h) - Backups PostgreSQL 🔴

**Objetivo**: Eliminar risco de perda de dados

```bash
# 1. Criar script de backup
cat > /opt/wms/scripts/backup-postgres.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/opt/wms/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/wms_backup_${TIMESTAMP}.sql"

mkdir -p ${BACKUP_DIR}

# Backup
docker exec wms-postgres pg_dump -U wms -d wms > ${BACKUP_FILE}

# Comprimir
gzip ${BACKUP_FILE}

# Manter apenas últimos 7 dias
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +7 -delete

echo "Backup concluído: ${BACKUP_FILE}.gz"
EOF

chmod +x /opt/wms/scripts/backup-postgres.sh

# 2. Testar backup
bash /opt/wms/scripts/backup-postgres.sh

# 3. Configurar cron (diário às 3h)
echo "0 3 * * * /opt/wms/scripts/backup-postgres.sh >> /var/log/wms-backup.log 2>&1" | crontab -

# 4. Testar restore (IMPORTANTE!)
gunzip -c /opt/wms/backups/wms_backup_*.sql.gz | head -20
# Deve mostrar SQL válido
```

**Checklist**:
- [ ] Script criado
- [ ] Backup manual executado com sucesso
- [ ] Cron configurado
- [ ] Restore testado
- [ ] Volume persistente `/opt/wms/backups` validado

---

### Terça-feira (3h) - Segurança Básica 🔴

**Objetivo**: Proteger endpoints críticos

#### 1. Shared Secret para Internal Endpoint (1h)

```bash
# 1. Gerar secret forte
SECRET=$(openssl rand -base64 32)
echo "INTERNAL_SHARED_SECRET=${SECRET}" >> /opt/wms/shared/.env

# 2. Atualizar docker-compose.yml
# Adicionar em core e worker:
#   INTERNAL_SHARED_SECRET: "${INTERNAL_SHARED_SECRET}"

# 3. No Core (FastAPI), validar header X-Internal-Secret
# Arquivo: core/app/main.py
```

**Código Core**:
```python
# core/app/main.py
import os
from fastapi import Header, HTTPException

INTERNAL_SECRET = os.getenv("INTERNAL_SHARED_SECRET")

@app.post("/internal/sap/orders")
async def receive_sap_orders(
    x_internal_secret: str = Header(...),
    orders: List[SapOrderCreate]
):
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # ... resto do código
```

**Código Worker**:
```typescript
// worker/src/index.ts
const INTERNAL_SECRET = process.env.INTERNAL_SHARED_SECRET;

await fetch(`${CORE_URL}/internal/sap/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Secret': INTERNAL_SECRET
  },
  body: JSON.stringify(orders)
});
```

#### 2. CORS Whitelist (1h)

```bash
# 1. Adicionar env var
echo "ALLOWED_ORIGINS=http://31.97.174.120:8080,https://wms.seudominio.com" >> /opt/wms/shared/.env

# 2. Atualizar gateway
# Arquivo: gateway/src/index.ts
```

**Código Gateway**:
```typescript
// gateway/src/index.ts
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

app.register(fastifyCors, {
  origin: (origin, cb) => {
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
});
```

#### 3. Review de Secrets (1h)

```bash
# Verificar que não há secrets hardcoded
grep -r "password\|secret\|key" gateway/src core/app worker/src --include="*.ts" --include="*.py"

# Mover credenciais SAP para Docker Secrets (produção)
# Arquivo: deploy/docker-compose.yml
```

**Checklist**:
- [ ] Internal secret implementado e testado
- [ ] CORS whitelist configurado
- [ ] Secrets revisados (nenhum hardcoded)
- [ ] Deploy com rebuild: `docker compose build --no-cache core gateway worker`

---

### Quarta-feira (2h) - Fix Botão "Importar SAP" 🔴

**Objetivo**: Permitir sync manual de pedidos

```typescript
// web/src/pages/OrdersDashboard.tsx

const syncSapOrders = async () => {
  setIsSyncing(true);
  
  try {
    // Disparar sync no backend
    await fetch(`${BASE_URL}/api/sap/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Aguardar alguns segundos
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Refetch orders
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    
    toast.success('Pedidos sincronizados com sucesso!');
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    toast.error('Erro ao sincronizar pedidos SAP');
  } finally {
    setIsSyncing(false);
  }
};

// JSX
<button
  onClick={syncSapOrders}
  disabled={isSyncing}
  className="btn btn-primary"
>
  {isSyncing ? (
    <>
      <LoadingSpinner size="sm" />
      Sincronizando...
    </>
  ) : (
    <>
      <RefreshIcon />
      Importar do SAP
    </>
  )}
</button>
```

**Teste**:
```bash
# 1. Rebuild frontend
cd web
npm run build

# 2. Restart container
docker compose restart web

# 3. Testar no browser
# - Clicar em "Importar do SAP"
# - Verificar loading state
# - Verificar toast de sucesso
# - Validar que novos pedidos aparecem
```

**Checklist**:
- [ ] Código atualizado
- [ ] Loading state funciona
- [ ] Toast notifications aparecem
- [ ] Orders refetch após sync
- [ ] Teste E2E validado

---

### Quinta-feira (4h) - Deploy e Validação 🟡

**Objetivo**: Aplicar todas as mudanças em produção

```bash
# No seu PC (Windows)
cd "c:\Users\Vitor A. Tito\Documents\GPTO\GSN\2026\wms"

# 1. Commit mudanças
git add .
git commit -m "feat: segurança + backups + fix botão SAP

- Adiciona shared secret para internal endpoint
- CORS whitelist configurável
- Backups PostgreSQL diários com cron
- Fix botão Importar SAP (POST /api/sap/sync)
- Loading states e toast notifications

Refs: ANALISE_E2E_COMPLETA.md"

git push origin main

# 2. No servidor VPS
ssh root@31.97.174.120

cd /opt/wms/current
git pull origin main

# 3. Validar .env
cat /opt/wms/shared/.env | grep -E "INTERNAL_SHARED_SECRET|ALLOWED_ORIGINS"

# Se faltarem, adicionar:
nano /opt/wms/shared/.env

# 4. Rebuild serviços afetados
docker compose build --no-cache core gateway worker web

# 5. Restart stack
docker compose up -d

# 6. Ver logs
docker compose logs -f --tail=50
```

**Validação Completa**:
```bash
# 1. Health checks
curl -i http://localhost:8080/health        # Gateway OK
curl -i http://localhost:8080/api/orders?limit=1  # Core OK

# 2. SAP health
curl -i http://localhost:8080/api/sap/health

# 3. Internal endpoint (deve falhar sem secret)
curl -X POST http://localhost:8080/internal/sap/orders \
  -H "Content-Type: application/json" \
  -d '[]'
# Esperado: 403 Forbidden

# 4. Worker logs (deve ter secret)
docker compose logs worker | grep -i "secret\|auth"

# 5. Backup cron
ls -lh /opt/wms/backups/
# Deve haver pelo menos 1 backup

# 6. Frontend
# Browser: http://31.97.174.120:8080/
# - Verificar "Fonte: API"
# - Clicar "Importar do SAP"
# - Verificar loading + toast
```

**Checklist**:
- [ ] Git push concluído
- [ ] Git pull no servidor
- [ ] `.env` validado
- [ ] Rebuild e restart sem erros
- [ ] Health checks passando
- [ ] Internal endpoint protegido
- [ ] Worker autenticando
- [ ] Backup existe
- [ ] Frontend funcional

---

### Sexta-feira (2h) - Documentação e Retrospectiva 🟢

**Objetivo**: Consolidar aprendizados

```bash
# 1. Atualizar CHANGELOG.md
cat >> CHANGELOG.md << 'EOF'

## [0.2.0] - 2026-02-03

### Added
- 🔒 Shared secret para internal endpoint (/internal/sap/orders)
- 🔒 CORS whitelist configurável via env var
- 💾 Backups PostgreSQL diários (cron 3h)
- 🔄 Fix botão "Importar SAP" (agora chama POST /api/sap/sync)
- 🎨 Loading states e toast notifications no frontend

### Security
- Endpoint interno agora requer autenticação
- CORS restrito a origens permitidas
- Review completo de secrets (nenhum hardcoded)

### Infrastructure
- Script de backup PostgreSQL automatizado
- Cron configurado para backups diários
- Volume persistente para backups

### Fixed
- Frontend mostrando "Mock local" (corrigido semana passada)
- Botão SAP não disparava sync real
- CORS permitindo qualquer origem

EOF

# 2. Criar OPERATIONS_MANUAL.md (se não existir)
# Ver seção abaixo

# 3. Revisar documentação E2E
# Validar que mudanças estão refletidas
```

**Retrospectiva (30 min)**:
- O que funcionou bem?
- O que pode melhorar?
- Bloqueios encontrados?
- Próxima semana é realista?

**Checklist**:
- [ ] CHANGELOG.md atualizado
- [ ] OPERATIONS_MANUAL.md criado/atualizado
- [ ] Retrospectiva realizada
- [ ] Próxima semana planejada

---

## 📅 Semana 2 (P1: Importante)

### Segunda-terça (6h) - Alembic + Audit Log

**Objetivo**: Versionamento de schema + auditoria

```bash
# 1. Instalar Alembic
cd core
pip install alembic

# 2. Inicializar Alembic
alembic init alembic

# 3. Configurar alembic.ini
# sqlalchemy.url = postgresql+psycopg://wms:PASSWORD@postgres:5432/wms

# 4. Criar migration inicial (schema atual)
alembic revision --autogenerate -m "Initial schema"

# 5. Criar migration para audit_log
alembic revision -m "Add audit_log table"
```

**Migration audit_log**:
```python
# alembic/versions/XXXXX_add_audit_log.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    op.create_table(
        'audit_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id')),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('from_status', sa.String(50)),
        sa.Column('to_status', sa.String(50)),
        sa.Column('actor', sa.String(255)),
        sa.Column('occurred_at', sa.DateTime, nullable=False),
        sa.Column('idempotency_key', sa.String(255)),
        sa.Column('reason', sa.Text),
        sa.Column('metadata', postgresql.JSONB),
    )
    
    op.create_index('idx_audit_order_id', 'audit_log', ['order_id'])
    op.create_index('idx_audit_occurred_at', 'audit_log', ['occurred_at'])

def downgrade():
    op.drop_table('audit_log')
```

**Model AuditLog**:
```python
# core/app/models.py
class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey('orders.id'))
    event_type = Column(String(50), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50))
    actor = Column(String(255))
    occurred_at = Column(DateTime, nullable=False)
    idempotency_key = Column(String(255))
    reason = Column(Text)
    metadata = Column(JSONB)
    
    order = relationship("Order", back_populates="audit_logs")
```

**Middleware**:
```python
# core/app/middleware/audit.py
async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
    
    # Se foi transição de status, logar
    if request.url.path.endswith('/status') and response.status_code == 200:
        order_id = request.path_params.get('id')
        body = await request.json()
        
        audit_entry = AuditLog(
            order_id=order_id,
            event_type="STATUS_TRANSITION",
            from_status=body.get('from_status'),
            to_status=body.get('to_status'),
            actor=request.headers.get('X-User-Id'),
            occurred_at=datetime.utcnow(),
            idempotency_key=request.headers.get('Idempotency-Key'),
        )
        
        db.add(audit_entry)
        db.commit()
    
    return response
```

**Endpoint**:
```python
# core/app/main.py
@app.get("/orders/{order_id}/audit")
async def get_order_audit(order_id: UUID, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(
        AuditLog.order_id == order_id
    ).order_by(AuditLog.occurred_at.desc()).all()
    
    return {"order_id": order_id, "audit_log": logs}
```

**Checklist**:
- [ ] Alembic instalado e configurado
- [ ] Migration inicial criada
- [ ] Migration audit_log criada e aplicada
- [ ] Model AuditLog implementado
- [ ] Middleware de auditoria funcional
- [ ] Endpoint GET /orders/{id}/audit testado

---

### Quarta-quinta (4h) - Cursor Persistente

**Objetivo**: Worker mantém estado entre restarts

```sql
-- Migration: sap_sync_cursor
CREATE TABLE sap_sync_cursor (
  id SERIAL PRIMARY KEY,
  last_sync_date TIMESTAMP NOT NULL,
  last_sync_doc_entry INTEGER,
  sync_status VARCHAR(20), -- SUCCESS, FAILED
  error_message TEXT,
  synced_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Core: Endpoint para cursor**:
```python
# core/app/main.py
@app.get("/internal/sap/cursor")
async def get_sap_cursor(db: Session = Depends(get_db)):
    cursor = db.query(SapSyncCursor).order_by(
        SapSyncCursor.created_at.desc()
    ).first()
    
    return {
        "last_sync_date": cursor.last_sync_date if cursor else None,
        "last_sync_doc_entry": cursor.last_sync_doc_entry if cursor else None
    }

@app.post("/internal/sap/cursor")
async def update_sap_cursor(
    cursor_data: SapCursorUpdate,
    db: Session = Depends(get_db)
):
    cursor = SapSyncCursor(**cursor_data.dict())
    db.add(cursor)
    db.commit()
    return {"status": "ok"}
```

**Worker: Usar cursor**:
```typescript
// worker/src/index.ts
async function getLastSyncDate(): Promise<Date> {
  const response = await fetch(`${CORE_URL}/internal/sap/cursor`, {
    headers: { 'X-Internal-Secret': INTERNAL_SECRET }
  });
  
  if (response.ok) {
    const data = await response.json();
    return data.last_sync_date ? new Date(data.last_sync_date) : new Date(0);
  }
  
  return new Date(0); // Se falhar, buscar tudo
}

async function updateLastSyncDate(date: Date, count: number) {
  await fetch(`${CORE_URL}/internal/sap/cursor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET
    },
    body: JSON.stringify({
      last_sync_date: date.toISOString(),
      sync_status: 'SUCCESS',
      synced_count: count
    })
  });
}

// No loop principal
const lastSyncDate = await getLastSyncDate();
const orders = await sapClient.getOrders({
  documentStatus: 'bost_Open',
  updateDate: lastSyncDate
});

// Após sync bem-sucedido
await updateLastSyncDate(new Date(), orders.length);
```

**Checklist**:
- [ ] Migration sap_sync_cursor criada
- [ ] Model SapSyncCursor implementado
- [ ] Endpoints cursor no Core
- [ ] Worker lê cursor ao iniciar
- [ ] Worker atualiza cursor após sync
- [ ] Testado restart do worker (não re-sync)

---

### Sexta (2h) - Gateway: Endpoint de Status

**Objetivo**: Visibilidade do status de sync

```typescript
// gateway/src/routes/sap.ts
app.get('/api/sap/sync/status', async (request, reply) => {
  try {
    // Buscar cursor do Core
    const cursorResponse = await fetch(`${CORE_BASE_URL}/internal/sap/cursor`, {
      headers: { 'X-Internal-Secret': INTERNAL_SECRET }
    });
    
    const cursor = await cursorResponse.json();
    
    // Buscar stats do SAP
    const sapOrders = await sapClient.getOrders({
      documentStatus: 'bost_Open'
    });
    
    return {
      last_sync_date: cursor.last_sync_date,
      last_sync_count: cursor.synced_count,
      last_sync_status: cursor.sync_status,
      sap_open_orders: sapOrders.length,
      next_sync_estimate: '30s' // POLL_INTERVAL
    };
  } catch (error) {
    reply.code(500);
    return { error: 'Failed to get sync status' };
  }
});
```

**Frontend: Mostrar status**:
```typescript
// web/src/pages/OrdersDashboard.tsx
const { data: syncStatus } = useQuery({
  queryKey: ['sap-sync-status'],
  queryFn: () => fetch(`${BASE_URL}/api/sap/sync/status`).then(r => r.json()),
  refetchInterval: 10000 // Atualizar a cada 10s
});

// JSX
<div className="sync-status">
  <span>Última sincronização: {formatRelativeTime(syncStatus?.last_sync_date)}</span>
  <span>Pedidos sincronizados: {syncStatus?.last_sync_count}</span>
  <span>Pedidos abertos no SAP: {syncStatus?.sap_open_orders}</span>
</div>
```

**Checklist**:
- [ ] Endpoint GET /api/sap/sync/status implementado
- [ ] Frontend mostra status de sync
- [ ] Auto-atualização funcionando

---

## 📊 Checklist Geral da Semana 1

### Segunda
- [ ] Script backup PostgreSQL criado
- [ ] Cron configurado (3h diariamente)
- [ ] Teste de restore validado
- [ ] Volume persistente validado

### Terça
- [ ] Shared secret implementado (Core + Worker)
- [ ] CORS whitelist configurado
- [ ] Review de secrets concluído
- [ ] Nenhum secret hardcoded

### Quarta
- [ ] Botão "Importar SAP" corrigido
- [ ] POST /api/sap/sync funcional
- [ ] Loading states implementados
- [ ] Toast notifications funcionando

### Quinta
- [ ] Deploy em produção concluído
- [ ] Todos os health checks passando
- [ ] Internal endpoint protegido
- [ ] Worker autenticando corretamente
- [ ] Backup diário validado
- [ ] Frontend 100% funcional

### Sexta
- [ ] CHANGELOG.md atualizado
- [ ] OPERATIONS_MANUAL.md criado
- [ ] Retrospectiva realizada
- [ ] Próxima semana planejada

---

## 🎯 KPIs de Sucesso (Semana 1)

| Métrica | Meta | Como Medir |
|---------|------|------------|
| **Backups funcionando** | 100% | Arquivo diário em `/opt/wms/backups/` |
| **Internal endpoint seguro** | 100% | Teste sem secret retorna 403 |
| **CORS configurado** | 100% | Apenas origens permitidas aceitas |
| **Botão SAP funciona** | 100% | Sync manual dispara e refetch |
| **Zero downtime** | 100% | Uptime > 99.9% durante deploy |

---

## 📞 Suporte

**Problemas?**
1. Ver logs: `docker compose logs -f [serviço]`
2. Consultar `docs/VALIDACAO_CADEIA_SAP.md`
3. Revisar `CORRECAO_SAP_RESUMO.md`
4. Troubleshooting: `QUICK-FIX.md`

**Dúvidas técnicas?**
- Consultar `ANALISE_E2E_COMPLETA.md`
- Índice: `INDICE_DOCUMENTACAO.md`

---

**Preparado por**: Equipe Técnica WMS  
**Data**: 2026-02-03  
**Próxima atualização**: Após Semana 1
