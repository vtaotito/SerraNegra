"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart/context";
import { useQuery } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
import { getProductImageUrl, getProductImageBySku } from "@/lib/product-images";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/components/catalog/FavoriteButton";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Package,
  Check,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Box,
  PackageCheck,
  PackageX,
  SlidersHorizontal,
  Tag,
  Layers,
} from "lucide-react";
import {
  type UnifiedProduct,
  type AttributeVariant,
  packagingLabel,
  packagingShort,
  packagingTypeName,
  groupColor,
  categoryColor,
  packStep,
  maxOrderableUnits,
} from "@/lib/catalog";

interface CategoryFacet {
  name: string;
  count: number;
}

interface UnifiedResponse {
  items: UnifiedProduct[];
  total: number;
  page: number;
  pages: number;
  categories: CategoryFacet[];
}

const PAGE_SIZE = 24;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function CatalogoPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 350);
  const [category, setCategory] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "in" | "out">("");
  const [page, setPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Quantidade (em embalagens) do add rápido por produto de combinação única.
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { addItem, getItem } = useCart();

  useEffect(() => { setPage(1); }, [search, category, stockFilter]);

  // Rola para o topo ao trocar de página/filtro (melhora a navegação no grid).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (category) queryParams.set("category", category);
  if (stockFilter === "in") queryParams.set("inStock", "true");
  if (stockFilter === "out") queryParams.set("inStock", "false");
  queryParams.set("page", String(page));
  queryParams.set("limit", String(PAGE_SIZE));

  const { data, isLoading, isFetching } = useQuery<UnifiedResponse>({
    queryKey: ["b2b-catalog-unified", search, category, stockFilter, page],
    queryFn: () => get(`/b2b/catalog/unified?${queryParams.toString()}`),
    placeholderData: (prev) => prev,
  });

  const categories = data?.categories ?? [];
  const totalCatalogCount = categories.reduce((s, c) => s + c.count, 0);

  // Variante representativa (menor embalagem em estoque) — usada no add rápido.
  const getSelectedVariant = useCallback(
    (product: UnifiedProduct): AttributeVariant =>
      product.variants.find((v) => v.sku === product.sku) ?? product.variants[0],
    [],
  );

  const handleQuantityChange = useCallback((id: string, delta: number) => {
    setQuantities((prev) => {
      const cur = prev[id] ?? 1;
      const next = Math.max(1, cur + delta);
      return { ...prev, [id]: next };
    });
  }, []);

  function handleAddToCart(product: UnifiedProduct, variant: AttributeVariant) {
    const perPack = packStep(variant.unitsPerPack);
    const label = packagingLabel(variant.packagingType, variant.unitsPerPack);
    const displayName =
      variant.unitsPerPack > 1 ? `${product.name} — ${label}` : product.name;

    // Estoque disponível (informativo). Não limita o pedido: o cliente pode pedir
    // acima do estoque; o excedente vira interação com o vendedor.
    const availableUnits = maxOrderableUnits(variant);
    const inCartUnits = getItem(variant.sku)?.quantity ?? 0;

    const qty = quantities[product.id] ?? 1;
    const addPacks = qty;
    const addUnits = addPacks * perPack;
    const exceedsStock = inCartUnits + addUnits > availableUnits;

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

    const baseDesc =
      perPack > 1
        ? `${addPacks} ${label} = ${addUnits} ${variant.unitOfMeasure}`
        : `${addUnits} ${variant.unitOfMeasure}`;
    if (exceedsStock) {
      toast.success(`${product.name} adicionado ao carrinho`, {
        description: `${baseDesc} · acima do estoque — seu vendedor confirmará prazo/disponibilidade.`,
      });
    } else {
      toast.success(`${product.name} adicionado ao carrinho`, {
        description: baseDesc,
      });
    }
  }

  async function handleNotify(variant: AttributeVariant, productName: string) {
    try {
      await post(`/b2b/catalog/${variant.sku}/notify`, {});
      toast.success("Cadastrado com sucesso!", {
        description: `Voce sera notificado quando "${productName}" estiver disponivel.`,
      });
    } catch {
      toast.error("Erro ao cadastrar notificacao");
    }
  }

  function resetFilters() {
    setSearchInput("");
    setCategory("");
    setStockFilter("");
    setPage(1);
  }

  const hasFilters = !!search || !!category || !!stockFilter;
  const activeFilterCount = (search ? 1 : 0) + (category ? 1 : 0) + (stockFilter ? 1 : 0);
  const pageNumbers = getPageNumbers(page, data?.pages ?? 1);
  const total = data?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />

      {/* ─── Sticky Filter Bar ─── */}
      <div className="sticky top-14 sm:top-16 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar produto, codigo ou EAN..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-9 h-9 text-base sm:text-sm bg-muted/50 border-transparent focus:border-input focus:bg-white transition-colors"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Desktop: Stock Toggle Buttons */}
            <div className="hidden sm:flex items-center rounded-lg border bg-muted/40 p-0.5">
              <button
                onClick={() => setStockFilter("")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  stockFilter === ""
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setStockFilter("in")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  stockFilter === "in"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <PackageCheck className="h-3 w-3" />
                Em estoque
              </button>
              <button
                onClick={() => setStockFilter("out")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  stockFilter === "out"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <PackageX className="h-3 w-3" />
                Sem estoque
              </button>
            </div>

            {/* Mobile: Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden relative h-9"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--gsn-brand)] text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Desktop: Clear Filters */}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Category Pills - Desktop */}
          {categories.length > 0 && (
            <div className="hidden sm:block relative pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pr-10">
                <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mr-0.5" />
                <CategoryPill
                  label="Todas"
                  count={totalCatalogCount}
                  active={category === ""}
                  onClick={() => setCategory("")}
                />
                {categories.map((c) => (
                  <CategoryPill
                    key={c.name}
                    label={c.name}
                    count={c.count}
                    color={categoryColor(c.name)}
                    active={category === c.name}
                    onClick={() => setCategory(category === c.name ? "" : c.name)}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-3 w-10 bg-gradient-to-l from-white via-white/85 to-transparent" />
            </div>
          )}

          {/* Mobile Filter Panel */}
          {showMobileFilters && (
            <div className="sm:hidden pb-3 space-y-3 border-t pt-3 animate-in slide-in-from-top-2 duration-200">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Package className="h-3 w-3" /> Disponibilidade
                </p>
                <div className="flex gap-1.5">
                  {([["", "Todos"], ["in", "Em estoque"], ["out", "Sem estoque"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setStockFilter(val)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-medium border transition-all",
                        stockFilter === val
                          ? val === "in" ? "bg-emerald-600 text-white border-emerald-600"
                          : val === "out" ? "bg-red-600 text-white border-red-600"
                          : "bg-[var(--gsn-brand)] text-white border-[var(--gsn-brand)]"
                          : "bg-white border-border text-muted-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Categoria
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <CategoryPill
                      label="Todas"
                      count={totalCatalogCount}
                      active={category === ""}
                      onClick={() => setCategory("")}
                    />
                    {categories.map((c) => (
                      <CategoryPill
                        key={c.name}
                        label={c.name}
                        count={c.count}
                        color={categoryColor(c.name)}
                        active={category === c.name}
                        onClick={() => setCategory(category === c.name ? "" : c.name)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {hasFilters && (
                <button
                  onClick={() => { resetFilters(); setShowMobileFilters(false); }}
                  className="w-full py-2 text-xs text-muted-foreground border border-dashed rounded-lg hover:bg-muted transition-colors"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pt-5 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <div className="space-y-4">
          {/* Results Header + Active Filter Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {isFetching && !isLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--gsn-brand)] animate-pulse" />
                    Atualizando...
                  </span>
                ) : data ? (
                  <span>
                    <strong className="text-foreground">{data.total}</strong> produto{data.total !== 1 ? "s" : ""}
                    {hasFilters ? " encontrado" + (data.total !== 1 ? "s" : "") : ""}
                  </span>
                ) : "Carregando..."}
              </p>

              {search && (
                <Badge
                  variant="secondary"
                  className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => setSearchInput("")}
                >
                  <Search className="h-2.5 w-2.5" />
                  &quot;{search}&quot;
                  <X className="h-3 w-3 ml-0.5" />
                </Badge>
              )}
              {category && (
                <Badge
                  variant="secondary"
                  className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => setCategory("")}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {category}
                  <X className="h-3 w-3 ml-0.5" />
                </Badge>
              )}
              {stockFilter && (
                <Badge
                  variant="secondary"
                  className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => setStockFilter("")}
                >
                  {stockFilter === "in" ? <PackageCheck className="h-2.5 w-2.5" /> : <PackageX className="h-2.5 w-2.5" />}
                  {stockFilter === "in" ? "Em estoque" : "Sem estoque"}
                  <X className="h-3 w-3 ml-0.5" />
                </Badge>
              )}
            </div>

            {data && data.total > 0 && data.pages > 1 && (
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                Mostrando{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {rangeStart}–{rangeEnd}
                </span>{" "}
                de <span className="tabular-nums">{data.total}</span>
              </p>
            )}
          </div>

          {/* Product Grid */}
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
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Package className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {hasFilters
                    ? "Nao encontramos resultados para os filtros selecionados. Tente ajustar sua busca."
                    : "Nenhum produto disponivel no momento."}
                </p>
                {hasFilters && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                    Limpar filtros
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.items.map((product) => {
                  const selVariant = getSelectedVariant(product);
                  const cartUnits = getItem(selVariant?.sku ?? "")?.quantity ?? 0;
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variant={selVariant}
                      qty={quantities[product.id] ?? 1}
                      cartUnits={cartUnits}
                      inCart={cartUnits > 0}
                      onQtyChange={(delta) =>
                        handleQuantityChange(product.id, delta)
                      }
                      onAdd={(v) => handleAddToCart(product, v)}
                      onNotify={(v) => handleNotify(v, product.name)}
                      onCategoryClick={(c) => setCategory(c)}
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex flex-col items-center gap-2.5 pt-8 pb-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hidden sm:inline-flex"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                      aria-label="Primeira página"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {pageNumbers.map((p, i) =>
                      p === "..." ? (
                        <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm select-none">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          aria-current={page === p ? "page" : undefined}
                          className={cn(
                            "h-9 min-w-[2.25rem] px-1 rounded-lg text-sm font-medium transition-all",
                            page === p
                              ? "bg-[var(--gsn-brand)] text-white shadow-sm"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={page >= data.pages}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hidden sm:inline-flex"
                      disabled={page >= data.pages}
                      onClick={() => setPage(data.pages)}
                      aria-label="Última página"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Página {page} de {data.pages}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Pílula de filtro de categoria ─── */

function CategoryPill({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  const c = color ?? "var(--gsn-brand)";
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5 text-xs font-medium transition-all whitespace-nowrap",
        active
          ? "shadow-sm"
          : "bg-white border-border text-foreground/80 hover:border-foreground/30 hover:text-foreground",
      )}
      style={active ? { backgroundColor: `${c}14`, borderColor: c, color: c } : undefined}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: c }}
        />
      )}
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
            !active && "bg-muted text-muted-foreground",
          )}
          style={active ? { backgroundColor: `${c}26`, color: c } : undefined}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Card de produto unificado ─── */

function ProductCard({
  product,
  variant,
  qty,
  cartUnits,
  inCart,
  onQtyChange,
  onAdd,
  onNotify,
  onCategoryClick,
}: {
  product: UnifiedProduct;
  variant: AttributeVariant;
  qty: number;
  cartUnits: number;
  inCart: boolean;
  onQtyChange: (delta: number) => void;
  onAdd: (variant: AttributeVariant) => void;
  onNotify: (variant: AttributeVariant) => void;
  onCategoryClick: (category: string) => void;
}) {
  const imgSrc = product.imageUrl ?? getProductImageBySku(product.sku) ?? getProductImageUrl(product.name);
  const gColor = groupColor(product.groupCode);
  const detailHref = `/catalogo/${encodeURIComponent(product.sku)}`;

  // Combinação única = uma só variante (1 cor × 1 fechamento × 1 embalagem):
  // permite o "add rápido" direto do card. Caso contrário leva ao detalhe.
  const singleCombo = product.variants.length === 1;

  // Cada card representa um produto específico (cor/fechamento/diâmetro fixos); a
  // única variação interna é a EMBALAGEM. Indicamos só quantas embalagens há.
  const distinctPackagings = new Set(
    product.variants.map((v) => `${packagingTypeName(v.packagingType)}|${v.unitsPerPack}`),
  ).size;
  const optionBits: string[] = [];
  if (distinctPackagings > 1) optionBits.push(`${distinctPackagings} embalagens`);

  const perPack = variant?.unitsPerPack > 1 ? variant.unitsPerPack : 1;
  const selectedInStock = variant?.inStock ?? false;

  // Estoque disponível (informativo). Sem limite de pedido: o cliente pode pedir
  // acima do estoque — o excedente vira interação com o vendedor.
  const availableUnits = variant ? maxOrderableUnits(variant) : 0;
  const effQty = Math.max(1, qty);
  const totalUnits = effQty * perPack;
  const canAdd = !!variant;
  const exceedsStock = !!variant && cartUnits + totalUnits > availableUnits;

  return (
    <Card
      className={cn(
        "relative flex flex-col transition-all hover:shadow-lg group overflow-hidden",
        !product.inStock && "opacity-75 hover:opacity-100",
      )}
    >
      <FavoriteButton
        sku={product.sku}
        variant="overlay"
        className="absolute right-2 top-2 z-20"
      />
      <Link
        href={detailHref}
        className="relative bg-white flex items-center justify-center h-48 overflow-hidden"
      >
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={product.name}
            width={280}
            height={280}
            className="object-contain h-full w-full p-4 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/20">
            <Package className="h-16 w-16" />
          </div>
        )}
        {product.inStock ? (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-600/90 text-white px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Disponivel
          </span>
        ) : (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-red-600/90 text-white px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm">
            Indisponivel
          </span>
        )}
        {inCart && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-[var(--gsn-brand)]/90 text-white px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm">
            <Check className="h-2.5 w-2.5" />
            No carrinho
          </span>
        )}
      </Link>

      <CardContent className="flex flex-col flex-1 p-4">
        <Link href={detailHref} className="mb-2 min-h-[2.5rem] block group/title">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-[var(--gsn-text)] group-hover/title:text-[var(--gsn-brand)] transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Categoria + capacidade + cor/fechamento únicos */}
        <div className="flex flex-wrap gap-1 mb-2">
          {product.category && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onCategoryClick(product.category!);
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors hover:brightness-95"
              style={{ background: `${gColor}1a`, color: gColor }}
            >
              <Tag className="h-2.5 w-2.5" />
              {product.category}
            </button>
          )}
          {product.capacity && (
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              {product.capacity}
            </span>
          )}
          {product.color && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {product.color}
            </span>
          )}
          {product.closure && (
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              {product.closure}
            </span>
          )}
          {product.diameter && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              Boca {product.diameter}
            </span>
          )}
        </div>

        {/* Indicador de opções (só quando há mais de uma combinação) */}
        {optionBits.length > 0 && (
          <div className="mb-3 flex items-center gap-1 text-[11px] font-medium text-[var(--gsn-brand)]">
            <Layers className="h-3 w-3 flex-shrink-0" />
            <span>{optionBits.join(" · ")}</span>
          </div>
        )}

        {/* Disponibilidade do modelo (sem expor a quantidade em estoque) */}
        <div className="mb-3 min-h-[1.25rem]">
          {product.inStock ? (
            <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <PackageCheck className="h-3 w-3 flex-shrink-0" />
              Em estoque
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] font-medium text-red-500">
              <PackageX className="h-3 w-3 flex-shrink-0" />
              Sem estoque no momento
            </p>
          )}
        </div>

        {/* Ações: add rápido (combinação única) ou "Escolher opções" → detalhe */}
        {singleCombo ? (
          <div className="mt-auto space-y-2">
            {perPack > 1 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 text-xs text-amber-800">
                <Box className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="font-medium">
                  {packagingLabel(variant.packagingType, variant.unitsPerPack)} = {perPack}{" "}
                  {variant.unitOfMeasure}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border bg-muted/30">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-r-none hover:bg-muted"
                  aria-label="Diminuir quantidade"
                  disabled={effQty <= 1}
                  onClick={() => onQtyChange(-1)}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">
                  {effQty}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-l-none hover:bg-muted"
                  aria-label="Aumentar quantidade"
                  onClick={() => onQtyChange(1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {perPack > 1
                  ? packagingShort(variant.packagingType, variant.unitsPerPack)
                  : variant.unitOfMeasure}
              </span>
            </div>
            {perPack > 1 && (
              <p className="text-xs text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-[var(--gsn-text)]">
                  {totalUnits} {variant.unitOfMeasure}
                </span>
              </p>
            )}
            {exceedsStock && (
              <p className="text-[11px] text-amber-600 flex items-start gap-1">
                <Bell className="h-3 w-3 shrink-0 mt-0.5" />
                Acima do estoque — seu vendedor confirmará prazo/disponibilidade.
              </p>
            )}
            <Button
              size="sm"
              className="w-full bg-[var(--gsn-brand)] hover:bg-[var(--gsn-brand-dark)] text-white shadow-sm"
              disabled={!canAdd}
              onClick={() => onAdd(variant)}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Adicionar ao Carrinho
            </Button>
            {!selectedInStock && (
              <button
                type="button"
                onClick={() => variant && onNotify(variant)}
                className="w-full text-[11px] text-amber-600 hover:underline"
              >
                Avise-me quando voltar ao estoque
              </button>
            )}
          </div>
        ) : (
          <div className="mt-auto">
            <Link href={detailHref}>
              <Button
                size="sm"
                className="w-full bg-[var(--gsn-brand)] hover:bg-[var(--gsn-brand-dark)] text-white shadow-sm"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Escolher opções
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [];
  pages.push(1);

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
