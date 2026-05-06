"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DollarSign, Search, Download, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  TrendingUp, ShoppingCart, Users, X, Calendar, Tag,
  BarChart3, ChevronDown,
} from "lucide-react";
import { fmtBRL, fmtNum, fmtDateShort, exportCSV } from "@/lib/format";
import {
  fetchPracticedPrices,
  fetchItemPrices,
  type PracticedPriceRow,
  type ItemPriceRow,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";

type SortKey = keyof PracticedPriceRow | "spread";
type SortDir = "asc" | "desc";
type Tab = "practiced" | "lists";

const PAGE_SIZE = 30;

export default function PrecosPage() {
  const {
    data: practicedData,
    loading: loadingPracticed,
    error: errorPracticed,
    refetch: refetchPracticed,
  } = useFetch(() => fetchPracticedPrices(), []);

  const {
    data: listData,
    loading: loadingLists,
  } = useFetch(() => fetchItemPrices(), []);

  const [tab, setTab] = useState<Tab>("practiced");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<string>("");

  const loading = loadingPracticed || loadingLists;
  const error = errorPracticed;

  // ── Practiced prices logic ──

  const practicedItems = useMemo(() => practicedData?.items ?? [], [practicedData]);

  const filtered = useMemo(() => {
    if (!search) return practicedItems;
    const q = search.toLowerCase();
    return practicedItems.filter(
      (r) =>
        r.item_code.toLowerCase().includes(q) ||
        r.item_description.toLowerCase().includes(q),
    );
  }, [practicedItems, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;

      if (sortKey === "item_code") {
        va = a.item_code;
        vb = b.item_code;
      } else if (sortKey === "item_description") {
        va = a.item_description;
        vb = b.item_description;
      } else if (sortKey === "spread") {
        va = a.max_price - a.min_price;
        vb = b.max_price - b.min_price;
      } else {
        const key = sortKey as keyof PracticedPriceRow;
        va = (a[key] as number) ?? 0;
        vb = (b[key] as number) ?? 0;
      }

      if (typeof va === "string" && typeof vb === "string")
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc"
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── SAP Price Lists logic ──

  const priceLists = useMemo(() => listData?.priceLists ?? [], [listData]);

  const activeList = selectedList || priceLists[0] || "";

  const listItems = useMemo(() => {
    if (!listData?.items || !activeList) return [];
    return listData.items
      .filter((r) => r.ListName === activeList)
      .sort((a, b) => b.Price - a.Price);
  }, [listData, activeList]);

  const listHasData = useMemo(
    () => listData?.items?.some((r) => r.Price > 0) ?? false,
    [listData],
  );

  // ── KPIs ──

  const kpis = useMemo(() => {
    if (!practicedData) return null;
    const items = practicedData.items;
    const t = practicedData.totals;

    const avgPrice =
      items.length > 0
        ? items.reduce((sum, r) => sum + r.avg_price, 0) / items.length
        : 0;

    let topItem = { code: "—", price: 0 };
    for (const r of items) {
      if (r.max_price > topItem.price)
        topItem = { code: r.item_code, price: r.max_price };
    }

    const uniqueClients = items.reduce(
      (max, r) => Math.max(max, r.unique_clients),
      0,
    );
    const totalClients = new Set(items.map((r) => r.unique_clients)).size;

    return {
      totalItems: items.length,
      avgPrice,
      topItem,
      totalRevenue: t.totalRevenue,
      totalSales: t.totalSales,
      totalQty: t.totalQty,
      uniqueClients,
      totalClients,
    };
  }, [practicedData]);

  // ── Handlers ──

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir(key === "item_code" || key === "item_description" ? "asc" : "desc");
      return key;
    });
    setPage(0);
  }, []);

  const handleExport = useCallback(() => {
    if (!sorted.length) return;
    const csvRows = sorted.map((r) => ({
      Codigo: r.item_code,
      Descricao: r.item_description,
      "Ultimo Preco": r.last_price,
      "Preco Medio": r.avg_price,
      "Preco Minimo": r.min_price,
      "Preco Maximo": r.max_price,
      "Preco Mediano": r.median_price,
      "Desconto Medio (%)": r.avg_discount,
      "Qtd Vendida": r.total_qty_sold,
      "Receita Total": r.total_revenue,
      "Num Vendas": r.sale_count,
      "Clientes Unicos": r.unique_clients,
      "Ultima Venda": r.last_sale_date ?? "",
    }));
    exportCSV(csvRows, `precos-praticados-${new Date().toISOString().slice(0, 10)}`);
  }, [sorted]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-cockpit-accent" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cockpit-accent" />
    );
  }

  function PriceBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-cockpit-accent/60 rounded-full motion-safe:transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={refetchPracticed} />;

  const maxRevenue = Math.max(...practicedItems.map((r) => r.total_revenue), 1);

  return (
    <div className="space-y-5">
      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => { setTab("practiced"); setPage(0); setSearch(""); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg motion-safe:transition-all ${
            tab === "practiced"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Preços Praticados
        </button>
        <button
          type="button"
          onClick={() => { setTab("lists"); setPage(0); setSearch(""); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg motion-safe:transition-all ${
            tab === "lists"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Tag className="w-4 h-4" />
          Listas de Preço SAP
          {!listHasData && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded-full font-medium">
              Sem dados
            </span>
          )}
        </button>
      </div>

      {tab === "practiced" ? (
        <PracticedTab
          kpis={kpis}
          search={search}
          setSearch={(v) => { setSearch(v); setPage(0); }}
          handleExport={handleExport}
          filtered={filtered}
          pageRows={pageRows}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          sorted={sorted}
          handleSort={handleSort}
          SortIcon={SortIcon}
          PriceBar={PriceBar}
          maxRevenue={maxRevenue}
          expandedItem={expandedItem}
          setExpandedItem={setExpandedItem}
        />
      ) : (
        <ListsTab
          priceLists={priceLists}
          activeList={activeList}
          setSelectedList={setSelectedList}
          listItems={listItems}
          listHasData={listHasData}
          search={search}
          setSearch={(v) => { setSearch(v); setPage(0); }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PRACTICED PRICES TAB
   ══════════════════════════════════════════════ */

function PracticedTab({
  kpis,
  search,
  setSearch,
  handleExport,
  filtered,
  pageRows,
  page,
  setPage,
  totalPages,
  sorted,
  handleSort,
  SortIcon,
  PriceBar,
  maxRevenue,
  expandedItem,
  setExpandedItem,
}: {
  kpis: {
    totalItems: number;
    avgPrice: number;
    topItem: { code: string; price: number };
    totalRevenue: number;
    totalSales: number;
    totalQty: number;
    uniqueClients: number;
    totalClients: number;
  } | null;
  search: string;
  setSearch: (v: string) => void;
  handleExport: () => void;
  filtered: PracticedPriceRow[];
  pageRows: PracticedPriceRow[];
  page: number;
  setPage: (v: number | ((p: number) => number)) => void;
  totalPages: number;
  sorted: PracticedPriceRow[];
  handleSort: (key: SortKey) => void;
  SortIcon: React.ComponentType<{ col: SortKey }>;
  PriceBar: React.ComponentType<{ value: number; max: number }>;
  maxRevenue: number;
  expandedItem: string | null;
  setExpandedItem: (v: string | null) => void;
}) {
  return (
    <>
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-cockpit-border bg-white p-4 hover:border-cockpit-accent/30 motion-safe:transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-cockpit-muted">Receita Total</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{fmtBRL(kpis.totalRevenue)}</p>
            <p className="text-[11px] text-cockpit-muted mt-1">{fmtNum(kpis.totalSales)} vendas registradas</p>
          </div>

          <div className="rounded-xl border border-cockpit-border bg-white p-4 hover:border-cockpit-accent/30 motion-safe:transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-cockpit-muted">Preço Médio</span>
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{fmtBRL(kpis.avgPrice)}</p>
            <p className="text-[11px] text-cockpit-muted mt-1">{fmtNum(kpis.totalItems)} itens com preço</p>
          </div>

          <div className="rounded-xl border border-cockpit-border bg-white p-4 hover:border-cockpit-accent/30 motion-safe:transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-cockpit-muted">Item Mais Caro</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{fmtBRL(kpis.topItem.price)}</p>
            <p className="text-[11px] text-cockpit-muted mt-1 truncate" title={kpis.topItem.code}>{kpis.topItem.code}</p>
          </div>

          <div className="rounded-xl border border-cockpit-border bg-white p-4 hover:border-cockpit-accent/30 motion-safe:transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-cockpit-muted">Quantidade Vendida</span>
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{fmtNum(Math.round(kpis.totalQty))}</p>
            <p className="text-[11px] text-cockpit-muted mt-1">unidades em pedidos</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-xs text-cockpit-muted">
          {fmtNum(filtered.length)} item(ns)
        </span>

        <button
          type="button"
          onClick={handleExport}
          disabled={sorted.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-cockpit-border bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 motion-safe:transition-colors ml-auto"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50/80">
                <ThSort col="item_code" label="Código" onClick={handleSort} Icon={SortIcon} />
                <ThSort col="item_description" label="Descrição" onClick={handleSort} Icon={SortIcon} className="min-w-[220px]" />
                <ThSort col="last_price" label="Último Preço" onClick={handleSort} Icon={SortIcon} align="right" />
                <ThSort col="avg_price" label="Preço Médio" onClick={handleSort} Icon={SortIcon} align="right" />
                <ThSort col="min_price" label="Mínimo" onClick={handleSort} Icon={SortIcon} align="right" />
                <ThSort col="max_price" label="Máximo" onClick={handleSort} Icon={SortIcon} align="right" />
                <ThSort col="total_revenue" label="Receita" onClick={handleSort} Icon={SortIcon} align="right" />
                <ThSort col="sale_count" label="Vendas" onClick={handleSort} Icon={SortIcon} align="right" />
                <th className="px-3 py-2.5 text-center font-medium text-gray-700 text-xs w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-cockpit-muted">
                      <Search className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">Nenhum item encontrado</p>
                      <p className="text-xs">Tente buscar por outro termo</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <PracticedRow
                    key={row.item_code}
                    row={row}
                    maxRevenue={maxRevenue}
                    PriceBar={PriceBar}
                    expanded={expandedItem === row.item_code}
                    onToggle={() =>
                      setExpandedItem(
                        expandedItem === row.item_code ? null : row.item_code,
                      )
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={sorted.length}
            pageSize={PAGE_SIZE}
            setPage={setPage}
          />
        )}
      </div>
    </>
  );
}

/* ── Practiced Row ── */
function PracticedRow({
  row,
  maxRevenue,
  PriceBar,
  expanded,
  onToggle,
}: {
  row: PracticedPriceRow;
  maxRevenue: number;
  PriceBar: React.ComponentType<{ value: number; max: number }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const spread = row.max_price - row.min_price;
  const hasVariation = spread > 0;

  return (
    <>
      <tr className="hover:bg-gray-50/60 motion-safe:transition-colors group">
        <td className="px-3 py-2.5 font-mono text-xs text-gray-800 whitespace-nowrap">
          {row.item_code}
        </td>
        <td
          className="px-3 py-2.5 text-gray-600 text-xs truncate max-w-[280px]"
          title={row.item_description}
        >
          {row.item_description}
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="font-mono text-xs font-semibold text-gray-900">
            {fmtBRL(row.last_price)}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">
          {fmtBRL(row.avg_price)}
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-600">
          {fmtBRL(row.min_price)}
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-xs text-cockpit-accent">
          {fmtBRL(row.max_price)}
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-xs text-gray-700">
              {fmtBRL(row.total_revenue)}
            </span>
            <div className="w-16">
              <PriceBar value={row.total_revenue} max={maxRevenue} />
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full tabular-nums">
            {fmtNum(row.sale_count)}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center">
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded hover:bg-gray-200 motion-safe:transition-colors text-gray-400 hover:text-gray-600"
            title="Ver detalhes"
          >
            <ChevronDown
              className={`w-4 h-4 motion-safe:transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-gray-50/50 px-6 py-4 border-b border-cockpit-border/30">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
              <DetailCell
                icon={<Calendar className="w-3.5 h-3.5 text-cockpit-muted" />}
                label="Última Venda"
                value={fmtDateShort(row.last_sale_date)}
              />
              <DetailCell
                icon={<DollarSign className="w-3.5 h-3.5 text-cockpit-muted" />}
                label="Preço Mediano"
                value={fmtBRL(row.median_price)}
              />
              <DetailCell
                icon={<TrendingUp className="w-3.5 h-3.5 text-cockpit-muted" />}
                label="Variação"
                value={hasVariation ? fmtBRL(spread) : "Sem variação"}
                valueClass={hasVariation ? "text-amber-700" : "text-gray-400"}
              />
              <DetailCell
                icon={<Tag className="w-3.5 h-3.5 text-cockpit-muted" />}
                label="Desconto Médio"
                value={`${row.avg_discount.toFixed(1)}%`}
                valueClass={row.avg_discount > 0 ? "text-emerald-600" : "text-gray-400"}
              />
              <DetailCell
                icon={<Users className="w-3.5 h-3.5 text-cockpit-muted" />}
                label="Clientes Únicos"
                value={String(row.unique_clients)}
              />
              <DetailCell
                icon={<ShoppingCart className="w-3.5 h-3.5 text-cockpit-muted" />}
                label="Qtd Total Vendida"
                value={fmtNum(Math.round(row.total_qty_sold))}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailCell({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-cockpit-muted text-[10px] uppercase tracking-wider">{label}</p>
        <p className={`font-medium text-sm tabular-nums ${valueClass ?? "text-gray-900"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   SAP PRICE LISTS TAB
   ══════════════════════════════════════════════ */

function ListsTab({
  priceLists,
  activeList,
  setSelectedList,
  listItems,
  listHasData,
  search,
  setSearch,
}: {
  priceLists: string[];
  activeList: string;
  setSelectedList: (v: string) => void;
  listItems: ItemPriceRow[];
  listHasData: boolean;
  search: string;
  setSearch: (v: string) => void;
}) {
  const filteredListItems = useMemo(() => {
    if (!search) return listItems;
    const q = search.toLowerCase();
    return listItems.filter((r) => r.ItemCode.toLowerCase().includes(q));
  }, [listItems, search]);

  if (!listHasData) {
    return (
      <div className="rounded-xl border border-cockpit-border bg-white p-12">
        <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
          <div className="p-4 rounded-full bg-amber-50">
            <Tag className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <p className="text-gray-900 font-semibold text-lg">Listas de preço sem valores</p>
            <p className="text-sm text-cockpit-muted mt-2">
              As listas de preço do SAP B1 ({priceLists.length} listas encontradas)
              estão com todos os valores em R$ 0,00. Os preços devem ser configurados
              diretamente no SAP B1 (ITM1/OPLN) para aparecerem aqui.
            </p>
          </div>
          <div className="mt-2 px-4 py-3 bg-gray-50 rounded-lg text-xs text-cockpit-muted text-left w-full">
            <p className="font-medium text-gray-700 mb-1">Listas encontradas:</p>
            <div className="flex flex-wrap gap-1.5">
              {priceLists.map((l) => (
                <span key={l} className="px-2 py-0.5 bg-white rounded border border-cockpit-border text-gray-600">
                  {l}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-cockpit-muted">
            Utilize a aba <strong>Preços Praticados</strong> para ver os preços reais
            baseados em pedidos de venda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* List selector + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-cockpit-muted">Lista:</span>
          <div className="flex flex-wrap gap-1">
            {priceLists.map((list) => (
              <button
                key={list}
                type="button"
                onClick={() => setSelectedList(list)}
                className={`px-3 py-1.5 text-xs rounded-lg border motion-safe:transition-colors ${
                  activeList === list
                    ? "border-cockpit-accent bg-cockpit-accent text-white"
                    : "border-cockpit-border bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {list}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex-1 min-w-[160px] max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-cockpit-border bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30"
          />
        </div>
      </div>

      <p className="text-xs text-cockpit-muted">
        {fmtNum(filteredListItems.length)} itens na lista <strong>{activeList}</strong>
      </p>

      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50/80">
                <th className="px-3 py-2.5 text-left font-medium text-gray-700 text-xs">
                  Código
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-700 text-xs">
                  Preço
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filteredListItems.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-12 text-center text-cockpit-muted text-sm">
                    Nenhum item encontrado nesta lista.
                  </td>
                </tr>
              ) : (
                filteredListItems.slice(0, 100).map((r, i) => (
                  <tr key={`${r.ItemCode}-${i}`} className="hover:bg-gray-50/60 motion-safe:transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-gray-800">
                      {r.ItemCode}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.Price > 0 ? (
                        <span className="text-gray-900 font-medium">{fmtBRL(r.Price)}</span>
                      ) : (
                        <span className="text-gray-300">R$ 0,00</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredListItems.length > 100 && (
          <div className="px-4 py-3 border-t border-cockpit-border bg-gray-50/50 text-xs text-cockpit-muted text-center">
            Mostrando 100 de {fmtNum(filteredListItems.length)} itens
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════ */

function ThSort({
  col,
  label,
  onClick,
  Icon,
  align = "left",
  className,
}: {
  col: SortKey;
  label: string;
  onClick: (key: SortKey) => void;
  Icon: React.ComponentType<{ col: SortKey }>;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th className={`px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`flex items-center gap-1 ${align === "right" ? "ml-auto" : ""}`}
      >
        {label} <Icon col={col} />
      </button>
    </th>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  setPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  setPage: (v: number | ((p: number) => number)) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-cockpit-border bg-gray-50/50">
      <span className="text-xs text-cockpit-muted tabular-nums">
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalItems)} de{" "}
        {fmtNum(totalItems)}
      </span>
      <div className="flex items-center gap-1">
        <PagBtn onClick={() => setPage(0)} disabled={page === 0}>
          <ChevronsLeft className="w-4 h-4" />
        </PagBtn>
        <PagBtn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          <ChevronLeft className="w-4 h-4" />
        </PagBtn>
        <span className="px-3 text-xs text-gray-600 tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <PagBtn
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </PagBtn>
        <PagBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
          <ChevronsRight className="w-4 h-4" />
        </PagBtn>
      </div>
    </div>
  );
}

function PagBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 motion-safe:transition-colors"
    >
      {children}
    </button>
  );
}
