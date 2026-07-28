"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeaturedProductCard } from "@/components/catalog/FeaturedProductCard";
import { ClientEmptyState } from "@/components/ui/client-empty-state";
import { useFavorites } from "@/lib/favorites/useFavorites";
import { Heart, Package } from "lucide-react";

export default function FavoritosPage() {
  const { items, isLoading, isError } = useFavorites();

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Favoritos" },
          ]}
          className="mb-4"
        />

        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gsn-text sm:text-3xl">
              <Heart className="h-7 w-7 text-gsn-brand" />
              Favoritos
            </h1>
            <p className="text-muted-foreground">
              Seus produtos salvos para recompra rápida
            </p>
          </div>
          {!isLoading && items.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{items.length}</strong>{" "}
              produto{items.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-0">
              <ClientEmptyState
                icon={Heart}
                title="Não foi possível carregar"
                description="Tente novamente em instantes."
              />
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <ClientEmptyState
                icon={Heart}
                title="Nenhum favorito ainda"
                description="Favorite produtos no catálogo para vê-los aqui e acelerar a recompra."
                action={
                  <Link href="/catalogo">
                    <Button className="bg-[var(--gsn-brand)] text-white hover:bg-[var(--gsn-brand-dark)]">
                      <Package className="mr-1.5 h-4 w-4" />
                      Explorar catálogo
                    </Button>
                  </Link>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => (
              <FeaturedProductCard
                key={item.sku}
                product={{
                  sku: item.sku,
                  name: item.name,
                  imageUrl: item.imageUrl,
                  imageThumbUrl: item.imageThumbUrl,
                  inStock: item.inStock,
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
