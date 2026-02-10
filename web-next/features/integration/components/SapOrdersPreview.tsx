"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { get } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { SapOrdersResponse } from "../types";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DESPACHADO: "default",
  EM_SEPARACAO: "outline",
  CONFERIDO: "outline",
  AGUARDANDO_COTACAO: "secondary",
  AGUARDANDO_COLETA: "secondary",
  A_SEPARAR: "secondary",
};

export function SapOrdersPreview() {
  const [limit] = useState(10);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<SapOrdersResponse>({
    queryKey: ["sap", "orders", "preview", limit],
    queryFn: () =>
      get<SapOrdersResponse>(
        `${API_ENDPOINTS.SAP_ORDERS}?$top=${limit}&$filter=DocumentStatus eq 'bost_Open'`
      ),
    enabled: true,
    retry: 1,
  });

  const formatCurrency = (value: number | undefined) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const items = data?.items;
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pedidos Abertos no SAP</CardTitle>
            <CardDescription>
              Últimos {limit} pedidos com status &quot;Open&quot; no SAP B1
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-red-500">Erro ao carregar pedidos do SAP</p>
            <p className="text-sm mt-1">
              Verifique se a conexão SAP está ativa e tente novamente.
            </p>
          </div>
        ) : hasItems ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
              <div>DocEntry</div>
              <div>DocNum</div>
              <div className="col-span-2">Cliente</div>
              <div>Valor</div>
              <div>Status WMS</div>
            </div>

            {/* Rows */}
            {items.map((order) => (
              <div
                key={order.sapDocEntry ?? order.orderId}
                className="grid grid-cols-6 gap-2 text-sm py-2 border-b last:border-0 hover:bg-accent rounded transition-colors"
              >
                <div className="font-mono text-blue-600">{order.sapDocEntry}</div>
                <div className="font-medium">{order.sapDocNum}</div>
                <div className="col-span-2 truncate" title={order.customerName ?? ""}>
                  <span className="font-mono text-xs text-muted-foreground">
                    {order.customerId}
                  </span>
                  <br />
                  <span className="text-sm">{order.customerName ?? "—"}</span>
                </div>
                <div className="font-medium">{formatCurrency(order.docTotal)}</div>
                <div>
                  <Badge variant={STATUS_COLORS[order.status] ?? "secondary"}>
                    {order.status ?? "Novo"}
                  </Badge>
                </div>
              </div>
            ))}

            {/* Footer */}
            <div className="pt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total: {data?.count ?? items.length} pedido(s) aberto(s) no SAP
              </span>
              <Button variant="link" size="sm" asChild>
                <a href="/pedidos" className="flex items-center gap-1">
                  Ver todos no WMS
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum pedido aberto encontrado no SAP</p>
            <p className="text-sm mt-1">
              Verifique se a conexão SAP está ativa ou se há pedidos com status &quot;Open&quot;
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
