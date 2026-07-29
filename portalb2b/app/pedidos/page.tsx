"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import {
  ORDER_STATUS_FILTERS,
  getDocumentTitle,
  getOrderStatusConfig,
  isQuotationLike,
  matchesOrderFilter,
  type OrderFilterKey,
  type OrderSummary,
} from "@/lib/orders";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  ArrowRight,
  Calendar,
  Package,
  Ban,
  MessageSquare,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CancelOrderDialog } from "@/components/orders/CancelOrderDialog";
import { ClientEmptyState } from "@/components/ui/client-empty-state";
import { useInbox } from "@/lib/messages/useInbox";

interface OrdersResponse {
  items: OrderSummary[];
  total: number;
}

const JOURNEY_STEPS = [
  "Cotação",
  "Confirmado",
  "Separação",
  "Faturado",
  "Entrega",
  "Entregue",
] as const;

export default function PedidosPage() {
  const [statusFilter, setStatusFilter] = useState<OrderFilterKey>("");
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<OrderSummary | null>(null);
  const qc = useQueryClient();
  const { isUnread, summaryFor } = useInbox();

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["b2b-orders"],
    queryFn: () => get("/b2b/orders"),
  });

  const cancelPending = useMutation({
    mutationFn: (vars: { pendingId: number; reason: string }) =>
      post(`/b2b/pending-orders/${vars.pendingId}/cancel`, {
        reason: vars.reason.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Cotação cancelada.");
      setCancelTarget(null);
      qc.invalidateQueries({ queryKey: ["b2b-orders"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar"),
  });

  const allOrders = data?.items ?? [];

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { "": allOrders.length };
    for (const f of ORDER_STATUS_FILTERS) {
      if (!f.value) continue;
      counts[f.value] = allOrders.filter((o) =>
        matchesOrderFilter(o.status, f.value),
      ).length;
    }
    return counts;
  }, [allOrders]);

  const filtered = allOrders.filter((o) => {
    if (!matchesOrderFilter(o.status, statusFilter)) return false;
    if (search) {
      const q = search.replace(/\D/g, "") || search.toLowerCase();
      const num = String(o.docNum);
      const entry = String(o.docEntry);
      if (
        !num.includes(q) &&
        !entry.includes(q) &&
        !String(o.docNum).toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
    }
    return true;
  });

  const quotationCount = allOrders.filter((o) => isQuotationLike(o)).length;
  const orderCount = allOrders.length - quotationCount;

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gsn-text">
                Meus pedidos
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe da cotação até a entrega
                {!isLoading && allOrders.length > 0 && (
                  <>
                    {" · "}
                    <span className="text-gsn-text/80">
                      {quotationCount} cotação(ões)
                      {orderCount > 0 ? ` · ${orderCount} pedido(s)` : ""}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white"
                  aria-label="Buscar por número"
                />
              </div>
              <Link href="/catalogo">
                <Button className="bg-gsn-brand hover:bg-gsn-brand-dark text-white">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Nova cotação</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Jornada resumida */}
          <div className="rounded-xl border bg-white px-3 py-3 sm:px-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2.5">
              Como funciona
            </p>
            <ol className="flex items-center gap-0 overflow-x-auto pb-0.5">
              {JOURNEY_STEPS.map((step, idx) => (
                <li key={step} className="flex items-center min-w-0">
                  <div className="flex flex-col items-center gap-1 px-1 sm:px-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gsn-brand/10 text-[11px] font-semibold text-gsn-brand">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                      {step}
                    </span>
                  </div>
                  {idx < JOURNEY_STEPS.length - 1 && (
                    <div className="mb-4 h-px w-4 sm:w-8 bg-border shrink-0" />
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Filtros da jornada */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <div
              className="flex gap-2 min-w-min pb-1"
              role="tablist"
              aria-label="Filtrar por etapa"
            >
              {ORDER_STATUS_FILTERS.map((f) => {
                const count = filterCounts[f.value] ?? 0;
                const active = statusFilter === f.value;
                return (
                  <button
                    key={f.value || "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap border transition",
                      active
                        ? "bg-gsn-brand text-white border-gsn-brand shadow-sm"
                        : "bg-white text-muted-foreground border-border hover:border-gsn-brand/40 hover:text-gsn-text",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        "text-xs tabular-nums rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <ClientEmptyState
                  icon={ClipboardList}
                  title={
                    search || statusFilter
                      ? "Nenhum resultado nesta etapa"
                      : "Nenhuma cotação ou pedido"
                  }
                  description={
                    search || statusFilter
                      ? "Tente outro filtro ou limpe a busca"
                      : "Solicite uma cotação no catálogo para começar"
                  }
                  action={
                    search || statusFilter ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setStatusFilter("");
                          setSearch("");
                        }}
                      >
                        Ver todos
                      </Button>
                    ) : (
                      <Link href="/catalogo">
                        <Button className="bg-gsn-brand hover:bg-gsn-brand-dark text-white">
                          Solicitar primeira cotação
                        </Button>
                      </Link>
                    )
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((order) => {
                const cfg = getOrderStatusConfig(order.status);
                const StatusIcon = cfg.icon;
                const quotation = isQuotationLike(order);
                const title = getDocumentTitle(order);
                const unread = !quotation && !order.pending && isUnread(order.docEntry);
                const msgSummary =
                  !quotation && !order.pending
                    ? summaryFor(order.docEntry)
                    : null;
                const showCancel = Boolean(order.pending && order.canCancel);
                // Cotação e pending legado não têm detalhe de pedido SAP.
                const canOpenDetail = !quotation && !order.pending;

                const cardBody = (
                  <CardContent className="flex items-start gap-3 p-4 sm:items-center sm:gap-4 sm:p-5">
                    <div
                      className={cn(
                        "hidden sm:flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
                        quotation
                          ? "bg-sky-50 text-sky-600"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {quotation ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <StatusIcon className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gsn-text">
                          {title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            quotation
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {quotation ? "Cotação" : "Pedido"}
                        </Badge>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        {unread && (
                          <Badge className="bg-gsn-brand text-white hover:bg-gsn-brand gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Nova msg
                          </Badge>
                        )}
                        {!unread && msgSummary && msgSummary.messages > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            {msgSummary.messages}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.createdAt)}
                        </span>
                        <span>{order.itemCount} item(ns)</span>
                        {order.totalQuantity > 0 && (
                          <span>{order.totalQuantity} un</span>
                        )}
                        {order.orderDocNum != null && quotation && (
                          <span className="text-emerald-700">
                            → Pedido #{order.orderDocNum}
                          </span>
                        )}
                      </div>

                      {cfg.hint && order.status !== "entregue" && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {cfg.hint}
                        </p>
                      )}
                      {order.status === "cancelado" && order.rejectReason && (
                        <p className="text-xs text-destructive">
                          Motivo: {order.rejectReason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {order.docTotal != null ? (
                        <span className="font-semibold text-sm whitespace-nowrap text-gsn-text">
                          {formatCurrency(
                            order.docTotal,
                            order.currency ?? "BRL",
                          )}
                        </span>
                      ) : quotation ? (
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          Aguardando preço
                        </span>
                      ) : null}
                      {canOpenDetail && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gsn-brand">
                          Detalhes
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </CardContent>
                );

                if (!canOpenDetail) {
                  return (
                    <Card
                      key={`q-${order.quotationId ?? order.pendingId ?? order.docEntry}`}
                      className={cn(
                        quotation &&
                          "border-sky-100 bg-gradient-to-r from-sky-50/40 to-white",
                      )}
                    >
                      {cardBody}
                      {showCancel && (
                        <div className="flex justify-end border-t px-4 py-2 sm:px-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setCancelTarget(order)}
                          >
                            <Ban className="h-4 w-4" />
                            Cancelar cotação
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                }

                return (
                  <Link
                    key={order.docEntry}
                    href={`/pedidos/${order.docEntry}`}
                    className="block"
                  >
                    <Card className="transition-all hover:shadow-md hover:border-gsn-brand/25 cursor-pointer">
                      {cardBody}
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <p className="text-center text-xs text-muted-foreground pt-1">
              Exibindo {filtered.length} de {allOrders.length}
            </p>
          )}
        </div>
      </main>

      {cancelTarget && (
        <CancelOrderDialog
          title={`Cancelar cotação #${cancelTarget.docNum}`}
          description="Sua cotação ainda não foi convertida em pedido. Ao cancelar, ela não seguirá para a equipe de vendas."
          confirmLabel="Cancelar cotação"
          busy={cancelPending.isPending}
          onConfirm={(reason) =>
            cancelPending.mutate({
              pendingId: cancelTarget.pendingId!,
              reason,
            })
          }
          onClose={() => {
            if (!cancelPending.isPending) setCancelTarget(null);
          }}
        />
      )}
    </div>
  );
}
