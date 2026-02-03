import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getOrder,
  getOrderHistory,
  postOrderEvent,
  releaseWave,
  reprocessOrder
} from "../api/orders";
import type { OrderEventType, OrderStatus, UiOrder } from "../api/types";
import { hasPermission, useAuth } from "../auth/auth";
import { formatDateTime, formatStatusLabel } from "./format";

const NEXT_EVENT_BY_STATUS: Partial<Record<OrderStatus, OrderEventType>> = {
  A_SEPARAR: "INICIAR_SEPARACAO",
  EM_SEPARACAO: "FINALIZAR_SEPARACAO",
  CONFERIDO: "SOLICITAR_COTACAO",
  AGUARDANDO_COTACAO: "CONFIRMAR_COTACAO",
  AGUARDANDO_COLETA: "DESPACHAR"
};

function labelForEvent(t: OrderEventType) {
  switch (t) {
    case "INICIAR_SEPARACAO":
      return "Iniciar separação";
    case "FINALIZAR_SEPARACAO":
      return "Finalizar separação";
    case "CONFERIR":
      return "Conferir";
    case "SOLICITAR_COTACAO":
      return "Solicitar cotação";
    case "CONFIRMAR_COTACAO":
      return "Confirmar cotação";
    case "AGUARDAR_COLETA":
      return "Aguardar coleta";
    case "DESPACHAR":
      return "Despachar";
    default:
      return t;
  }
}

export function OrderDrawer(props: {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onAfterAction?: () => void;
}) {
  const { user } = useAuth();
  const orderId = props.orderId;

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId!),
    enabled: props.open && !!orderId
  });

  const historyQuery = useQuery({
    queryKey: ["order-history", orderId],
    queryFn: () => getOrderHistory(orderId!),
    enabled: props.open && !!orderId
  });

  const sendEventMutation = useMutation({
    mutationFn: (type: OrderEventType) =>
      postOrderEvent(orderId!, {
        type,
        actor: { kind: "USER", id: user.id }
      }),
    onSuccess: async (data) => {
      if (data.applied) {
        toast.success(`Transição aplicada: ${labelForEvent(data.event.type)}`);
      } else {
        toast.error("Transição rejeitada pela state machine");
      }
      await Promise.all([orderQuery.refetch(), historyQuery.refetch()]);
      props.onAfterAction?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao enviar evento");
    }
  });

  const reprocessMutation = useMutation({
    mutationFn: () => reprocessOrder(orderId!),
    onSuccess: async () => {
      toast.success("Pedido reprocessado com sucesso");
      await orderQuery.refetch();
      props.onAfterAction?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao reprocessar pedido");
    }
  });

  const releaseWaveMutation = useMutation({
    mutationFn: () => releaseWave(orderId!),
    onSuccess: async () => {
      toast.success("Onda liberada com sucesso");
      await orderQuery.refetch();
      props.onAfterAction?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao liberar onda");
    }
  });

  const order = orderQuery.data as UiOrder | undefined;
  const nextEvent = order ? NEXT_EVENT_BY_STATUS[order.status] : undefined;

  const canSendEvent =
    !!order && !!nextEvent && hasPermission(user.role, "order.event.send");
  const canReleaseWave =
    !!order &&
    hasPermission(user.role, "order.wave.release") &&
    (order.status === "CONFERIDO" || order.status === "AGUARDANDO_COLETA");
  const canReprocess = !!order && hasPermission(user.role, "order.reprocess");

  const topStatus = order ? formatStatusLabel(order.status) : "Pedido";

  const history = useMemo(
    () => historyQuery.data?.events ?? [],
    [historyQuery.data]
  );

  return (
    <div
      className={`drawer-overlay ${props.open ? "open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!props.open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className={`drawer ${props.open ? "open" : ""}`}>
        <div className="drawer-head">
          <div style={{ display: "grid", gap: 4 }}>
            <div className="drawer-title">{topStatus}</div>
            <div className="text-secondary text-sm">
              {order ? (
                <>
                  <b>{order.orderId}</b> · {order.externalOrderId ?? "—"} ·{" "}
                  {order.customerId}
                </>
              ) : (
                "Carregando…"
              )}
            </div>
          </div>
          <button className="btn btn-sm" onClick={props.onClose}>
            Fechar
          </button>
        </div>

        <div className="drawer-body">
          {orderQuery.isLoading ? (
            <div className="panel" style={{ padding: 16 }}>
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" />
            </div>
          ) : orderQuery.isError ? (
            <div className="panel" style={{ padding: 16 }}>
              <p className="text-secondary">Erro ao carregar pedido.</p>
            </div>
          ) : order ? (
            <>
              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Resumo</div>
                <div className="grid-2">
                  <div className="kv">
                    <div className="k">Status</div>
                    <div className="v">{formatStatusLabel(order.status)}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Transportadora</div>
                    <div className="v">{order.carrier ?? "—"}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Prioridade</div>
                    <div className="v">{order.priority ?? "—"}</div>
                  </div>
                  <div className="kv">
                    <div className="k">SLA</div>
                    <div className="v">
                      {order.slaDueAt ? formatDateTime(order.slaDueAt) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Ações</div>
                <div className="actions">
                  <button
                    className="btn btn-primary"
                    disabled={!canSendEvent || sendEventMutation.isPending}
                    onClick={() => nextEvent && sendEventMutation.mutate(nextEvent)}
                    title={
                      !hasPermission(user.role, "order.event.send")
                        ? "Sem permissão"
                        : !nextEvent
                          ? "Sem transição disponível"
                          : undefined
                    }
                  >
                    {sendEventMutation.isPending ? (
                      <>
                        <span className="spinner" />
                        Processando…
                      </>
                    ) : nextEvent ? (
                      labelForEvent(nextEvent)
                    ) : (
                      "Sem transição"
                    )}
                  </button>

                  <button
                    className="btn"
                    disabled={!canReleaseWave || releaseWaveMutation.isPending}
                    onClick={() => releaseWaveMutation.mutate()}
                    title={
                      !hasPermission(user.role, "order.wave.release")
                        ? "Sem permissão"
                        : "Disponível em status específicos"
                    }
                  >
                    {releaseWaveMutation.isPending ? (
                      <>
                        <span className="spinner spinner-primary" />
                        Liberando…
                      </>
                    ) : (
                      "Liberar onda"
                    )}
                  </button>

                  <button
                    className="btn btn-danger"
                    disabled={!canReprocess || reprocessMutation.isPending}
                    onClick={() => reprocessMutation.mutate()}
                    title={
                      !hasPermission(user.role, "order.reprocess")
                        ? "Sem permissão"
                        : undefined
                    }
                  >
                    {reprocessMutation.isPending ? (
                      <>
                        <span className="spinner" />
                        Reprocessando…
                      </>
                    ) : (
                      "Reprocessar"
                    )}
                  </button>
                </div>
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Itens</div>
                <div className="table">
                  <div className="tr th">
                    <div>SKU</div>
                    <div style={{ textAlign: "right" }}>Qtd</div>
                  </div>
                  {order.items.map((it, idx) => (
                    <div key={`${it.sku}-${idx}`} className="tr">
                      <div>{it.sku}</div>
                      <div style={{ textAlign: "right" }}>{it.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Pendências</div>
                {order.pendingIssues && order.pendingIssues.length > 0 ? (
                  <ul className="list">
                    {order.pendingIssues.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted">Sem pendências.</div>
                )}
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Histórico (audit trail)</div>
                {historyQuery.isFetching ? (
                  <div className="text-muted">Carregando histórico…</div>
                ) : history.length === 0 ? (
                  <div className="text-muted">Sem eventos ainda.</div>
                ) : (
                  <div className="table table-5">
                    <div className="tr th">
                      <div>Quando</div>
                      <div>Evento</div>
                      <div>De</div>
                      <div>Para</div>
                      <div>Ator</div>
                    </div>
                    {history
                      .slice()
                      .reverse()
                      .map((ev) => (
                        <div key={ev.eventId} className="tr">
                          <div>{formatDateTime(ev.occurredAt)}</div>
                          <div>{labelForEvent(ev.type)}</div>
                          <div>{formatStatusLabel(ev.from)}</div>
                          <div>{formatStatusLabel(ev.to)}</div>
                          <div className="text-muted text-xs">
                            {ev.actor.kind}:{ev.actor.id}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Histórico de bipagem</div>
                {order.scanHistory && order.scanHistory.length > 0 ? (
                  <div className="table table-4">
                    <div className="tr th">
                      <div>Quando</div>
                      <div>Operador</div>
                      <div>SKU</div>
                      <div style={{ textAlign: "right" }}>Qtd</div>
                    </div>
                    {order.scanHistory
                      .slice()
                      .reverse()
                      .map((s, idx) => (
                        <div key={`${s.at}-${idx}`} className="tr">
                          <div>{formatDateTime(s.at)}</div>
                          <div>{s.by}</div>
                          <div>{s.sku}</div>
                          <div style={{ textAlign: "right" }}>{s.quantity}</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-muted">Sem bipagens registradas.</div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="drawer-foot">
          <span className="text-muted">Permissões: </span>
          <b>
            {hasPermission(user.role, "order.event.send") ? "event" : "—"} ·{" "}
            {hasPermission(user.role, "order.wave.release") ? "onda" : "—"} ·{" "}
            {hasPermission(user.role, "order.reprocess") ? "reprocess" : "—"}
          </b>
        </div>
      </div>
    </div>
  );
}
