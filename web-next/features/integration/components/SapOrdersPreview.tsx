"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useSapOrders } from "../hooks/useSapOrders";

const STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DESPACHADO: "default",
  EM_SEPARACAO: "outline",
  CONFERIDO: "outline",
  AGUARDANDO_COTACAO: "secondary",
  AGUARDANDO_COLETA: "secondary",
  A_SEPARAR: "secondary",
};

export function SapOrdersPreview() {
  const [limit] = useState(20);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useSapOrders({
    top: limit,
    filter: "DocumentStatus eq 'bost_Open'",
    search: search || undefined,
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Pedidos Abertos no SAP</CardTitle>
            <CardDescription>
              Pedidos com status &quot;Open&quot; no SAP B1 — clique para ver detalhes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar DocNum, cliente..."
                className="pl-9 w-[200px] h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
          <div className="space-y-1">
            {/* Header */}
            <div className="hidden md:grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b px-2">
              <div>DocEntry</div>
              <div>DocNum</div>
              <div className="col-span-2">Cliente</div>
              <div className="text-right">Valor</div>
              <div>Status WMS</div>
              <div className="text-right">Itens</div>
            </div>

            {/* Rows */}
            {items.map((order) => (
              <Link
                key={order.sapDocEntry ?? order.orderId}
                href={`/integracao/pedido-sap/${order.sapDocEntry}`}
                className="group block"
              >
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-sm py-3 px-2 border-b last:border-0 hover:bg-accent rounded-md transition-colors items-center">
                  {/* DocEntry */}
                  <div className="font-mono text-blue-600 group-hover:underline">
                    {order.sapDocEntry}
                  </div>
                  {/* DocNum */}
                  <div className="font-semibold">{order.sapDocNum}</div>
                  {/* Cliente */}
                  <div className="col-span-2 truncate hidden md:block">
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {order.customerId}
                    </span>
                    <span>{order.customerName ?? "—"}</span>
                  </div>
                  {/* Valor */}
                  <div className="text-right font-medium hidden md:block">
                    {formatCurrency(order.docTotal)}
                  </div>
                  {/* Status */}
                  <div className="hidden md:block">
                    <Badge variant={STATUS_COLORS[order.status] ?? "secondary"}>
                      {order.status ?? "Novo"}
                    </Badge>
                  </div>
                  {/* Itens count + chevron */}
                  <div className="hidden md:flex items-center justify-end gap-1">
                    <span className="text-muted-foreground text-xs">
                      {order.items.length} iten(s)
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  {/* Mobile row extra info */}
                  <div className="col-span-2 md:hidden">
                    <span className="text-xs text-muted-foreground">
                      {order.customerName ?? order.customerId}
                    </span>
                    <span className="ml-2 font-medium">
                      {formatCurrency(order.docTotal)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {/* Footer */}
            <div className="pt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total: {data?.count ?? items.length} pedido(s) aberto(s)
              </span>
              <Button variant="link" size="sm" asChild>
                <Link href="/pedidos" className="flex items-center gap-1">
                  Ver todos no WMS
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum pedido aberto encontrado no SAP</p>
            <p className="text-sm mt-1">
              Verifique se a conexão SAP está ativa ou se há pedidos com status
              &quot;Open&quot;
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
