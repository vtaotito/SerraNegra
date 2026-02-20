"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { formatDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  ArrowRight,
  Calendar,
  Package,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Order {
  orderId: string;
  externalOrderId: string;
  sapDocEntry: number;
  sapDocNum: number;
  customerId: string;
  customerName?: string;
  status: string;
  docTotal?: number;
  currency?: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{ sku: string; quantity: number; description?: string }>;
}

interface OrdersResponse {
  items: Order[];
  total: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "destructive" }> = {
  A_SEPARAR: { label: "A Separar", variant: "info" },
  EM_SEPARACAO: { label: "Em Separacao", variant: "warning" },
  CONFERIDO: { label: "Conferido", variant: "secondary" },
  AGUARDANDO_COTACAO: { label: "Aguardando Cotacao", variant: "warning" },
  AGUARDANDO_COLETA: { label: "Aguardando Coleta", variant: "success" },
  DESPACHADO: { label: "Despachado", variant: "success" },
};

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "A_SEPARAR", label: "A Separar" },
  { value: "EM_SEPARACAO", label: "Em Separacao" },
  { value: "CONFERIDO", label: "Conferido" },
  { value: "AGUARDANDO_COLETA", label: "Aguardando Coleta" },
  { value: "DESPACHADO", label: "Despachado" },
];

export default function PedidosPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: openData, isLoading: loadingOpen } = useQuery<OrdersResponse>({
    queryKey: ["b2b-orders", "open", statusFilter],
    queryFn: () =>
      get(`/b2b/orders?docStatus=O${statusFilter ? `&status=${statusFilter}` : ""}`),
  });

  const { data: closedData, isLoading: loadingClosed } = useQuery<OrdersResponse>({
    queryKey: ["b2b-orders", "closed"],
    queryFn: () => get("/b2b/orders?docStatus=C"),
  });

  const allOrders = [
    ...(openData?.items ?? []),
    ...(closedData?.items ?? []),
  ];

  const filtered = search
    ? allOrders.filter(
        (o) =>
          String(o.sapDocNum).includes(search) ||
          o.orderId.toLowerCase().includes(search.toLowerCase())
      )
    : allOrders;

  const isLoading = loadingOpen || loadingClosed;

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Meus Pedidos</h1>
              <p className="text-muted-foreground">
                {filtered.length} pedido(s)
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por numero..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Link href="/catalogo">
                <Button>
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Pedido</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Filtros de Status */}
          <div className="flex flex-wrap gap-2">
            <Filter className="h-4 w-4 text-muted-foreground mt-1.5" />
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">Nenhum pedido encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter
                    ? "Tente alterar os filtros"
                    : "Voce ainda nao possui pedidos"}
                </p>
                <Link href="/catalogo" className="mt-4">
                  <Button>Fazer primeiro pedido</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((order) => (
                <Link key={order.orderId} href={`/pedidos/${order.sapDocEntry}`}>
                  <Card className="transition-all hover:shadow-md hover:border-primary/20 cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                      <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">Pedido #{order.sapDocNum}</span>
                          <Badge variant={STATUS_MAP[order.status]?.variant ?? "secondary"}>
                            {STATUS_MAP[order.status]?.label ?? order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(order.createdAt)}
                          </span>
                          <span>{order.items.length} item(ns)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {order.docTotal != null && (
                          <span className="font-semibold text-sm whitespace-nowrap">
                            {formatCurrency(order.docTotal, order.currency)}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
