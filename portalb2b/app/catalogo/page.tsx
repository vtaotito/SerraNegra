"use client";

import { useState } from "react";
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
              <h1 className="text-2xl font-bold tracking-tight">Catalogo de Produtos</h1>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((product) => {
                const qty = quantities[product.sku] ?? 1;
                const inCart = getItem(product.sku);

                return (
                  <Card
                    key={product.sku}
                    className="flex flex-col transition-all hover:shadow-md"
                  >
                    <CardContent className="flex flex-col flex-1 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                            {product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {product.sku}
                          </p>
                        </div>
                        {inCart && (
                          <Badge variant="success" className="ml-2 flex-shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            No carrinho
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
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
                          className="flex-1"
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
