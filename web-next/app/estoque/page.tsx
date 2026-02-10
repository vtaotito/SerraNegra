"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/features/inventory/hooks/useInventory";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Warehouse, RefreshCw, Database } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

export default function EstoquePage() {
  const { data, isLoading, error } = useInventory({ limit: 50 });

  const hasData = data?.data && data.data.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">Visao geral de estoque por deposito</p>
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
                description="Nao foi possivel carregar os dados de estoque."
              />
            </div>
          )}

          {!isLoading && !error && !hasData && (
            <div className="p-8 text-center">
              <Database className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Dados de estoque nao disponiveis
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Os dados de estoque serao populados quando a integracao com o SAP
                B1 estiver configurada para sincronizar inventario. Atualmente,
                a sincronizacao importa pedidos.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/integracao">
                  <Button variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Ir para Integracao
                  </Button>
                </Link>
                <Link href="/pedidos">
                  <Button variant="outline" className="gap-2">
                    <Warehouse className="h-4 w-4" />
                    Ver Pedidos
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {!isLoading && !error && hasData && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Deposito</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Disponivel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Reservado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Livre</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">Em Pedidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.data.map((stock) => (
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
