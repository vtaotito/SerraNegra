"use client";

import { useAuth } from "@/lib/auth/context";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import {
  ClipboardList,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { FEATURED_PRODUCTS } from "@/lib/product-images";

interface DashboardData {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  recentOrders: Array<{
    orderId: string;
    externalOrderId: string;
    sapDocEntry: number;
    sapDocNum: number;
    status: string;
    docTotal?: number;
    currency?: string;
    createdAt: string;
    items: Array<{ sku: string; quantity: number }>;
  }>;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "destructive" }> = {
  A_SEPARAR: { label: "A Separar", variant: "info" },
  EM_SEPARACAO: { label: "Em Separacao", variant: "warning" },
  CONFERIDO: { label: "Conferido", variant: "secondary" },
  AGUARDANDO_COTACAO: { label: "Aguardando Cotacao", variant: "warning" },
  AGUARDANDO_COLETA: { label: "Aguardando Coleta", variant: "success" },
  DESPACHADO: { label: "Despachado", variant: "success" },
};

export default function DashboardPage() {
  const { customer } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["b2b-dashboard"],
    queryFn: () => get("/b2b/dashboard"),
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-gsn-text">
              Ola, {customer?.cardName?.split(" ")[0] ?? "Cliente"}
            </h1>
            <p className="text-muted-foreground">
              Acompanhe seus pedidos e faca novas compras
            </p>
          </div>

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total de Pedidos"
              value={data?.totalOrders}
              icon={ClipboardList}
              isLoading={isLoading}
            />
            <KPICard
              title="Em Andamento"
              value={
                data
                  ? (data.ordersByStatus["A_SEPARAR"] ?? 0) +
                    (data.ordersByStatus["EM_SEPARACAO"] ?? 0)
                  : undefined
              }
              icon={Clock}
              isLoading={isLoading}
              color="text-amber-600"
            />
            <KPICard
              title="Despachados"
              value={data?.ordersByStatus["DESPACHADO"]}
              icon={CheckCircle2}
              isLoading={isLoading}
              color="text-gsn-green-dark"
            />
            <KPICard
              title="Itens no Carrinho"
              value={0}
              icon={ShoppingCart}
              isLoading={false}
              color="text-gsn-green"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/catalogo">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-green/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gsn-green/10 text-gsn-green group-hover:bg-gsn-green group-hover:text-white transition-colors">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Ver Catalogo</h3>
                    <p className="text-sm text-muted-foreground">Explore nossos produtos</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gsn-green transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/pedidos">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-green/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gsn-green/10 text-gsn-green-dark group-hover:bg-gsn-green-dark group-hover:text-white transition-colors">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Meus Pedidos</h3>
                    <p className="text-sm text-muted-foreground">Acompanhe seus pedidos</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gsn-green-dark transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/carrinho">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-green/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Novo Pedido</h3>
                    <p className="text-sm text-muted-foreground">Monte seu pedido</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Produtos em Destaque */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base text-gsn-text">Produtos em Destaque</CardTitle>
              <Link href="/catalogo">
                <Button variant="ghost" size="sm" className="text-gsn-green hover:text-gsn-green-dark">
                  Ver catalogo <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {FEATURED_PRODUCTS.map((product) => (
                  <Link key={product.name} href="/catalogo" className="group">
                    <div className="rounded-lg border bg-gray-50 p-3 transition-all hover:shadow-md hover:border-gsn-green/30 text-center">
                      <div className="relative h-24 mb-2">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-contain group-hover:scale-105 transition-transform"
                          sizes="150px"
                        />
                        {product.discount && (
                          <span className="absolute -top-1 -right-1 bg-gsn-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            -{product.discount}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium line-clamp-2 text-gsn-text leading-tight">
                        {product.name}
                      </p>
                      <p className="text-xs font-bold text-gsn-green-dark mt-1">
                        {product.price}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pedidos Recentes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base text-gsn-text">Pedidos Recentes</CardTitle>
              <Link href="/pedidos">
                <Button variant="ghost" size="sm" className="text-gsn-green hover:text-gsn-green-dark">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !data?.recentOrders?.length ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
                  <Link href="/catalogo" className="mt-3">
                    <Button variant="outline" size="sm" className="border-gsn-green text-gsn-green-dark hover:bg-gsn-green/10">
                      Fazer primeiro pedido
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentOrders.map((order) => (
                    <Link
                      key={order.orderId}
                      href={`/pedidos/${order.sapDocEntry}`}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gsn-text">Pedido #{order.sapDocNum}</span>
                          <Badge variant={STATUS_MAP[order.status]?.variant ?? "secondary"}>
                            {STATUS_MAP[order.status]?.label ?? order.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)} &middot; {order.items.length} item(ns)
                        </p>
                      </div>
                      {order.docTotal != null && (
                        <span className="text-sm font-semibold text-gsn-green-dark">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: order.currency ?? "BRL",
                          }).format(order.docTotal)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function KPICard({
  title,
  value,
  icon: Icon,
  isLoading,
  color,
}: {
  title: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-muted", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          {isLoading ? (
            <Skeleton className="h-7 w-12 mb-1" />
          ) : (
            <p className="text-2xl font-bold">{value ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
