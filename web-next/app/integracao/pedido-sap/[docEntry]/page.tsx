"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSapOrder } from "@/features/integration/hooks/useSapOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  FileText,
  User,
  Package,
  Warehouse,
  DollarSign,
  CalendarDays,
  Hash,
  Globe,
  AlertCircle,
} from "lucide-react";

function fmt(v: number | undefined, currency?: string) {
  if (v == null) return "—";
  const code =
    currency === "R$" ? "BRL" : currency === "US$" ? "USD" : currency ?? "BRL";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code,
  }).format(v);
}

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SapOrderDetailPage() {
  const params = useParams();
  const docEntry = params.docEntry as string;
  const { data: order, isLoading, isError } = useSapOrder(docEntry);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !order) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto space-y-4">
          <Link href="/integracao">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-medium text-red-900">
                  Pedido SAP DocEntry {docEntry} não encontrado
                </p>
                <p className="text-sm text-red-700">
                  Verifique se a conexão SAP está ativa e se o DocEntry é válido.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const meta = (order.metadata ?? {}) as Record<string, string | number | boolean | null | undefined>;
  const sapDocStatus = String(meta.sapDocumentStatus ?? meta.sapDocStatus ?? order.status);
  const isOpen = sapDocStatus === "bost_Open";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Link href="/integracao">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Integração
          </Button>
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              Pedido SAP #{order.sapDocNum}
            </h1>
            <p className="text-muted-foreground mt-1">
              DocEntry: {order.sapDocEntry} &middot; ID WMS: {order.orderId}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={isOpen ? "secondary" : "default"}
              className="text-sm px-3 py-1"
            >
              SAP: {isOpen ? "Aberto" : "Fechado"}
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              WMS: {order.status}
            </Badge>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Dados do Documento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Dados do Documento (SAP)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <span className="text-muted-foreground block">DocEntry</span>
                <span className="font-mono font-semibold">{order.sapDocEntry}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">DocNum</span>
                <span className="font-mono font-semibold">{order.sapDocNum}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">ExternalOrderId</span>
                <span className="font-mono">{order.externalOrderId}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">DocumentStatus</span>
                <Badge variant={isOpen ? "secondary" : "default"} className="mt-0.5">
                  {sapDocStatus}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block">Status WMS</span>
                <span className="font-semibold">{order.status}</span>
              </div>
              {meta.sapComments && (
                <div className="col-span-2">
                  <span className="text-muted-foreground block">Comments</span>
                  <span>{String(meta.sapComments)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cliente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Cliente (CardCode / CardName)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <span className="text-muted-foreground block">CardCode</span>
                  <span className="font-mono font-semibold">
                    {order.customerId}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">CardName</span>
                  <span className="font-semibold">
                    {order.customerName ?? "—"}
                  </span>
                </div>
              </div>
              {order.shipToAddress && (
                <div>
                  <span className="text-muted-foreground block">Endereço</span>
                  <span>{order.shipToAddress}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <span className="text-muted-foreground block">DocTotal</span>
                  <span className="text-xl font-bold text-primary">
                    {fmt(order.docTotal, order.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">DocCurrency</span>
                  <span className="font-mono">{order.currency ?? "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Criado em</span>
                <span>{fmtDate(order.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Atualizado em</span>
                <span>{fmtDate(order.updatedAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">SLA / DocDueDate</span>
                <span>{fmtDate(order.slaDueAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Itens (DocumentLines) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              Itens — DocumentLines ({order.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">ItemCode (SKU)</th>
                    <th className="text-left py-2 pr-4">Descrição</th>
                    <th className="text-right py-2 pr-4">Qty</th>
                    <th className="text-left py-2 pr-4">
                      <span className="flex items-center gap-1">
                        <Warehouse className="h-3 w-3" />
                        Armazém
                      </span>
                    </th>
                    <th className="text-right py-2 pr-4">Preço Unit.</th>
                    <th className="text-right py-2">Total Linha</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.items.map((item, idx) => {
                    const lineTotal =
                      item.lineTotal != null ? Number(item.lineTotal) : undefined;
                    const price =
                      item.price != null ? Number(item.price) : undefined;
                    return (
                      <tr
                        key={`${item.sku}-${idx}`}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 pr-4 text-muted-foreground">
                          {idx}
                        </td>
                        <td className="py-3 pr-4 font-mono font-semibold">
                          {item.sku}
                        </td>
                        <td className="py-3 pr-4 max-w-[200px] truncate">
                          {item.description ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold">
                          {item.quantity}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.warehouse ?? "—"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {price != null ? fmt(price, order.currency) : "—"}
                        </td>
                        <td className="py-3 text-right font-semibold">
                          {lineTotal != null
                            ? fmt(lineTotal, order.currency)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {order.docTotal != null && (
              <>
                <Separator className="my-4" />
                <div className="flex justify-end gap-6">
                  <div className="text-right">
                    <span className="text-xs uppercase text-muted-foreground block">
                      DocTotal
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      {fmt(order.docTotal, order.currency)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Metadata / campos extras */}
        {Object.keys(meta).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Metadata (campos extras SAP)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                {Object.entries(meta).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between border-b border-dashed pb-1"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {key}
                    </span>
                    <span className="font-medium truncate ml-4 max-w-[60%] text-right">
                      {value == null ? "—" : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
