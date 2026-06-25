"use client";

import { useAuth } from "@/lib/auth/context";
import { useCart } from "@/lib/cart/context";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getOrderStatusConfig, type OrderSummary } from "@/lib/orders";
import { getProductImageBySku } from "@/lib/product-images";
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

interface DashboardData {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  recentOrders: OrderSummary[];
}

interface CatalogProduct {
  sku: string;
  name: string;
  imageUrl: string | null;
  inStock: boolean;
}

interface CatalogResponse {
  items: CatalogProduct[];
}

export default function DashboardPage() {
  const { customer } = useAuth();
  const { totalItems } = useCart();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["b2b-dashboard"],
    queryFn: () => get("/b2b/dashboard"),
  });

  const { data: featured, isLoading: loadingFeatured } = useQuery<CatalogResponse>({
    queryKey: ["b2b-featured"],
    queryFn: () => get("/b2b/catalog?inStock=true&limit=6"),
    staleTime: 60_000 * 5,
  });

  const byStatus = data?.ordersByStatus ?? {};
  const inProgress =
    (byStatus["novo"] ?? 0) +
    (byStatus["em_analise"] ?? 0) +
    (byStatus["separacao"] ?? 0) +
    (byStatus["faturado"] ?? 0) +
    (byStatus["enviado"] ?? 0);
  const delivered = byStatus["entregue"] ?? 0;

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
              value={data ? inProgress : undefined}
              icon={Clock}
              isLoading={isLoading}
              color="text-amber-600"
            />
            <KPICard
              title="Entregues"
              value={data ? delivered : undefined}
              icon={CheckCircle2}
              isLoading={isLoading}
              color="text-gsn-brand-dark"
            />
            <KPICard
              title="Itens no Carrinho"
              value={totalItems}
              icon={ShoppingCart}
              isLoading={false}
              color="text-gsn-brand"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/catalogo">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-brand/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gsn-brand/10 text-gsn-brand group-hover:bg-gsn-brand group-hover:text-white transition-colors">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Ver Catalogo</h3>
                    <p className="text-sm text-muted-foreground">Explore nossos produtos</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gsn-brand transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/pedidos">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-brand/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gsn-brand/10 text-gsn-brand-dark group-hover:bg-gsn-brand-dark group-hover:text-white transition-colors">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Meus Pedidos</h3>
                    <p className="text-sm text-muted-foreground">Acompanhe seus pedidos</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gsn-brand-dark transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/carrinho">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-brand/30">
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

          {/* Produtos em Destaque (catálogo real) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base text-gsn-text">Produtos em Destaque</CardTitle>
              <Link href="/catalogo">
                <Button variant="ghost" size="sm" className="text-gsn-brand hover:text-gsn-brand-dark">
                  Ver catalogo <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingFeatured ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 rounded-lg" />
                  ))}
                </div>
              ) : !featured?.items?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum produto disponivel no momento.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {featured.items.map((product) => {
                    const imgSrc = product.imageUrl ?? getProductImageBySku(product.sku);
                    return (
                    <Link key={product.sku} href={`/catalogo/${product.sku}`} className="group">
                      <div className="rounded-lg border bg-gray-50 p-3 transition-all hover:shadow-md hover:border-gsn-brand/30 text-center h-full flex flex-col">
                        <div className="relative h-24 mb-2 flex items-center justify-center">
                          {imgSrc ? (
                            <Image
                              src={imgSrc}
                              alt={product.name}
                              fill
                              className="object-contain group-hover:scale-105 transition-transform"
                              sizes="150px"
                            />
                          ) : (
                            <Package className="h-10 w-10 text-muted-foreground/20" />
                          )}
                        </div>
                        <p className="text-xs font-medium line-clamp-2 text-gsn-text leading-tight mt-auto">
                          {product.name}
                        </p>
                      </div>
                    </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pedidos Recentes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base text-gsn-text">Pedidos Recentes</CardTitle>
              <Link href="/pedidos">
                <Button variant="ghost" size="sm" className="text-gsn-brand hover:text-gsn-brand-dark">
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
                    <Button variant="outline" size="sm" className="border-gsn-brand text-gsn-brand-dark hover:bg-gsn-brand/10">
                      Fazer primeiro pedido
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentOrders.map((order) => {
                    const cfg = getOrderStatusConfig(order.status);
                    const inner = (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gsn-text">
                              {order.pending ? `Solicitação #${order.docNum}` : `Pedido #${order.docNum}`}
                            </span>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(order.createdAt)} &middot; {order.itemCount} item(ns)
                          </p>
                        </div>
                        {order.docTotal != null && (
                          <span className="text-sm font-semibold text-gsn-brand-dark">
                            {formatCurrency(order.docTotal, order.currency ?? "BRL")}
                          </span>
                        )}
                      </>
                    );

                    if (order.pending) {
                      return (
                        <div
                          key={order.docEntry}
                          className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/30 p-4"
                        >
                          {inner}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={order.docEntry}
                        href={`/pedidos/${order.docEntry}`}
                        className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                      >
                        {inner}
                      </Link>
                    );
                  })}
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
