import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UiOrder } from "../api/types";
import { formatCurrency, formatSlaBadge, priorityBadgeClass } from "./format";

export function OrderCard(props: {
  order: UiOrder;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: props.order.orderId
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || props.isDragging ? 0.5 : 1
  };

  const o = props.order;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="card"
      onClick={props.onClick}
      title="Clique para abrir detalhes"
    >
      <div className="card-top">
        <div className="card-id">{o.orderId}</div>
        <div className="card-badges">
          {o.priority ? (
            <span className={`badge ${priorityBadgeClass(o.priority)}`}>
              {o.priority}
            </span>
          ) : null}
          {o.slaDueAt ? formatSlaBadge(o.slaDueAt) : null}
        </div>
      </div>

      {o.customerName && (
        <div className="card-customer">
          <div className="fw-semibold text-sm" style={{ marginBottom: 2 }}>
            {o.customerName}
          </div>
        </div>
      )}

      <div className="card-mid">
        <div className="text-secondary text-xs">
          {o.externalOrderId ?? "—"} · {o.customerId}
        </div>
        {o.shipToCity && o.shipToState && (
          <div className="text-muted text-xs" style={{ marginTop: 2 }}>
            📍 {o.shipToCity}/{o.shipToState}
          </div>
        )}
      </div>

      {o.docTotal && o.docTotal > 0 && (
        <div className="card-value">
          <span className="fw-bold">{formatCurrency(o.docTotal, o.currency)}</span>
        </div>
      )}

      <div className="card-bottom">
        <div className="text-muted text-xs">
          {o.items?.length ?? 0} {o.items?.length === 1 ? "item" : "itens"}
        </div>
        <div className="text-muted text-xs">{o.carrier ?? "Sem transportadora"}</div>
      </div>

      {o.pendingIssues && o.pendingIssues.length > 0 ? (
        <div className="card-warn">
          <span className="dot dot-warn" />
          <span>
            {o.pendingIssues.length} pendência{o.pendingIssues.length > 1 ? "s" : ""}
          </span>
        </div>
      ) : null}
    </button>
  );
}
