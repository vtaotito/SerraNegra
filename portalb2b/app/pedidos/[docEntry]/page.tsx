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
import {
  ORDER_FLOW,
  getOrderStatusConfig,
  type OrderStatus,
} from "@/lib/orders";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  User,
  FileText,
  CheckCircle2,
  MessageSquare,
  XCircle,
} from "lucide-react";

interface OrderItem {
  sku: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  warehouse?: string | null;
}

interface OrderDetail {
  docEntry: number;
  docNum: number;
  status: OrderStatus;
  cancelled: boolean;
  customerId: string;
  cardName?: string | null;
  shipToAddress?: string | null;
  dueDate?: string | null;
  docTotal?: number | null;
  currency?: string | null;
  comments?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export default function PedidoDetalhePage({ params }: { params: Promise<{ docEntry: string }> }) {
  const { docEntry } = use(params);

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ["b2b-order", docEntry],
    queryFn: () => get(`/b2b/orders/${docEntry}`),
  });

  const cfg = order ? getOrderStatusConfig(order.status) : null;
  const isCancelled = order?.status === "cancelado";
  const currentStepIdx = order ? ORDER_FLOW.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/pedidos">
              <Button variant="ghost" size="icon" aria-label="Voltar para pedidos">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isLoading ? (
                  <Skeleton className="h-8 w-48" />
                ) : (
                  `Pedido #${order?.docNum}`
                )}
              </h1>
              {order && (
                <p className="text-sm text-muted-foreground">
                  Pedido nº {order.docEntry}
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
              {/* Status + Timeline */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {cfg && <cfg.icon className="h-6 w-6 text-gsn-brand" />}
                      <Badge variant={cfg?.variant ?? "secondary"} className="text-sm px-3 py-1">
                        {cfg?.label ?? order.status}
                      </Badge>
                    </div>
                    {order.docTotal != null && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {formatCurrency(order.docTotal, order.currency ?? "BRL")}
                        </p>
                        <p className="text-xs text-muted-foreground">Valor total</p>
                      </div>
                    )}
                  </div>

                  {cfg?.hint && (
                    <p className="text-sm text-muted-foreground mb-6">{cfg.hint}</p>
                  )}

                  {isCancelled ? (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                      Este pedido foi cancelado.
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      {ORDER_FLOW.map((step, idx) => {
                        const stepConf = getOrderStatusConfig(step);
                        const isComplete = idx <= currentStepIdx;
                        const isCurrent = idx === currentStepIdx;
                        return (
                          <div key={step} className="flex flex-col items-center flex-1 relative">
                            {idx > 0 && (
                              <div
                                className={`absolute top-4 right-1/2 h-0.5 w-full -z-0 ${
                                  idx <= currentStepIdx ? "bg-gsn-brand" : "bg-muted"
                                }`}
                              />
                            )}
                            <div
                              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                isCurrent
                                  ? "bg-gsn-brand text-white ring-4 ring-gsn-brand/20"
                                  : isComplete
                                    ? "bg-gsn-brand/80 text-white"
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
                              {stepConf.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                    {order.dueDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Previsao</span>
                        <span>{formatDate(order.dueDate)}</span>
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
                    {order.cardName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nome</span>
                        <span className="text-right max-w-[60%] truncate">{order.cardName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Codigo</span>
                      <span className="font-mono">{order.customerId}</span>
                    </div>
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

              {/* Observações */}
              {order.comments && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> Observacoes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{order.comments}</p>
                  </CardContent>
                </Card>
              )}

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
                        <div key={`${item.sku}-${idx}`}>
                          {idx > 0 && <Separator className="mb-3" />}
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {item.description ?? item.sku}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                SKU: {item.sku}
                                {item.warehouse && ` | Deposito: ${item.warehouse}`}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <Badge variant="outline" className="font-mono">
                                {item.quantity}x
                              </Badge>
                              {item.lineTotal != null && item.lineTotal > 0 && (
                                <p className="text-sm font-semibold mt-1">
                                  {formatCurrency(item.lineTotal, order.currency ?? "BRL")}
                                </p>
                              )}
                            </div>
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
