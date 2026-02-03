import type { OrderStatus, UiOrder } from "../api/types";
import { formatSlaBadge, formatStatusLabel, priorityColor } from "./format";

export function KanbanBoard(props: {
  statuses: OrderStatus[];
  groupedOrders: Record<OrderStatus, UiOrder[]>;
  onSelectOrder: (orderId: string) => void;
}) {
  return (
    <div className="kanban">
      {props.statuses.map((s) => {
        const items = props.groupedOrders[s] ?? [];
        return (
          <div key={s} className="kanban-col panel">
            <div className="kanban-col-head">
              <div className="kanban-col-title">
                <span>{formatStatusLabel(s)}</span>
                <span className="kanban-col-count">{items.length}</span>
              </div>
            </div>
            <div className="kanban-col-body">
              {items.length === 0 ? (
                <div className="kanban-empty muted">Sem pedidos</div>
              ) : (
                items.map((o) => (
                  <button
                    key={o.orderId}
                    className="card"
                    onClick={() => props.onSelectOrder(o.orderId)}
                    title="Abrir detalhe"
                  >
                    <div className="card-top">
                      <div className="card-id">{o.orderId}</div>
                      <div className="card-badges">
                        {o.priority ? (
                          <span
                            className="badge"
                            style={{
                              borderColor: priorityColor(o.priority).border,
                              background: priorityColor(o.priority).bg,
                              color: priorityColor(o.priority).text
                            }}
                          >
                            {o.priority}
                          </span>
                        ) : null}
                        {o.slaDueAt ? formatSlaBadge(o.slaDueAt) : null}
                      </div>
                    </div>

                    <div className="card-mid">
                      <div className="muted" style={{ fontSize: 12 }}>
                        {o.externalOrderId ?? "—"} · {o.customerId}
                      </div>
                    </div>

                    <div className="card-bottom">
                      <div className="muted" style={{ fontSize: 12 }}>
                        {o.items?.length ?? 0} itens
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {o.carrier ?? "Sem transportadora"}
                      </div>
                    </div>

                    {o.pendingIssues && o.pendingIssues.length > 0 ? (
                      <div className="card-warn">
                        <span className="dot dot-warn" />
                        <span>{o.pendingIssues.length} pendência(s)</span>
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

