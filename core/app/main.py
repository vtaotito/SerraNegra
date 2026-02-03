from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .db import Base, engine, get_session
from .logging_json import configure_logging
from .models import IdempotencyKey, Order as DbOrder, OrderEvent as DbOrderEvent, OrderItem as DbOrderItem
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
            message="Erro interno.",
            correlationId=correlation_id,
        )
        return JSONResponse(status_code=500, content=payload.model_dump(by_alias=True))

    response.headers["X-Correlation-Id"] = correlation_id
    return response


@app.get("/health")
def health():
    return {"ok": True, "service": SERVICE_NAME}


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

