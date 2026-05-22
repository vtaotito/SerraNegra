"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Calculator, Search, Download, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  AlertCircle, Package, TrendingUp, X, RefreshCw, Pencil,
  ChevronDown, Save, Check, AlertTriangle, ExternalLink, Eraser,
  CircleDollarSign, Receipt, Loader2,
} from "lucide-react";
import { fmtBRL, fmtNum, exportCSV, getProductGroupColor, getProductGroupName } from "@/lib/format";
import {
  fetchMarkupItems,
  saveMarkupOverride,
  type MarkupItem,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import {
  calcCMV,
  calcLucro,
  IG,
  ICMS_FAIXAS,
  igForFaixa,
  getMarkupPrefix,
  isMarkupCatalogItem,
  MARKUP_ITEM_PREFIXES,
  type MarkupCostParams,
} from "@/lib/markup-engine";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type SortKey = "itemCode" | "itemName" | "manufacturer" | "v" | "cmv" | "margemSaco" | "margemPallet";
type SortDir = "asc" | "desc";
type QuickFilter = "override" | "semCmv" | "margemBaixa" | "pendentes";

const CF_SACO = 0.06;
const CF_PALLET = 0.03;

const PAGE_SIZES = [25, 50, 100, 250] as const;

const ICMS_OPTIONS = [
  { rate: 0.12, label: "12%", color: "#AF272F" },
  { rate: 0.07, label: "7%", color: "#7B1A1F" },
  { rate: 0.18, label: "18%", color: "#5B3A6B" },
  { rate: 0, label: "ME", color: "#8B7435" },
] as const;

const COST_FIELDS = [
  { key: "v", label: "Valor s/ Imp.", prefix: "R$", step: "0.01", hint: "Preço de compra sem impostos (por milheiro)" },
  { key: "fr", label: "Frete", prefix: "R$", step: "0.01", hint: "Frete por milheiro" },
  { key: "sc", label: "Embalagem", prefix: "R$", step: "0.01", hint: "Custo de embalagem / fardo / caixa" },
  { key: "co", label: "Comissão", prefix: "R$", step: "0.01", hint: "Comissão sobre venda" },
] as const;

const TRIBUTO_FIELDS = [
  { key: "pc", label: "PIS/COFINS", suffix: "%", step: "0.01", hint: "Alíquota PIS+COFINS na compra" },
  { key: "ic", label: "ICMS Compra", suffix: "%", step: "0.1", hint: "Alíquota ICMS na compra" },
  { key: "ip", label: "IPI", suffix: "%", step: "0.01", hint: "Alíquota IPI" },
] as const;

type CostFieldKey = (typeof COST_FIELDS)[number]["key"];
type TributoFieldKey = (typeof TRIBUTO_FIELDS)[number]["key"];
type EditableKey = CostFieldKey | TributoFieldKey;

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function MargemBadge({ value, size = "md" }: { value: number | null; size?: "sm" | "md" }) {
  if (value === null || isNaN(value)) return <span className="text-gray-300">&mdash;</span>;
  const pct = (value * 100).toFixed(1);
  const cls =
    value >= 0.15 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
    value >= 0.05 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
    value >= 0 ? "bg-red-50 text-red-600 ring-1 ring-red-200" :
    "bg-red-100 text-red-800 ring-1 ring-red-300";
  const sz = size === "sm" ? "px-1.5 py-0.5 text-[10px] min-w-[44px]" : "px-2 py-0.5 text-[11px] min-w-[52px]";
  return <span className={`inline-flex items-center justify-center rounded-full font-bold ${cls} ${sz}`}>{pct}%</span>;
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

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 ${
      type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {message}
    </div>
  );
}

function ChipFilter({
  active, count, onClick, color, children,
}: {
  active: boolean; count: number; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold motion-safe:transition-all ring-1 ${
        active
          ? "bg-cockpit-accent text-white ring-cockpit-accent shadow-sm"
          : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50 hover:text-gray-900"
      }`}
      style={active && color ? { background: color, borderColor: color } : undefined}
    >
      {children}
      <span className={`inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full text-[9px] font-bold ${
        active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
      }`}>{count}</span>
    </button>
  );
}

function InlineNumberInput({
  value, onChange, prefix, suffix, step, dirty,
}: {
  value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: string; dirty?: boolean;
}) {
  return (
    <div className={`flex items-center rounded-md ring-1 motion-safe:transition-all bg-white ${
      dirty ? "ring-amber-400 ring-2" : "ring-gray-200 focus-within:ring-cockpit-accent"
    }`}>
      {prefix && <span className="pl-2 text-[10px] font-semibold text-gray-400">{prefix}</span>}
      <input
        type="number"
        step={step ?? "0.01"}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full px-2 py-1.5 text-xs font-semibold text-right font-mono bg-transparent focus:outline-none"
      />
      {suffix && <span className="pr-2 text-[10px] text-gray-400">{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function costParams(item: MarkupItem): MarkupCostParams {
  return { v: item.v, fr: item.fr, sc: item.sc, co: item.co, pc: item.pc, ic: item.ic, ip: item.ip };
}

function applyEdits(item: MarkupItem, edits: Partial<Record<EditableKey, number>> | undefined): MarkupItem {
  if (!edits) return item;
  return { ...item, ...edits } as MarkupItem;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarkupPage() {
  const { data, loading, error, refetch } = useFetch(() => fetchMarkupItems(), []);

  // Filtros / paginação / ordenação
  const [search, setSearch] = useState("");
  const [filterPrefix, setFilterPrefix] = useState("TODOS");
  const [filterMfr, setFilterMfr] = useState("TODOS");
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilter>>(new Set());
  const [icmsRate, setIcmsRate] = useState<number>(0.12);
  const [sortKey, setSortKey] = useState<SortKey>("itemCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);

  // Edição inline
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [edits, setEdits] = useState<Map<string, Partial<Record<EditableKey, number>>>>(new Map());
  const [overrides, setOverrides] = useState<Map<string, Partial<Record<EditableKey, number>>>>(new Map());
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Catálogo filtrado pelas siglas
  const items = useMemo<MarkupItem[]>(
    () => (data?.items ?? []).filter((i) => isMarkupCatalogItem(i.itemCode)),
    [data],
  );

  // Item efetivo (com overrides salvos + edições pendentes)
  const effectiveItem = useCallback(
    (item: MarkupItem) => {
      const combined: Partial<Record<EditableKey, number>> = {
        ...(overrides.get(item.itemCode) ?? {}),
        ...(edits.get(item.itemCode) ?? {}),
      };
      return applyEdits(item, combined);
    },
    [edits, overrides],
  );

  const isDirty = useCallback((code: string) => Object.keys(edits.get(code) ?? {}).length > 0, [edits]);

  // Listas auxiliares para filtros
  const prefixes = useMemo(() => {
    const present = new Set(items.map((i) => getMarkupPrefix(i.itemCode)).filter(Boolean));
    return ["TODOS", ...MARKUP_ITEM_PREFIXES.filter((p) => present.has(p))];
  }, [items]);

  const manufacturers = useMemo(() => {
    const s = new Set(items.filter((i) => i.manufacturer).map((i) => i.manufacturer));
    return ["TODOS", ...Array.from(s).sort()];
  }, [items]);

  // Enriquecimento (CMV + margens calculados via item efetivo)
  const enriched = useMemo(
    () =>
      items.map((raw) => {
        const item = effectiveItem(raw);
        const cp = costParams(item);
        const cmv = calcCMV(cp);
        const ig = igForFaixa(icmsRate);
        const mSaco = calcLucro(
          item.prices["PL_1"] ? item.prices["PL_1"] * 1000 : 0,
          { ...cp, icmsVenda: icmsRate, ig, cf: CF_SACO },
        );
        const mPallet = calcLucro(
          item.prices["PL_2"] ? item.prices["PL_2"] * 1000 : 0,
          { ...cp, icmsVenda: icmsRate, ig, cf: CF_PALLET },
        );
        const noCost = item.v === 0 && item.fr === 0 && item.sc === 0 && item.co === 0;
        return {
          ...item,
          rawV: raw.v,
          rawHasOverride: raw.hasOverride,
          cmv,
          mSaco,
          mPallet,
          isDirty: isDirty(item.itemCode),
          noCost,
        };
      }),
    [items, effectiveItem, icmsRate, isDirty],
  );

  // KPIs (sobre TODOS os itens, antes do filtro)
  const kpis = useMemo(() => {
    if (enriched.length === 0) return { total: 0, withOverride: 0, noCost: 0, lowMargin: 0, dirty: 0 };
    return {
      total: enriched.length,
      withOverride: enriched.filter((i) => i.rawHasOverride || overrides.has(i.itemCode)).length,
      noCost: enriched.filter((i) => i.noCost).length,
      lowMargin: enriched.filter((i) => i.mSaco !== null && i.mSaco < 0.05 && i.v > 0).length,
      dirty: edits.size,
    };
  }, [enriched, edits, overrides]);

  // Filtragem
  const filtered = useMemo(() => {
    let result = enriched;
    if (filterPrefix !== "TODOS") result = result.filter((i) => getMarkupPrefix(i.itemCode) === filterPrefix);
    if (filterMfr !== "TODOS") result = result.filter((i) => i.manufacturer === filterMfr);
    if (quickFilters.has("override")) result = result.filter((i) => i.rawHasOverride || overrides.has(i.itemCode));
    if (quickFilters.has("semCmv")) result = result.filter((i) => i.v === 0);
    if (quickFilters.has("margemBaixa")) result = result.filter((i) => i.mSaco !== null && i.mSaco < 0.05 && i.v > 0);
    if (quickFilters.has("pendentes")) result = result.filter((i) => i.isDirty);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.itemCode.toLowerCase().includes(s) ||
          i.itemName.toLowerCase().includes(s) ||
          (i.manufacturer ?? "").toLowerCase().includes(s),
      );
    }
    return result;
  }, [enriched, search, filterPrefix, filterMfr, quickFilters, overrides]);

  // KPIs do filtro
  const filterKpis = useMemo(() => {
    if (filtered.length === 0) return { count: 0, avgCmv: 0, avgMargem: null as number | null };
    const withCmv = filtered.filter((i) => i.cmv > 0);
    const withMargem = filtered.filter((i) => i.mSaco !== null && i.mSaco !== 0);
    return {
      count: filtered.length,
      avgCmv: withCmv.length > 0 ? withCmv.reduce((s, i) => s + i.cmv, 0) / withCmv.length / 1000 : 0,
      avgMargem: withMargem.length > 0 ? withMargem.reduce((s, i) => s + (i.mSaco ?? 0), 0) / withMargem.length : null,
    };
  }, [filtered]);

  // Ordenação
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortKey) {
        case "itemCode": va = a.itemCode; vb = b.itemCode; break;
        case "itemName": va = a.itemName; vb = b.itemName; break;
        case "manufacturer": va = a.manufacturer ?? ""; vb = b.manufacturer ?? ""; break;
        case "v": va = a.v; vb = b.v; break;
        case "cmv": va = a.cmv; vb = b.cmv; break;
        case "margemSaco": va = a.mSaco ?? -999; vb = b.mSaco ?? -999; break;
        case "margemPallet": va = a.mPallet ?? -999; vb = b.mPallet ?? -999; break;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Paginação
  const effectivePageSize = pageSize >= sorted.length ? sorted.length : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(sorted.length / effectivePageSize) : 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageItems = pageSize >= sorted.length
    ? sorted
    : sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // ---------- Edição inline ----------

  const handleEdit = useCallback((code: string, key: EditableKey, value: number) => {
    setEdits((prev) => {
      const m = new Map(prev);
      const cur = { ...(m.get(code) ?? {}) };
      cur[key] = value;
      m.set(code, cur);
      return m;
    });
  }, []);

  const cancelEdits = useCallback((code: string) => {
    setEdits((prev) => {
      const m = new Map(prev);
      m.delete(code);
      return m;
    });
  }, []);

  const saveRow = useCallback(async (code: string) => {
    const ed = edits.get(code);
    if (!ed || Object.keys(ed).length === 0) return;
    setSavingCode(code);
    try {
      await saveMarkupOverride({
        itemCode: code,
        precoSemImp: ed.v ?? null,
        frete: ed.fr ?? null,
        embalagem: ed.sc ?? null,
        comissao: ed.co ?? null,
        pisCofins: ed.pc ?? null,
        icmsCompra: ed.ic ?? null,
        ipi: ed.ip ?? null,
      });
      setOverrides((prev) => {
        const m = new Map(prev);
        m.set(code, { ...(m.get(code) ?? {}), ...ed });
        return m;
      });
      setEdits((prev) => {
        const m = new Map(prev);
        m.delete(code);
        return m;
      });
      setToast({ message: `${code} atualizado`, type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Falha ao salvar",
        type: "error",
      });
    } finally {
      setSavingCode(null);
    }
  }, [edits]);

  // Salva todos os pendentes (atômico — usa snapshot estável de edits)
  const saveAllPending = useCallback(async () => {
    const entries = Array.from(edits.entries());
    if (entries.length === 0) return;
    setSavingCode("__all__");
    const succeeded: Array<[string, Partial<Record<EditableKey, number>>]> = [];
    const failed: string[] = [];
    for (const [code, ed] of entries) {
      try {
        await saveMarkupOverride({
          itemCode: code,
          precoSemImp: ed.v ?? null,
          frete: ed.fr ?? null,
          embalagem: ed.sc ?? null,
          comissao: ed.co ?? null,
          pisCofins: ed.pc ?? null,
          icmsCompra: ed.ic ?? null,
          ipi: ed.ip ?? null,
        });
        succeeded.push([code, ed]);
      } catch {
        failed.push(code);
      }
    }
    setOverrides((prev) => {
      const m = new Map(prev);
      for (const [code, ed] of succeeded) m.set(code, { ...(m.get(code) ?? {}), ...ed });
      return m;
    });
    setEdits((prev) => {
      const m = new Map(prev);
      for (const [code] of succeeded) m.delete(code);
      return m;
    });
    setSavingCode(null);
    const ok = succeeded.length;
    setToast({
      message: failed.length === 0
        ? `${ok} produto${ok > 1 ? "s" : ""} salvo${ok > 1 ? "s" : ""}`
        : `${ok} salvos, ${failed.length} com erro`,
      type: failed.length === 0 ? "success" : "error",
    });
  }, [edits]);

  // ---------- Atalhos ----------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (expandedCode && edits.has(expandedCode)) saveRow(expandedCode);
      }
      if (e.key === "Escape" && expandedCode) {
        if (edits.has(expandedCode)) cancelEdits(expandedCode);
        setExpandedCode(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedCode, edits, saveRow, cancelEdits]);

  // ---------- UI helpers ----------

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "itemCode" ? "asc" : "desc"); }
    setPage(0);
  }, [sortKey]);

  const toggleQuick = useCallback((q: QuickFilter) => {
    setQuickFilters((prev) => {
      const s = new Set(prev);
      if (s.has(q)) s.delete(q); else s.add(q);
      return s;
    });
    setPage(0);
  }, []);

  const handleExport = useCallback(() => {
    exportCSV(
      filtered.map((i) => ({
        "Cod SAP": i.itemCode,
        Produto: i.itemName,
        Fornecedor: i.manufacturer,
        Sigla: getMarkupPrefix(i.itemCode) ?? "",
        "Valor s/ Imp (milh)": i.v.toFixed(2),
        "Frete (milh)": i.fr.toFixed(2),
        "Embalagem (milh)": i.sc.toFixed(2),
        "Comissão (milh)": i.co.toFixed(2),
        "PIS/COFINS %": (i.pc * 100).toFixed(2),
        "ICMS Compra %": (i.ic * 100).toFixed(1),
        "IPI %": (i.ip * 100).toFixed(2),
        "CMV (milh)": i.cmv.toFixed(2),
        "CMV Unit": (i.cmv / 1000).toFixed(2),
        "Margem Saco": i.mSaco !== null ? (i.mSaco * 100).toFixed(1) + "%" : "",
        "Margem Pallet": i.mPallet !== null ? (i.mPallet * 100).toFixed(1) + "%" : "",
        Override: i.rawHasOverride || overrides.has(i.itemCode) ? "Sim" : "",
      })),
      `markup_${icmsRate === 0 ? "ME" : `ICMS${(icmsRate * 100).toFixed(0)}`}`,
    );
  }, [filtered, overrides, icmsRate]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterPrefix("TODOS");
    setFilterMfr("TODOS");
    setQuickFilters(new Set());
    setPage(0);
  }, []);

  const hasActiveFilters = search || filterPrefix !== "TODOS" || filterMfr !== "TODOS" || quickFilters.size > 0;

  // ---------- Render ----------

  if (loading) return <LoadingSkeleton rows={10} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
      : <ArrowUpDown className="w-3 h-3 opacity-25" />;

  const icmsActive = ICMS_OPTIONS.find((o) => o.rate === icmsRate) ?? ICMS_OPTIONS[0];

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">MarkUp &mdash; Precificação</h1>
          <p className="text-xs text-gray-500 mt-0.5">Edite custos e tributos diretamente na linha. Margens recalculam ao vivo.</p>
        </div>
        <div className="flex items-center gap-2">
          {edits.size > 0 && (
            <button
              type="button"
              onClick={saveAllPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 motion-safe:transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar {edits.size} pendente{edits.size > 1 ? "s" : ""}
            </button>
          )}
          <button
            type="button"
            onClick={refetch}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 border border-cockpit-border hover:bg-gray-50 motion-safe:transition-colors"
            title="Recarregar dados do servidor"
          >
            <RefreshCw className="w-3.5 h-3.5" />Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5"><Package className="w-3 h-3" />Total no catálogo</div>
          <div className="text-xl font-bold text-gray-900">{fmtNum(kpis.total)}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{fmtNum(filterKpis.count)} no filtro atual</div>
        </div>
        <div className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5"><Pencil className="w-3 h-3 text-amber-500" />Com override</div>
          <div className="text-xl font-bold text-gray-900">{fmtNum(kpis.withOverride)}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{((kpis.withOverride / Math.max(kpis.total, 1)) * 100).toFixed(0)}% editados manualmente</div>
        </div>
        <div className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5"><Calculator className="w-3 h-3" />CMV Médio</div>
          <div className="text-xl font-bold text-gray-900">{fmtBRL(filterKpis.avgCmv)}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">unitário, filtro atual</div>
        </div>
        <div className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5"><TrendingUp className="w-3 h-3" />Margem Média</div>
          {filterKpis.avgMargem !== null ? (
            <>
              <div className={`text-xl font-bold ${
                filterKpis.avgMargem >= 0.10 ? "text-emerald-700" :
                filterKpis.avgMargem >= 0.05 ? "text-amber-600" : "text-red-600"
              }`}>
                {(filterKpis.avgMargem * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">ICMS {icmsActive.label} · saco</div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-gray-300">&mdash;</div>
              <div className="text-[10px] text-gray-400 mt-0.5">sem preço de venda</div>
            </>
          )}
        </div>
        <div className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5"><AlertCircle className="w-3 h-3 text-red-400" />Atenção</div>
          <div className="text-xl font-bold text-gray-900">{fmtNum(kpis.lowMargin + kpis.noCost)}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{kpis.noCost} sem custo · {kpis.lowMargin} margem &lt; 5%</div>
        </div>
      </div>

      {/* ICMS faixa + filters bar */}
      <div className="rounded-xl border border-cockpit-border bg-white p-4 space-y-3">
        {/* Faixa ICMS */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Faixa ICMS para margem:</span>
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {ICMS_OPTIONS.map((opt) => {
              const isActive = opt.rate === icmsRate;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setIcmsRate(opt.rate)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold motion-safe:transition-all ${
                    isActive ? "text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                  style={isActive ? { background: opt.color } : undefined}
                  title={`ICMS de venda ${opt.label} (ig=${opt.rate === 0 ? "9,4% ME" : "7,04% LP"})`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-gray-400">
            margem de venda exibida na tabela
          </span>
        </div>

        {/* Busca + selects + export */}
        <div className="flex flex-wrap gap-2 items-center">
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
            {prefixes.map((p) => (
              <option key={p} value={p}>
                {p === "TODOS" ? "Linha: Todas" : `${p} · ${getProductGroupName(p)}`}
              </option>
            ))}
          </select>
          <select
            value={filterMfr}
            onChange={(e) => { setFilterMfr(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent max-w-[200px]"
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

        {/* Quick filters */}
        <div className="flex flex-wrap items-center gap-2">
          <ChipFilter
            active={quickFilters.has("override")}
            count={kpis.withOverride}
            onClick={() => toggleQuick("override")}
          >
            <Pencil className="w-3 h-3" />Com override
          </ChipFilter>
          <ChipFilter
            active={quickFilters.has("semCmv")}
            count={kpis.noCost}
            onClick={() => toggleQuick("semCmv")}
          >
            <AlertCircle className="w-3 h-3" />Sem custos
          </ChipFilter>
          <ChipFilter
            active={quickFilters.has("margemBaixa")}
            count={kpis.lowMargin}
            onClick={() => toggleQuick("margemBaixa")}
          >
            <TrendingUp className="w-3 h-3" />Margem &lt; 5%
          </ChipFilter>
          {edits.size > 0 && (
            <ChipFilter
              active={quickFilters.has("pendentes")}
              count={edits.size}
              onClick={() => toggleQuick("pendentes")}
              color="#d97706"
            >
              <Save className="w-3 h-3" />Pendentes
            </ChipFilter>
          )}
          <div className="flex-1" />
          <span className="text-[11px] text-gray-500">
            <strong className="text-gray-700">{fmtNum(filtered.length)}</strong> produto{filtered.length !== 1 && "s"}
          </span>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-[11px] text-cockpit-accent hover:underline inline-flex items-center gap-1">
              <Eraser className="w-3 h-3" />Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
              <tr>
                <th className="w-6 px-2 py-3" />
                {([
                  ["itemCode", "Código", "min-w-[110px]"],
                  ["itemName", "Produto", "min-w-[220px]"],
                  ["manufacturer", "Fornecedor", "min-w-[120px]"],
                  ["v", "Vlr s/ Imp", "min-w-[100px] text-right"],
                  ["cmv", "CMV Unit.", "min-w-[100px] text-right"],
                  ["margemSaco", "Mg Saco", "min-w-[80px] text-right"],
                  ["margemPallet", "Mg Pallet", "min-w-[80px] text-right"],
                ] as [SortKey, string, string][]).map(([key, label, cls]) => (
                  <th
                    key={key}
                    className={`px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800 motion-safe:transition-colors ${cls}`}
                    onClick={() => handleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">{label}<SortIcon col={key} /></span>
                  </th>
                ))}
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map((item) => {
                const isExpanded = expandedCode === item.itemCode;
                const isSaving = savingCode === item.itemCode;
                const hasOverride = item.rawHasOverride || overrides.has(item.itemCode);
                const prefix = getMarkupPrefix(item.itemCode);
                const color = prefix ? getProductGroupColor(prefix) : "#A81C2C";

                return (
                  <RowGroup
                    key={item.itemCode}
                    item={item}
                    isExpanded={isExpanded}
                    isSaving={isSaving}
                    hasOverride={hasOverride}
                    color={color}
                    icmsRate={icmsRate}
                    onToggle={() => setExpandedCode(isExpanded ? null : item.itemCode)}
                    onEdit={(key, value) => handleEdit(item.itemCode, key, value)}
                    onSave={() => saveRow(item.itemCode)}
                    onCancel={() => cancelEdits(item.itemCode)}
                  />
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
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

      {/* Pagination + page size */}
      <div className="flex items-center justify-between text-sm flex-wrap gap-3">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Mostrando <strong className="text-gray-700">{sorted.length === 0 ? 0 : safePage * pageSize + 1}</strong>–
            <strong className="text-gray-700">{Math.min((safePage + 1) * pageSize, sorted.length)}</strong> de{" "}
            <strong className="text-gray-700">{fmtNum(sorted.length)}</strong>
          </span>
          <span className="text-gray-300">|</span>
          <label className="inline-flex items-center gap-1.5">
            Itens por página:
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="px-2 py-1 rounded border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <PageButton onClick={() => setPage(0)} disabled={safePage === 0} title="Primeira página">
              <ChevronsLeft className="w-4 h-4" />
            </PageButton>
            <PageButton onClick={() => setPage(safePage - 1)} disabled={safePage === 0} title="Página anterior">
              <ChevronLeft className="w-4 h-4" />
            </PageButton>
            <span className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md min-w-[60px] text-center">
              {safePage + 1} / {totalPages}
            </span>
            <PageButton onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages - 1} title="Próxima página">
              <ChevronRight className="w-4 h-4" />
            </PageButton>
            <PageButton onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1} title="Última página">
              <ChevronsRight className="w-4 h-4" />
            </PageButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row with inline editor
// ---------------------------------------------------------------------------

interface RowGroupProps {
  item: MarkupItem & { cmv: number; mSaco: number | null; mPallet: number | null; isDirty: boolean; noCost: boolean };
  isExpanded: boolean;
  isSaving: boolean;
  hasOverride: boolean;
  color: string;
  icmsRate: number;
  onToggle: () => void;
  onEdit: (key: EditableKey, value: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

function RowGroup({
  item, isExpanded, isSaving, hasOverride, color, icmsRate,
  onToggle, onEdit, onSave, onCancel,
}: RowGroupProps) {
  const expandRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (isExpanded && expandRef.current) {
      expandRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isExpanded]);

  return (
    <>
      <tr
        className={`group motion-safe:transition-colors cursor-pointer ${
          isExpanded ? "bg-cockpit-accent/5" : "hover:bg-gray-50"
        } ${item.noCost ? "bg-red-50/40" : ""} ${item.isDirty ? "bg-amber-50/60" : ""}`}
        onClick={onToggle}
      >
        {/* Indicador colorido + chevron */}
        <td className="relative px-2 py-2.5">
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="p-0.5 rounded hover:bg-gray-200 motion-safe:transition-all"
            title={isExpanded ? "Recolher" : "Expandir"}
          >
            <ChevronDown className={`w-4 h-4 text-gray-400 motion-safe:transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
          </button>
        </td>

        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-cockpit-accent font-mono text-xs font-semibold">{item.itemCode}</span>
            {hasOverride && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded ring-1 ring-amber-200"
                title="Possui valores editados manualmente"
              >
                <Pencil className="w-2.5 h-2.5" />
              </span>
            )}
            {item.isDirty && (
              <span
                className="inline-flex items-center text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold"
                title="Edição não salva"
              >
                •
              </span>
            )}
          </div>
        </td>

        <td className="px-3 py-2.5">
          <div className="max-w-[300px] truncate text-gray-800 text-xs" title={item.itemName}>{item.itemName}</div>
        </td>

        <td className="px-3 py-2.5 text-gray-500 text-xs truncate max-w-[140px]" title={item.manufacturer}>
          {item.manufacturer || "—"}
        </td>

        <td className={`px-3 py-2.5 text-right font-mono text-xs ${item.v === 0 ? "text-red-400" : "text-gray-700"}`}>
          {item.v === 0 ? "—" : fmtBRL(item.v / 1000)}
        </td>

        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${item.cmv === 0 ? "text-gray-300" : "text-gray-900"}`}>
          {item.cmv === 0 ? "—" : fmtBRL(item.cmv / 1000)}
        </td>

        <td className="px-3 py-2.5 text-right"><MargemBadge value={item.mSaco} size="sm" /></td>
        <td className="px-3 py-2.5 text-right"><MargemBadge value={item.mPallet} size="sm" /></td>

        <td className="px-2 py-2.5 text-right">
          <Link
            href={`/business-intelligence/markup/${encodeURIComponent(item.itemCode)}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 motion-safe:transition-all"
            title="Abrir tela completa de precificação"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </td>
      </tr>

      {isExpanded && (
        <tr ref={expandRef} className="bg-gradient-to-b from-cockpit-accent/[0.03] to-white">
          <td colSpan={9} className="px-6 py-4">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Cabeçalho do editor */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-gray-700">Editar custos</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500">CMV unitário atualizado:</span>
                  <span className="font-bold text-gray-900 font-mono">{fmtBRL(item.cmv / 1000)}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500">Milheiro:</span>
                  <span className="font-mono text-gray-700">{fmtBRL(item.cmv)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.isDirty && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 motion-safe:transition-colors"
                    >
                      Descartar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={!item.isDirty || isSaving}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold text-white motion-safe:transition-all ${
                      !item.isDirty ? "bg-gray-300 cursor-not-allowed" :
                      isSaving ? "bg-cockpit-accent/70 cursor-wait" :
                      "bg-cockpit-accent hover:bg-cockpit-accent/90 shadow-sm"
                    }`}
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {isSaving ? "Salvando..." : "Salvar"}
                    {item.isDirty && !isSaving && <span className="text-[9px] opacity-70">Ctrl+S</span>}
                  </button>
                </div>
              </div>

              {/* Grid de campos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                <div className="p-4 border-r border-gray-100">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
                    <CircleDollarSign className="w-3 h-3" />Custos (por milheiro)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {COST_FIELDS.map((f) => (
                      <label key={f.key} className="flex flex-col gap-1" title={f.hint}>
                        <span className="text-[10px] text-gray-500 font-medium">{f.label}</span>
                        <InlineNumberInput
                          value={item[f.key]}
                          onChange={(v) => onEdit(f.key, v)}
                          prefix={f.prefix}
                          step={f.step}
                          dirty={item.isDirty}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
                    <Receipt className="w-3 h-3 text-violet-500" />Tributos (alíquotas)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {TRIBUTO_FIELDS.map((f) => (
                      <label key={f.key} className="flex flex-col gap-1" title={f.hint}>
                        <span className="text-[10px] text-gray-500 font-medium">{f.label}</span>
                        <InlineNumberInput
                          value={Math.round(item[f.key] * 10000) / 100}
                          onChange={(v) => onEdit(f.key, v / 100)}
                          suffix={f.suffix}
                          step={f.step}
                          dirty={item.isDirty}
                        />
                      </label>
                    ))}
                  </div>

                  {/* Margens preview */}
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between bg-gray-50 rounded-md px-2.5 py-1.5">
                      <span className="text-[10px] text-gray-500">Margem Saco ({icmsRate === 0 ? "ME" : `${(icmsRate * 100).toFixed(0)}%`})</span>
                      <MargemBadge value={item.mSaco} size="sm" />
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-md px-2.5 py-1.5">
                      <span className="text-[10px] text-gray-500">Margem Pallet ({icmsRate === 0 ? "ME" : `${(icmsRate * 100).toFixed(0)}%`})</span>
                      <MargemBadge value={item.mPallet} size="sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé com link para detalhe */}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  Esc: fechar &middot; Ctrl+S: salvar &middot; Use a tela completa para precificação por faixa
                </span>
                <Link
                  href={`/business-intelligence/markup/${encodeURIComponent(item.itemCode)}`}
                  className="inline-flex items-center gap-1 text-[11px] text-cockpit-accent hover:underline font-medium"
                >
                  Abrir precificação completa <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
