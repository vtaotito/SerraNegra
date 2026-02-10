from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


OrderStatus = Literal[
    "A_SEPARAR",
    "EM_SEPARACAO",
    "CONFERIDO",
    "AGUARDANDO_COTACAO",
    "AGUARDANDO_COLETA",
    "DESPACHADO",
]

OrderEventType = Literal[
    "INICIAR_SEPARACAO",
    "FINALIZAR_SEPARACAO",
    "CONFERIR",
    "SOLICITAR_COTACAO",
    "CONFIRMAR_COTACAO",
    "AGUARDAR_COLETA",
    "DESPACHAR",
]


class OrderItem(BaseModel):
    sku: str
    quantity: float = Field(gt=0)


class CreateOrderRequest(BaseModel):
    externalOrderId: str | None = None
    customerId: str = "SEM_CLIENTE"
    items: list[OrderItem] = []
    metadata: dict | None = None


class Order(BaseModel):
    orderId: str
    externalOrderId: str | None
    customerId: str
    status: OrderStatus
    items: list[OrderItem]
    createdAt: datetime
    updatedAt: datetime


class OrderEventActor(BaseModel):
    kind: Literal["USER", "SYSTEM", "INTEGRATION"]
    id: str


class OrderEventRequest(BaseModel):
    type: OrderEventType
    occurredAt: datetime | None = None
    actor: OrderEventActor
    reason: str | None = None


class OrderEvent(BaseModel):
    eventId: str
    type: OrderEventType
    from_: OrderStatus = Field(alias="from")
    to: OrderStatus
    occurredAt: datetime
    actor: OrderEventActor
    idempotencyKey: str | None = None


class OrderEventResult(BaseModel):
    orderId: str
    previousStatus: OrderStatus
    currentStatus: OrderStatus
    applied: bool
    event: OrderEvent


class OrderHistoryResponse(BaseModel):
    orderId: str
    events: list[OrderEvent]


class ErrorResponse(BaseModel):
    errorCode: str
    message: str
    details: dict | None = None
    correlationId: str | None = None


# ---- Sync SAP ----
class SapOrderLine(BaseModel):
    LineNum: int
    ItemCode: str
    Quantity: float
    WarehouseCode: str | None = None


class SapOrder(BaseModel):
    DocEntry: int
    DocNum: int
    CardCode: str
    DocStatus: str | None = None
    UpdateDate: str | None = None
    UpdateTime: str | None = None
    DocumentLines: list[SapOrderLine] | None = None


class SapOrdersSyncRequest(BaseModel):
    orders: list[SapOrder]


class SapOrdersSyncResponse(BaseModel):
    upserted: int
    created: int
    updated: int

