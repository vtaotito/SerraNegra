"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import {
  fetchCatalogB2B,
  fetchCatalogCategories,
  type B2BCatalogItem,
} from "@/lib/b2b-api";
import { ProductCard } from "@/components/b2b/ProductCard";
import { EmptyState } from "@/components/b2b/EmptyState";
import { ErrorState } from "@/components/cockpit/DataState";

const PAGE_SIZE = 24;

export default function CatalogoPage() {
  const [items, setItems] = useState<B2BCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Carregar categorias
  useEffect(() => {
    fetchCatalogCategories()
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, []);

  // Carregar produtos
  const loadProducts = useCallback(
    async (pageNum: number, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await fetchCatalogB2B({
          search: searchDebounced || undefined,
          category: category || undefined,
          inStock: inStockOnly || undefined,
          page: pageNum,
          limit: PAGE_SIZE,
        });
        if (append) {
          setItems((prev) => [...prev, ...res.items]);
        } else {
          setItems(res.items);
        }
        setTotal(res.total);
        setPages(res.pages);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar catálogo");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchDebounced, category, inStockOnly],
  );

  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  const hasMore = page < pages;
  const activeFilters = (category ? 1 : 0) + (inStockOnly ? 1 : 0);

  if (error && items.length === 0) return <ErrorState message={error} onRetry={() => loadProducts(1)} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-cockpit-accent/10">
          <BookOpen className="w-5 h-5 text-cockpit-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catálogo</h1>
          <p className="text-xs text-cockpit-muted">
            {total} {total === 1 ? "produto" : "produtos"} disponíveis
          </p>
        </div>
      </div>

      {/* Busca + Filtros */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-cockpit-border bg-white text-sm placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              showFilters || activeFilters
                ? "border-cockpit-accent bg-cockpit-accent/5 text-cockpit-accent"
                : "border-cockpit-border bg-white text-gray-700 hover:bg-cockpit-bg"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilters > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cockpit-accent text-white text-[10px] font-bold">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 rounded-xl border border-cockpit-border bg-white">
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-cockpit-muted mb-1">Categoria</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-cockpit-border bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-cockpit-accent"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted pointer-events-none" />
              </div>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-cockpit-border text-cockpit-accent focus:ring-cockpit-accent"
                />
                <span className="text-sm text-gray-700">Apenas em estoque</span>
              </label>
            </div>
            {activeFilters > 0 && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => { setCategory(""); setInStockOnly(false); }}
                  className="inline-flex items-center gap-1 text-xs text-cockpit-accent hover:underline"
                >
                  <X className="w-3 h-3" /> Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <CatalogSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8 text-cockpit-accent" />}
          title="Nenhum produto encontrado"
          description="Tente alterar os filtros ou termo de busca."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
              <ProductCard key={item.sku} product={item} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => loadProducts(page + 1, true)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-cockpit-border bg-white text-sm font-medium text-gray-700 hover:bg-cockpit-bg disabled:opacity-50 transition-colors"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                Carregar mais produtos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse motion-reduce:animate-none">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="aspect-square bg-cockpit-bg rounded-lg mb-3" />
          <div className="h-3 w-16 bg-cockpit-border rounded mb-2" />
          <div className="h-3 w-full bg-cockpit-border rounded mb-1" />
          <div className="h-3 w-3/4 bg-cockpit-border rounded mb-3" />
          <div className="h-8 w-full bg-cockpit-border rounded" />
        </div>
      ))}
    </div>
  );
}
