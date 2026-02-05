"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/features/inventory/hooks/useInventory";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Warehouse } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

export default function EstoquePage() {
  const { data, isLoading, error } = useInventory({ limit: 50 });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">Visão geral de estoque por depósito</p>
        </div>

        <Card>
          {isLoading && (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-6">
              <EmptyState
                icon={Warehouse}
                title="Erro ao carregar estoque"
                description="Não foi possível carregar os dados de estoque."
              />
            </div>
          )}

          {!isLoading && !error && (!data?.data || data.data.length === 0) && (
            <div className="p-6">
              <EmptyState
                icon={Warehouse}
                title="Nenhum estoque encontrado"
                description="Não há registros de estoque no sistema."
              />
            </div>
          )}

          {!isLoading && !error && data?.data && data.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Depósito</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Disponível</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Reservado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Livre</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Em Pedidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map((stock) => (
                    <tr key={stock.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{stock.product_id}</td>
                      <td className="px-4 py-3 text-sm">{stock.warehouse_id}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatNumber(stock.quantity_available, 2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-amber-600">
                        {formatNumber(stock.quantity_reserved, 2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Badge
                          variant={stock.quantity_free > 0 ? "default" : "outline"}
                          className={stock.quantity_free > 0 ? "bg-green-600" : ""}
                        >
                          {formatNumber(stock.quantity_free, 2)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {formatNumber(stock.quantity_on_order, 2)}
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
