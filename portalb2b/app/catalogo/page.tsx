"use client";

import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  X,
  Box,
  PackageCheck,
  PackageX,
  SlidersHorizontal,
  ChevronDown,
  Tag,
  Layers,
} from "lucide-react";

interface CatalogProduct {
  sku: string;
  name: string;
  description: string;
  category: string | null;
  ean: string | null;
  imageUrl: string | null;
  price: number;
  inStock: boolean;
  stockQuantity: number;
  unitOfMeasure: string;
  packagingType: string | null;
  unitsPerPack: number | string | null;
}

/** Normaliza unitsPerPack (vem como number, string "24.00" ou null do backend). */
function toUnitsPerPack(value: number | string | null): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Remove tags HTML da descrição para um resumo curto no card. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface CatalogResponse {
  items: CatalogProduct[];
  total: number;
  page: number;
  pages: number;
}

interface CategoriesResponse {
  categories: string[];
}

const PAGE_SIZE = 24;

function packagingLabel(type: string | null): string {
  if (!type) return "Unidade";
  const t = type.toLowerCase().trim();
  if (t.includes("cx") || t.includes("caixa")) return "Caixa";
  if (t.includes("frd") || t.includes("fardo")) return "Fardo";
  if (t.includes("plt") || t.includes("palet") || t.includes("pallet")) return "Palet";
  if (t.includes("sc") || t.includes("saco")) return "Saco";
  if (t.includes("pct") || t.includes("pcte") || t.includes("pacote")) return "Pacote";
  if (t.includes("dz") || t.includes("duzia")) return "Duzia";
  if (t.includes("engradado")) return "Engradado";
  if (t.includes("un")) return "Unidade";
  return type;
}

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
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { addItem, getItem } = useCart();

  useEffect(() => { setPage(1); }, [search, category, stockFilter]);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (category) queryParams.set("category", category);
  if (stockFilter === "in") queryParams.set("inStock", "true");
  if (stockFilter === "out") queryParams.set("inStock", "false");
  queryParams.set("page", String(page));
  queryParams.set("limit", String(PAGE_SIZE));

  const { data, isLoading, isFetching } = useQuery<CatalogResponse>({
    queryKey: ["b2b-catalog", search, category, stockFilter, page],
    queryFn: () => get(`/b2b/catalog?${queryParams.toString()}`),
    placeholderData: (prev) => prev,
  });

  const { data: catData } = useQuery<CategoriesResponse>({
    queryKey: ["b2b-catalog-categories"],
    queryFn: () => get("/b2b/catalog/categories"),
    staleTime: 60_000 * 5,
  });

  const handleQuantityChange = useCallback((sku: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [sku]: Math.max(1, (prev[sku] ?? 1) + delta),
    }));
  }, []);

  function handleAddToCart(product: CatalogProduct) {
    const qty = quantities[product.sku] ?? 1;
    const perPack = toUnitsPerPack(product.unitsPerPack);
    const totalUnits = perPack && perPack > 1 ? qty * perPack : qty;
    addItem(
      { sku: product.sku, name: product.name, unit: product.unitOfMeasure },
      totalUnits,
    );
    const desc =
      perPack && perPack > 1
        ? `${qty} ${packagingLabel(product.packagingType)}(s) = ${totalUnits} ${product.unitOfMeasure}`
        : `${qty} ${product.unitOfMeasure}`;
    toast.success(`${product.name} adicionado ao carrinho`, { description: desc });
  }

  async function handleNotify(product: CatalogProduct) {
    try {
      await post(`/b2b/catalog/${product.sku}/notify`, {});
      toast.success("Cadastrado com sucesso!", {
        description: `Voce sera notificado quando "${product.name}" estiver disponivel.`,
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

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />

      {/* ─── Sticky Filter Bar ─── */}
      <div className="sticky top-16 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar produto, codigo ou EAN..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm bg-muted/50 border-transparent focus:border-input focus:bg-white transition-colors"
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
          {catData?.categories && catData.categories.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 pb-3 overflow-x-auto scrollbar-hide">
              <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mr-0.5" />
              <button
                onClick={() => setCategory("")}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all",
                  category === ""
                    ? "bg-[var(--gsn-brand)] text-white border-[var(--gsn-brand)]"
                    : "bg-white text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                )}
              >
                Todas
              </button>
              {catData.categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(category === c ? "" : c)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                    category === c
                      ? "bg-[var(--gsn-brand)] text-white border-[var(--gsn-brand)]"
                      : "bg-white text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Mobile Filter Panel */}
          {showMobileFilters && (
            <div className="sm:hidden pb-3 space-y-3 border-t pt-3 animate-in slide-in-from-top-2 duration-200">
              {/* Mobile Stock Toggles */}
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

              {/* Mobile Categories */}
              {catData?.categories && catData.categories.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Categoria
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setCategory("")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        category === ""
                          ? "bg-[var(--gsn-brand)] text-white border-[var(--gsn-brand)]"
                          : "bg-white border-border text-muted-foreground"
                      )}
                    >
                      Todas
                    </button>
                    {catData.categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setCategory(category === c ? "" : c); }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          category === c
                            ? "bg-[var(--gsn-brand)] text-white border-[var(--gsn-brand)]"
                            : "bg-white border-border text-muted-foreground"
                        )}
                      >
                        {c}
                      </button>
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

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
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

              {/* Active Filter Chips */}
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

            {data && data.pages > 1 && (
              <p className="text-xs text-muted-foreground">
                Pagina {page} de {data.pages}
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
                  const qty = quantities[product.sku] ?? 1;
                  const inCart = getItem(product.sku);
                  const imgSrc = product.imageUrl;
                  const perPack = toUnitsPerPack(product.unitsPerPack);
                  const hasPack = perPack != null && perPack > 1;
                  const packLabel = packagingLabel(product.packagingType);
                  const totalUnits = hasPack ? qty * perPack! : qty;
                  const descSnippet = product.description ? plainText(product.description) : "";

                  return (
                    <Card
                      key={product.sku}
                      className={cn(
                        "flex flex-col transition-all hover:shadow-lg group overflow-hidden",
                        !product.inStock && "opacity-75 hover:opacity-100",
                      )}
                    >
                      <Link
                        href={`/catalogo/${product.sku}`}
                        className="relative bg-gray-50 flex items-center justify-center h-48 overflow-hidden"
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
                          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[var(--gsn-brand)]/90 text-white px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm">
                            <Check className="h-2.5 w-2.5" />
                            No carrinho
                          </span>
                        )}
                      </Link>

                      <CardContent className="flex flex-col flex-1 p-4">
                        <div className="mb-2 min-h-[3rem]">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-[var(--gsn-text)]">
                            {product.name}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mt-1 font-mono tracking-wide">
                            {product.sku}
                          </p>
                        </div>

                        {descSnippet && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-snug">
                            {descSnippet}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1 mb-2">
                          {product.category && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setCategory(product.category!);
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {product.category}
                            </button>
                          )}
                        </div>

                        {hasPack && (
                          <div className="flex items-center gap-1.5 mb-3 rounded-lg bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 text-xs text-amber-800">
                            <Box className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="font-medium">
                              {packLabel} c/ {perPack} {product.unitOfMeasure}
                            </span>
                          </div>
                        )}

                        {product.inStock ? (
                          <div className="mt-auto space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center rounded-lg border bg-muted/30">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-r-none hover:bg-muted"
                                  onClick={() =>
                                    handleQuantityChange(product.sku, -1)
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-10 text-center text-sm font-semibold tabular-nums">
                                  {qty}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-l-none hover:bg-muted"
                                  onClick={() =>
                                    handleQuantityChange(product.sku, 1)
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {hasPack ? packLabel : product.unitOfMeasure}
                              </span>
                            </div>
                            {hasPack && (
                              <p className="text-xs text-muted-foreground">
                                Total: <span className="font-semibold text-[var(--gsn-text)]">{totalUnits} {product.unitOfMeasure}</span>
                              </p>
                            )}
                            <Button
                              size="sm"
                              className="w-full bg-[var(--gsn-brand)] hover:bg-[var(--gsn-brand-dark)] text-white shadow-sm"
                              onClick={() => handleAddToCart(product)}
                            >
                              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                              Adicionar ao Carrinho
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-amber-400/60 text-amber-700 hover:bg-amber-50 hover:border-amber-500"
                              onClick={() => handleNotify(product)}
                            >
                              <Bell className="h-3.5 w-3.5 mr-1.5" />
                              Avise-me quando disponivel
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-6 pb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {pageNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={cn(
                          "h-9 min-w-[2.25rem] rounded-lg text-sm font-medium transition-all",
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
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
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
