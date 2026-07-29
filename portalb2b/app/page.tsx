"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { useCart } from "@/lib/cart/context";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import {
  getDocumentTitle,
  getOrderStatusConfig,
  isQuotationLike,
  type OrderSummary,
} from "@/lib/orders";
import { useFavorites } from "@/lib/favorites/useFavorites";
import { FeaturedProductCard, type FeaturedProduct } from "@/components/catalog/FeaturedProductCard";
import Link from "next/link";
import { SalespersonCard } from "@/components/salesperson/SalespersonCard";
import {
  ClipboardList,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Heart,
  Repeat,
  ListOrdered,
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

interface FrequentItem {
  sku: string;
  name: string;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  inStock: boolean;
  orderCount: number;
}

interface FrequentResponse {
  items: FrequentItem[];
}

export default function DashboardPage() {
  const { customer } = useAuth();
  const { totalItems } = useCart();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["b2b-dashboard"],
    queryFn: () => get("/b2b/dashboard"),
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
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-gsn-text">
              Olá, {customer?.cardName?.split(" ")[0] ?? "Cliente"}
            </h1>
            <p className="text-muted-foreground">
              Acompanhe seus pedidos e faça novas compras
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/catalogo">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-brand/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gsn-brand/10 text-gsn-brand group-hover:bg-gsn-brand group-hover:text-white transition-colors">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Ver Catálogo</h3>
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

            <Link href={totalItems > 0 ? "/carrinho" : "/catalogo"}>
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-brand/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Novo Pedido</h3>
                    <p className="text-sm text-muted-foreground">
                      {totalItems > 0 ? "Continuar no carrinho" : "Monte seu pedido"}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/listas">
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-gsn-brand/30">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gsn-brand/10 text-gsn-brand group-hover:bg-gsn-brand group-hover:text-white transition-colors">
                    <ListOrdered className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gsn-text">Listas de compra</h3>
                    <p className="text-sm text-muted-foreground">Modelos para repor rápido</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gsn-brand transition-colors" />
                </CardContent>
              </Card>
            </Link>
          </div>

          <SalespersonCard />

          {/* Produtos em Destaque: Favoritos + Mais comprados (fallback catálogo) */}
          <FeaturedSection />

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
                              {getDocumentTitle(order)}
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

                    if (isQuotationLike(order) || order.pending) {
                      return (
                        <div
                          key={order.docEntry}
                          className="flex items-center justify-between rounded-lg border border-sky-100 bg-sky-50/30 p-4"
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
      <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
        <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-7 w-12 mb-1" />
          ) : (
            <p className="text-xl font-bold sm:text-2xl">{value ?? 0}</p>
          )}
          <p className="text-xs leading-tight text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

type FeaturedTab = "favoritos" | "frequentes";

function FeaturedSection() {
  const { items: favorites, isLoading: loadingFav } = useFavorites();
  const { data: frequent, isLoading: loadingFreq } = useQuery<FrequentResponse>({
    queryKey: ["b2b-frequent"],
    queryFn: () => get("/b2b/catalog/frequent"),
    staleTime: 60_000 * 5,
  });
  const { data: fallback, isLoading: loadingFallback } = useQuery<CatalogResponse>({
    queryKey: ["b2b-featured"],
    queryFn: () => get("/b2b/catalog?inStock=true&limit=6"),
    staleTime: 60_000 * 5,
  });

  const [tabOverride, setTabOverride] = useState<FeaturedTab | null>(null);

  const hasFavorites = favorites.length > 0;
  const hasFrequent = (frequent?.items?.length ?? 0) > 0;
  const showTabs = hasFavorites || hasFrequent;

  const loading = loadingFav || loadingFreq || (!showTabs && loadingFallback);

  const autoTab: FeaturedTab = hasFavorites ? "favoritos" : "frequentes";
  const tab = tabOverride ?? autoTab;

  const products: FeaturedProduct[] =
    tab === "favoritos"
      ? favorites.map((f) => ({
          sku: f.sku,
          name: f.name,
          imageUrl: f.imageUrl,
          imageThumbUrl: f.imageThumbUrl,
          inStock: f.inStock,
        }))
      : (frequent?.items ?? []).map((f) => ({
          sku: f.sku,
          name: f.name,
          imageUrl: f.imageUrl,
          imageThumbUrl: f.imageThumbUrl,
          inStock: f.inStock,
          orderCount: f.orderCount,
        }));

  const fallbackProducts: FeaturedProduct[] = (fallback?.items ?? []).map((p) => ({
    sku: p.sku,
    name: p.name,
    imageUrl: p.imageUrl,
    inStock: p.inStock,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-gsn-text">Produtos em Destaque</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {showTabs && (
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                <TabButton
                  active={tab === "favoritos"}
                  onClick={() => setTabOverride("favoritos")}
                  icon={Heart}
                  label="Favoritos"
                />
                <TabButton
                  active={tab === "frequentes"}
                  onClick={() => setTabOverride("frequentes")}
                  icon={Repeat}
                  label="Mais comprados"
                />
              </div>
            )}
            <Link href={tab === "favoritos" && hasFavorites ? "/favoritos" : "/catalogo"}>
              <Button variant="ghost" size="sm" className="text-gsn-brand hover:text-gsn-brand-dark">
                {tab === "favoritos" && hasFavorites ? "Ver todos" : "Ver catálogo"}{" "}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : !showTabs ? (
          fallbackProducts.length ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Favorite produtos no catálogo para vê-los aqui. Enquanto isso, confira o que está disponível:
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {fallbackProducts.map((p) => (
                  <FeaturedProductCard key={p.sku} product={p} />
                ))}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum produto disponível no momento.
            </p>
          )
        ) : products.length ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {products.slice(0, 6).map((p) => (
                <FeaturedProductCard key={p.sku} product={p} />
              ))}
            </div>
            {tab === "favoritos" && favorites.length > 6 && (
              <div className="mt-4 flex justify-center">
                <Link href="/favoritos">
                  <Button variant="outline" size="sm" className="border-gsn-brand text-gsn-brand-dark hover:bg-gsn-brand/10">
                    Ver todos os {favorites.length} favoritos
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            {tab === "favoritos" ? (
              <>
                <Heart className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Você ainda não favoritou nenhum produto.
                </p>
              </>
            ) : (
              <>
                <Repeat className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Você ainda não tem histórico de compras.
                </p>
              </>
            )}
            <Link href="/catalogo" className="mt-3">
              <Button variant="outline" size="sm" className="border-gsn-brand text-gsn-brand-dark hover:bg-gsn-brand/10">
                Explorar catálogo
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
        active
          ? "bg-white text-gsn-brand-dark shadow-sm"
          : "text-muted-foreground hover:text-gsn-text",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
