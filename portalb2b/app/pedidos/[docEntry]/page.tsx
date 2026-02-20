"use client";

import { use } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  User,
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  ClipboardList,
} from "lucide-react";

interface OrderDetail {
  orderId: string;
  externalOrderId: string;
  sapDocEntry: number;
  sapDocNum: number;
  customerId: string;
  customerName?: string;
  shipToAddress?: string;
  status: string;
  slaDueAt?: string;
  docTotal?: number;
  currency?: string;
  items: Array<{
    sku: string;
    quantity: number;
    description?: string;
    warehouse?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info"; icon: React.ComponentType<{ className?: string }> }> = {
  A_SEPARAR: { label: "A Separar", variant: "info", icon: ClipboardList },
  EM_SEPARACAO: { label: "Em Separacao", variant: "warning", icon: Package },
  CONFERIDO: { label: "Conferido", variant: "secondary", icon: CheckCircle2 },
  AGUARDANDO_COTACAO: { label: "Aguardando Cotacao", variant: "warning", icon: Clock },
  AGUARDANDO_COLETA: { label: "Aguardando Coleta", variant: "success", icon: Truck },
  DESPACHADO: { label: "Despachado", variant: "success", icon: CheckCircle2 },
};

const STATUS_FLOW = [
  "A_SEPARAR",
  "EM_SEPARACAO",
  "CONFERIDO",
  "AGUARDANDO_COLETA",
  "DESPACHADO",
];

export default function PedidoDetalhePage({ params }: { params: Promise<{ docEntry: string }> }) {
  const { docEntry } = use(params);

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ["b2b-order", docEntry],
    queryFn: () => get(`/b2b/orders/${docEntry}`),
  });

  const statusConfig = order ? STATUS_MAP[order.status] : null;
  const currentStepIdx = order ? STATUS_FLOW.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/b2b/pedidos">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isLoading ? (
                  <Skeleton className="h-8 w-48" />
                ) : (
                  `Pedido #${order?.sapDocNum}`
                )}
              </h1>
              {order && (
                <p className="text-sm text-muted-foreground">
                  DocEntry: {order.sapDocEntry}
                </p>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : !order ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">Pedido nao encontrado</h3>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Status Badge + Timeline */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      {statusConfig && <statusConfig.icon className="h-6 w-6 text-primary" />}
                      <div>
                        <Badge variant={statusConfig?.variant ?? "secondary"} className="text-sm px-3 py-1">
                          {statusConfig?.label ?? order.status}
                        </Badge>
                      </div>
                    </div>
                    {order.docTotal != null && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {formatCurrency(order.docTotal, order.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">Valor total</p>
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center justify-between">
                    {STATUS_FLOW.map((step, idx) => {
                      const stepConf = STATUS_MAP[step];
                      const isComplete = idx <= currentStepIdx;
                      const isCurrent = idx === currentStepIdx;
                      return (
                        <div key={step} className="flex flex-col items-center flex-1">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                              isCurrent
                                ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                : isComplete
                                  ? "bg-primary/80 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <span className="mt-1.5 text-[10px] text-center text-muted-foreground leading-tight hidden sm:block">
                            {stepConf?.label ?? step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Informações */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Datas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Criado em</span>
                      <span>{formatDateTime(order.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Atualizado em</span>
                      <span>{formatDateTime(order.updatedAt)}</span>
                    </div>
                    {order.slaDueAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prazo</span>
                        <span>{formatDate(order.slaDueAt)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Codigo</span>
                      <span className="font-mono">{order.customerId}</span>
                    </div>
                    {order.customerName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nome</span>
                        <span className="text-right max-w-[60%] truncate">{order.customerName}</span>
                      </div>
                    )}
                    {order.shipToAddress && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Entrega
                        </span>
                        <span className="text-right max-w-[60%] truncate">{order.shipToAddress}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Itens do Pedido */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Itens do Pedido ({order.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {order.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Detalhes dos itens nao disponiveis
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={idx}>
                          {idx > 0 && <Separator className="mb-3" />}
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="font-medium text-sm">
                                {item.description ?? item.sku}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                SKU: {item.sku}
                                {item.warehouse && ` | Deposito: ${item.warehouse}`}
                              </p>
                            </div>
                            <Badge variant="outline" className="font-mono">
                              Qtde: {item.quantity}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
