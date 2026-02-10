"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOrder, useOrderHistory, useApplyOrderEvent } from "@/features/orders/hooks/useOrders";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import {
  ArrowLeft,
  Package,
  Clock,
  Hash,
  User,
  RefreshCw,
  Play,
  CheckCircle2,
} from "lucide-react";
import { OrderStatus } from "@/lib/constants/status";

// Mapa de transicoes possiveis a partir de cada status
const NEXT_EVENTS: Record<string, { event: string; label: string; icon: any }[]> = {
  [OrderStatus.A_SEPARAR]: [
    { event: "INICIAR_SEPARACAO", label: "Iniciar Separacao", icon: Play },
  ],
  [OrderStatus.EM_SEPARACAO]: [
    { event: "FINALIZAR_SEPARACAO", label: "Finalizar Separacao", icon: CheckCircle2 },
  ],
  [OrderStatus.CONFERIDO]: [
    { event: "SOLICITAR_COTACAO", label: "Solicitar Cotacao", icon: Play },
  ],
  [OrderStatus.AGUARDANDO_COTACAO]: [
    { event: "CONFIRMAR_COTACAO", label: "Confirmar Cotacao", icon: CheckCircle2 },
  ],
  [OrderStatus.AGUARDANDO_COLETA]: [
    { event: "DESPACHAR", label: "Despachar", icon: CheckCircle2 },
  ],
};

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading: isLoadingOrder } = useOrder(orderId);
  const { data: history, isLoading: isLoadingHistory } = useOrderHistory(orderId);
  const applyEvent = useApplyOrderEvent();

  if (isLoadingOrder) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Link href="/pedidos">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar para pedidos
            </Button>
          </Link>
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h1 className="text-2xl font-bold">Pedido nao encontrado</h1>
            <p className="text-muted-foreground mt-2">
              O pedido solicitado nao existe ou foi removido.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const nextEvents = NEXT_EVENTS[order.status] || [];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <Link href="/pedidos">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar para pedidos
            </Button>
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {order.order_number}
              </h1>
              <p className="text-muted-foreground">
                {order.customer_name} ({order.customer_id})
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <OrderStatusBadge status={order.status} />
              {order.sync_status && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  Sincronizado SAP
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Acoes de transicao */}
        {nextEvents.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <p className="text-sm font-medium">Proxima acao:</p>
                <div className="flex gap-2 flex-wrap">
                  {nextEvents.map((evt) => {
                    const Icon = evt.icon;
                    return (
                      <Button
                        key={evt.event}
                        size="sm"
                        className="gap-2"
                        disabled={applyEvent.isPending}
                        onClick={() =>
                          applyEvent.mutate({
                            orderId: order.id,
                            eventType: evt.event,
                          })
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {evt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid principal */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Informacoes Gerais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Informacoes Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Numero</span>
                <span className="font-medium">{order.order_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">ID interno</span>
                <span className="font-mono text-xs">{order.id.substring(0, 8)}...</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Criado em</span>
                <span>{formatDateTime(order.created_at)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Atualizado</span>
                <span>{formatDateTime(order.updated_at)}</span>
              </div>
              {order.total_amount != null && (
                <div className="col-span-2">
                  <span className="text-muted-foreground block">Valor Total</span>
                  <span className="font-semibold text-lg text-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: order.currency || "BRL" }).format(order.total_amount)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cliente + SAP */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Cliente & SAP
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground block">ID Cliente</span>
                  <span className="font-mono font-semibold">{order.customer_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Nome</span>
                  <span className="font-semibold">{order.customer_name}</span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                {order.sap_doc_num && (
                  <div>
                    <span className="text-muted-foreground block">SAP DocNum</span>
                    <span className="font-mono font-semibold text-blue-600">
                      {order.sap_doc_num}
                    </span>
                  </div>
                )}
                {order.sap_doc_entry && (
                  <div>
                    <span className="text-muted-foreground block">SAP DocEntry</span>
                    <span className="font-mono">{order.sap_doc_entry}</span>
                  </div>
                )}
                {!order.sap_doc_num && !order.sap_doc_entry && (
                  <div className="col-span-2 text-center py-4">
                    <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-muted-foreground text-xs">
                      Sem dados SAP vinculados
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Itens do Pedido */}
        {order.lines && order.lines.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Itens ({order.lines.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="text-left py-2 pr-3">#</th>
                      <th className="text-left py-2 pr-3">SKU</th>
                      <th className="text-left py-2 pr-3">Descricao</th>
                      <th className="text-right py-2">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.lines.map((line) => (
                      <tr key={line.id} className="hover:bg-muted/50">
                        <td className="py-3 pr-3 text-muted-foreground">
                          {line.line_number}
                        </td>
                        <td className="py-3 pr-3">
                          <span className="font-mono font-semibold">
                            {line.product_sku}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {line.product_description}
                        </td>
                        <td className="py-3 text-right font-semibold">
                          {line.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline/Historico */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Historico de Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum evento registrado
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Eventos aparecerao aqui conforme o pedido avanca no fluxo.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {history.map((event, idx) => (
                  <div key={event.event_id || idx} className="flex gap-4 pb-4 relative">
                    {idx < history.length - 1 && (
                      <div className="absolute left-[11px] top-[24px] bottom-0 w-[2px] bg-border" />
                    )}
                    <div className="flex-shrink-0 mt-1 z-10">
                      <div className="h-6 w-6 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pb-4 border-b last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{event.type}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {event.actor_kind}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <OrderStatusBadge status={event.from_status} />
                        <span>→</span>
                        <OrderStatusBadge status={event.to_status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(event.occurred_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
