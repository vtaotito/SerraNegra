"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUS_CONFIG } from "@/lib/constants/status";
import { formatRelativeTime, formatCurrency } from "@/lib/utils/format";
import { Order } from "@/features/orders/types";
import { ArrowRight } from "lucide-react";

interface RecentOrdersListProps {
  orders?: Order[];
  isLoading?: boolean;
}

export function RecentOrdersList({ orders, isLoading }: RecentOrdersListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-16" />
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
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum pedido encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pedidos Recentes</CardTitle>
        <Link
          href="/pedidos"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.map((order) => {
            const statusConfig = ORDER_STATUS_CONFIG[order.status];

            return (
              <Link
                key={order.id}
                href={`/pedidos/${order.id}`}
                className="flex items-center space-x-4 rounded-lg border p-4 hover:bg-accent transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">
                      {order.order_number}
                    </p>
                    <Badge className={statusConfig.color}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.customer_name}
                  </p>
                </div>
                <div className="text-right">
                  {order.total_amount && (
                    <p className="text-sm font-medium">
                      {formatCurrency(order.total_amount, order.currency)}
                    </p>
                  )}
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
