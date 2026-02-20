"use client";

import { useState } from "react";
import Image from "next/image";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart/context";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Package,
  Check,
} from "lucide-react";
import { getProductImageUrl } from "@/lib/product-images";

interface Product {
  sku: string;
  name: string;
  ean: string | null;
  unit: string;
  group: number | null;
  active: boolean;
}

interface ProductsResponse {
  items: Product[];
  total: number;
}

export default function CatalogoPage() {
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { addItem, getItem } = useCart();

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["b2b-products", search],
    queryFn: () => get(`/b2b/products?search=${encodeURIComponent(search)}&limit=100`),
    placeholderData: (prev) => prev,
  });

  function handleQuantityChange(sku: string, delta: number) {
    setQuantities((prev) => {
      const current = prev[sku] ?? 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [sku]: next };
    });
  }

  function handleAddToCart(product: Product) {
    const qty = quantities[product.sku] ?? 1;
    addItem({ sku: product.sku, name: product.name, unit: product.unit }, qty);
    toast.success(`${product.name} adicionado ao carrinho`, {
      description: `${qty} ${product.unit}`,
    });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gsn-text">Catalogo de Produtos</h1>
              <p className="text-muted-foreground">
                {data ? `${data.total} produto(s) disponivel(eis)` : "Carregando..."}
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, codigo ou EAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-full mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.items?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? "Tente outro termo de busca" : "Nenhum produto disponivel no momento"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((product) => {
                const qty = quantities[product.sku] ?? 1;
                const inCart = getItem(product.sku);
                const imageUrl = getProductImageUrl(product.name);

                return (
                  <Card
                    key={product.sku}
                    className="flex flex-col transition-all hover:shadow-lg group overflow-hidden"
                  >
                    <div className="relative bg-gray-50 flex items-center justify-center h-48 overflow-hidden">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={product.name}
                          width={280}
                          height={280}
                          className="object-contain h-full w-full p-4 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground/30">
                          <Package className="h-16 w-16" />
                        </div>
                      )}
                      {inCart && (
                        <Badge className="absolute top-2 right-2 bg-gsn-brand text-white border-0 shadow-md">
                          <Check className="h-3 w-3 mr-1" />
                          No carrinho
                        </Badge>
                      )}
                    </div>

                    <CardContent className="flex flex-col flex-1 p-4">
                      <div className="mb-3 min-h-[3rem]">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-gsn-text">
                          {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {product.sku}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Badge variant="outline" className="text-xs">
                          {product.unit}
                        </Badge>
                        {product.ean && (
                          <Badge variant="outline" className="text-xs font-mono">
                            EAN: {product.ean}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-auto flex items-center gap-2">
                        <div className="flex items-center rounded-md border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-r-none"
                            onClick={() => handleQuantityChange(product.sku, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-10 text-center text-sm font-medium">{qty}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-l-none"
                            onClick={() => handleQuantityChange(product.sku, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          className="flex-1 bg-gsn-brand hover:bg-gsn-brand-dark text-white"
                          onClick={() => handleAddToCart(product)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Adicionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
