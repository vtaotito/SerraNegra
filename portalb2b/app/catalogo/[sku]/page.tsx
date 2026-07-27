"use client";

import { use, useEffect, useMemo, useState } from "react";
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
  type AttributeVariant,
  packagingLabel,
  packagingShort,
  packagingTypeName,
  groupColor,
  formatStockUnits,
  packStep,
  maxOrderableUnits,
  availableColors,
  availableClosures,
  availablePackagings,
  resolveSku,
} from "@/lib/catalog";
import { AttributeSelector, type AttributeOption } from "@/components/catalog/AttributeSelector";
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
  Palette,
  Lock,
} from "lucide-react";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = use(params);
  const [qty, setQty] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedClosure, setSelectedClosure] = useState<string | null>(null);
  const [selectedPackagingSku, setSelectedPackagingSku] = useState<string | null>(null);
  const { addItem, getItem } = useCart();

  const { data: product, isLoading } = useQuery<UnifiedProductDetail>({
    queryKey: ["b2b-catalog-unified-product", sku],
    queryFn: () => get(`/b2b/catalog/unified/${encodeURIComponent(sku)}`),
  });

  const variants = useMemo(() => product?.variants ?? [], [product]);

  // Dimensões da cascata: cor → fechamento → embalagem.
  const colorOptionValues = useMemo(() => availableColors(variants), [variants]);
  const closureOptionValues = useMemo(
    () => availableClosures(variants, selectedColor),
    [variants, selectedColor],
  );
  // Cada card agora tem uma única cor e um único fechamento (a unificação é só
  // por embalagem), então só exibimos o seletor quando houver MAIS de uma opção
  // — na prática, nunca para garrafas. A cor/fechamento único é semeado abaixo e
  // aparece como badge.
  const hasColorDim = colorOptionValues.length > 1;
  const hasClosureDim = closureOptionValues.length > 1;

  const colorReady = !hasColorDim || !!selectedColor;
  const closureReady = !hasClosureDim || !!selectedClosure;

  const packagingVariants = useMemo(
    () => (colorReady && closureReady ? availablePackagings(variants, selectedColor, selectedClosure) : []),
    [variants, selectedColor, selectedClosure, colorReady, closureReady],
  );

  const resolvedSku = useMemo(
    () =>
      colorReady && closureReady
        ? resolveSku(variants, selectedColor, selectedClosure, selectedPackagingSku)
        : null,
    [variants, selectedColor, selectedClosure, selectedPackagingSku, colorReady, closureReady],
  );

  const variant: AttributeVariant | undefined = useMemo(
    () => (resolvedSku ? variants.find((v) => v.sku === resolvedSku) : undefined),
    [variants, resolvedSku],
  );

  // Semeia a seleção inicial a partir do SKU da URL (ou de dimensões únicas).
  useEffect(() => {
    if (!product) return;
    const urlVariant = product.variants.find((v) => v.sku === sku);
    const colors = availableColors(product.variants);
    const initColor = urlVariant?.color ?? (colors.length === 1 ? colors[0] : null);
    const closures = availableClosures(product.variants, initColor);
    const initClosure = urlVariant?.closure ?? (closures.length === 1 ? closures[0] : null);
    const packs = availablePackagings(product.variants, initColor, initClosure);
    const initPack =
      urlVariant?.sku ?? (packs.length === 1 ? packs[0].sku : null);
    setSelectedColor(initColor);
    setSelectedClosure(initClosure);
    setSelectedPackagingSku(initPack);
    setQty(1);
  }, [product, sku]);

  // Auto-seleciona o fechamento quando só há uma opção para a cor escolhida.
  useEffect(() => {
    if (!colorReady || selectedClosure) return;
    if (closureOptionValues.length === 1) setSelectedClosure(closureOptionValues[0]);
  }, [colorReady, selectedClosure, closureOptionValues]);

  // Auto-seleciona a embalagem quando só há uma para a combinação escolhida.
  useEffect(() => {
    if (!colorReady || !closureReady || selectedPackagingSku) return;
    if (packagingVariants.length === 1) setSelectedPackagingSku(packagingVariants[0].sku);
  }, [colorReady, closureReady, selectedPackagingSku, packagingVariants]);

  const perPack = variant ? packStep(variant.unitsPerPack) : 1;
  const inCart = variant ? getItem(variant.sku) : undefined;
  const gColor = product ? groupColor(product.groupCode) : "#A81C2C";

  // Imagem: prioriza a foto da variante da cor selecionada, senão a do modelo.
  const imgSrc = useMemo(() => {
    if (!product) return null;
    const colorImg = selectedColor
      ? product.variants.find((v) => v.color === selectedColor && v.imageUrl)?.imageUrl
      : null;
    return (
      colorImg ??
      product.imageUrl ??
      getProductImageBySku(product.sku) ??
      getProductImageUrl(product.name)
    );
  }, [product, selectedColor]);

  // Estoque disponível (em unidades) — apenas informativo. NÃO limita o pedido:
  // o cliente pode pedir acima do estoque; o excedente vira interação com o
  // vendedor (o pedido é sinalizado no painel e o portal orienta a contatá-lo).
  const availableUnits = variant ? maxOrderableUnits(variant) : 0;
  const inCartUnits = inCart?.quantity ?? 0;
  const effQty = Math.max(1, qty);
  const totalUnits = effQty * perPack;
  const canAdd = !!variant;
  // true quando o total (carrinho + este acréscimo) ultrapassa o estoque.
  const exceedsStock = !!variant && inCartUnits + totalUnits > availableUnits;

  // Opções para os seletores (cascata + estado de estoque/disponibilidade).
  const colorOptions: AttributeOption[] = colorOptionValues.map((c) => ({
    value: c,
    label: c,
    available: true,
    inStock: variants.some((v) => v.color === c && v.inStock),
  }));
  const closureOptions: AttributeOption[] = closureOptionValues.map((cl) => ({
    value: cl,
    label: cl,
    available: true,
    inStock: variants.some(
      (v) => v.closure === cl && (!selectedColor || v.color === selectedColor) && v.inStock,
    ),
  }));
  const packagingOptions: AttributeOption[] = packagingVariants.map((v) => ({
    value: v.sku,
    label: packagingLabel(v.packagingType, v.unitsPerPack),
    available: true,
    inStock: v.inStock,
  }));

  function selectColor(c: string) {
    setSelectedColor(c);
    setSelectedClosure(null);
    setSelectedPackagingSku(null);
    setQty(1);
  }
  function selectClosure(cl: string) {
    setSelectedClosure(cl);
    setSelectedPackagingSku(null);
    setQty(1);
  }
  function selectPackaging(s: string) {
    setSelectedPackagingSku(s);
    setQty(1);
  }

  // Mensagem do que ainda falta escolher (para o CTA desabilitado).
  const pending: string[] = [];
  if (hasColorDim && !selectedColor) pending.push("cor");
  if (hasClosureDim && (!colorReady || !selectedClosure)) pending.push("fechamento");
  if (colorReady && closureReady && !selectedPackagingSku) pending.push("embalagem");

  function handleAddToCart() {
    if (!product || !variant || !resolvedSku) return;
    const label = packagingLabel(variant.packagingType, variant.unitsPerPack);
    const attrSuffix = [variant.color, variant.closure].filter(Boolean).join(" · ");
    const displayName =
      variant.unitsPerPack > 1
        ? `${product.name}${attrSuffix ? ` (${attrSuffix})` : ""} — ${label}`
        : `${product.name}${attrSuffix ? ` (${attrSuffix})` : ""}`;
    const addPacks = effQty;
    const addUnits = addPacks * perPack;
    addItem(
      {
        sku: variant.sku,
        name: displayName,
        unit: variant.unitOfMeasure,
        unitsPerPack: perPack,
        maxUnits: availableUnits,
      },
      addUnits,
    );
    const desc =
      perPack > 1
        ? `${addPacks} ${label} = ${addUnits} ${variant.unitOfMeasure}`
        : `${addUnits} ${variant.unitOfMeasure}`;
    toast.success(`${product.name} adicionado ao carrinho`, {
      description: exceedsStock
        ? `${desc} · acima do estoque — seu vendedor vai confirmar prazo/disponibilidade.`
        : desc,
    });
  }

  async function handleNotify() {
    if (!variant) return;
    try {
      await post(`/b2b/catalog/${variant.sku}/notify`, {});
      toast.success("Cadastrado com sucesso!", {
        description: "Voce sera notificado quando este produto estiver disponivel.",
      });
    } catch {
      toast.error("Erro ao cadastrar notificacao");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-44 sm:px-6 lg:px-8 md:pb-8">
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
                  {!product.inStock && (
                    <Badge className="absolute top-4 left-4 bg-red-600 text-white border-0 shadow-md text-sm px-3 py-1">
                      Sem estoque
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h1 className="text-2xl font-bold text-gsn-text">{product.name}</h1>
                    <FavoriteButton
                      sku={variant?.sku ?? product.sku}
                      variant="inline"
                      className="-mt-1 shrink-0"
                    />
                  </div>
                  {/* O código do SKU só aparece após a combinação estar resolvida. */}
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    {resolvedSku ? (
                      <>SKU: {resolvedSku}</>
                    ) : (
                      <span className="italic">Selecione as opções para ver o código</span>
                    )}
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
                    {(selectedColor ?? product.color) && (
                      <Badge variant="outline">{selectedColor ?? product.color}</Badge>
                    )}
                    {(selectedClosure ?? product.closure) && (
                      <Badge variant="outline" className="text-violet-700 border-violet-200">
                        {selectedClosure ?? product.closure}
                      </Badge>
                    )}
                    {product.diameter && (
                      <Badge variant="outline" className="text-amber-700 border-amber-200">
                        Boca {product.diameter}
                      </Badge>
                    )}
                    {product.ean && resolvedSku && (
                      <Badge variant="outline" className="font-mono">
                        EAN: {product.ean}
                      </Badge>
                    )}
                    {variant ? (
                      variant.inStock ? (
                        <Badge className="bg-green-600 text-white border-0">
                          Em estoque · {formatStockUnits(variant.stockUnits)} {variant.unitOfMeasure}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600 text-white border-0">Indisponivel</Badge>
                      )
                    ) : product.inStock ? (
                      <Badge className="bg-green-600 text-white border-0">Disponível</Badge>
                    ) : (
                      <Badge className="bg-red-600 text-white border-0">Indisponivel</Badge>
                    )}
                  </div>

                  {/* Seletores em cascata: cor → fechamento → embalagem */}
                  <div className="mt-5 space-y-4">
                    {hasColorDim && (
                      <AttributeSelector
                        label="Cor"
                        options={colorOptions}
                        selected={selectedColor}
                        onSelect={selectColor}
                        hideWhenSingle
                      />
                    )}
                    {hasClosureDim && colorReady && (
                      <AttributeSelector
                        label="Fechamento"
                        options={closureOptions}
                        selected={selectedClosure}
                        onSelect={selectClosure}
                        hideWhenSingle
                      />
                    )}
                    {colorReady && closureReady && packagingOptions.length > 0 && (
                      <AttributeSelector
                        label={packagingOptions.length > 1 ? "Escolha a embalagem" : "Embalagem"}
                        options={packagingOptions}
                        selected={selectedPackagingSku}
                        onSelect={selectPackaging}
                      />
                    )}
                  </div>

                  {/* Detalhe da embalagem selecionada */}
                  {variant && perPack > 1 && (
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
                      <h3 className="text-sm font-semibold text-gsn-text mb-1">Descricao</h3>
                      <div
                        className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: product.fullDescription || product.description,
                        }}
                      />
                    </div>
                  )}

                  {inCart && variant && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-gsn-brand">
                      <Check className="h-4 w-4" />
                      Ja esta no carrinho ({inCart.quantity} {variant.unitOfMeasure})
                    </div>
                  )}

                  {/* Ações (desktop). No mobile, a barra sticky abaixo assume. */}
                  <div className="mt-auto pt-6 hidden md:block">
                    {!resolvedSku ? (
                      <Button className="w-full h-10" disabled>
                        <Lock className="h-4 w-4 mr-2" />
                        {pending.length > 0
                          ? `Selecione: ${pending.join(", ")}`
                          : "Selecione as opções"}
                      </Button>
                    ) : variant ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center rounded-md border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-r-none"
                              disabled={effQty <= 1}
                              onClick={() => setQty((q) => Math.max(1, q - 1))}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-14 text-center text-base font-medium">
                              {effQty}
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
                            {perPack > 1
                              ? packagingShort(variant.packagingType, variant.unitsPerPack)
                              : variant.unitOfMeasure}
                          </span>
                        </div>

                        {perPack > 1 && (
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

                        {exceedsStock && (
                          <p className="text-xs text-amber-600 flex items-start gap-1">
                            <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            Quantidade acima do estoque disponível
                            {availableUnits > 0
                              ? ` (${formatStockUnits(availableUnits)} ${variant.unitOfMeasure})`
                              : ""}
                            . Seu vendedor confirmará prazo e disponibilidade.
                          </p>
                        )}

                        <Button
                          className="w-full bg-gsn-brand hover:bg-gsn-brand-dark text-white h-10"
                          disabled={!canAdd}
                          onClick={handleAddToCart}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Adicionar ao carrinho
                        </Button>

                        {!variant.inStock && (
                          <button
                            type="button"
                            onClick={handleNotify}
                            className="w-full text-xs text-amber-600 hover:underline"
                          >
                            Avise-me quando voltar ao estoque
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ─── Barra CTA sticky (mobile) — acima do MobileNav ─── */}
      {product && (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-md px-4 py-2.5">
            {!resolvedSku ? (
              <Button className="w-full h-11" disabled>
                <Palette className="h-4 w-4 mr-2" />
                {pending.length > 0 ? `Selecione: ${pending.join(", ")}` : "Selecione as opções"}
              </Button>
            ) : variant ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border bg-white">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-10 rounded-r-none"
                    disabled={effQty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-9 text-center text-sm font-semibold tabular-nums">
                    {effQty}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-10 rounded-l-none"
                    onClick={() => setQty((q) => q + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="flex-1 h-11 bg-gsn-brand hover:bg-gsn-brand-dark text-white"
                  disabled={!canAdd}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {perPack > 1
                    ? `Adicionar · ${totalUnits} ${variant.unitOfMeasure}`
                    : "Adicionar ao carrinho"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
