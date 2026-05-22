"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Calculator, Search, Download, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  AlertCircle, Package, TrendingUp, X, RefreshCw, Pencil,
} from "lucide-react";
import { fmtBRL, fmtNum, exportCSV } from "@/lib/format";
import { fetchMarkupItems, type MarkupItem } from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { calcCMV, calcLucro, IG, getMarkupPrefix, isMarkupCatalogItem, MARKUP_ITEM_PREFIXES, type MarkupCostParams } from "@/lib/markup-engine";
import Link from "next/link";

type SortKey = "itemCode" | "itemName" | "manufacturer" | "v" | "cmv" | "margem12s" | "margem12p";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;
const CF_SACO = 0.06;
const CF_PALLET = 0.03;

function costParams(item: MarkupItem): MarkupCostParams {
  return { v: item.v, fr: item.fr, sc: item.sc, co: item.co, pc: item.pc, ic: item.ic, ip: item.ip };
}

function MargemBadge({ value }: { value: number | null }) {
  if (value === null || isNaN(value)) return <span className="text-gray-300">&mdash;</span>;
  const pct = (value * 100).toFixed(1);
  const cls =
    value >= 0.15 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
    value >= 0.05 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
    value >= 0 ? "bg-red-50 text-red-600 ring-1 ring-red-200" :
    "bg-red-100 text-red-800 ring-1 ring-red-300";
  return <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{pct}%</span>;
}

function PageButton({
  onClick, disabled, children, title,
}: {
  onClick: () => void; disabled: boolean; children: React.ReactNode; title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed motion-safe:transition-colors"
    >
      {children}
    </button>
  );
}

export default function MarkupPage() {
  const { data, loading, error, refetch } = useFetch(() => fetchMarkupItems(), []);

  const [search, setSearch] = useState("");
  const [filterPrefix, setFilterPrefix] = useState("TODOS");
  const [filterMfr, setFilterMfr] = useState("TODOS");
  const [sortKey, setSortKey] = useState<SortKey>("itemCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const items = useMemo(
    () => (data?.items ?? []).filter((i) => isMarkupCatalogItem(i.itemCode)),
    [data],
  );

  const prefixes = useMemo(() => {
    const present = new Set(items.map((i) => getMarkupPrefix(i.itemCode)).filter(Boolean));
    return ["TODOS", ...MARKUP_ITEM_PREFIXES.filter((p) => present.has(p))];
  }, [items]);

  const manufacturers = useMemo(() => {
    const s = new Set(items.filter((i) => i.manufacturer).map((i) => i.manufacturer));
    return ["TODOS", ...Array.from(s).sort()];
  }, [items]);

  const enriched = useMemo(
    () =>
      items.map((item) => {
        const cp = costParams(item);
        const cmv = calcCMV(cp);
        const m12s = calcLucro(item.prices["PL_1"] ? item.prices["PL_1"] * 1000 : 0, {
          ...cp, icmsVenda: 0.12, ig: IG, cf: CF_SACO,
        });
        const m12p = calcLucro(item.prices["PL_2"] ? item.prices["PL_2"] * 1000 : 0, {
          ...cp, icmsVenda: 0.12, ig: IG, cf: CF_PALLET,
        });
        return { ...item, cmv, m12s, m12p };
      }),
    [items],
  );

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterPrefix !== "TODOS") {
      result = result.filter((i) => getMarkupPrefix(i.itemCode) === filterPrefix);
    }
    if (filterMfr !== "TODOS") result = result.filter((i) => i.manufacturer === filterMfr);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.itemCode.toLowerCase().includes(s) ||
          i.itemName.toLowerCase().includes(s) ||
          i.manufacturer.toLowerCase().includes(s),
      );
    }
    return result;
  }, [enriched, search, filterPrefix, filterMfr]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortKey) {
        case "itemCode": va = a.itemCode; vb = b.itemCode; break;
        case "itemName": va = a.itemName; vb = b.itemName; break;
        case "manufacturer": va = a.manufacturer; vb = b.manufacturer; break;
        case "v": va = a.v; vb = b.v; break;
        case "cmv": va = a.cmv; vb = b.cmv; break;
        case "margem12s": va = a.m12s ?? -999; vb = b.m12s ?? -999; break;
        case "margem12p": va = a.m12p ?? -999; vb = b.m12p ?? -999; break;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageItems = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const kpis = useMemo(() => {
    if (enriched.length === 0) return { total: 0, avgCmv: 0, avgMargem: 0, lowMargin: 0 };
    const withMargem = enriched.filter((i) => i.m12s !== null && i.m12s !== 0);
    const avgM = withMargem.length > 0 ? withMargem.reduce((s, i) => s + (i.m12s ?? 0), 0) / withMargem.length : 0;
    return {
      total: enriched.length,
      avgCmv: enriched.reduce((s, i) => s + i.cmv, 0) / enriched.length / 1000,
      avgMargem: avgM,
      lowMargin: enriched.filter((i) => i.m12s !== null && i.m12s < 0.05 && i.m12s !== 0).length,
    };
  }, [enriched]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  }, [sortKey]);

  const handleExport = useCallback(() => {
    exportCSV(
      filtered.map((i) => ({
        "Cod SAP": i.itemCode,
        Produto: i.itemName,
        Fornecedor: i.manufacturer,
        Sigla: getMarkupPrefix(i.itemCode) ?? "",
        Grupo: i.itemGroup,
        "Valor s/ Imp (milh)": i.v.toFixed(2),
        "Frete (milh)": i.fr.toFixed(2),
        "Embalagem (milh)": i.sc.toFixed(2),
        "Comissão (milh)": i.co.toFixed(2),
        "PIS/COFINS %": (i.pc * 100).toFixed(2),
        "ICMS Compra %": (i.ic * 100).toFixed(1),
        "IPI %": (i.ip * 100).toFixed(2),
        "CMV (milh)": i.cmv.toFixed(2),
        "CMV Unit": (i.cmv / 1000).toFixed(2),
        "Margem 12% Saco": i.m12s !== null ? (i.m12s * 100).toFixed(1) + "%" : "",
        "Margem 12% Pallet": i.m12p !== null ? (i.m12p * 100).toFixed(1) + "%" : "",
        Override: i.hasOverride ? "Sim" : "",
      })),
      "markup_garrafaria",
    );
  }, [filtered]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterPrefix("TODOS");
    setFilterMfr("TODOS");
    setPage(0);
  }, []);

  const hasActiveFilters = search || filterPrefix !== "TODOS" || filterMfr !== "TODOS";

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
      : <ArrowUpDown className="w-3 h-3 opacity-25" />;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">MarkUp &mdash; Precificação</h1>
          <p className="text-xs text-gray-500 mt-0.5">Cálculo de CMV, margens e ponto de equilíbrio por produto</p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 border border-cockpit-border hover:bg-gray-50 motion-safe:transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Package className="w-3.5 h-3.5" />Total de Produtos</div>
          <div className="text-2xl font-bold text-gray-900">{fmtNum(kpis.total)}</div>
        </div>
        <div className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Calculator className="w-3.5 h-3.5" />CMV Médio (unitário)</div>
          <div className="text-2xl font-bold text-gray-900">{fmtBRL(kpis.avgCmv)}</div>
        </div>
        <div className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><TrendingUp className="w-3.5 h-3.5" />Margem Média 12%</div>
          <div className={`text-2xl font-bold ${kpis.avgMargem >= 0.10 ? "text-emerald-700" : kpis.avgMargem >= 0.05 ? "text-amber-600" : "text-red-600"}`}>
            {(kpis.avgMargem * 100).toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><AlertCircle className="w-3.5 h-3.5 text-red-400" />Margem abaixo de 5%</div>
          <div className={`text-2xl font-bold ${kpis.lowMargin > 0 ? "text-red-600" : "text-gray-900"}`}>{fmtNum(kpis.lowMargin)}</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="rounded-xl border border-cockpit-border bg-white p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar código, produto ou fornecedor..."
              className="w-full pl-10 pr-8 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent transition-shadow"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(""); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={filterPrefix}
            onChange={(e) => { setFilterPrefix(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
          >
            {prefixes.map((p) => <option key={p} value={p}>{p === "TODOS" ? "Linha: Todas" : `Linha ${p}`}</option>)}
          </select>
          <select
            value={filterMfr}
            onChange={(e) => { setFilterMfr(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
          >
            {manufacturers.map((m) => <option key={m} value={m}>{m === "TODOS" ? "Fornecedor: Todos" : m}</option>)}
          </select>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 motion-safe:transition-colors"
          >
            <Download className="w-3.5 h-3.5" />Exportar CSV
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span><strong className="text-gray-700">{fmtNum(filtered.length)}</strong> produtos encontrados</span>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-cockpit-accent hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {([
                  ["itemCode", "Código SAP", "min-w-[110px]"],
                  ["itemName", "Produto", "min-w-[200px]"],
                  ["manufacturer", "Fornecedor", "min-w-[120px]"],
                  ["v", "Vlr s/ Imp", "min-w-[100px] text-right"],
                  ["cmv", "CMV Unit.", "min-w-[100px] text-right"],
                  ["margem12s", "Mg 12% Saco", "min-w-[100px] text-right"],
                  ["margem12p", "Mg 12% Pallet", "min-w-[110px] text-right"],
                ] as [SortKey, string, string][]).map(([key, label, cls]) => (
                  <th
                    key={key}
                    className={`px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800 motion-safe:transition-colors ${cls}`}
                    onClick={() => handleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">{label}<SortIcon col={key} /></span>
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map((item, idx) => (
                <tr key={item.itemCode} className={`group motion-safe:transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-cockpit-accent/5`}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/business-intelligence/markup/${encodeURIComponent(item.itemCode)}`}
                        className="text-cockpit-accent font-mono text-xs font-semibold hover:underline"
                      >
                        {item.itemCode}
                      </Link>
                      {item.hasOverride && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded ring-1 ring-amber-200" title="Valores editados manualmente">
                          <Pencil className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="max-w-[300px] truncate text-gray-800 text-xs" title={item.itemName}>{item.itemName}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{item.manufacturer || "—"}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-gray-700">{fmtBRL(item.v / 1000)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-gray-900">{fmtBRL(item.cmv / 1000)}</td>
                  <td className="px-3 py-3 text-right"><MargemBadge value={item.m12s} /></td>
                  <td className="px-3 py-3 text-right"><MargemBadge value={item.m12p} /></td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/business-intelligence/markup/${encodeURIComponent(item.itemCode)}`}
                      className="opacity-0 group-hover:opacity-100 inline-flex p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 motion-safe:transition-all"
                      title="Detalhar produto"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="text-gray-400 mb-2">Nenhum produto encontrado</div>
                    {hasActiveFilters && (
                      <button type="button" onClick={clearFilters} className="text-sm text-cockpit-accent hover:underline">
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} de {fmtNum(sorted.length)}
          </span>
          <div className="flex items-center gap-1">
            <PageButton onClick={() => setPage(0)} disabled={page === 0} title="Primeira página">
              <ChevronsLeft className="w-4 h-4" />
            </PageButton>
            <PageButton onClick={() => setPage(page - 1)} disabled={page === 0} title="Página anterior">
              <ChevronLeft className="w-4 h-4" />
            </PageButton>
            <span className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md min-w-[60px] text-center">
              {page + 1} / {totalPages}
            </span>
            <PageButton onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1} title="Próxima página">
              <ChevronRight className="w-4 h-4" />
            </PageButton>
            <PageButton onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} title="Última página">
              <ChevronsRight className="w-4 h-4" />
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}
