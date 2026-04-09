"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DollarSign, Search, Download, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ListFilter, Hash, TrendingUp, Crown, X,
} from "lucide-react";
import { fmtBRL, fmtNum, exportCSV } from "@/lib/format";
import {
  fetchItemPrices, fetchCatalog,
  type ItemPriceRow, type CatalogItem,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";

/* ── Pivot row: one row per ItemCode, dynamic price columns ── */
interface PivotRow {
  itemCode: string;
  description: string;
  prices: Record<string, number | null>;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  listCount: number;
}

type SortKey = "itemCode" | "description" | "minPrice" | "maxPrice" | "avgPrice" | string;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export default function PrecosPage() {
  const { data: priceData, loading: loadingPrices, error: errorPrices, refetch: refetchPrices } =
    useFetch(() => fetchItemPrices(), []);

  const { data: catalogData, loading: loadingCatalog } =
    useFetch(() => fetchCatalog({ limit: 5000, active: true }), []);

  const [search, setSearch] = useState("");
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("itemCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [showListFilter, setShowListFilter] = useState(false);

  const loading = loadingPrices || loadingCatalog;
  const error = errorPrices;

  const catalogMap = useMemo(() => {
    const m = new Map<string, string>();
    if (catalogData?.data) {
      for (const c of catalogData.data) {
        m.set(c.sku, c.description);
      }
    }
    return m;
  }, [catalogData]);

  const priceLists = useMemo(
    () => priceData?.priceLists ?? [],
    [priceData],
  );

  const visibleLists = useMemo(
    () => (selectedLists.size > 0 ? priceLists.filter(l => selectedLists.has(l)) : priceLists),
    [priceLists, selectedLists],
  );

  const pivotRows = useMemo(() => {
    if (!priceData?.items) return [];

    const grouped = new Map<string, Map<string, number>>();
    for (const row of priceData.items) {
      let itemMap = grouped.get(row.ItemCode);
      if (!itemMap) {
        itemMap = new Map();
        grouped.set(row.ItemCode, itemMap);
      }
      itemMap.set(row.ListName, row.Price);
    }

    const rows: PivotRow[] = [];
    for (const [itemCode, priceMap] of grouped) {
      const prices: Record<string, number | null> = {};
      const vals: number[] = [];

      for (const list of priceLists) {
        const p = priceMap.get(list) ?? null;
        prices[list] = p;
        if (p !== null && p > 0) vals.push(p);
      }

      if (vals.length === 0) continue;

      rows.push({
        itemCode,
        description: catalogMap.get(itemCode) ?? itemCode,
        prices,
        minPrice: Math.min(...vals),
        maxPrice: Math.max(...vals),
        avgPrice: vals.reduce((a, b) => a + b, 0) / vals.length,
        listCount: vals.length,
      });
    }

    return rows;
  }, [priceData, priceLists, catalogMap]);

  const filtered = useMemo(() => {
    let rows = pivotRows;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.itemCode.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }

    const pMin = priceMin ? parseFloat(priceMin) : null;
    const pMax = priceMax ? parseFloat(priceMax) : null;

    if (pMin !== null || pMax !== null) {
      rows = rows.filter(r => {
        const hasAnyInRange = Object.entries(r.prices).some(([list, price]) => {
          if (price === null || price <= 0) return false;
          if (visibleLists.length > 0 && !visibleLists.includes(list)) return false;
          if (pMin !== null && price < pMin) return false;
          if (pMax !== null && price > pMax) return false;
          return true;
        });
        return hasAnyInRange;
      });
    }

    return rows;
  }, [pivotRows, search, priceMin, priceMax, visibleLists]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;

      if (sortKey === "itemCode") { va = a.itemCode; vb = b.itemCode; }
      else if (sortKey === "description") { va = a.description; vb = b.description; }
      else if (sortKey === "minPrice") { va = a.minPrice; vb = b.minPrice; }
      else if (sortKey === "maxPrice") { va = a.maxPrice; vb = b.maxPrice; }
      else if (sortKey === "avgPrice") { va = a.avgPrice; vb = b.avgPrice; }
      else {
        va = a.prices[sortKey] ?? -1;
        vb = b.prices[sortKey] ?? -1;
      }

      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
    setPage(0);
  }, []);

  const kpis = useMemo(() => {
    if (!priceData?.items) return null;
    const totalItems = pivotRows.length;
    const totalLists = priceLists.length;
    const allPrices = priceData.items.filter(r => r.Price > 0).map(r => r.Price);
    const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
    let topItem = { code: "—", price: 0 };
    for (const row of pivotRows) {
      if (row.maxPrice > topItem.price) {
        topItem = { code: row.itemCode, price: row.maxPrice };
      }
    }
    return { totalItems, totalLists, avgPrice, topItem };
  }, [priceData, pivotRows, priceLists]);

  const handleExport = useCallback(() => {
    if (!sorted.length) return;
    const csvRows = sorted.map(r => {
      const row: Record<string, unknown> = {
        Codigo: r.itemCode,
        Descricao: r.description,
      };
      for (const list of visibleLists) {
        row[list] = r.prices[list] ?? "";
      }
      row["Menor Preco"] = r.minPrice;
      row["Maior Preco"] = r.maxPrice;
      row["Preco Medio"] = r.avgPrice.toFixed(2);
      return row;
    });
    exportCSV(csvRows, `tabela-precos-${new Date().toISOString().slice(0, 10)}`);
  }, [sorted, visibleLists]);

  const toggleList = useCallback((list: string) => {
    setSelectedLists(prev => {
      const next = new Set(prev);
      if (next.has(list)) next.delete(list);
      else next.add(list);
      return next;
    });
    setPage(0);
  }, []);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-cockpit-accent" />
      : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={refetchPrices} />;

  return (
    <div className="space-y-4">
      {/* ── KPI Cards ── */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            icon={Hash}
            label="Itens com preço"
            value={fmtNum(kpis.totalItems)}
            accent="text-cockpit-accent"
            bg="bg-red-50"
          />
          <KPICard
            icon={ListFilter}
            label="Listas ativas"
            value={String(kpis.totalLists)}
            accent="text-emerald-700"
            bg="bg-emerald-50"
          />
          <KPICard
            icon={TrendingUp}
            label="Preço médio"
            value={fmtBRL(kpis.avgPrice)}
            accent="text-sky-700"
            bg="bg-sky-50"
          />
          <KPICard
            icon={Crown}
            label="Item mais caro"
            value={fmtBRL(kpis.topItem.price)}
            sub={kpis.topItem.code}
            accent="text-amber-700"
            bg="bg-amber-50"
          />
        </div>
      )}

      {/* ── Toolbar: Search + Filters + Export ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar código ou descrição..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-cockpit-border bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowListFilter(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
              selectedLists.size > 0
                ? "border-cockpit-accent/40 bg-cockpit-accent/10 text-cockpit-accent"
                : "border-cockpit-border bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Listas{selectedLists.size > 0 ? ` (${selectedLists.size})` : ""}
          </button>
          {showListFilter && (
            <div className="absolute z-20 top-full mt-1 left-0 bg-white rounded-lg border border-cockpit-border shadow-lg p-2 min-w-[200px] max-h-60 overflow-y-auto">
              {priceLists.map(list => (
                <label key={list} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLists.has(list)}
                    onChange={() => toggleList(list)}
                    className="rounded border-gray-300 text-cockpit-accent focus:ring-cockpit-accent/30"
                  />
                  {list}
                </label>
              ))}
              {selectedLists.size > 0 && (
                <button
                  type="button"
                  onClick={() => { setSelectedLists(new Set()); setPage(0); }}
                  className="w-full mt-1 px-2 py-1.5 text-xs text-cockpit-accent hover:bg-cockpit-accent/10 rounded text-center"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm">
          <input
            type="number"
            placeholder="R$ min"
            value={priceMin}
            onChange={e => { setPriceMin(e.target.value); setPage(0); }}
            className="w-24 px-2 py-2 rounded-lg border border-cockpit-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30"
          />
          <span className="text-gray-400">–</span>
          <input
            type="number"
            placeholder="R$ max"
            value={priceMax}
            onChange={e => { setPriceMax(e.target.value); setPage(0); }}
            className="w-24 px-2 py-2 rounded-lg border border-cockpit-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30"
          />
          {(priceMin || priceMax) && (
            <button type="button" onClick={() => { setPriceMin(""); setPriceMax(""); setPage(0); }} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={sorted.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-cockpit-border bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors ml-auto"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
      </div>

      {/* ── Results count ── */}
      <p className="text-xs text-cockpit-muted">
        {fmtNum(filtered.length)} item(ns) encontrado(s)
        {selectedLists.size > 0 && ` · ${selectedLists.size} lista(s) selecionada(s)`}
      </p>

      {/* ── Pivot Table ── */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50/80">
                <th className="sticky left-0 z-10 bg-gray-50/80 px-3 py-2.5 text-left font-medium text-gray-700">
                  <button type="button" onClick={() => handleSort("itemCode")} className="flex items-center gap-1">
                    Código <SortIcon col="itemCode" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-700 min-w-[200px]">
                  <button type="button" onClick={() => handleSort("description")} className="flex items-center gap-1">
                    Descrição <SortIcon col="description" />
                  </button>
                </th>
                {visibleLists.map(list => (
                  <th key={list} className="px-3 py-2.5 text-right font-medium text-gray-700 whitespace-nowrap">
                    <button type="button" onClick={() => handleSort(list)} className="flex items-center gap-1 ml-auto">
                      {list} <SortIcon col={list} />
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium text-gray-700">
                  <button type="button" onClick={() => handleSort("minPrice")} className="flex items-center gap-1 ml-auto">
                    Menor <SortIcon col="minPrice" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-700">
                  <button type="button" onClick={() => handleSort("maxPrice")} className="flex items-center gap-1 ml-auto">
                    Maior <SortIcon col="maxPrice" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-700">
                  <button type="button" onClick={() => handleSort("avgPrice")} className="flex items-center gap-1 ml-auto">
                    Médio <SortIcon col="avgPrice" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/60">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleLists.length + 5} className="px-4 py-12 text-center text-cockpit-muted">
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                pageRows.map(row => (
                  <tr key={row.itemCode} className="hover:bg-gray-50/60 transition-colors">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-mono text-xs text-gray-800 whitespace-nowrap">
                      {row.itemCode}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[280px]" title={row.description}>
                      {row.description}
                    </td>
                    {visibleLists.map(list => {
                      const price = row.prices[list];
                      return (
                        <td key={list} className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                          {price !== null && price > 0 ? (
                            <span className={
                              price === row.maxPrice && row.listCount > 1
                                ? "text-cockpit-accent font-semibold"
                                : price === row.minPrice && row.listCount > 1
                                  ? "text-emerald-600"
                                  : "text-gray-700"
                            }>
                              {fmtBRL(price)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600 whitespace-nowrap">
                      {fmtBRL(row.minPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-cockpit-accent whitespace-nowrap">
                      {fmtBRL(row.maxPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-600 whitespace-nowrap">
                      {fmtBRL(row.avgPrice)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cockpit-border bg-gray-50/50">
            <span className="text-xs text-cockpit-muted">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} de {fmtNum(sorted.length)}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(0)} disabled={page === 0}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                {page + 1} / {totalPages}
              </span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── KPI Card ── */
function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl border border-cockpit-border ${bg} p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-xs text-cockpit-muted font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-[10px] text-cockpit-muted mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
