"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart/context";
import { useQuery } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Package,
  Bell,
  Check,
} from "lucide-react";

interface CatalogProduct {
  id: number;
  sap_item_code: string;
  sap_item_name: string;
  image_url: string | null;
  image_thumb_url: string | null;
  category_name: string | null;
  description_short: string | null;
  ean: string | null;
  unit_of_measure: string;
  total_stock: number;
  is_in_stock: boolean;
  match_score: number;
  gsn_product_name: string | null;
  gsn_slug: string | null;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = use(params);
  const [qty, setQty] = useState(1);
  const { addItem, getItem } = useCart();

  const { data: product, isLoading } = useQuery<CatalogProduct>({
    queryKey: ["b2b-catalog-product", sku],
    queryFn: () => get(`/b2b/catalog/${sku}`),
  });

  const inCart = getItem(sku);

  function handleAddToCart() {
    if (!product) return;
    addItem(
      {
        sku: product.sap_item_code,
        name: product.sap_item_name,
        unit: product.unit_of_measure,
      },
      qty,
    );
    toast.success(`${product.sap_item_name} adicionado ao carrinho`, {
      description: `${qty} ${product.unit_of_measure}`,
    });
  }

  async function handleNotify() {
    try {
      await post(`/b2b/catalog/${sku}/notify`, {});
      toast.success("Cadastrado com sucesso!", {
        description:
          "Voce sera notificado quando este produto estiver disponivel.",
      });
    } catch {
      toast.error("Erro ao cadastrar notificacao");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/catalogo"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-gsn-brand mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao catalogo
        </Link>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <Skeleton className="h-96 rounded-lg" />
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : !product ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold">
                Produto nao encontrado
              </h2>
              <p className="text-muted-foreground mt-1">SKU: {sku}</p>
              <Link href="/catalogo">
                <Button variant="outline" className="mt-4">
                  Voltar ao catalogo
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Image */}
                <div className="relative bg-gray-50 rounded-lg flex items-center justify-center min-h-[320px] overflow-hidden">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.sap_item_name}
                      width={500}
                      height={500}
                      className="object-contain max-h-[480px] w-auto p-6"
                      priority
                    />
                  ) : (
                    <Package className="h-24 w-24 text-muted-foreground/20" />
                  )}
                  {!product.is_in_stock && (
                    <Badge className="absolute top-4 left-4 bg-red-600 text-white border-0 shadow-md text-sm px-3 py-1">
                      Sem estoque
                    </Badge>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col">
                  <h1 className="text-2xl font-bold text-gsn-text">
                    {product.sap_item_name}
                  </h1>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    SKU: {product.sap_item_code}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="outline">{product.unit_of_measure}</Badge>
                    {product.category_name && (
                      <Badge variant="outline">{product.category_name}</Badge>
                    )}
                    {product.ean && (
                      <Badge variant="outline" className="font-mono">
                        EAN: {product.ean}
                      </Badge>
                    )}
                    {product.is_in_stock ? (
                      <Badge className="bg-green-600 text-white border-0">
                        Em estoque ({Math.floor(product.total_stock)})
                      </Badge>
                    ) : (
                      <Badge className="bg-red-600 text-white border-0">
                        Indisponivel
                      </Badge>
                    )}
                  </div>

                  {product.description_short && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-gsn-text mb-1">
                        Descricao
                      </h3>
                      <p
                        className="text-sm text-muted-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: product.description_short,
                        }}
                      />
                    </div>
                  )}

                  {inCart && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-gsn-brand">
                      <Check className="h-4 w-4" />
                      Ja esta no carrinho ({inCart.quantity}{" "}
                      {product.unit_of_measure})
                    </div>
                  )}

                  <div className="mt-auto pt-6">
                    {product.is_in_stock ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center rounded-md border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-r-none"
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-14 text-center text-base font-medium">
                            {qty}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-l-none"
                            onClick={() => setQty((q) => q + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          className="flex-1 bg-gsn-brand hover:bg-gsn-brand-dark text-white h-10"
                          onClick={handleAddToCart}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Adicionar ao carrinho
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-amber-500 text-amber-600 hover:bg-amber-50 h-10"
                        onClick={handleNotify}
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        Avise-me quando disponivel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
