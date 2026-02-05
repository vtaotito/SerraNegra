"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOrders } from "@/features/orders/hooks/useOrders";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { SyncStatusBadge } from "@/features/orders/components/SyncStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import { ShoppingCart, Eye } from "lucide-react";

export default function PedidosPage() {
  const { data, isLoading, error } = useOrders({ limit: 50 });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-muted-foreground">
              Gerenciamento de pedidos e separação
            </p>
          </div>
        </div>

        <Card>
          {isLoading && (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-6">
              <EmptyState
                icon={ShoppingCart}
                title="Erro ao carregar pedidos"
                description="Não foi possível carregar os pedidos. Verifique se o backend está rodando."
              />
            </div>
          )}

          {!isLoading && !error && (!data?.data || data.data.length === 0) && (
            <div className="p-6">
              <EmptyState
                icon={ShoppingCart}
                title="Nenhum pedido encontrado"
                description="Não há pedidos cadastrados no sistema."
              />
            </div>
          )}

          {!isLoading && !error && data?.data && data.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Número
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Sync
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium">{order.customer_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.customer_id}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {order.total_amount
                          ? formatCurrency(order.total_amount, order.currency)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <SyncStatusBadge status={order.sync_status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Link href={`/pedidos/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
