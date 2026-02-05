import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { OrderStatus, UiOrder } from "../api/types";
import { OrderCard } from "./OrderCard";
import { formatStatusLabel } from "./format";

export function KanbanBoard(props: {
  statuses: OrderStatus[];
  groupedOrders: Record<OrderStatus, UiOrder[]>;
  onSelectOrder: (orderId: string) => void;
  onMoveOrder: (orderId: string, newStatus: OrderStatus) => void;
  isMoving?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const orderId = active.id as string;
    const newStatus = over.id as OrderStatus;

    // Encontra o status atual do pedido
    let currentStatus: OrderStatus | null = null;
    for (const [status, orders] of Object.entries(props.groupedOrders)) {
      if (orders.some((o) => o.orderId === orderId)) {
        currentStatus = status as OrderStatus;
        break;
      }
    }

    if (currentStatus && currentStatus !== newStatus) {
      props.onMoveOrder(orderId, newStatus);
    }
  };

  const activeOrder = activeId
    ? Object.values(props.groupedOrders)
        .flat()
        .find((o) => o.orderId === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board-wrapper">
        <div className="kanban">
          {props.statuses.map((status) => {
            const items = props.groupedOrders[status] ?? [];
            return (
              <KanbanColumn
                key={status}
                status={status}
                items={items}
                onSelectOrder={props.onSelectOrder}
                isOver={overId === status}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeOrder ? (
          <div style={{ cursor: "grabbing", opacity: 0.95, transform: "rotate(3deg)" }}>
            <OrderCard order={activeOrder} onClick={() => {}} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function getStatusIcon(status: OrderStatus) {
  switch (status) {
    case "A_SEPARAR":
      return "📦";
    case "EM_SEPARACAO":
      return "🔄";
    case "CONFERIDO":
      return "✅";
    case "AGUARDANDO_COTACAO":
      return "💰";
    case "AGUARDANDO_COLETA":
      return "🚚";
    case "DESPACHADO":
      return "✈️";
    default:
      return "";
  }
}

function getStatusColor(status: OrderStatus) {
  switch (status) {
    case "A_SEPARAR":
      return "#8993a4"; // cinza
    case "EM_SEPARACAO":
      return "#0079bf"; // azul
    case "CONFERIDO":
      return "#61bd4f"; // verde
    case "AGUARDANDO_COTACAO":
      return "#f2d600"; // amarelo
    case "AGUARDANDO_COLETA":
      return "#ff9f1a"; // laranja
    case "DESPACHADO":
      return "#61bd4f"; // verde
    default:
      return "#8993a4";
  }
}

function KanbanColumn(props: {
  status: OrderStatus;
  items: UiOrder[];
  onSelectOrder: (orderId: string) => void;
  isOver?: boolean;
}) {
  const itemIds = props.items.map((o) => o.orderId);
  const icon = getStatusIcon(props.status);
  const color = getStatusColor(props.status);

  return (
    <SortableContext id={props.status} items={itemIds} strategy={verticalListSortingStrategy}>
      <div
        className={`kanban-col ${props.isOver ? "drag-over" : ""}`}
        data-status={props.status}
        style={{ borderTop: `3px solid ${color}` }}
      >
        <div className="kanban-col-head">
          <div className="kanban-col-title">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span>{formatStatusLabel(props.status)}</span>
            </span>
            <span className="kanban-col-count" style={{ background: color, color: "#fff" }}>
              {props.items.length}
            </span>
          </div>
        </div>
        <div className={`kanban-col-body ${props.isOver ? "drop-target" : ""}`}>
          {props.items.length === 0 ? (
            <div className="kanban-empty">
              {props.isOver ? "Solte aqui" : "Nenhum pedido"}
            </div>
          ) : (
            props.items.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                onClick={() => props.onSelectOrder(order.orderId)}
              />
            ))
          )}
        </div>
      </div>
    </SortableContext>
  );
}
