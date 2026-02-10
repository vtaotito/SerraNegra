"use client";

import { useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOrders } from "@/features/orders/hooks/useOrders";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatRelativeTime } from "@/lib/utils/format";
import { ShoppingCart, Eye, Search, RefreshCw } from "lucide-react";

export default function PedidosPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch } = useOrders({ limit: 50 });

  // Filtrar client-side por busca
  const filteredOrders = data?.data?.filter((order) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(term) ||
      order.customer_id.toLowerCase().includes(term) ||
      order.customer_name.toLowerCase().includes(term) ||
      order.id.toLowerCase().includes(term)
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-muted-foreground">
              Gerenciamento de pedidos e separacao
              {data?.data && (
                <span className="ml-2 text-xs">
                  ({data.data.length} pedidos)
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2 self-start"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Barra de busca */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          {isLoading && (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-6">
              <EmptyState
                icon={ShoppingCart}
                title="Erro ao carregar pedidos"
                description="Nao foi possivel carregar os pedidos. Verifique se o backend esta rodando."
              />
            </div>
          )}

          {!isLoading && !error && (!filteredOrders || filteredOrders.length === 0) && (
            <div className="p-6">
              <EmptyState
                icon={ShoppingCart}
                title={search ? "Nenhum resultado" : "Nenhum pedido encontrado"}
                description={
                  search
                    ? `Nenhum pedido corresponde a "${search}".`
                    : "Sincronize dados do SAP para ver pedidos aqui."
                }
              />
            </div>
          )}

          {!isLoading && !error && filteredOrders && filteredOrders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pedido
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Itens
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                      Criado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold">{order.order_number}</div>
                        {order.sap_doc_num && (
                          <div className="text-xs text-muted-foreground">
                            SAP #{order.sap_doc_num}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium truncate max-w-[200px]">
                          {order.customer_name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {order.customer_id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {order.lines?.length ?? 0} item(s)
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                        <div>{formatDate(order.created_at)}</div>
                        <div className="text-xs">
                          {formatRelativeTime(order.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Link href={`/pedidos/${order.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">Ver</span>
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
