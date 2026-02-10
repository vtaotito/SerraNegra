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
from sqlalchemy import select
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


@app.on_event("startup")
def on_startup() -> None:
    configure_logging()
    Base.metadata.create_all(bind=engine)
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
            message=f"Erro interno: {type(exc).__name__}: {exc}",
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
    limit: int = 50,
    offset: int = 0,
):
    """Listagem de estoque por depósito."""
    q = select(DbInventoryStock).order_by(DbInventoryStock.sku.asc())
    if sku:
        q = q.where(DbInventoryStock.sku.ilike(f"%{sku}%"))
    if warehouseCode:
        q = q.where(DbInventoryStock.warehouse_code == warehouseCode)

    total = len(db.execute(select(DbInventoryStock)).scalars().all())
    rows = db.execute(q.offset(offset).limit(min(max(limit, 1), 200))).scalars().all()

    return {
        "data": [
            {
                "id": s.id,
                "product_id": s.sku,
                "warehouse_id": s.warehouse_code,
                "quantity_available": float(s.on_hand),
                "quantity_reserved": float(s.committed),
                "quantity_free": max(float(s.on_hand) - float(s.committed), 0),
                "quantity_on_order": float(s.ordered),
                "sap_update_date": s.sap_update_date,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in rows
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
    q = select(DbCustomer).order_by(DbCustomer.card_name.asc())
    if search:
        q = q.where(
            DbCustomer.card_code.ilike(f"%{search}%")
            | DbCustomer.card_name.ilike(f"%{search}%")
        )
    if active is not None:
        q = q.where(DbCustomer.is_active == active)

    total = len(db.execute(select(DbCustomer)).scalars().all())
    rows = db.execute(q.offset(offset).limit(min(max(limit, 1), 200))).scalars().all()

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
        "total": total,
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
    log.info("Bulk products sync.", extra={"correlationId": correlation_id, "created": created, "updated": updated})
    return {"upserted": created + updated, "created": created, "updated": updated}


class BulkInventoryItem(BaseModel):
    sku: str
    warehouse_code: str
    on_hand: float = 0
    committed: float = 0
    ordered: float = 0
    sap_update_date: str | None = None


class BulkInventoryRequest(BaseModel):
    items: list[BulkInventoryItem]


@app.post("/v1/inventory/bulk")
def bulk_upsert_inventory(
    req: BulkInventoryRequest,
    request: Request,
    db: Session = Depends(get_session),
):
    """Bulk upsert de estoque vindo do SAP."""
    correlation_id = request.state.correlation_id
    created = 0
    updated = 0

    for item in req.items:
        existing = db.execute(
            select(DbInventoryStock).where(
                DbInventoryStock.sku == item.sku,
                DbInventoryStock.warehouse_code == item.warehouse_code,
            )
        ).scalar_one_or_none()

        now = now_utc()
        if existing:
            existing.on_hand = item.on_hand
            existing.committed = item.committed
            existing.ordered = item.ordered
            existing.sap_update_date = item.sap_update_date
            existing.updated_at = now
            updated += 1
        else:
            db.add(DbInventoryStock(
                sku=item.sku,
                warehouse_code=item.warehouse_code,
                on_hand=item.on_hand,
                committed=item.committed,
                ordered=item.ordered,
                sap_update_date=item.sap_update_date,
                created_at=now,
                updated_at=now,
            ))
            created += 1

    db.commit()
    log.info("Bulk inventory sync.", extra={"correlationId": correlation_id, "created": created, "updated": updated})
    return {"upserted": created + updated, "created": created, "updated": updated}


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
    log.info("Bulk customers sync.", extra={"correlationId": correlation_id, "created": created, "updated": updated})
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

