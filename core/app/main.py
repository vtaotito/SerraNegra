from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, inspect as sa_inspect, or_, select, text
from sqlalchemy.orm import Session, selectinload

from .db import Base, engine, get_session
from .logging_json import configure_logging
from .models import (
    IdempotencyKey,
    Order as DbOrder,
    OrderEvent as DbOrderEvent,
    OrderItem as DbOrderItem,
    Product as DbProduct,
    InventoryStock as DbInventoryStock,
    InventoryMovement as DbInventoryMovement,
    Customer as DbCustomer,
)
from .schemas import (
    CreateOrderRequest,
    ErrorResponse,
    Order,
    OrderEvent,
    OrderEventRequest,
    OrderEventResult,
    OrderHistoryResponse,
    SapOrdersSyncRequest,
    SapOrdersSyncResponse,
)
from .state_machine import order_sm


SERVICE_NAME = os.getenv("SERVICE_NAME", "wms-core")
INTERNAL_SHARED_SECRET = os.getenv("INTERNAL_SHARED_SECRET", "dev-internal-secret")

log = logging.getLogger(SERVICE_NAME)

app = FastAPI(title="WMS Core", version="0.1.0")

# CORS - Permitir requisições do frontend via Nginx
# Em produção, o Nginx faz proxy então o Origin pode variar
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if "*" not in ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-Id", "X-Request-Id"],
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def run_migrations() -> None:
    """Migrações idempotentes leves (ALTER TABLE ADD COLUMN) para colunas novas.

    `create_all` cria tabelas inexistentes, mas não adiciona colunas a tabelas já
    existentes. Aqui adicionamos colunas faltantes de forma compatível com Postgres e SQLite.
    """
    inspector = sa_inspect(engine)
    tables = set(inspector.get_table_names())
    is_pg = engine.dialect.name == "postgresql"
    ts_type = "TIMESTAMPTZ" if is_pg else "TIMESTAMP"
    bool_default = "BOOLEAN DEFAULT FALSE" if is_pg else "BOOLEAN DEFAULT 0"

    if "inventory_stock" in tables:
        cols = {c["name"] for c in inspector.get_columns("inventory_stock")}
        stmts: list[str] = []
        if "last_synced_at" not in cols:
            stmts.append(f"ALTER TABLE inventory_stock ADD COLUMN last_synced_at {ts_type}")
        if "is_stale" not in cols:
            stmts.append(f"ALTER TABLE inventory_stock ADD COLUMN is_stale {bool_default}")
        if stmts:
            with engine.begin() as conn:
                for sql in stmts:
                    conn.execute(text(sql))
            log.info("Migração aplicada em inventory_stock.", extra={"columns": stmts})


@app.on_event("startup")
def on_startup() -> None:
    configure_logging()
    Base.metadata.create_all(bind=engine)
    run_migrations()
    log.info("Core iniciado.")


@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    incoming = request.headers.get("x-correlation-id")
    correlation_id = incoming if incoming else str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    request.state.request_id = str(uuid.uuid4())
    try:
        response: Response = await call_next(request)
    except HTTPException as exc:
        payload = ErrorResponse(
            errorCode=getattr(exc, "error_code", "WMS-ERR-001"),
            message=exc.detail if isinstance(exc.detail, str) else "Erro.",
            details=getattr(exc, "details", None),
            correlationId=correlation_id,
        )
        return JSONResponse(status_code=exc.status_code, content=payload.model_dump(by_alias=True))
    except Exception as exc:  # noqa: BLE001
        log.exception("Erro inesperado.", extra={"correlationId": correlation_id})
        payload = ErrorResponse(
            errorCode="WMS-ERR-500",
            message=f"Erro interno: {type(exc).__name__}",
            details={"error": str(exc)[:200]} if str(exc) else None,
            correlationId=correlation_id,
        )
        return JSONResponse(status_code=500, content=payload.model_dump(by_alias=True))

    response.headers["X-Correlation-Id"] = correlation_id
    return response


@app.get("/health")
def health():
    return {"ok": True, "service": SERVICE_NAME}


@app.get("/v1/catalog/items")
def list_catalog_items(
    db: Session = Depends(get_session),
    search: str | None = None,
    active: bool | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """Listagem de produtos do catálogo."""
    q = select(DbProduct).order_by(DbProduct.sku.asc())
    if search:
        q = q.where(
            DbProduct.sku.ilike(f"%{search}%")
            | DbProduct.description.ilike(f"%{search}%")
        )
    if active is not None:
        q = q.where(DbProduct.is_active == active)

    total_q = select(DbProduct)
    if search:
        total_q = total_q.where(
            DbProduct.sku.ilike(f"%{search}%")
            | DbProduct.description.ilike(f"%{search}%")
        )
    total = len(db.execute(total_q).scalars().all())

    rows = db.execute(q.offset(offset).limit(min(max(limit, 1), 200))).scalars().all()
    return {
        "data": [
            {
                "id": p.id,
                "sku": p.sku,
                "description": p.description,
                "ean": p.ean,
                "category": p.category,
                "unit_of_measure": p.unit_of_measure,
                "is_active": p.is_active,
                "is_inventory_item": p.is_inventory_item,
                "is_sales_item": p.is_sales_item,
                "sap_item_code": p.sap_item_code,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/v1/inventory")
def list_inventory(
    db: Session = Depends(get_session),
    sku: str | None = None,
    warehouseCode: str | None = None,
    includeStale: bool = False,
    limit: int = 50,
    offset: int = 0,
):
    """Listagem de estoque por depósito.

    Por padrão exclui registros obsoletos (`is_stale=True`) — SKUs/depósitos que
    deixaram de vir no último snapshot do SAP. Use `includeStale=true` para trazê-los.
    Default False evita dupla contagem (ex.: linhas legadas do depósito 'GERAL'
    coexistindo com a quebra real por depósito)."""
    q = select(DbInventoryStock).order_by(DbInventoryStock.sku.asc())
    count_q = select(DbInventoryStock)
    if sku:
        q = q.where(DbInventoryStock.sku.ilike(f"%{sku}%"))
        count_q = count_q.where(DbInventoryStock.sku.ilike(f"%{sku}%"))
    if warehouseCode:
        q = q.where(DbInventoryStock.warehouse_code == warehouseCode)
        count_q = count_q.where(DbInventoryStock.warehouse_code == warehouseCode)
    if not includeStale:
        q = q.where(DbInventoryStock.is_stale.is_(False))
        count_q = count_q.where(DbInventoryStock.is_stale.is_(False))

    total = len(db.execute(count_q).scalars().all())
    rows = db.execute(q.offset(offset).limit(min(max(limit, 1), 5000))).scalars().all()

    return {
        "data": [
            {
                "id": s.id,
                "product_id": s.sku,
                "warehouse_id": s.warehouse_code,
                "item_name": s.item_name,
                "quantity_available": float(s.on_hand),
                "quantity_reserved": float(s.committed),
                "quantity_free": float(s.available) if s.available else max(float(s.on_hand) - float(s.committed), 0),
                "quantity_on_order": float(s.ordered),
                "min_stock": float(s.min_stock) if s.min_stock else 0,
                "max_stock": float(s.max_stock) if s.max_stock else 0,
                "uom": s.uom,
                "avg_price": float(s.avg_price) if s.avg_price else 0,
                "last_purchase_price": float(s.last_purchase_price) if s.last_purchase_price else 0,
                "last_purchase_date": s.last_purchase_date,
                "last_sale_date": s.last_sale_date,
                "gross_weight": float(s.gross_weight) if s.gross_weight else 0,
                "lead_time": s.lead_time or 0,
                "item_group_code": s.item_group_code,
                "item_group_name": s.item_group_name,
                "last_count_date": s.last_count_date,
                "sap_update_date": s.sap_update_date,
                "is_stale": bool(s.is_stale),
                "last_synced_at": s.last_synced_at.isoformat() if s.last_synced_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# ========================================
# Movimentações de Estoque (OINM)
# ========================================

class BulkMovementItem(BaseModel):
    sku: str
    warehouse_code: str
    doc_date: str | None = None
    create_date: str | None = None
    in_qty: float = 0
    out_qty: float = 0
    trans_type: int | None = None
    base_ref: str | None = None
    calc_price: float = 0
    balance: float = 0


class BulkMovementsRequest(BaseModel):
    items: list[BulkMovementItem]
    # Janela sincronizada (YYYY-MM-DD). Movimentos com doc_date >= date_from são
    # apagados antes da reinserção, tornando a operação idempotente para a janela.
    date_from: str | None = None


def _movement_signature(item: BulkMovementItem) -> str:
    raw = "|".join(
        str(x)
        for x in [
            item.sku,
            item.warehouse_code,
            item.doc_date or "",
            item.create_date or "",
            item.in_qty,
            item.out_qty,
            item.trans_type if item.trans_type is not None else "",
            item.base_ref or "",
            item.balance,
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:64]


@app.post("/v1/inventory/movements/bulk")
def bulk_upsert_movements(
    req: BulkMovementsRequest,
    request: Request,
    db: Session = Depends(get_session),
):
    """Bulk insert de movimentações (OINM). Idempotente por janela de data."""
    correlation_id = request.state.correlation_id
    now = now_utc()

    if req.date_from:
        db.execute(
            DbInventoryMovement.__table__.delete().where(
                DbInventoryMovement.doc_date >= req.date_from
            )
        )
        db.commit()

    inserted = 0
    seen: set[str] = set()
    existing_sigs = {
        row[0]
        for row in db.execute(select(DbInventoryMovement.signature)).all()
    }
    for item in req.items:
        sig = _movement_signature(item)
        if sig in seen or sig in existing_sigs:
            continue
        seen.add(sig)
        db.add(DbInventoryMovement(
            sku=item.sku,
            warehouse_code=item.warehouse_code,
            doc_date=item.doc_date,
            create_date=item.create_date,
            in_qty=item.in_qty,
            out_qty=item.out_qty,
            trans_type=item.trans_type,
            base_ref=item.base_ref,
            calc_price=item.calc_price,
            balance=item.balance,
            signature=sig,
            created_at=now,
        ))
        inserted += 1

    db.commit()
    log.info("Bulk movements sync.", extra={"correlationId": correlation_id, "inserted": inserted})
    return {"inserted": inserted, "received": len(req.items)}


@app.get("/v1/inventory/movements")
def list_movements(
    db: Session = Depends(get_session),
    sku: str | None = None,
    warehouseCode: str | None = None,
    limit: int = 200,
    offset: int = 0,
):
    """Listagem de movimentações de estoque (mais recentes primeiro)."""
    q = select(DbInventoryMovement).order_by(
        DbInventoryMovement.doc_date.desc(), DbInventoryMovement.id.desc()
    )
    count_q = select(DbInventoryMovement)
    if sku:
        q = q.where(DbInventoryMovement.sku == sku)
        count_q = count_q.where(DbInventoryMovement.sku == sku)
    if warehouseCode:
        q = q.where(DbInventoryMovement.warehouse_code == warehouseCode)
        count_q = count_q.where(DbInventoryMovement.warehouse_code == warehouseCode)

    total = len(db.execute(count_q).scalars().all())
    rows = db.execute(q.offset(offset).limit(min(max(limit, 1), 5000))).scalars().all()

    return {
        "data": [
            {
                "id": m.id,
                "sku": m.sku,
                "warehouse_code": m.warehouse_code,
                "doc_date": m.doc_date,
                "create_date": m.create_date,
                "in_qty": float(m.in_qty),
                "out_qty": float(m.out_qty),
                "net_qty": float(m.in_qty) - float(m.out_qty),
                "trans_type": m.trans_type,
                "base_ref": m.base_ref,
                "calc_price": float(m.calc_price),
                "balance": float(m.balance),
            }
            for m in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/v1/customers")
def list_customers(
    db: Session = Depends(get_session),
    search: str | None = None,
    active: bool | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """Listagem de clientes."""
    q = select(DbCustomer)
    if search:
        term = f"%{search.strip()}%"
        q = q.where(
            or_(
                DbCustomer.card_code.ilike(term),
                DbCustomer.card_name.ilike(term),
            )
        )
    if active is not None:
        q = q.where(DbCustomer.is_active == active)

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    rows = db.execute(
        q.order_by(DbCustomer.card_name.asc())
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 500))
    ).scalars().all()

    return {
        "data": [
            {
                "id": c.id,
                "card_code": c.card_code,
                "card_name": c.card_name,
                "card_type": c.card_type,
                "phone": c.phone,
                "email": c.email,
                "address": c.address,
                "city": c.city,
                "state": c.state,
                "is_active": c.is_active,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in rows
        ],
        "total": int(total or 0),
        "limit": limit,
        "offset": offset,
    }


# ========================================
# Bulk Sync Endpoints (chamados pelo Gateway)
# ========================================

class BulkProductItem(BaseModel):
    sku: str
    description: str = ""
    ean: str | None = None
    category: str | None = None
    unit_of_measure: str = "UN"
    is_active: bool = True
    is_inventory_item: bool = True
    is_sales_item: bool = True
    sap_item_code: str | None = None
    sap_update_date: str | None = None


class BulkProductsRequest(BaseModel):
    items: list[BulkProductItem]


@app.post("/v1/catalog/items/bulk")
def bulk_upsert_products(
    req: BulkProductsRequest,
    request: Request,
    db: Session = Depends(get_session),
):
    """Bulk upsert de produtos vindos do SAP."""
    correlation_id = request.state.correlation_id
    created = 0
    updated = 0

    for item in req.items:
        existing = db.execute(
            select(DbProduct).where(DbProduct.sku == item.sku)
        ).scalar_one_or_none()

        now = now_utc()
        if existing:
            existing.description = item.description
            existing.ean = item.ean
            existing.category = item.category
            existing.unit_of_measure = item.unit_of_measure
            existing.is_active = item.is_active
            existing.is_inventory_item = item.is_inventory_item
            existing.is_sales_item = item.is_sales_item
            existing.sap_item_code = item.sap_item_code
            existing.sap_update_date = item.sap_update_date
            existing.updated_at = now
            updated += 1
        else:
            db.add(DbProduct(
                sku=item.sku,
                description=item.description,
                ean=item.ean,
                category=item.category,
                unit_of_measure=item.unit_of_measure,
                is_active=item.is_active,
                is_inventory_item=item.is_inventory_item,
                is_sales_item=item.is_sales_item,
                sap_item_code=item.sap_item_code,
                sap_update_date=item.sap_update_date,
                created_at=now,
                updated_at=now,
            ))
            created += 1

    db.commit()
    log.info("Bulk products sync.", extra={"correlationId": correlation_id, "items_created": created, "items_updated": updated})
    return {"upserted": created + updated, "created": created, "updated": updated}


class BulkInventoryItem(BaseModel):
    sku: str
    warehouse_code: str
    item_name: str | None = None
    on_hand: float = 0
    committed: float = 0
    ordered: float = 0
    available: float = 0
    min_stock: float = 0
    max_stock: float = 0
    uom: str | None = None
    avg_price: float = 0
    last_purchase_price: float = 0
    last_purchase_date: str | None = None
    last_sale_date: str | None = None
    gross_weight: float = 0
    lead_time: int = 0
    item_group_code: int | None = None
    item_group_name: str | None = None
    last_count_date: str | None = None
    sap_update_date: str | None = None


class BulkInventoryRequest(BaseModel):
    items: list[BulkInventoryItem]


@app.post("/v1/inventory/bulk")
def bulk_upsert_inventory(
    req: BulkInventoryRequest,
    request: Request,
    db: Session = Depends(get_session),
    markStale: bool = True,
):
    """Bulk upsert de estoque vindo do SAP.

    Cada registro tocado recebe `last_synced_at = sync_ts` e `is_stale = False`.
    Quando `markStale` é True, registros que não vieram neste snapshot (last_synced_at
    anterior a sync_ts) são marcados como `is_stale = True` — soft-flag em vez de delete.
    """
    correlation_id = request.state.correlation_id
    created = 0
    updated = 0
    sync_ts = now_utc()

    for item in req.items:
        existing = db.execute(
            select(DbInventoryStock).where(
                DbInventoryStock.sku == item.sku,
                DbInventoryStock.warehouse_code == item.warehouse_code,
            )
        ).scalar_one_or_none()

        computed_available = item.available if item.available else max(item.on_hand - item.committed, 0)
        now = sync_ts
        if existing:
            existing.item_name = item.item_name
            existing.on_hand = item.on_hand
            existing.committed = item.committed
            existing.ordered = item.ordered
            existing.available = computed_available
            existing.min_stock = item.min_stock
            existing.max_stock = item.max_stock
            existing.uom = item.uom
            existing.avg_price = item.avg_price
            existing.last_purchase_price = item.last_purchase_price
            existing.last_purchase_date = item.last_purchase_date
            existing.last_sale_date = item.last_sale_date
            existing.gross_weight = item.gross_weight
            existing.lead_time = item.lead_time
            existing.item_group_code = item.item_group_code
            existing.item_group_name = item.item_group_name
            existing.last_count_date = item.last_count_date
            existing.sap_update_date = item.sap_update_date
            existing.last_synced_at = sync_ts
            existing.is_stale = False
            existing.updated_at = now
            updated += 1
        else:
            db.add(DbInventoryStock(
                sku=item.sku,
                warehouse_code=item.warehouse_code,
                item_name=item.item_name,
                on_hand=item.on_hand,
                committed=item.committed,
                ordered=item.ordered,
                available=computed_available,
                min_stock=item.min_stock,
                max_stock=item.max_stock,
                uom=item.uom,
                avg_price=item.avg_price,
                last_purchase_price=item.last_purchase_price,
                last_purchase_date=item.last_purchase_date,
                last_sale_date=item.last_sale_date,
                gross_weight=item.gross_weight,
                lead_time=item.lead_time,
                item_group_code=item.item_group_code,
                item_group_name=item.item_group_name,
                last_count_date=item.last_count_date,
                sap_update_date=item.sap_update_date,
                last_synced_at=sync_ts,
                is_stale=False,
                created_at=now,
                updated_at=now,
            ))
            created += 1

    db.commit()

    marked_stale = 0
    # Só marca obsoletos quando o payload tem itens (evita zerar tudo num snapshot vazio).
    if markStale and req.items:
        result = db.execute(
            DbInventoryStock.__table__.update()
            .where(
                (DbInventoryStock.last_synced_at.is_(None))
                | (DbInventoryStock.last_synced_at < sync_ts)
            )
            .where(DbInventoryStock.is_stale.is_(False))
            .values(is_stale=True)
        )
        marked_stale = result.rowcount or 0
        db.commit()

    log.info(
        "Bulk inventory sync.",
        extra={"correlationId": correlation_id, "items_created": created, "items_updated": updated, "marked_stale": marked_stale},
    )
    return {"upserted": created + updated, "created": created, "updated": updated, "marked_stale": marked_stale}


class BulkCustomerItem(BaseModel):
    card_code: str
    card_name: str = ""
    card_type: str = "C"
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    is_active: bool = True
    sap_update_date: str | None = None


class BulkCustomersRequest(BaseModel):
    items: list[BulkCustomerItem]


@app.post("/v1/customers/bulk")
def bulk_upsert_customers(
    req: BulkCustomersRequest,
    request: Request,
    db: Session = Depends(get_session),
):
    """Bulk upsert de clientes vindos do SAP."""
    correlation_id = request.state.correlation_id
    created = 0
    updated = 0

    for item in req.items:
        existing = db.execute(
            select(DbCustomer).where(DbCustomer.card_code == item.card_code)
        ).scalar_one_or_none()

        now = now_utc()
        if existing:
            existing.card_name = item.card_name
            existing.card_type = item.card_type
            existing.phone = item.phone
            existing.email = item.email
            existing.address = item.address
            existing.city = item.city
            existing.state = item.state
            existing.is_active = item.is_active
            existing.sap_update_date = item.sap_update_date
            existing.updated_at = now
            updated += 1
        else:
            db.add(DbCustomer(
                card_code=item.card_code,
                card_name=item.card_name,
                card_type=item.card_type,
                phone=item.phone,
                email=item.email,
                address=item.address,
                city=item.city,
                state=item.state,
                is_active=item.is_active,
                sap_update_date=item.sap_update_date,
                created_at=now,
                updated_at=now,
            ))
            created += 1

    db.commit()
    log.info("Bulk customers sync.", extra={"correlationId": correlation_id, "items_created": created, "items_updated": updated})
    return {"upserted": created + updated, "created": created, "updated": updated}


@app.get("/v1/orders")
def list_orders_v1(
    request: Request,
    db: Session = Depends(get_session),
    status: str | None = None,
    externalOrderId: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    Endpoint v1 para listagem de pedidos (compatível com a interface).
    Redireciona para o endpoint /orders existente.
    """
    q = select(DbOrder).options(selectinload(DbOrder.items)).order_by(DbOrder.updated_at.desc())
    if status:
        q = q.where(DbOrder.status == status)
    if externalOrderId:
        q = q.where(DbOrder.external_order_id.ilike(f"%{externalOrderId}%"))
    
    # Aplicar offset e limit
    q = q.offset(offset).limit(min(max(limit, 1), 200))

    rows = db.execute(q).scalars().all()
    total = db.execute(select(DbOrder)).scalars().all()
    
    return {
        "items": [db_order_to_schema(o) for o in rows],
        "total": len(total),
        "limit": limit,
        "offset": offset,
        "nextCursor": None
    }


def db_order_to_schema(o: DbOrder) -> Order:
    return Order(
        orderId=o.order_id,
        externalOrderId=o.external_order_id,
        customerId=o.customer_id,
        status=o.status,  # type: ignore[arg-type]
        items=[{"sku": it.sku, "quantity": float(it.quantity)} for it in o.items],
        createdAt=o.created_at,
        updatedAt=o.updated_at,
    )


def db_event_to_schema(e: DbOrderEvent) -> OrderEvent:
    return OrderEvent(
        eventId=e.event_id,
        type=e.type,  # type: ignore[arg-type]
        **{"from": e.from_status},  # alias
        to=e.to_status,  # type: ignore[arg-type]
        occurredAt=e.occurred_at,
        actor={"kind": e.actor_kind, "id": e.actor_id},
        idempotencyKey=e.idempotency_key,
    )


@app.post("/orders", status_code=201, response_model=Order)
def create_order(
    req: CreateOrderRequest,
    request: Request,
    db: Session = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    correlation_id = request.state.correlation_id

    # Idempotência por header
    if idempotency_key:
        scope = "ORDER_CREATE"
        request_hash = sha256(stable_json(req.model_dump()))
        existing = db.execute(
            select(IdempotencyKey).where(IdempotencyKey.scope == scope, IdempotencyKey.key == idempotency_key)
        ).scalar_one_or_none()
        if existing:
            if existing.request_hash != request_hash:
                exc = HTTPException(status_code=409, detail="Idempotency-Key já usada com payload diferente.")
                setattr(exc, "error_code", "WMS-IDEM-001")
                raise exc
            payload = json.loads(existing.response_json)
            return payload

    # Se já existir por externalOrderId, devolve (best-effort para sync SAP)
    if req.externalOrderId:
        existing_order = db.execute(
            select(DbOrder)
            .options(selectinload(DbOrder.items))
            .where(DbOrder.external_order_id == req.externalOrderId)
        ).scalar_one_or_none()
        if existing_order:
            return db_order_to_schema(existing_order)

    oid = str(uuid.uuid4())
    now = now_utc()
    order = DbOrder(
        order_id=oid,
        external_order_id=req.externalOrderId,
        customer_id=req.customerId,
        status=order_sm.initial_state,
        created_at=now,
        updated_at=now,
        version=0,
    )
    for it in req.items:
        order.items.append(DbOrderItem(order_id=oid, sku=it.sku, quantity=it.quantity))

    db.add(order)
    db.commit()
    db.refresh(order)

    out = db_order_to_schema(order)

    if idempotency_key:
        idem = IdempotencyKey(
            scope="ORDER_CREATE",
            key=idempotency_key,
            request_hash=sha256(stable_json(req.model_dump())),
            response_json=stable_json(out.model_dump(mode="json")),
            created_at=now,
        )
        db.add(idem)
        db.commit()

    log.info("Pedido criado.", extra={"correlationId": correlation_id, "orderId": oid})
    return out


@app.get("/orders")
def list_orders(
    request: Request,
    db: Session = Depends(get_session),
    status: str | None = None,
    externalOrderId: str | None = None,
    limit: int = 50,
):
    q = select(DbOrder).options(selectinload(DbOrder.items)).order_by(DbOrder.updated_at.desc())
    if status:
        q = q.where(DbOrder.status == status)
    if externalOrderId:
        # “search” do painel costuma passar DocNum parcial; usamos match parcial.
        q = q.where(DbOrder.external_order_id.ilike(f"%{externalOrderId}%"))
    q = q.limit(min(max(limit, 1), 200))

    rows = db.execute(q).scalars().all()
    return {"items": [db_order_to_schema(o) for o in rows], "nextCursor": None}


@app.get("/orders/{order_id}", response_model=Order)
def get_order(order_id: str, db: Session = Depends(get_session)):
    order = db.execute(select(DbOrder).options(selectinload(DbOrder.items)).where(DbOrder.order_id == order_id)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    return db_order_to_schema(order)


@app.get("/orders/{order_id}/history", response_model=OrderHistoryResponse)
def get_history(order_id: str, db: Session = Depends(get_session)):
    order = db.execute(select(DbOrder).where(DbOrder.order_id == order_id)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    events = db.execute(select(DbOrderEvent).where(DbOrderEvent.order_id == order_id).order_by(DbOrderEvent.occurred_at.asc())).scalars().all()
    return OrderHistoryResponse(orderId=order_id, events=[db_event_to_schema(e) for e in events])


@app.post("/orders/{order_id}/events", response_model=OrderEventResult)
def post_event(
    order_id: str,
    req: OrderEventRequest,
    request: Request,
    db: Session = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    correlation_id = request.state.correlation_id
    order = db.execute(select(DbOrder).options(selectinload(DbOrder.items)).where(DbOrder.order_id == order_id)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")

    if order_sm.is_final(order.status):
        exc = HTTPException(status_code=409, detail="Pedido em estado final.")
        setattr(exc, "error_code", "WMS-SM-003")
        raise exc

    # idempotência simples por (orderId, type, idemKey)
    if idempotency_key:
        existing = db.execute(
            select(DbOrderEvent).where(
                DbOrderEvent.order_id == order_id,
                DbOrderEvent.type == req.type,
                DbOrderEvent.idempotency_key == idempotency_key,
            )
        ).scalar_one_or_none()
        if existing:
            event_schema = db_event_to_schema(existing)
            return OrderEventResult(
                orderId=order_id,
                previousStatus=existing.from_status,  # type: ignore[arg-type]
                currentStatus=existing.to_status,  # type: ignore[arg-type]
                applied=True,
                event=event_schema,
            )

    next_state = order_sm.next_state(order.status, req.type)
    if not next_state:
        exc = HTTPException(status_code=409, detail="Transição inválida para o status atual.")
        setattr(exc, "error_code", "WMS-SM-001")
        setattr(exc, "details", {"from": order.status, "eventType": req.type})
        raise exc

    prev = order.status
    occurred_at = req.occurredAt or now_utc()

    # itens imutáveis após iniciar separação (MVP)
    # (este endpoint não altera itens; a guarda aqui é apenas conceitual)

    order.status = next_state
    order.updated_at = occurred_at
    order.version += 1

    ev = DbOrderEvent(
        order_id=order_id,
        type=req.type,
        from_status=prev,
        to_status=next_state,
        occurred_at=occurred_at,
        actor_kind=req.actor.kind,
        actor_id=req.actor.id,
        idempotency_key=idempotency_key,
        correlation_id=correlation_id,
        request_id=request.state.request_id,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    result = OrderEventResult(
        orderId=order_id,
        previousStatus=prev,  # type: ignore[arg-type]
        currentStatus=next_state,  # type: ignore[arg-type]
        applied=True,
        event=db_event_to_schema(ev),
    )
    log.info("Evento aplicado.", extra={"correlationId": correlation_id, "orderId": order_id, "eventType": req.type})
    return result


@app.post("/internal/sap/orders", response_model=SapOrdersSyncResponse)
def sync_sap_orders(
    req: SapOrdersSyncRequest,
    request: Request,
    db: Session = Depends(get_session),
    internal_secret: str | None = Header(default=None, alias="X-Internal-Secret"),
):
    if internal_secret != INTERNAL_SHARED_SECRET:
        raise HTTPException(status_code=403, detail="forbidden")

    correlation_id = request.state.correlation_id
    created = 0
    updated = 0

    for o in req.orders:
        external_id = str(o.DocNum)
        existing = None
        if o.DocEntry is not None:
            existing = db.execute(
                select(DbOrder).options(selectinload(DbOrder.items)).where(DbOrder.sap_doc_entry == o.DocEntry)
            ).scalar_one_or_none()
        if not existing:
            existing = db.execute(
                select(DbOrder).options(selectinload(DbOrder.items)).where(DbOrder.external_order_id == external_id)
            ).scalar_one_or_none()

        if not existing:
            oid = str(uuid.uuid4())
            now = now_utc()
            order = DbOrder(
                order_id=oid,
                external_order_id=external_id,
                customer_id=o.CardCode,
                status=order_sm.initial_state,
                created_at=now,
                updated_at=now,
                version=0,
                sap_doc_entry=o.DocEntry,
                sap_doc_num=o.DocNum,
                sap_doc_status=o.DocStatus,
                sap_update_date=o.UpdateDate,
                sap_update_time=o.UpdateTime,
            )
            for line in o.DocumentLines or []:
                order.items.append(DbOrderItem(order_id=oid, sku=line.ItemCode, quantity=line.Quantity))
            db.add(order)
            created += 1
            continue

        # Atualiza snapshot SAP
        existing.sap_doc_entry = o.DocEntry
        existing.sap_doc_num = o.DocNum
        existing.sap_doc_status = o.DocStatus
        existing.sap_update_date = o.UpdateDate
        existing.sap_update_time = o.UpdateTime
        if not existing.external_order_id:
            existing.external_order_id = external_id

        # Atualiza itens apenas antes de iniciar separação
        if existing.status == "A_SEPARAR":
            existing.customer_id = o.CardCode
            existing.items.clear()
            for line in o.DocumentLines or []:
                existing.items.append(DbOrderItem(order_id=existing.order_id, sku=line.ItemCode, quantity=line.Quantity))
            updated += 1

    db.commit()

    log.info(
        "Sync SAP concluído.",
        extra={"correlationId": correlation_id, "sapDocEntry": None},
    )
    return SapOrdersSyncResponse(upserted=created + updated, created=created, updated=updated)

