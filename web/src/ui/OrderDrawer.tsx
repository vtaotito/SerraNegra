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
import { formatCurrency, formatDateTime, formatStatusLabel } from "./format";

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
                <div className="section-title">Dados do Pedido (SAP B1)</div>
                <div className="grid-2">
                  <div className="kv">
                    <div className="k">DocNum</div>
                    <div className="v">{order.sapDocNum ?? order.externalOrderId ?? "—"}</div>
                  </div>
                  <div className="kv">
                    <div className="k">DocEntry</div>
                    <div className="v">{order.sapDocEntry ?? "—"}</div>
                  </div>
                  <div className="kv">
                    <div className="k">DocDate</div>
                    <div className="v">
                      {order.docDate ? formatDateTime(order.docDate) : "—"}
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">DocDueDate</div>
                    <div className="v">
                      {order.docDueDate ? formatDateTime(order.docDueDate) : "—"}
                    </div>
                  </div>
                  {order.sapStatus && (
                    <div className="kv">
                      <div className="k">DocumentStatus (SAP)</div>
                      <div className="v">
                        <span className={`badge ${order.sapStatus === "bost_Close" ? "badge-sla-ok" : "badge-sla-soon"}`}>
                          {order.sapStatus === "bost_Open" ? "Aberto" : "Fechado"}
                        </span>
                      </div>
                    </div>
                  )}
                  {order.cancelled !== null && order.cancelled !== undefined && (
                    <div className="kv">
                      <div className="k">Cancelado</div>
                      <div className="v">
                        <span className={`badge ${order.cancelled ? "badge-sla-late" : "badge-sla-ok"}`}>
                          {order.cancelled ? "Sim" : "Não"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {order.docTotal && order.docTotal > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: "rgba(0, 121, 191, 0.08)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div className="k" style={{ marginBottom: 4 }}>DocTotal</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>
                          {formatCurrency(order.docTotal, order.currency)}
                        </div>
                      </div>
                      {order.discountPercent && order.discountPercent > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <div className="k" style={{ marginBottom: 4 }}>Desconto</div>
                          <div className="text-secondary fw-bold">{order.discountPercent}%</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Cliente (CardCode/CardName)</div>
                <div className="grid-2">
                  <div className="kv">
                    <div className="k">CardCode</div>
                    <div className="v">{order.customerId}</div>
                  </div>
                  <div className="kv">
                    <div className="k">CardName</div>
                    <div className="v">{order.customerName ?? "—"}</div>
                  </div>
                </div>

                {(order.shipToAddress || order.shipToCode) && (
                  <div style={{ marginTop: 12 }}>
                    <div className="k" style={{ marginBottom: 6 }}>
                      Endereço de Entrega {order.shipToCode && `(${order.shipToCode})`}
                    </div>
                    <div style={{ padding: 10, background: "var(--bg-hover)", borderRadius: "6px", fontSize: 13 }}>
                      {order.shipToAddress && <div>{order.shipToAddress}</div>}
                      {order.shipToCity && order.shipToState && (
                        <div style={{ marginTop: 4 }}>
                          {order.shipToCity}/{order.shipToState} 
                          {order.shipToZipCode && ` - CEP: ${order.shipToZipCode}`}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {order.comments && (
                  <div style={{ marginTop: 12 }}>
                    <div className="k" style={{ marginBottom: 6 }}>Comments (SAP)</div>
                    <div style={{ padding: 10, background: "var(--warn-light)", border: "1px solid rgba(242, 214, 0, 0.3)", borderRadius: "6px", fontSize: 13, color: "var(--text-primary)" }}>
                      {order.comments}
                    </div>
                  </div>
                )}
              </div>

              <div className="panel" style={{ padding: 16 }}>
                <div className="section-title">Logística</div>
                <div className="grid-2">
                  <div className="kv">
                    <div className="k">Status WMS</div>
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
                    <div className="k">Criado em</div>
                    <div className="v">{formatDateTime(order.createdAt)}</div>
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
                <div className="section-title">Itens (DocumentLines)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid var(--border-light)" }}>ItemCode</th>
                        <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid var(--border-light)" }}>Description</th>
                        <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border-light)" }}>Qtd</th>
                        <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border-light)" }}>UM</th>
                        <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border-light)" }}>Armazém</th>
                        {order.items.some(it => it.price) && (
                          <>
                            <th style={{ padding: "10px", textAlign: "right", borderBottom: "1px solid var(--border-light)" }}>Preço</th>
                            <th style={{ padding: "10px", textAlign: "right", borderBottom: "1px solid var(--border-light)" }}>Total Linha</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((it, idx) => (
                        <tr key={`${it.sku}-${idx}`} style={{ borderBottom: idx < order.items.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                          <td style={{ padding: "10px" }} className="fw-semibold">{it.sku}</td>
                          <td style={{ padding: "10px" }} className="text-secondary">{it.itemDescription ?? "—"}</td>
                          <td style={{ padding: "10px", textAlign: "center" }} className="fw-semibold">{it.quantity}</td>
                          <td style={{ padding: "10px", textAlign: "center" }} className="text-muted text-xs">{it.measureUnit ?? "—"}</td>
                          <td style={{ padding: "10px", textAlign: "center" }} className="text-muted text-xs">{it.warehouseCode ?? "—"}</td>
                          {it.price && (
                            <>
                              <td style={{ padding: "10px", textAlign: "right" }} className="text-muted">
                                {formatCurrency(it.price, order.currency)}
                              </td>
                              <td style={{ padding: "10px", textAlign: "right" }} className="fw-bold">
                                {formatCurrency(it.lineTotal || (it.price * it.quantity), order.currency)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {order.docTotal && order.docTotal > 0 && (
                  <div style={{ marginTop: 12, padding: 10, background: "var(--bg-active)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="fw-bold">DocTotal (SAP):</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>
                      {formatCurrency(order.docTotal, order.currency)}
                    </span>
                  </div>
                )}
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
