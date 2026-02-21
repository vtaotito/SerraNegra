"use client";

import { useState } from "react";
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
  Filter,
  XCircle,
  Box,
} from "lucide-react";

interface CatalogProduct {
  id: number;
  sap_item_code: string;
  sap_item_name: string;
  image_url: string | null;
  image_thumb_url: string | null;
  category_name: string | null;
  ean: string | null;
  unit_of_measure: string;
  packaging_type: string | null;
  units_per_package: number | null;
  total_stock: number;
  is_in_stock: boolean;
  match_score: number;
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
  if (t.includes("un")) return "Unidade";
  return type;
}

function packagingIcon(type: string | null): string {
  if (!type) return "📦";
  const t = type.toLowerCase();
  if (t.includes("cx") || t.includes("caixa")) return "📦";
  if (t.includes("frd") || t.includes("fardo")) return "📦";
  if (t.includes("plt") || t.includes("palet")) return "🏗️";
  if (t.includes("sc") || t.includes("saco")) return "🛍️";
  if (t.includes("pct") || t.includes("pacote")) return "📦";
  return "📦";
}

export default function CatalogoPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { addItem, getItem } = useCart();

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (category) queryParams.set("category", category);
  if (stockFilter === "in") queryParams.set("inStock", "true");
  if (stockFilter === "out") queryParams.set("inStock", "false");
  queryParams.set("page", String(page));
  queryParams.set("limit", String(PAGE_SIZE));

  const { data, isLoading } = useQuery<CatalogResponse>({
    queryKey: ["b2b-catalog", search, category, stockFilter, page],
    queryFn: () => get(`/b2b/catalog?${queryParams.toString()}`),
    placeholderData: (prev) => prev,
  });

  const { data: catData } = useQuery<CategoriesResponse>({
    queryKey: ["b2b-catalog-categories"],
    queryFn: () => get("/b2b/catalog/categories"),
    staleTime: 60_000 * 5,
  });

  function handleQuantityChange(sku: string, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [sku]: Math.max(1, (prev[sku] ?? 1) + delta),
    }));
  }

  function handleAddToCart(product: CatalogProduct) {
    const qty = quantities[product.sap_item_code] ?? 1;
    const totalUnits =
      product.units_per_package && product.units_per_package > 1
        ? qty * product.units_per_package
        : qty;
    addItem(
      { sku: product.sap_item_code, name: product.sap_item_name, unit: product.unit_of_measure },
      totalUnits,
    );
    const desc =
      product.units_per_package && product.units_per_package > 1
        ? `${qty} ${packagingLabel(product.packaging_type)}(s) = ${totalUnits} ${product.unit_of_measure}`
        : `${qty} ${product.unit_of_measure}`;
    toast.success(`${product.sap_item_name} adicionado ao carrinho`, { description: desc });
  }

  async function handleNotify(product: CatalogProduct) {
    try {
      await post(`/b2b/catalog/${product.sap_item_code}/notify`, {});
      toast.success("Cadastrado com sucesso!", {
        description: `Voce sera notificado quando "${product.sap_item_name}" estiver disponivel.`,
      });
    } catch {
      toast.error("Erro ao cadastrar notificacao");
    }
  }

  function resetFilters() {
    setSearch("");
    setCategory("");
    setStockFilter("");
    setPage(1);
  }

  const hasFilters = search || category || stockFilter;

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gsn-text">
                Catalogo de Produtos
              </h1>
              <p className="text-muted-foreground">
                {data ? `${data.total} produto(s)` : "Carregando..."}
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, codigo ou EAN..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Todas as categorias</option>
              {catData?.categories?.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Todos (estoque)</option>
              <option value="in">Em estoque</option>
              <option value="out">Sem estoque</option>
            </select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Limpar filtros
              </Button>
            )}
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
                  {hasFilters
                    ? "Tente outros filtros ou termos de busca"
                    : "Nenhum produto disponivel no momento"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.items.map((product) => {
                  const qty = quantities[product.sap_item_code] ?? 1;
                  const inCart = getItem(product.sap_item_code);
                  const imgSrc = product.image_thumb_url ?? product.image_url;
                  const hasPack =
                    product.units_per_package != null && product.units_per_package > 1;
                  const packLabel = packagingLabel(product.packaging_type);
                  const totalUnits = hasPack ? qty * product.units_per_package! : qty;

                  return (
                    <Card
                      key={product.sap_item_code}
                      className="flex flex-col transition-all hover:shadow-lg group overflow-hidden"
                    >
                      <Link
                        href={`/catalogo/${product.sap_item_code}`}
                        className="relative bg-gray-50 flex items-center justify-center h-48 overflow-hidden"
                      >
                        {imgSrc ? (
                          <Image
                            src={imgSrc}
                            alt={product.sap_item_name}
                            width={280}
                            height={280}
                            className="object-contain h-full w-full p-4 group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground/30">
                            <Package className="h-16 w-16" />
                          </div>
                        )}
                        {!product.is_in_stock && (
                          <Badge className="absolute top-2 left-2 bg-red-600 text-white border-0 shadow-md text-xs">
                            Sem estoque
                          </Badge>
                        )}
                        {inCart && (
                          <Badge className="absolute top-2 right-2 bg-gsn-brand text-white border-0 shadow-md">
                            <Check className="h-3 w-3 mr-1" />
                            No carrinho
                          </Badge>
                        )}
                      </Link>

                      <CardContent className="flex flex-col flex-1 p-4">
                        <div className="mb-2 min-h-[3rem]">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-gsn-text">
                            {product.sap_item_name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {product.sap_item_code}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {product.category_name && (
                            <Badge variant="outline" className="text-xs">
                              {product.category_name}
                            </Badge>
                          )}
                          {product.ean && (
                            <Badge variant="outline" className="text-xs font-mono">
                              EAN: {product.ean}
                            </Badge>
                          )}
                        </div>

                        {hasPack && (
                          <div className="flex items-center gap-1.5 mb-3 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800">
                            <Box className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="font-medium">
                              {packLabel} c/ {product.units_per_package} {product.unit_of_measure}
                            </span>
                          </div>
                        )}

                        {product.is_in_stock ? (
                          <div className="mt-auto space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center rounded-md border">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-r-none"
                                  onClick={() =>
                                    handleQuantityChange(product.sap_item_code, -1)
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-10 text-center text-sm font-medium">
                                  {qty}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-l-none"
                                  onClick={() =>
                                    handleQuantityChange(product.sap_item_code, 1)
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {hasPack ? packLabel : product.unit_of_measure}
                              </span>
                            </div>
                            {hasPack && (
                              <p className="text-xs text-muted-foreground">
                                Total: <span className="font-semibold text-gsn-text">{totalUnits} {product.unit_of_measure}</span>
                              </p>
                            )}
                            <Button
                              size="sm"
                              className="w-full bg-gsn-brand hover:bg-gsn-brand-dark text-white"
                              onClick={() => handleAddToCart(product)}
                            >
                              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                              Adicionar
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
                              onClick={() => handleNotify(product)}
                            >
                              <Bell className="h-3.5 w-3.5 mr-1" />
                              Avise-me quando disponivel
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {data.pages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Pagina {data.page} de {data.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Proxima
                    <ChevronRight className="h-4 w-4 ml-1" />
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
