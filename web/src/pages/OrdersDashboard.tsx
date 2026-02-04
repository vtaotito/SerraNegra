import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { OrderStatus, Priority } from "../api/types";
import { isUsingMock, listCarriers, listOrders, postOrderEvent } from "../api/orders";
import { syncSapOrders, isSapApiConfigured } from "../api/sap";
import { FiltersBar, type OrdersUiFilters } from "../ui/FiltersBar";
import { KanbanBoard } from "../ui/KanbanBoard";
import { OrderDrawer } from "../ui/OrderDrawer";
import { SkeletonKanban } from "../ui/SkeletonKanban";

const STATUSES: OrderStatus[] = [
  "A_SEPARAR",
  "EM_SEPARACAO",
  "CONFERIDO",
  "AGUARDANDO_COTACAO",
  "AGUARDANDO_COLETA",
  "DESPACHADO"
];

const STATUS_EVENT_MAP: Record<OrderStatus, Partial<Record<OrderStatus, string>>> = {
  A_SEPARAR: { EM_SEPARACAO: "INICIAR_SEPARACAO" },
  EM_SEPARACAO: { CONFERIDO: "FINALIZAR_SEPARACAO" },
  CONFERIDO: { AGUARDANDO_COTACAO: "SOLICITAR_COTACAO" },
  AGUARDANDO_COTACAO: { AGUARDANDO_COLETA: "CONFIRMAR_COTACAO" },
  AGUARDANDO_COLETA: { DESPACHADO: "DESPACHAR" },
  DESPACHADO: {}
};

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

  const moveOrderMutation = useMutation({
    mutationFn: async ({
      orderId,
      currentStatus,
      newStatus
    }: {
      orderId: string;
      currentStatus: OrderStatus;
      newStatus: OrderStatus;
    }) => {
      const eventType = STATUS_EVENT_MAP[currentStatus]?.[newStatus];
      if (!eventType) {
        throw new Error("Transição não permitida pela state machine");
      }

      return postOrderEvent(orderId, {
        type: eventType as any,
        actor: { kind: "USER", id: "user-demo" }
      });
    },
    onSuccess: (data) => {
      if (data.applied) {
        toast.success(`Pedido movido para "${data.currentStatus}"`);
      } else {
        toast.error("Transição rejeitada pela state machine");
      }
      ordersQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao mover pedido");
    }
  });

  const handleMoveOrder = (orderId: string, newStatus: OrderStatus) => {
    const order = ordersQuery.data?.items.find((o) => o.orderId === orderId);
    if (!order) return;

    const currentStatus = order.status;
    if (currentStatus === newStatus) return;

    moveOrderMutation.mutate({ orderId, currentStatus, newStatus });
  };

  const syncSapMutation = useMutation({
    mutationFn: () => syncSapOrders(),
    onSuccess: async (data) => {
      toast.success(`${data.imported} pedidos importados do SAP`);
      await ordersQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao importar pedidos do SAP");
    }
  });

  const grouped = useMemo(() => {
    const items = ordersQuery.data?.items ?? [];
    const by: Record<OrderStatus, any[]> = Object.fromEntries(
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

  const totalOrders = ordersQuery.data?.items.length ?? 0;

  return (
    <div>
      <div className="container" style={{ paddingTop: 16, paddingBottom: 12 }}>
        <div className="panel">
          <FiltersBar
            value={filters}
            carriers={carriersQuery.data ?? []}
            loadingCarriers={carriersQuery.isFetching}
            onChange={setFilters}
            onImportFromSap={
              isSapApiConfigured() ? () => syncSapMutation.mutate() : undefined
            }
            importingSap={syncSapMutation.isPending}
          />
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13
          }}
        >
          <span className="text-secondary fw-semibold">
            {ordersQuery.isFetching && !ordersQuery.data
              ? "Carregando pedidos…"
              : `${totalOrders} ${totalOrders === 1 ? "pedido" : "pedidos"}`}
          </span>
          <span className="text-muted text-xs">
            Fonte: <b>{isUsingMock() ? "Mock local" : "WMS Core API"}</b>
          </span>
        </div>
      </div>

      {ordersQuery.isLoading ? (
        <SkeletonKanban />
      ) : ordersQuery.isError ? (
        <div className="container">
          <div className="panel" style={{ padding: 24, textAlign: "center" }}>
            <p className="text-secondary">Erro ao carregar pedidos.</p>
          </div>
        </div>
      ) : (
        <KanbanBoard
          statuses={STATUSES}
          groupedOrders={grouped}
          onSelectOrder={(id) => setSelectedOrderId(id)}
          onMoveOrder={handleMoveOrder}
          isMoving={moveOrderMutation.isPending}
        />
      )}

      <OrderDrawer
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onAfterAction={() => ordersQuery.refetch()}
      />
    </div>
  );
}
