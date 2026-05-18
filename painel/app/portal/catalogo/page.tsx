"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  X,
  RefreshCw,
  ShoppingCart,
  Package,
  TrendingUp,
} from "lucide-react";
import {
  fetchCatalogB2B,
  fetchCatalogCategories,
  fetchFrequentProducts,
  fmtBRL,
  fmtDate,
  type B2BCatalogItem,
  type B2BFrequentItem,
} from "@/lib/b2b-api";
import { useCart } from "@/contexts/CartContext";
import { ProductCard } from "@/components/b2b/ProductCard";
import { EmptyState } from "@/components/b2b/EmptyState";
import { ErrorState } from "@/components/cockpit/DataState";

const PAGE_SIZE = 24;

export default function CatalogoPage() {
  const { addItem } = useCart();
  const [items, setItems] = useState<B2BCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [frequentItems, setFrequentItems] = useState<B2BFrequentItem[]>([]);

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

  // Carregar categorias e produtos frequentes
  useEffect(() => {
    fetchCatalogCategories()
      .then((res) => setCategories(res.categories))
      .catch(() => {});
    fetchFrequentProducts()
      .then((res) => setFrequentItems(res.items))
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

      {/* Comprar Novamente */}
      {frequentItems.length > 0 && !searchDebounced && !category && (
        <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-cockpit-border bg-cockpit-bg/30">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cockpit-accent" />
              <h2 className="text-sm font-semibold text-gray-900">Comprar Novamente</h2>
            </div>
            <span className="text-[10px] text-cockpit-muted">Baseado no seu histórico de pedidos</span>
          </div>
          <div className="divide-y divide-cockpit-border">
            {frequentItems.slice(0, 6).map((item) => (
              <FrequentProductRow key={item.sku} item={item} onAdd={addItem} />
            ))}
          </div>
        </div>
      )}

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

function FrequentProductRow({
  item,
  onAdd,
}: {
  item: B2BFrequentItem;
  onAdd: (item: { sku: string; name: string; imageUrl: string | null; price: number; unitOfMeasure: string }, qty?: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAdd({ sku: item.sku, name: item.name, imageUrl: item.imageUrl, price: item.price, unitOfMeasure: item.unitOfMeasure }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    setQty(1);
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-cockpit-bg/30 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-cockpit-bg flex items-center justify-center shrink-0 overflow-hidden">
        {item.imageThumbUrl ? (
          <img src={item.imageThumbUrl} alt={item.name} className="w-full h-full object-contain p-0.5" loading="lazy" />
        ) : (
          <Package className="w-5 h-5 text-cockpit-muted/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/portal/catalogo/${encodeURIComponent(item.sku)}`}
          className="text-sm font-medium text-gray-900 hover:text-cockpit-accent truncate block"
        >
          {item.name}
        </Link>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-cockpit-muted">{item.sku}</span>
          <span className="text-[10px] text-cockpit-muted">
            <TrendingUp className="w-3 h-3 inline -mt-0.5 mr-0.5" />
            {item.orderCount} {item.orderCount === 1 ? "pedido" : "pedidos"}
          </span>
          {item.inStock ? (
            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Em estoque
            </span>
          ) : (
            <span className="text-[10px] text-red-500 flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Indisponível
            </span>
          )}
        </div>
      </div>
      {item.inStock && (
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 text-center text-sm font-medium text-gray-900 border border-cockpit-border rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-cockpit-accent tabular-nums"
          />
          <button
            type="button"
            onClick={handleAdd}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              added
                ? "bg-emerald-500 text-white"
                : "bg-cockpit-accent text-white hover:bg-cockpit-accentHover"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {added ? "Ok!" : "Adicionar"}
          </button>
        </div>
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
