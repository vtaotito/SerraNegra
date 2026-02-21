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
  Box,
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
  packaging_type: string | null;
  units_per_package: number | null;
  total_stock: number;
  is_in_stock: boolean;
  match_score: number;
  gsn_product_name: string | null;
  gsn_slug: string | null;
}

function packagingLabel(type: string | null): string {
  if (!type) return "Unidade";
  const t = type.toLowerCase().trim();
  if (t.includes("cx") || t.includes("caixa")) return "Caixa";
  if (t.includes("frd") || t.includes("fardo")) return "Fardo";
  if (t.includes("plt") || t.includes("palet") || t.includes("pallet")) return "Palet";
  if (t.includes("sc") || t.includes("saco")) return "Saco";
  if (t.includes("pct") || t.includes("pcte") || t.includes("pacote")) return "Pacote";
  if (t.includes("dz") || t.includes("duzia")) return "Duzia";
  if (t.includes("un")) return "Unidade";
  return type;
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

  const hasPack =
    product?.units_per_package != null && product.units_per_package > 1;
  const packLabel = hasPack ? packagingLabel(product?.packaging_type ?? null) : "";
  const totalUnits = hasPack ? qty * product!.units_per_package! : qty;

  function handleAddToCart() {
    if (!product) return;
    addItem(
      {
        sku: product.sap_item_code,
        name: product.sap_item_name,
        unit: product.unit_of_measure,
      },
      totalUnits,
    );
    const desc = hasPack
      ? `${qty} ${packLabel}(s) = ${totalUnits} ${product.unit_of_measure}`
      : `${qty} ${product.unit_of_measure}`;
    toast.success(`${product.sap_item_name} adicionado ao carrinho`, {
      description: desc,
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
              <h2 className="text-xl font-semibold">Produto nao encontrado</h2>
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

                <div className="flex flex-col">
                  <h1 className="text-2xl font-bold text-gsn-text">
                    {product.sap_item_name}
                  </h1>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    SKU: {product.sap_item_code}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
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

                  {/* Packaging info */}
                  {hasPack && (
                    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Box className="h-5 w-5 text-amber-700" />
                        <h3 className="font-semibold text-sm text-amber-900">
                          Embalagem
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-amber-700">Tipo</p>
                          <p className="font-semibold text-amber-900">
                            {packLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-amber-700">Unidades por {packLabel.toLowerCase()}</p>
                          <p className="font-semibold text-amber-900">
                            {product.units_per_package} {product.unit_of_measure}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {product.description_short && (
                    <div className="mt-5">
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
                      <div className="space-y-3">
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
                          <span className="text-sm text-muted-foreground">
                            {hasPack ? packLabel : product.unit_of_measure}
                          </span>
                        </div>

                        {hasPack && (
                          <div className="rounded-md bg-muted px-3 py-2 text-sm">
                            <span className="text-muted-foreground">Total: </span>
                            <span className="font-semibold text-gsn-text">
                              {totalUnits} {product.unit_of_measure}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}({qty} x {product.units_per_package} un)
                            </span>
                          </div>
                        )}

                        <Button
                          className="w-full bg-gsn-brand hover:bg-gsn-brand-dark text-white h-10"
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
