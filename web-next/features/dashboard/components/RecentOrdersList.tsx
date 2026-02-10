"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUS_CONFIG } from "@/lib/constants/status";
import { formatRelativeTime } from "@/lib/utils/format";
import { Order } from "@/features/orders/types";
import { ArrowRight, ShoppingCart } from "lucide-react";

interface RecentOrdersListProps {
  orders?: Order[];
  isLoading?: boolean;
}

export function RecentOrdersList({ orders, isLoading }: RecentOrdersListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center space-x-4 p-3 rounded-lg border">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum pedido encontrado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sincronize dados do SAP para ver pedidos aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Pedidos Recentes</CardTitle>
        <Link
          href="/pedidos"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orders.map((order) => {
            const statusConfig = ORDER_STATUS_CONFIG[order.status];

            return (
              <Link
                key={order.id}
                href={`/pedidos/${order.id}`}
                className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold truncate">
                      {order.order_number}
                    </p>
                    {statusConfig && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusConfig.color}`}>
                        {statusConfig.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.customer_name} ({order.customer_id})
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(order.created_at)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
