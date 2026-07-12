"use client";

import { use, useEffect, useState } from "react";
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
import { getProductImageUrl, getProductImageBySku } from "@/lib/product-images";
import {
  type UnifiedProductDetail,
  type PackagingVariant,
  packagingLabel,
  packagingShort,
  packagingTypeName,
  groupColor,
  formatStockUnits,
  packStep,
  maxOrderableUnits,
} from "@/lib/catalog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/components/catalog/FavoriteButton";
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

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = use(params);
  const [qty, setQty] = useState(1);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const { addItem, getItem } = useCart();

  const { data: product, isLoading } = useQuery<UnifiedProductDetail>({
    queryKey: ["b2b-catalog-unified-product", sku],
    queryFn: () => get(`/b2b/catalog/unified/${encodeURIComponent(sku)}`),
  });

  // A variante inicialmente selecionada é a do SKU da URL (ou a padrão).
  useEffect(() => {
    if (!product) return;
    const exists = product.variants.find((v) => v.sku === sku);
    setSelectedSku(exists?.sku ?? product.sku);
  }, [product, sku]);

  const variant: PackagingVariant | undefined =
    product?.variants.find((v) => v.sku === selectedSku) ??
    product?.variants.find((v) => v.sku === product?.sku) ??
    product?.variants[0];

  const perPack = variant ? packStep(variant.unitsPerPack) : 1;
  const inCart = variant ? getItem(variant.sku) : undefined;
  const imgSrc = product ? product.imageUrl ?? getProductImageBySku(product.sku) ?? getProductImageUrl(product.name) : null;
  const gColor = product ? groupColor(product.groupCode) : "#A81C2C";

  // Limite de pedido: estoque disponível (em embalagens inteiras) menos o que
  // já está no carrinho desta variante.
  const maxUnits = variant ? maxOrderableUnits(variant) : 0;
  const inCartUnits = inCart?.quantity ?? 0;
  const remainingUnits = Math.max(0, maxUnits - inCartUnits);
  const remainingPacks = Math.floor(remainingUnits / perPack);
  const effQty = Math.min(qty, Math.max(1, remainingPacks));
  const totalUnits = effQty * perPack;
  const atMax = effQty >= remainingPacks;
  const canAdd = remainingPacks >= 1;

  function handleAddToCart() {
    if (!product || !variant) return;
    if (remainingPacks < 1) {
      toast.info("Estoque máximo já no carrinho", {
        description: `Você já tem ${formatStockUnits(inCartUnits)} ${variant.unitOfMeasure} — todo o estoque disponível.`,
      });
      return;
    }
    const label = packagingLabel(variant.packagingType, variant.unitsPerPack);
    const displayName =
      variant.unitsPerPack > 1 ? `${product.name} — ${label}` : product.name;
    const addPacks = Math.min(effQty, remainingPacks);
    const addUnits = addPacks * perPack;
    addItem(
      {
        sku: variant.sku,
        name: displayName,
        unit: variant.unitOfMeasure,
        unitsPerPack: perPack,
        maxUnits,
      },
      addUnits,
    );
    const desc =
      perPack > 1
        ? `${addPacks} ${label} = ${addUnits} ${variant.unitOfMeasure}`
        : `${addUnits} ${variant.unitOfMeasure}`;
    toast.success(`${product.name} adicionado ao carrinho`, { description: desc });
  }

  async function handleNotify() {
    if (!variant) return;
    try {
      await post(`/b2b/catalog/${variant.sku}/notify`, {});
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
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 md:pb-8">
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
        ) : !product || !variant ? (
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
                <div className="relative bg-white rounded-lg flex items-center justify-center min-h-[320px] overflow-hidden">
                  {imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={product.name}
                      width={500}
                      height={500}
                      className="object-contain max-h-[480px] w-auto p-6"
                      priority
                    />
                  ) : (
                    <Package className="h-24 w-24 text-muted-foreground/20" />
                  )}
                  {!variant.inStock && (
                    <Badge className="absolute top-4 left-4 bg-red-600 text-white border-0 shadow-md text-sm px-3 py-1">
                      Sem estoque
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h1 className="text-2xl font-bold text-gsn-text">
                      {product.name}
                    </h1>
                    <FavoriteButton
                      sku={variant.sku}
                      variant="inline"
                      className="-mt-1 shrink-0"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    SKU: {variant.sku}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {product.category && (
                      <Badge
                        variant="outline"
                        style={{ borderColor: `${gColor}55`, color: gColor }}
                      >
                        {product.category}
                      </Badge>
                    )}
                    {product.capacity && (
                      <Badge variant="outline" className="text-sky-700 border-sky-200">
                        {product.capacity}
                      </Badge>
                    )}
                    {product.color && (
                      <Badge variant="outline">{product.color}</Badge>
                    )}
                    {product.closure && (
                      <Badge variant="outline" className="text-violet-700 border-violet-200">
                        {product.closure}
                      </Badge>
                    )}
                    {product.ean && (
                      <Badge variant="outline" className="font-mono">
                        EAN: {product.ean}
                      </Badge>
                    )}
                    {variant.inStock ? (
                      <Badge className="bg-green-600 text-white border-0">
                        Em estoque · {formatStockUnits(variant.stockUnits)} {variant.unitOfMeasure}
                      </Badge>
                    ) : (
                      <Badge className="bg-red-600 text-white border-0">
                        Indisponivel
                      </Badge>
                    )}
                  </div>

                  {/* Seletor de embalagem */}
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold text-gsn-text mb-2 flex items-center gap-1.5">
                      <Box className="h-4 w-4 text-amber-700" />
                      {product.variants.length > 1
                        ? "Escolha a embalagem"
                        : "Embalagem"}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((v) => {
                        const isSelected = v.sku === variant.sku;
                        return (
                          <button
                            key={v.sku}
                            onClick={() => { setSelectedSku(v.sku); setQty(1); }}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                              isSelected
                                ? "border-gsn-brand bg-gsn-brand/10 text-gsn-brand"
                                : "border-border bg-white text-muted-foreground hover:border-foreground/30",
                              !v.inStock && "opacity-60",
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                v.inStock ? "bg-emerald-500" : "bg-red-400",
                              )}
                            />
                            {packagingLabel(v.packagingType, v.unitsPerPack)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalhe da embalagem selecionada */}
                  {perPack > 1 && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-amber-700">Tipo</p>
                          <p className="font-semibold text-amber-900">
                            {packagingShort(variant.packagingType, variant.unitsPerPack)}
                          </p>
                        </div>
                        <div>
                          <p className="text-amber-700">Unidades por embalagem</p>
                          <p className="font-semibold text-amber-900">
                            {perPack} {variant.unitOfMeasure}
                          </p>
                        </div>
                        {variant.inStock && (
                          <div className="col-span-2 border-t border-amber-200 pt-3">
                            <p className="text-amber-700">Disponível</p>
                            <p className="font-semibold text-amber-900">
                              {formatStockUnits(variant.stockUnits)} {variant.unitOfMeasure}
                              {variant.stockQuantity >= 1 && (
                                <span className="font-normal text-amber-700">
                                  {" "}· {Math.floor(variant.stockQuantity)}{" "}
                                  {packagingTypeName(variant.packagingType).toLowerCase()}
                                  {Math.floor(variant.stockQuantity) !== 1 ? "s" : ""}
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(product.fullDescription || product.description) && (
                    <div className="mt-5">
                      <h3 className="text-sm font-semibold text-gsn-text mb-1">
                        Descricao
                      </h3>
                      <div
                        className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: product.fullDescription || product.description,
                        }}
                      />
                    </div>
                  )}

                  {inCart && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-gsn-brand">
                      <Check className="h-4 w-4" />
                      Ja esta no carrinho ({inCart.quantity}{" "}
                      {variant.unitOfMeasure})
                    </div>
                  )}

                  <div className="mt-auto pt-6">
                    {variant.inStock ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center rounded-md border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-r-none"
                              disabled={!canAdd || effQty <= 1}
                              onClick={() => setQty((q) => Math.max(1, q - 1))}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-14 text-center text-base font-medium">
                              {canAdd ? effQty : 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-l-none"
                              disabled={!canAdd || atMax}
                              onClick={() =>
                                setQty((q) => Math.min(remainingPacks, q + 1))
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {perPack > 1
                              ? packagingShort(variant.packagingType, variant.unitsPerPack)
                              : variant.unitOfMeasure}
                          </span>
                        </div>

                        {perPack > 1 && canAdd && (
                          <div className="rounded-md bg-muted px-3 py-2 text-sm">
                            <span className="text-muted-foreground">Total: </span>
                            <span className="font-semibold text-gsn-text">
                              {totalUnits} {variant.unitOfMeasure}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}({effQty} x {perPack} un)
                            </span>
                          </div>
                        )}

                        {atMax && canAdd && (
                          <p className="text-xs text-amber-600">
                            Quantidade máxima disponível em estoque
                            {inCartUnits > 0 ? " (considerando o carrinho)" : ""}.
                          </p>
                        )}

                        <Button
                          className="w-full bg-gsn-brand hover:bg-gsn-brand-dark text-white h-10"
                          disabled={!canAdd}
                          onClick={handleAddToCart}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {canAdd ? "Adicionar ao carrinho" : "Máximo no carrinho"}
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
