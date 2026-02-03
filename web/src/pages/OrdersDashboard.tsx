import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrderStatus, Priority, UiOrder } from "../api/types";
import { isUsingMock, listCarriers, listOrders } from "../api/orders";
import { FiltersBar, type OrdersUiFilters } from "../ui/FiltersBar";
import { KanbanBoard } from "../ui/KanbanBoard";

const STATUSES: OrderStatus[] = [
  "A_SEPARAR",
  "EM_SEPARACAO",
  "CONFERIDO",
  "AGUARDANDO_COTACAO",
  "AGUARDANDO_COLETA",
  "DESPACHADO"
];

export function OrdersDashboard() {
  const [filters, setFilters] = useState<OrdersUiFilters>({
    search: "",
    carrier: "",
    priority: "",
    sla: "ALL"
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const carriersQuery = useQuery({
    queryKey: ["carriers", isUsingMock()],
    queryFn: () => listCarriers(),
    staleTime: 60_000
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", filters, isUsingMock()],
    queryFn: () =>
      listOrders({
        search: filters.search?.trim() || undefined,
        carrier: filters.carrier || undefined,
        priority: (filters.priority || undefined) as Priority | undefined,
        sla: filters.sla
      }),
    refetchInterval: 15_000
  });

  const grouped = useMemo(() => {
    const items = ordersQuery.data?.items ?? [];
    const by: Record<OrderStatus, UiOrder[]> = Object.fromEntries(
      STATUSES.map((s) => [s, []])
    ) as any;
    for (const o of items) by[o.status].push(o);
    for (const s of STATUSES) {
      by[s].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return by;
  }, [ordersQuery.data]);

  const statusLine = ordersQuery.isFetching
    ? "Atualizando…"
    : ordersQuery.isError
      ? "Erro ao carregar pedidos"
      : `${ordersQuery.data?.items.length ?? 0} pedidos`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel" style={{ padding: 12 }}>
        <FiltersBar
          value={filters}
          carriers={carriersQuery.data ?? []}
          loadingCarriers={carriersQuery.isFetching}
          onChange={setFilters}
        />
      </div>

      <div className="muted" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{statusLine}</span>
        <span>
          Fonte: <b>{isUsingMock() ? "mock local" : "API"}</b>
        </span>
      </div>

      <KanbanBoard
        statuses={STATUSES}
        groupedOrders={grouped}
        onSelectOrder={(id) => setSelectedOrderId(id)}
      />

      {selectedOrderId ? (
        <div className="card">
          <h3>Pedido selecionado</h3>
          <p className="muted">ID: {selectedOrderId}</p>
          <button
            className="control"
            type="button"
            onClick={() => setSelectedOrderId(null)}
          >
            Fechar
          </button>
        </div>
      ) : null}
    </div>
  );
}

