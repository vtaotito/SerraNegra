"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOrder, useOrderHistory } from "@/features/orders/hooks/useOrders";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { SyncStatusBadge } from "@/features/orders/components/SyncStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatCurrency } from "@/lib/utils/format";
import { ArrowLeft, Package, Clock } from "lucide-react";

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading: isLoadingOrder } = useOrder(orderId);
  const { data: history, isLoading: isLoadingHistory } = useOrderHistory(orderId);

  if (isLoadingOrder) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pedido não encontrado</h1>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link href="/pedidos">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para pedidos
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Pedido {order.order_number}
              </h1>
              <p className="text-muted-foreground">
                Cliente: {order.customer_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <SyncStatusBadge status={order.sync_status} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Informações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Número do Pedido</p>
                  <p className="font-medium">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID do Cliente</p>
                  <p className="font-medium">{order.customer_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data do Pedido</p>
                  <p className="font-medium">{formatDateTime(order.order_date)}</p>
                </div>
                {order.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Vencimento</p>
                    <p className="font-medium">{formatDateTime(order.due_date)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Prioridade</p>
                  <Badge variant="outline">P{order.priority}</Badge>
                </div>
                {order.total_amount && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="font-medium text-lg">
                      {formatCurrency(order.total_amount, order.currency)}
                    </p>
                  </div>
                )}
              </div>

              {order.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{order.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Integração SAP */}
          {(order.sap_doc_entry || order.sap_doc_num) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integração SAP B1</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {order.sap_doc_num && (
                    <div>
                      <p className="text-sm text-muted-foreground">DocNum</p>
                      <p className="font-medium">{order.sap_doc_num}</p>
                    </div>
                  )}
                  {order.sap_doc_entry && (
                    <div>
                      <p className="text-sm text-muted-foreground">DocEntry</p>
                      <p className="font-medium">{order.sap_doc_entry}</p>
                    </div>
                  )}
                  {order.sap_doc_status && (
                    <div>
                      <p className="text-sm text-muted-foreground">Status SAP</p>
                      <Badge variant="outline">{order.sap_doc_status}</Badge>
                    </div>
                  )}
                  {order.last_sync_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Última Sync</p>
                      <p className="font-medium text-sm">
                        {formatDateTime(order.last_sync_at)}
                      </p>
                    </div>
                  )}
                </div>

                {order.sync_error && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Erro de Sincronização</p>
                      <p className="text-sm text-red-600">{order.sync_error}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Itens do Pedido */}
        {order.lines && order.lines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                        SKU
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                        Descrição
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                        Qtd
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                        Separado
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                        UM
                      </th>
                      {order.lines.some((l) => l.unit_price) && (
                        <>
                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                            Preço Unit.
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                            Total
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 text-sm font-medium">
                          {line.product_sku}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {line.product_description}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {line.quantity_picked}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-muted-foreground">
                          {line.unit_of_measure}
                        </td>
                        {line.unit_price && (
                          <>
                            <td className="px-4 py-3 text-sm text-right">
                              {formatCurrency(line.unit_price, order.currency)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium">
                              {formatCurrency(
                                line.line_total || line.unit_price * line.quantity,
                                order.currency
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline/Histórico */}
        {history && history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {history.map((event) => (
                  <div
                    key={event.event_id}
                    className="flex gap-4 pb-4 border-b last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{event.type}</span>
                        <Badge variant="outline" className="text-xs">
                          {event.actor_kind}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{event.from_status}</span>
                        <span>→</span>
                        <span>{event.to_status}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {formatDateTime(event.occurred_at)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
