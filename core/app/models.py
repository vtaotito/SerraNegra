from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, DateTime, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


# ========================================
# Pedidos
# ========================================

class Order(Base):
    __tablename__ = "orders"

    order_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    external_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    customer_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # campos SAP (snapshot leve)
    sap_doc_entry: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True, index=True)
    sap_doc_num: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    sap_doc_status: Mapped[str | None] = mapped_column(String(4), nullable=True)
    sap_update_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sap_update_time: Mapped[str | None] = mapped_column(String(16), nullable=True)

    items: Mapped[list[OrderItem]] = relationship(back_populates="order", cascade="all, delete-orphan")
    events: Mapped[list[OrderEvent]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(40), ForeignKey("orders.order_id", ondelete="CASCADE"), index=True)
    sku: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)

    order: Mapped[Order] = relationship(back_populates="items")


class OrderEvent(Base):
    __tablename__ = "order_events"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(String(40), ForeignKey("orders.order_id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    from_status: Mapped[str] = mapped_column(String(32), nullable=False)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    actor_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    order: Mapped[Order] = relationship(back_populates="events")


# ========================================
# Produtos (catálogo)
# ========================================

class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    ean: Mapped[str | None] = mapped_column(String(128), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unit_of_measure: Mapped[str] = mapped_column(String(64), nullable=False, default="UN")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_inventory_item: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_sales_item: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sap_item_code: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    sap_update_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# ========================================
# Estoque
# ========================================

class InventoryStock(Base):
    __tablename__ = "inventory_stock"
    __table_args__ = (UniqueConstraint("sku", "warehouse_code", name="uq_stock_sku_wh"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    warehouse_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    on_hand: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    committed: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    ordered: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    sap_update_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# ========================================
# Clientes (Business Partners)
# ========================================

class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_code: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    card_name: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    card_type: Mapped[str] = mapped_column(String(32), nullable=False, default="C")  # C=Customer, S=Supplier
    phone: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sap_update_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# ========================================
# Precificação por Cliente (B2B)
# ========================================

class CustomerProductPrice(Base):
    """
    Preço específico de um produto (SKU) para um cliente (CardCode).

    Regra do MVP:
    - Um preço ativo por (customer_card_code, product_sku).
    - O catálogo do cliente pode ser derivado dessa tabela (somente SKUs com preço ativo).
    """

    __tablename__ = "customer_product_prices"
    __table_args__ = (
        UniqueConstraint("customer_card_code", "product_sku", name="uq_customer_product_price"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Vincula por CardCode/SKU (campos únicos nas tabelas origem)
    customer_card_code: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("customers.card_code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_sku: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("products.sku", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="BRL")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    customer: Mapped[Customer] = relationship()
    product: Mapped[Product] = relationship()


# ========================================
# Idempotência
# ========================================

class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("scope", "key", name="uq_idem_scope_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    response_json: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

