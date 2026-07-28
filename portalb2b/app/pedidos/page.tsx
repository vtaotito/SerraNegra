"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  ORDER_STATUS_FILTERS,
  getOrderStatusConfig,
  type OrderStatus,
  type OrderSummary,
} from "@/lib/orders";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  ArrowRight,
  Calendar,
  Package,
  Filter,
  Ban,
  MessageSquare,
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

export default function PedidosPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
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
      toast.success("Solicitação cancelada.");
      setCancelTarget(null);
      qc.invalidateQueries({ queryKey: ["b2b-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao cancelar"),
  });

  const allOrders = data?.items ?? [];

  const filtered = allOrders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!String(o.docNum).includes(search) && !String(o.docEntry).includes(search)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gsn-text">Meus Pedidos</h1>
              <p className="text-muted-foreground">
                {filtered.length} pedido(s)
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Buscar pedido por número"
                />
              </div>
              <Link href="/catalogo">
                <Button className="bg-gsn-brand hover:bg-gsn-brand-dark text-white">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Pedido</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Filtros de Status */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {ORDER_STATUS_FILTERS.map((f) => (
              <Button
                key={f.value || "all"}
                variant={statusFilter === f.value ? "default" : "outline"}
                size="sm"
                className={statusFilter === f.value ? "bg-gsn-brand hover:bg-gsn-brand-dark text-white" : ""}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <ClientEmptyState
                  icon={ClipboardList}
                  title="Nenhum pedido encontrado"
                  description={
                    search || statusFilter
                      ? "Tente alterar os filtros"
                      : "Você ainda não possui pedidos"
                  }
                  action={
                    <Link href="/catalogo">
                      <Button className="bg-gsn-brand hover:bg-gsn-brand-dark text-white">
                        Fazer primeiro pedido
                      </Button>
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((order) => {
                const cfg = getOrderStatusConfig(order.status);
                const StatusIcon = cfg.icon;
                const unread = !order.pending && isUnread(order.docEntry);
                const msgSummary = !order.pending ? summaryFor(order.docEntry) : null;

                const cardBody = (
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                      <StatusIcon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {order.pending ? `Solicitação #${order.docNum}` : `Pedido #${order.docNum}`}
                        </span>
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
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.createdAt)}
                        </span>
                        <span>{order.itemCount} item(ns)</span>
                      </div>
                      {order.pending && order.status === "cancelado" && order.rejectReason && (
                        <p className="text-xs text-destructive">Motivo: {order.rejectReason}</p>
                      )}
                      {order.pending && order.status === "aguardando" && (
                        <p className="text-xs text-muted-foreground">{cfg.hint}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {order.docTotal != null && (
                        <span className="font-semibold text-sm whitespace-nowrap">
                          {formatCurrency(order.docTotal, order.currency ?? "BRL")}
                        </span>
                      )}
                      {!order.pending && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </CardContent>
                );

                // Pedidos pendentes não têm página de detalhe (não existem no SAP).
                if (order.pending) {
                  return (
                    <Card key={order.docEntry} className="border-amber-200 bg-amber-50/30">
                      {cardBody}
                      {order.canCancel && (
                        <div className="flex justify-end border-t border-amber-100 px-4 py-2 sm:px-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setCancelTarget(order)}
                          >
                            <Ban className="h-4 w-4" />
                            Cancelar solicitação
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                }

                return (
                  <Link key={order.docEntry} href={`/pedidos/${order.docEntry}`}>
                    <Card className="transition-all hover:shadow-md hover:border-gsn-brand/20 cursor-pointer">
                      {cardBody}
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {cancelTarget && (
        <CancelOrderDialog
          title={`Cancelar solicitação #${cancelTarget.docNum}`}
          description="Sua solicitação ainda não foi confirmada pela equipe de vendas. Ao cancelar, ela não será enviada ao SAP."
          confirmLabel="Cancelar solicitação"
          busy={cancelPending.isPending}
          onConfirm={(reason) =>
            cancelPending.mutate({ pendingId: cancelTarget.pendingId!, reason })
          }
          onClose={() => {
            if (!cancelPending.isPending) setCancelTarget(null);
          }}
        />
      )}
    </div>
  );
}
