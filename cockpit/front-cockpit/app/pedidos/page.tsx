"use client";

import { Fragment, useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, Package, Plus, Loader2,
  RefreshCw, DollarSign, Users, TrendingUp, BarChart3,
  ArrowUpDown, ArrowUp, ArrowDown, ListOrdered,
  PieChart as PieChartIcon, Clock, Activity, Hash,
  Calendar, Briefcase, Minus, Equal,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, AreaChart, Area, ComposedChart, Line,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { fmtBRL, fmtNum, exportCSV } from "@/lib/format";
import {
  fetchSalesOrders, syncSalesOrders, fetchOrderLines,
  type SalesOrderRow, type SalesOrderLine,
} from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import {
  format, parseISO, startOfDay, startOfMonth, subDays, subMonths,
  getDay, differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const BATCH_SIZE = 50;
const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_COLORS = ["#e5484d", "#A81C2C", "#c42538", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6"];

// ─── Range presets ────────────────────────────────────────────

type RangePreset = "today" | "7d" | "month" | "3m" | "custom";

interface LocalRange { from: Date; to: Date }

function presetRange(key: Exclude<RangePreset, "custom">): LocalRange {
  const now = new Date();
  switch (key) {
    case "today": return { from: startOfDay(now), to: now };
    case "7d": return { from: subDays(now, 6), to: now };
    case "month": return { from: startOfMonth(now), to: now };
    case "3m": return { from: startOfMonth(subMonths(now, 2)), to: now };
  }
}

const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "month", label: "Mês atual" },
  { key: "3m", label: "3 meses" },
];

// ─── Helpers de formatação ────────────────────────────────────

function fmtDateShort(raw: string | null): string {
  if (!raw) return "—";
  try { return format(raw.includes("T") ? parseISO(raw) : new Date(raw), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return raw; }
}

function fmtQty(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

// ─── Helpers estatísticos ─────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

function stdDev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ─── Helpers de agregação ─────────────────────────────────────

function aggregateByDay(orders: SalesOrderRow[]): { data: string; valor: number; pedidos: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byDay = new Map<string, { valor: number; pedidos: number }>();
  for (const o of active) {
    const day = o.doc_date?.slice(0, 10) ?? "";
    if (!day) continue;
    const cur = byDay.get(day) ?? { valor: 0, pedidos: 0 };
    cur.valor += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    byDay.set(day, cur);
  }
  return Array.from(byDay.entries())
    .map(([data, v]) => ({ data, valor: v.valor, pedidos: v.pedidos }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

function statusAggregate(orders: SalesOrderRow[]): { name: string; value: number; fill: string }[] {
  const open = orders.filter((o) => o.doc_status === "O" && o.cancelled !== "Y").length;
  const closed = orders.filter((o) => o.doc_status === "C" && o.cancelled !== "Y").length;
  const cancelled = orders.filter((o) => o.cancelled === "Y").length;
  return [
    { name: "Abertos", value: open, fill: "#10b981" },
    { name: "Fechados", value: closed, fill: "#78696c" },
    { name: "Cancelados", value: cancelled, fill: "#e5484d" },
  ].filter((s) => s.value > 0);
}

function aggregateByClient(orders: SalesOrderRow[], limit = 5): { nome: string; valor: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byClient = new Map<string, { nome: string; valor: number }>();
  for (const o of active) {
    const key = o.card_code ?? "?";
    const cur = byClient.get(key) ?? { nome: o.card_name ?? key, valor: 0 };
    cur.valor += Number(o.doc_total) || 0;
    byClient.set(key, cur);
  }
  return Array.from(byClient.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit)
    .map((v) => ({ nome: v.nome.length > 22 ? v.nome.slice(0, 20) + "…" : v.nome, valor: v.valor }));
}

function histogramBins(values: number[]): { faixa: string; count: number; total: number; from: number; to: number }[] {
  const edges = [0, 500, 1000, 2500, 5000, 10000, 25000, 50000, Infinity];
  const labels = ["0–500", "500–1k", "1k–2,5k", "2,5k–5k", "5k–10k", "10k–25k", "25k–50k", "50k+"];
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const inBin = values.filter((v) => v >= lo && v < hi);
    return { faixa: labels[i], count: inBin.length, total: inBin.reduce((s, v) => s + v, 0), from: lo, to: hi };
  }).filter((b) => b.count > 0);
}

function aggregateByWeekday(orders: SalesOrderRow[]): { dia: string; idx: number; valor: number; pedidos: number; mediana: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byDay = new Map<number, number[]>();
  for (const o of active) {
    if (!o.doc_date) continue;
    const d = o.doc_date.includes("T") ? parseISO(o.doc_date) : new Date(o.doc_date);
    const wd = getDay(d);
    const arr = byDay.get(wd) ?? [];
    arr.push(Number(o.doc_total) || 0);
    byDay.set(wd, arr);
  }
  return [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const vals = byDay.get(wd) ?? [];
    return {
      dia: WEEKDAY_NAMES[wd],
      idx: wd,
      valor: vals.reduce((s, v) => s + v, 0),
      pedidos: vals.length,
      mediana: median(vals),
    };
  }).filter((d) => d.pedidos > 0);
}

function aggregateBySalesPerson(orders: SalesOrderRow[]): { vendedor: string; valor: number; pedidos: number; mediana: number; ticket: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y" && o.sales_person_code != null);
  const byPerson = new Map<number, number[]>();
  for (const o of active) {
    const key = o.sales_person_code!;
    const arr = byPerson.get(key) ?? [];
    arr.push(Number(o.doc_total) || 0);
    byPerson.set(key, arr);
  }
  return Array.from(byPerson.entries())
    .map(([code, vals]) => ({
      vendedor: `Vend. ${code}`,
      valor: vals.reduce((s, v) => s + v, 0),
      pedidos: vals.length,
      mediana: median(vals),
      ticket: vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

function cumulativeByDay(dayData: { data: string; valor: number }[]): { data: string; diario: number; acumulado: number }[] {
  let acc = 0;
  return dayData.map((d) => {
    acc += d.valor;
    return { data: d.data, diario: d.valor, acumulado: acc };
  });
}

function scatterData(orders: SalesOrderRow[], limit = 300): { itens: number; valor: number; status: string; docNum: number }[] {
  return orders.filter((o) => o.cancelled !== "Y").slice(0, limit).map((o) => ({
    itens: o.lines?.length ?? o.num_lines ?? 0,
    valor: Number(o.doc_total) || 0,
    status: o.doc_status === "O" ? "Aberto" : "Fechado",
    docNum: o.doc_num,
  }));
}

function leadTimeData(orders: SalesOrderRow[]): { dias: number; count: number }[] {
  const ltMap = new Map<number, number>();
  for (const o of orders.filter((o) => o.cancelled !== "Y" && o.doc_date && o.doc_due_date)) {
    const d1 = o.doc_date.includes("T") ? parseISO(o.doc_date) : new Date(o.doc_date);
    const d2 = o.doc_due_date!.includes("T") ? parseISO(o.doc_due_date!) : new Date(o.doc_due_date!);
    const diff = differenceInCalendarDays(d2, d1);
    if (diff >= 0 && diff <= 90) {
      ltMap.set(diff, (ltMap.get(diff) ?? 0) + 1);
    }
  }
  return Array.from(ltMap.entries())
    .map(([dias, count]) => ({ dias, count }))
    .sort((a, b) => a.dias - b.dias);
}

// ─── Sort & Types ─────────────────────────────────────────────

type SortField = "doc_num" | "doc_date" | "card_name" | "doc_total" | "num_lines" | "total_quantity";
type SortDir = "asc" | "desc";
type ChartTab = "overview" | "stats" | "patterns";

const CHART_TABS: { key: ChartTab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Visão Geral", icon: BarChart3 },
  { key: "stats", label: "Análise Estatística", icon: Activity },
  { key: "patterns", label: "Padrões & Tendências", icon: TrendingUp },
];

// ─── Custom Tooltip Components ────────────────────────────────

function ChartTooltipWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-cockpit-border rounded-lg shadow-lg px-3 py-2.5 text-xs">
      {children}
    </div>
  );
}

// ─── Box Plot Visual Component ────────────────────────────────

function BoxPlotVisual({ min, p25, med, p75, max, mean }: { min: number; p25: number; med: number; p75: number; max: number; mean: number }) {
  const range = max - min || 1;
  const pctP25 = ((p25 - min) / range) * 100;
  const pctMed = ((med - min) / range) * 100;
  const pctP75 = ((p75 - min) / range) * 100;
  const pctMean = ((mean - min) / range) * 100;
  const boxWidth = pctP75 - pctP25;

  return (
    <div className="space-y-3">
      <div className="relative h-10 mx-2">
        {/* Whisker line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-300 -translate-y-1/2" />
        {/* Min/Max caps */}
        <div className="absolute top-1/2 left-0 w-px h-4 bg-gray-400 -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-px h-4 bg-gray-400 -translate-y-1/2" />
        {/* IQR box */}
        <div
          className="absolute top-1/2 h-7 rounded-md bg-cockpit-accent/15 border border-cockpit-accent/40 -translate-y-1/2"
          style={{ left: `${pctP25}%`, width: `${boxWidth}%` }}
        />
        {/* Median line */}
        <div
          className="absolute top-1/2 w-0.5 h-7 bg-cockpit-accent rounded-full -translate-y-1/2 z-10"
          style={{ left: `${pctMed}%` }}
        />
        {/* Mean diamond */}
        <div
          className="absolute top-1/2 w-2 h-2 bg-blue-500 rotate-45 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${pctMean}%` }}
          title={`Média: ${fmtBRL(mean)}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-cockpit-muted tabular-nums mx-2">
        <span>Min {fmtBRL(min)}</span>
        <span>P25 {fmtBRL(p25)}</span>
        <span className="font-semibold text-cockpit-accent">Med {fmtBRL(med)}</span>
        <span>P75 {fmtBRL(p75)}</span>
        <span>Max {fmtBRL(max)}</span>
      </div>
      <div className="flex items-center justify-center gap-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-cockpit-accent rounded-full inline-block" /> Mediana
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-blue-500 rotate-45 inline-block" /> Média
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2.5 bg-cockpit-accent/15 border border-cockpit-accent/40 rounded-sm inline-block" /> IQR (P25–P75)
        </span>
      </div>
    </div>
  );
}

// ─── OrderDetailPanel ─────────────────────────────────────────

function OrderDetailPanel({ lines }: { lines: SalesOrderLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="px-6 py-6 text-sm text-cockpit-muted italic bg-gradient-to-b from-amber-50/80 to-white rounded-b-lg border border-t-0 border-cockpit-border/50 flex items-center gap-3">
        <ListOrdered className="w-5 h-5 text-amber-500/70 shrink-0" />
        Detalhamento de itens indisponível para este pedido.
      </div>
    );
  }

  const totalQty = lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
  const totalVal = lines.reduce((s, l) => s + (l.LineTotal ?? 0), 0);

  return (
    <div className="order-detail-enter overflow-hidden">
      <div className="px-4 py-4 bg-gradient-to-b from-gray-50/90 to-white border-x border-b border-cockpit-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-cockpit-accent/10">
              <Package className="w-4 h-4 text-cockpit-accent" />
            </div>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Itens do Pedido</span>
            <span className="text-xs text-cockpit-muted font-normal">({lines.length} itens)</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">Qtd: <strong className="text-gray-900 tabular-nums">{fmtQty(totalQty)}</strong></span>
            <span className="font-semibold text-cockpit-accent tabular-nums">{fmtBRL(totalVal)}</span>
          </div>
        </div>
        <div className="rounded-lg border border-cockpit-border/50 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-cockpit-border/40 bg-gray-50/80 text-cockpit-muted uppercase tracking-wider text-[10px]">
                <th className="text-left py-2.5 px-3 font-semibold w-10">#</th>
                <th className="text-left py-2.5 px-3 font-semibold w-28">Código</th>
                <th className="text-left py-2.5 px-3 font-semibold">Descrição</th>
                <th className="text-left py-2.5 px-3 font-semibold w-16">Dep.</th>
                <th className="text-right py-2.5 px-3 font-semibold w-20">Qtd</th>
                <th className="text-right py-2.5 px-3 font-semibold w-24">Preço Unit.</th>
                <th className="text-right py-2.5 px-3 font-semibold w-16">Desc%</th>
                <th className="text-right py-2.5 px-3 font-semibold w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={`${l.ItemCode}-${l.LineNum ?? idx}`} className="border-b border-cockpit-border/10 last:border-b-0 hover:bg-cockpit-accent/[0.03] transition-colors duration-150">
                  <td className="py-2 px-3 text-cockpit-muted tabular-nums">{(l.LineNum ?? idx) + 1}</td>
                  <td className="py-2 px-3 font-mono text-xs text-blue-700 font-medium">{l.ItemCode ?? "—"}</td>
                  <td className="py-2 px-3 text-gray-700 max-w-[280px]"><span className="line-clamp-2">{l.ItemDescription ?? "—"}</span></td>
                  <td className="py-2 px-3 text-gray-500 font-mono text-[10px]">{l.WarehouseCode ?? "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-900">{fmtQty(l.Quantity ?? 0)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-600">{l.UnitPrice != null ? fmtBRL(l.UnitPrice) : l.Price != null ? fmtBRL(l.Price) : "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-500">{(l.DiscountPercent ?? 0) > 0 ? `${l.DiscountPercent}%` : "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold text-cockpit-accent">{l.LineTotal != null ? fmtBRL(l.LineTotal) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────

export default function PedidosPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <PedidosContent />
    </Suspense>
  );
}

// ─── Main content ─────────────────────────────────────────────

function PedidosContent() {
  const searchParams = useSearchParams();
  const cardCodeFromUrl = searchParams.get("cardCode");
  const clientNameFromUrl = searchParams.get("clientName") ?? undefined;

  // ─── Range local ───
  const [rangePreset, setRangePreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const localRange = useMemo<LocalRange>(() => {
    if (rangePreset === "custom" && customFrom && customTo)
      return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
    if (rangePreset === "custom") return presetRange("today");
    return presetRange(rangePreset);
  }, [rangePreset, customFrom, customTo]);

  const dateFrom = format(localRange.from, "yyyy-MM-dd");
  const dateTo = format(localRange.to, "yyyy-MM-dd");
  const rangeLabel = rangePreset === "custom" && customFrom && customTo
    ? `${format(localRange.from, "dd/MM/yyyy")} — ${format(localRange.to, "dd/MM/yyyy")}`
    : RANGE_OPTIONS.find((o) => o.key === rangePreset)?.label ?? "Hoje";

  // ─── Fetch ───
  const { data, loading, error, refetch } = useFetch(
    () => fetchSalesOrders({ dateFrom, dateTo, limit: 50000 }),
    [dateFrom, dateTo]
  );

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const orders = useMemo(() => data?.items ?? [], [data]);
  const activeOrders = useMemo(() => orders.filter((o) => o.cancelled !== "Y"), [orders]);

  // ─── Chart tab ───
  const [chartTab, setChartTab] = useState<ChartTab>("overview");

  // ─── Filtros ───
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState(cardCodeFromUrl ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "cancelled">("all");

  useEffect(() => {
    if (cardCodeFromUrl) setClienteFilter(cardCodeFromUrl);
  }, [cardCodeFromUrl]);

  // ─── Sort ───
  const [sortField, setSortField] = useState<SortField>("doc_num");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return field; }
      setSortDir("desc");
      return field;
    });
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) { if (o.card_code && !map.has(o.card_code)) map.set(o.card_code, o.card_name || o.card_code); }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter === "open") result = result.filter((o) => o.doc_status === "O" && o.cancelled !== "Y");
    else if (statusFilter === "closed") result = result.filter((o) => o.doc_status === "C" && o.cancelled !== "Y");
    else if (statusFilter === "cancelled") result = result.filter((o) => o.cancelled === "Y");
    if (clienteFilter) result = result.filter((o) => o.card_code === clienteFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        String(o.doc_num).includes(q) || (o.card_name ?? "").toLowerCase().includes(q) || (o.card_code ?? "").toLowerCase().includes(q) ||
        (o.lines ?? []).some((l) => (l.ItemCode ?? "").toLowerCase().includes(q) || (l.ItemDescription ?? "").toLowerCase().includes(q))
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "doc_num": cmp = (a.doc_num ?? 0) - (b.doc_num ?? 0); break;
        case "doc_date": cmp = (a.doc_date ?? "").localeCompare(b.doc_date ?? ""); break;
        case "card_name": cmp = (a.card_name ?? "").localeCompare(b.card_name ?? ""); break;
        case "doc_total": cmp = (Number(a.doc_total) || 0) - (Number(b.doc_total) || 0); break;
        case "num_lines": cmp = (a.lines?.length ?? a.num_lines ?? 0) - (b.lines?.length ?? b.num_lines ?? 0); break;
        case "total_quantity": cmp = (Number(a.total_quantity) || 0) - (Number(b.total_quantity) || 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [orders, statusFilter, clienteFilter, search, sortField, sortDir]);

  // ─── Load-more & expansion ───
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [orderLines, setOrderLines] = useState<Record<number, SalesOrderLine[]>>({});
  const [loadingLines, setLoadingLines] = useState<Set<number>>(new Set());

  useEffect(() => { setVisibleCount(BATCH_SIZE); setExpanded(new Set()); }, [dateFrom, dateTo, statusFilter, clienteFilter, search, sortField, sortDir]);

  const visibleDocs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // ─── KPIs ───
  const totalDocs = filtered.length;
  const openDocs = useMemo(() => filtered.filter((o) => o.doc_status === "O" && o.cancelled !== "Y").length, [filtered]);
  const closedDocs = useMemo(() => filtered.filter((o) => o.doc_status === "C" && o.cancelled !== "Y").length, [filtered]);
  const cancelledDocs = useMemo(() => filtered.filter((o) => o.cancelled === "Y").length, [filtered]);
  const activeFiltered = useMemo(() => filtered.filter((o) => o.cancelled !== "Y"), [filtered]);
  const activeValue = useMemo(() => activeFiltered.reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [activeFiltered]);
  const totalQty = useMemo(() => filtered.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0), [filtered]);
  const ticketMedio = activeFiltered.length > 0 ? activeValue / activeFiltered.length : 0;
  const uniqueClients = useMemo(() => new Set(activeFiltered.map((o) => o.card_code)).size, [activeFiltered]);

  // ─── Estatísticas descritivas ───
  const orderValues = useMemo(() => activeOrders.map((o) => Number(o.doc_total) || 0).filter((v) => v > 0), [activeOrders]);
  const stats = useMemo(() => {
    if (orderValues.length === 0) return null;
    const med = median(orderValues);
    const mean = orderValues.reduce((s, v) => s + v, 0) / orderValues.length;
    const sd = stdDev(orderValues, mean);
    const p25 = percentile(orderValues, 25);
    const p75 = percentile(orderValues, 75);
    const minV = Math.min(...orderValues);
    const maxV = Math.max(...orderValues);
    const skew = mean > 0 ? (mean - med) / mean : 0;
    const cv = mean > 0 ? sd / mean : 0;
    return { median: med, mean, stdDev: sd, p25, p75, min: minV, max: maxV, skew, cv, iqr: p75 - p25 };
  }, [orderValues]);

  // ─── Chart data ───
  const chartByDay = useMemo(() => aggregateByDay(orders), [orders]);
  const statusData = useMemo(() => statusAggregate(orders), [orders]);
  const topClients = useMemo(() => aggregateByClient(orders, 5), [orders]);
  const dailyMedian = useMemo(() => median(chartByDay.map((d) => d.valor)), [chartByDay]);
  const histData = useMemo(() => histogramBins(orderValues), [orderValues]);
  const weekdayData = useMemo(() => aggregateByWeekday(orders), [orders]);
  const salesPersonData = useMemo(() => aggregateBySalesPerson(orders), [orders]);
  const cumulativeData = useMemo(() => cumulativeByDay(chartByDay), [chartByDay]);
  const scatter = useMemo(() => scatterData(orders), [orders]);
  const leadTime = useMemo(() => leadTimeData(orders), [orders]);
  const leadTimeMedian = useMemo(() => {
    const vals: number[] = [];
    for (const o of orders.filter((o) => o.cancelled !== "Y" && o.doc_date && o.doc_due_date)) {
      const d1 = o.doc_date.includes("T") ? parseISO(o.doc_date) : new Date(o.doc_date);
      const d2 = o.doc_due_date!.includes("T") ? parseISO(o.doc_due_date!) : new Date(o.doc_due_date!);
      const diff = differenceInCalendarDays(d2, d1);
      if (diff >= 0 && diff <= 90) vals.push(diff);
    }
    return median(vals);
  }, [orders]);
  const spMedianAll = useMemo(() => median(salesPersonData.map((s) => s.valor)), [salesPersonData]);

  const hasMore = visibleCount < filtered.length;
  const remaining = Math.max(0, filtered.length - visibleCount);
  const nextBatch = Math.min(BATCH_SIZE, remaining);
  const progressPct = filtered.length > 0 ? Math.min(100, (visibleCount / filtered.length) * 100) : 100;
  const needMoreData = activeOrders.length < 3;

  const handleLoadMore = useCallback(() => setVisibleCount((c) => c + BATCH_SIZE), []);
  const handleShowAll = useCallback(() => setVisibleCount(filtered.length), [filtered.length]);

  const toggleExpand = useCallback(async (docEntry: number) => {
    setExpanded((prev) => { const next = new Set(prev); next.has(docEntry) ? next.delete(docEntry) : next.add(docEntry); return next; });
    if (!orderLines[docEntry] && !loadingLines.has(docEntry)) {
      setLoadingLines((prev) => new Set(prev).add(docEntry));
      try { const res = await fetchOrderLines(docEntry); if (res.ok && res.lines?.length > 0) setOrderLines((prev) => ({ ...prev, [docEntry]: res.lines })); }
      catch { /* will show "indisponível" */ }
      finally { setLoadingLines((prev) => { const next = new Set(prev); next.delete(docEntry); return next; }); }
    }
  }, [orderLines, loadingLines]);

  const expandAll = useCallback(() => setExpanded(new Set(visibleDocs.map((d) => d.doc_entry))), [visibleDocs]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncMsg(null);
    try { const res = await syncSalesOrders(); setSyncMsg(res.message); refetch(); }
    catch (err) { setSyncMsg(err instanceof Error ? err.message : "Erro ao sincronizar"); }
    finally { setSyncing(false); }
  }, [refetch]);

  const handleExportCSV = useCallback(() => {
    const rows = filtered.map((o) => ({
      "Nº Pedido": o.doc_num, "Data Pedido": fmtDateShort(o.doc_date), "Data Entrega": fmtDateShort(o.doc_due_date),
      "Cód. Cliente": o.card_code, "Cliente": o.card_name, "Valor Total": Number(o.doc_total) || 0,
      "Moeda": o.doc_currency, "Status": o.cancelled === "Y" ? "Cancelado" : o.doc_status === "O" ? "Aberto" : "Fechado",
      "Itens": o.lines?.length ?? o.num_lines ?? 0, "Qtd Total": Number(o.total_quantity) || 0,
      "Vendedor": o.sales_person_code ?? "", "Observações": o.comments ?? "",
    }));
    exportCSV(rows, `pedidos-venda-${dateFrom}-${dateTo}`);
  }, [filtered, dateFrom, dateTo]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cockpit-accent" /> : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-cockpit-accent/10"><ShoppingCart className="w-5 h-5 text-cockpit-accent" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900">Pedidos de Venda</h1><p className="text-sm text-cockpit-muted mt-0.5">Carregando dados...</p></div>
      </div>
      <LoadingSkeleton rows={6} />
    </div>
  );

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">

      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10">
            <ShoppingCart className="w-5 h-5 text-cockpit-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pedidos de Venda</h1>
            <p className="text-sm text-cockpit-muted flex items-center gap-1.5 mt-0.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {rangeLabel}
              <span className="text-cockpit-border mx-1">·</span>
              <strong className="text-gray-700">{data?.total ?? 0}</strong> registros
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg bg-cockpit-accent text-white font-medium hover:bg-cockpit-accent/90 transition-colors disabled:opacity-50 shadow-sm">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Sincronizando..." : "Sync SAP"}
          </button>
          <button type="button" onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-cockpit-accent/10 text-cockpit-accent text-sm border border-cockpit-accent/20 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 shrink-0" /> {syncMsg}
        </div>
      )}

      {/* ═══ Range selector ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="w-4 h-4 text-cockpit-muted shrink-0" />
          <span className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mr-1">Período</span>
          {RANGE_OPTIONS.map((opt) => (
            <button key={opt.key} type="button" onClick={() => setRangePreset(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${rangePreset === opt.key ? "bg-cockpit-accent text-white shadow-sm" : "text-gray-600 hover:bg-black/5 border border-cockpit-border/50"}`}>
              {opt.label}
            </button>
          ))}
          <div className="h-5 w-px bg-cockpit-border mx-1" />
          <button type="button" onClick={() => { setRangePreset("custom"); setCustomFrom(dateFrom); setCustomTo(dateTo); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${rangePreset === "custom" ? "bg-cockpit-accent text-white shadow-sm" : "text-gray-600 hover:bg-black/5 border border-cockpit-border/50"}`}>
            Personalizado
          </button>
          {rangePreset === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} max={customTo || undefined}
                className="px-2 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:ring-2 focus:ring-cockpit-accent/30" />
              <span className="text-xs text-cockpit-muted">—</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} min={customFrom || undefined}
                className="px-2 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:ring-2 focus:ring-cockpit-accent/30" />
            </div>
          )}
        </div>
      </div>

      {cardCodeFromUrl && clienteFilter && (
        <div className="rounded-xl border border-cockpit-accent/30 bg-cockpit-accent/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-700">
            Pedidos do cliente: <strong className="text-cockpit-accent">{clientNameFromUrl || clienteFilter}</strong>
          </p>
          <Link href="/pedidos" className="text-sm font-medium text-cockpit-accent hover:text-cockpit-accent/80 transition-colors flex items-center gap-1.5">
            <X className="w-4 h-4" /> Limpar filtro
          </Link>
        </div>
      )}

      {/* ═══ KPIs ═══ */}
      <section className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Pedidos", value: fmtNum(totalDocs), sub: `${openDocs} abertos · ${closedDocs} fechados`, icon: ShoppingCart, color: "text-cockpit-accent" },
            { label: "Faturamento", value: fmtBRL(activeValue), icon: DollarSign, color: "text-emerald-600" },
            { label: "Ticket Médio", value: fmtBRL(ticketMedio), sub: stats ? `Med: ${fmtBRL(stats.median)}` : undefined, icon: TrendingUp, color: "text-blue-600" },
            { label: "Mediana", value: stats ? fmtBRL(stats.median) : "—", sub: stats ? (stats.skew > 0.05 ? "Assimétrica →" : stats.skew < -0.05 ? "← Assimétrica" : "≈ Simétrica") : undefined, icon: Minus, color: "text-violet-600" },
            { label: "Clientes", value: fmtNum(uniqueClients), icon: Users, color: "text-teal-600" },
            { label: "Qtd Total", value: fmtQty(totalQty), sub: `${cancelledDocs} cancelados`, icon: Package, color: "text-amber-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-cockpit-border bg-white p-3.5 shadow-sm hover:border-cockpit-accent/30 transition-all duration-200 group">
              <div className="flex items-center gap-2 mb-1.5">
                <kpi.icon className={`w-4 h-4 ${kpi.color} transition-transform duration-200 group-hover:scale-110`} />
                <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-cockpit-muted mt-0.5">{kpi.sub}</p>}
            </div>
          ))}
        </div>

        {/* ═══ Analytics Tabs ═══ */}
        {activeOrders.length > 0 && (
          <div className="space-y-4">
            {/* Tab bar */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {CHART_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = chartTab === tab.key;
                return (
                  <button key={tab.key} type="button" onClick={() => setChartTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ─── Tab: Visão Geral ─── */}
            {chartTab === "overview" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 animate-[fadeIn_200ms_ease-out]">
                {/* Faturamento por dia com mediana */}
                <div className="xl:col-span-2 rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cockpit-accent" />
                      <h2 className="text-sm font-semibold text-gray-900">Faturamento por dia</h2>
                    </div>
                    {dailyMedian > 0 && (
                      <span className="text-[10px] text-cockpit-muted flex items-center gap-1">
                        <span className="w-3 h-px bg-blue-500 inline-block" style={{ borderTop: "2px dashed #3b82f6" }} />
                        Mediana diária: <strong className="text-blue-600">{fmtBRL(dailyMedian)}</strong>
                      </span>
                    )}
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartByDay} barCategoryGap="15%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                        <XAxis dataKey="data" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => (v ? format(parseISO(v), "dd/MM") : "")} />
                        <YAxis tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => fmtK(v)} width={45} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            return (
                              <ChartTooltipWrapper>
                                <p className="font-semibold text-gray-800 mb-1">{label ? format(parseISO(label), "EEEE, dd/MM/yyyy", { locale: ptBR }) : ""}</p>
                                <p className="text-cockpit-accent font-bold">{fmtBRL(d?.valor ?? 0)}</p>
                                <p className="text-gray-500">{d?.pedidos ?? 0} pedidos</p>
                                {dailyMedian > 0 && (
                                  <p className="text-blue-600 mt-1 pt-1 border-t border-gray-100">
                                    {(d?.valor ?? 0) >= dailyMedian ? "↑" : "↓"} {(d?.valor ?? 0) >= dailyMedian ? "Acima" : "Abaixo"} da mediana
                                  </p>
                                )}
                              </ChartTooltipWrapper>
                            );
                          }}
                        />
                        <Bar dataKey="valor" fill="#A81C2C" radius={[3, 3, 0, 0]} name="Faturamento" />
                        {dailyMedian > 0 && (
                          <ReferenceLine y={dailyMedian} stroke="#3b82f6" strokeDasharray="6 4" strokeWidth={1.5} label="" />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Donut status */}
                  <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <PieChartIcon className="w-4 h-4 text-cockpit-accent" />
                      <h2 className="text-sm font-semibold text-gray-900">Status</h2>
                    </div>
                    {statusData.length > 0 ? (
                      <div className="h-28 flex items-center">
                        <ResponsiveContainer width="50%" height="100%">
                          <PieChart>
                            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={3}>
                              {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                const pct = orders.length > 0 ? ((d?.value ?? 0) / orders.length * 100).toFixed(1) : "0";
                                return (
                                  <ChartTooltipWrapper>
                                    <p className="font-semibold" style={{ color: d?.fill }}>{d?.name}</p>
                                    <p className="text-gray-800">{d?.value} pedidos ({pct}%)</p>
                                  </ChartTooltipWrapper>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-1.5 pl-2">
                          {statusData.map((s) => (
                            <div key={s.name} className="flex items-center gap-2 text-xs">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.fill }} />
                              <span className="text-gray-600">{s.name}</span>
                              <span className="ml-auto font-semibold text-gray-900 tabular-nums">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-xs text-cockpit-muted text-center py-6">Sem dados</p>}
                  </div>

                  {/* Top clientes */}
                  <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-cockpit-accent" />
                      <h2 className="text-sm font-semibold text-gray-900">Top clientes</h2>
                    </div>
                    {topClients.length > 0 ? (
                      <div className="space-y-2">
                        {topClients.map((c, i) => {
                          const pct = topClients[0].valor > 0 ? (c.valor / topClients[0].valor) * 100 : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between text-xs mb-0.5">
                                <span className="text-gray-700 truncate max-w-[140px]" title={c.nome}>{c.nome}</span>
                                <span className="text-cockpit-accent font-semibold tabular-nums">{fmtBRL(c.valor)}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full bg-cockpit-accent/70 transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-xs text-cockpit-muted text-center py-6">Sem dados</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Tab: Análise Estatística ─── */}
            {chartTab === "stats" && (
              <div className="space-y-4 animate-[fadeIn_200ms_ease-out]">
                {needMoreData ? (
                  <div className="rounded-xl border border-cockpit-border bg-white p-8 text-center shadow-sm">
                    <Activity className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-600 font-medium">Dados insuficientes para análise estatística</p>
                    <p className="text-sm text-cockpit-muted mt-1">Expanda o período para pelo menos 3 pedidos ativos.</p>
                  </div>
                ) : (
                  <>
                    {/* Stats summary + Box plot */}
                    {stats && (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-cockpit-border bg-white p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-cockpit-accent" />
                            <h2 className="text-sm font-semibold text-gray-900">Distribuição dos Valores</h2>
                          </div>
                          <BoxPlotVisual min={stats.min} p25={stats.p25} med={stats.median} p75={stats.p75} max={stats.max} mean={stats.mean} />
                          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-cockpit-border/50">
                            <div className="text-center">
                              <p className="text-[10px] text-cockpit-muted uppercase tracking-wider mb-0.5">IQR</p>
                              <p className="text-sm font-bold text-gray-900 tabular-nums">{fmtBRL(stats.iqr)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-cockpit-muted uppercase tracking-wider mb-0.5">Desvio Padrão</p>
                              <p className="text-sm font-bold text-gray-900 tabular-nums">{fmtBRL(stats.stdDev)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-cockpit-muted uppercase tracking-wider mb-0.5">Coef. Variação</p>
                              <p className="text-sm font-bold text-gray-900 tabular-nums">{(stats.cv * 100).toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>

                        {/* Median vs Mean comparison */}
                        <div className="rounded-xl border border-cockpit-border bg-white p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <Equal className="w-4 h-4 text-cockpit-accent" />
                            <h2 className="text-sm font-semibold text-gray-900">Média vs Mediana</h2>
                          </div>
                          <div className="space-y-4">
                            <div className="flex items-end gap-4">
                              <div className="flex-1">
                                <p className="text-xs text-cockpit-muted mb-1">Média (sensível a outliers)</p>
                                <div className="h-10 bg-blue-100 rounded-lg flex items-center px-3 relative overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 bg-blue-500/20 rounded-lg" style={{ width: `${stats.mean > 0 ? Math.min(100, (stats.mean / Math.max(stats.mean, stats.median)) * 100) : 0}%` }} />
                                  <span className="text-sm font-bold text-blue-700 tabular-nums relative z-10">{fmtBRL(stats.mean)}</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-cockpit-muted mb-1">Mediana (valor central real)</p>
                                <div className="h-10 bg-cockpit-accent/10 rounded-lg flex items-center px-3 relative overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 bg-cockpit-accent/20 rounded-lg" style={{ width: `${stats.median > 0 ? Math.min(100, (stats.median / Math.max(stats.mean, stats.median)) * 100) : 0}%` }} />
                                  <span className="text-sm font-bold text-cockpit-accent tabular-nums relative z-10">{fmtBRL(stats.median)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
                              {stats.skew > 0.1
                                ? <><strong className="text-cockpit-accent">Distribuição assimétrica positiva.</strong> A média é maior que a mediana — poucos pedidos de alto valor puxam a média para cima. A mediana representa melhor o pedido &quot;típico&quot;.</>
                                : stats.skew < -0.1
                                  ? <><strong className="text-blue-600">Distribuição assimétrica negativa.</strong> A mediana é maior que a média — há concentração em valores mais altos com alguns pedidos pequenos.</>
                                  : <><strong className="text-emerald-600">Distribuição aproximadamente simétrica.</strong> Média e mediana estão próximas — os valores se distribuem de forma equilibrada.</>
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Histogram + Scatter */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Histogram */}
                      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <Hash className="w-4 h-4 text-cockpit-accent" />
                          <h2 className="text-sm font-semibold text-gray-900">Distribuição por faixa de valor</h2>
                        </div>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histData} barCategoryGap="10%">
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                              <XAxis dataKey="faixa" tick={{ fill: "#78696c", fontSize: 9 }} angle={-15} textAnchor="end" height={40} />
                              <YAxis tick={{ fill: "#78696c", fontSize: 10 }} allowDecimals={false} width={30} />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0]?.payload;
                                  const pct = orderValues.length > 0 ? ((d?.count ?? 0) / orderValues.length * 100).toFixed(1) : "0";
                                  return (
                                    <ChartTooltipWrapper>
                                      <p className="font-semibold text-gray-800">R$ {d?.faixa}</p>
                                      <p className="text-cockpit-accent font-bold">{d?.count} pedidos ({pct}%)</p>
                                      <p className="text-gray-500">Total: {fmtBRL(d?.total ?? 0)}</p>
                                    </ChartTooltipWrapper>
                                  );
                                }}
                              />
                              {stats && <ReferenceLine y={0} stroke="transparent" />}
                              <Bar dataKey="count" fill="#A81C2C" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Scatter: Valor × Itens */}
                      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-cockpit-accent" />
                            <h2 className="text-sm font-semibold text-gray-900">Valor × Nº de Itens</h2>
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Aberto</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Fechado</span>
                          </div>
                        </div>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                              <XAxis type="number" dataKey="itens" name="Itens" tick={{ fill: "#78696c", fontSize: 10 }} label={{ value: "Nº Itens", position: "insideBottom", offset: -2, fontSize: 10, fill: "#78696c" }} />
                              <YAxis type="number" dataKey="valor" name="Valor" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => fmtK(v)} width={45} />
                              <ZAxis range={[30, 30]} />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0]?.payload;
                                  return (
                                    <ChartTooltipWrapper>
                                      <p className="font-semibold text-gray-800">Pedido #{d?.docNum}</p>
                                      <p className="text-cockpit-accent font-bold">{fmtBRL(d?.valor ?? 0)}</p>
                                      <p className="text-gray-500">{d?.itens} itens · {d?.status}</p>
                                    </ChartTooltipWrapper>
                                  );
                                }}
                              />
                              <Scatter data={scatter.filter((s) => s.status === "Aberto")} fill="#10b981" fillOpacity={0.6} />
                              <Scatter data={scatter.filter((s) => s.status === "Fechado")} fill="#9ca3af" fillOpacity={0.4} />
                              {stats && <ReferenceLine y={stats.median} stroke="#A81C2C" strokeDasharray="6 4" strokeWidth={1} />}
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Lead time */}
                    {leadTime.length > 2 && (
                      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cockpit-accent" />
                            <h2 className="text-sm font-semibold text-gray-900">Lead Time (dias até entrega)</h2>
                          </div>
                          <span className="text-[10px] text-cockpit-muted">
                            Mediana: <strong className="text-cockpit-accent">{leadTimeMedian.toFixed(0)} dias</strong>
                          </span>
                        </div>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={leadTime} barCategoryGap="5%">
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                              <XAxis dataKey="dias" tick={{ fill: "#78696c", fontSize: 10 }} label={{ value: "Dias", position: "insideBottom", offset: -2, fontSize: 10, fill: "#78696c" }} />
                              <YAxis tick={{ fill: "#78696c", fontSize: 10 }} allowDecimals={false} width={30} />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0]?.payload;
                                  return (
                                    <ChartTooltipWrapper>
                                      <p className="font-semibold text-gray-800">{d?.dias} dias</p>
                                      <p className="text-cockpit-accent">{d?.count} pedidos</p>
                                    </ChartTooltipWrapper>
                                  );
                                }}
                              />
                              <Bar dataKey="count" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
                              <ReferenceLine x={leadTimeMedian} stroke="#A81C2C" strokeDasharray="6 4" strokeWidth={1.5} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ─── Tab: Padrões & Tendências ─── */}
            {chartTab === "patterns" && (
              <div className="space-y-4 animate-[fadeIn_200ms_ease-out]">
                {needMoreData ? (
                  <div className="rounded-xl border border-cockpit-border bg-white p-8 text-center shadow-sm">
                    <TrendingUp className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-600 font-medium">Dados insuficientes para análise de padrões</p>
                    <p className="text-sm text-cockpit-muted mt-1">Expanda o período para visualizar tendências.</p>
                  </div>
                ) : (
                  <>
                    {/* Acumulado no período */}
                    {cumulativeData.length > 1 && (
                      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-cockpit-accent" />
                            <h2 className="text-sm font-semibold text-gray-900">Faturamento Acumulado</h2>
                          </div>
                          <span className="text-[10px] text-cockpit-muted">
                            Total: <strong className="text-cockpit-accent">{fmtBRL(cumulativeData[cumulativeData.length - 1]?.acumulado ?? 0)}</strong>
                          </span>
                        </div>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={cumulativeData}>
                              <defs>
                                <linearGradient id="gradAccum" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#A81C2C" stopOpacity={0.15} />
                                  <stop offset="100%" stopColor="#A81C2C" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                              <XAxis dataKey="data" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => (v ? format(parseISO(v), "dd/MM") : "")} />
                              <YAxis yAxisId="acum" orientation="left" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => fmtK(v)} width={50} />
                              <YAxis yAxisId="diario" orientation="right" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => fmtK(v)} width={50} />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0]?.payload;
                                  return (
                                    <ChartTooltipWrapper>
                                      <p className="font-semibold text-gray-800 mb-1">{label ? format(parseISO(label), "dd/MM/yyyy", { locale: ptBR }) : ""}</p>
                                      <p className="text-gray-600">Dia: <strong className="text-cockpit-accent">{fmtBRL(d?.diario ?? 0)}</strong></p>
                                      <p className="text-gray-600">Acumulado: <strong className="text-gray-900">{fmtBRL(d?.acumulado ?? 0)}</strong></p>
                                    </ChartTooltipWrapper>
                                  );
                                }}
                              />
                              <Bar yAxisId="diario" dataKey="diario" fill="#e5dfe1" radius={[2, 2, 0, 0]} barSize={20} />
                              <Area yAxisId="acum" type="monotone" dataKey="acumulado" stroke="#A81C2C" strokeWidth={2} fill="url(#gradAccum)" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Weekday + Vendedores */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Pedidos por dia da semana */}
                      {weekdayData.length > 0 && (
                        <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-cockpit-accent" />
                            <h2 className="text-sm font-semibold text-gray-900">Padrão por dia da semana</h2>
                          </div>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={weekdayData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                                <XAxis dataKey="dia" tick={{ fill: "#78696c", fontSize: 11 }} />
                                <YAxis yAxisId="valor" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => fmtK(v)} width={45} />
                                <YAxis yAxisId="pedidos" orientation="right" tick={{ fill: "#78696c", fontSize: 10 }} width={30} />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const d = payload[0]?.payload;
                                    return (
                                      <ChartTooltipWrapper>
                                        <p className="font-semibold text-gray-800">{d?.dia}</p>
                                        <p className="text-cockpit-accent font-bold">{fmtBRL(d?.valor ?? 0)}</p>
                                        <p className="text-gray-500">{d?.pedidos} pedidos</p>
                                        <p className="text-blue-600">Mediana: {fmtBRL(d?.mediana ?? 0)}</p>
                                      </ChartTooltipWrapper>
                                    );
                                  }}
                                />
                                <Bar yAxisId="valor" dataKey="valor" radius={[3, 3, 0, 0]}>
                                  {weekdayData.map((d) => (
                                    <Cell key={d.dia} fill={WEEKDAY_COLORS[d.idx] ?? "#A81C2C"} fillOpacity={0.8} />
                                  ))}
                                </Bar>
                                <Line yAxisId="pedidos" type="monotone" dataKey="pedidos" stroke="#78696c" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: "#78696c" }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Vendedores */}
                      {salesPersonData.length > 0 && (
                        <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-cockpit-accent" />
                              <h2 className="text-sm font-semibold text-gray-900">Vendedores</h2>
                            </div>
                            {spMedianAll > 0 && (
                              <span className="text-[10px] text-cockpit-muted">
                                Med. geral: <strong className="text-blue-600">{fmtBRL(spMedianAll)}</strong>
                              </span>
                            )}
                          </div>
                          <div className="space-y-2.5">
                            {salesPersonData.map((sp) => {
                              const pct = salesPersonData[0].valor > 0 ? (sp.valor / salesPersonData[0].valor) * 100 : 0;
                              return (
                                <div key={sp.vendedor}>
                                  <div className="flex items-center justify-between text-xs mb-0.5">
                                    <span className="text-gray-700 font-medium">{sp.vendedor}</span>
                                    <div className="flex items-center gap-3 tabular-nums">
                                      <span className="text-gray-400 text-[10px]">{sp.pedidos} ped.</span>
                                      <span className="text-blue-600 text-[10px]">med: {fmtBRL(sp.mediana)}</span>
                                      <span className="text-cockpit-accent font-semibold">{fmtBRL(sp.valor)}</span>
                                    </div>
                                  </div>
                                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden relative">
                                    <div className="h-full rounded-full bg-cockpit-accent/70 transition-all duration-500" style={{ width: `${pct}%` }} />
                                    {spMedianAll > 0 && salesPersonData[0].valor > 0 && (
                                      <div
                                        className="absolute top-0 h-full w-0.5 bg-blue-500"
                                        style={{ left: `${Math.min(100, (spMedianAll / salesPersonData[0].valor) * 100)}%` }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeOrders.length === 0 && orders.length === 0 && (
          <div className="rounded-xl border border-cockpit-border bg-white p-8 text-center shadow-sm">
            <ShoppingCart className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Nenhum pedido neste período</p>
            <p className="text-sm text-cockpit-muted mt-1 mb-4">Expanda o período para visualizar mais dados.</p>
            <div className="flex items-center justify-center gap-2">
              {RANGE_OPTIONS.filter((o) => o.key !== rangePreset).slice(0, 3).map((opt) => (
                <button key={opt.key} type="button" onClick={() => setRangePreset(opt.key)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-cockpit-accent/30 text-cockpit-accent hover:bg-cockpit-accent/10 transition-colors font-medium">
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ═══ Filtros da tabela ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="relative sm:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº pedido, cliente, item..."
              className="w-full pl-10 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-black/5 rounded">
                <X className="w-3.5 h-3.5 text-cockpit-muted" />
              </button>
            )}
          </div>
          <div className="sm:col-span-4">
            <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
              <option value="">Todos clientes ({clientes.length})</option>
              {clientes.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
            </select>
          </div>
          <div className="sm:col-span-4 flex items-center rounded-lg border border-cockpit-border overflow-hidden bg-cockpit-bg">
            {(["all", "open", "closed", "cancelled"] as const).map((s) => {
              const counts = { all: totalDocs, open: openDocs, closed: closedDocs, cancelled: cancelledDocs };
              const labels = { all: "Todos", open: "Abertos", closed: "Fechados", cancelled: "Cancelados" };
              return (
                <button key={s} type="button" onClick={() => setStatusFilter(s)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${statusFilter === s ? "bg-cockpit-accent text-white shadow-sm" : "text-gray-500 hover:bg-black/5 hover:text-gray-700"}`}>
                  {labels[s]} <span className="opacity-70">({counts[s]})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Tabela de pedidos ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-cockpit-border bg-gray-50/80">
          <p className="text-xs text-cockpit-muted">
            Exibindo <strong className="text-gray-800">{visibleDocs.length}</strong> de{" "}
            <strong className="text-gray-800">{filtered.length}</strong> pedidos
            {filtered.length < orders.length && <span className="ml-1">({orders.length} total)</span>}
          </p>
          {visibleDocs.length > 0 && (
            <button type="button" onClick={expanded.size > 0 ? collapseAll : expandAll}
              className="text-xs text-cockpit-accent hover:text-cockpit-accent/80 font-medium transition-colors">
              {expanded.size > 0 ? "Recolher todos" : "Expandir todos"}
            </button>
          )}
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm table-sticky-head">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50/50 text-[10px] uppercase tracking-wider text-cockpit-muted">
                <th className="w-8" />
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_num")}>
                  <span className="inline-flex items-center gap-1">Nº <SortIcon field="doc_num" /></span></th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_date")}>
                  <span className="inline-flex items-center gap-1">Data <SortIcon field="doc_date" /></span></th>
                <th className="text-left py-2.5 px-3 font-semibold">Cód. PN</th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("card_name")}>
                  <span className="inline-flex items-center gap-1">Parceiro de Negócios <SortIcon field="card_name" /></span></th>
                <th className="text-center py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("num_lines")}>
                  <span className="inline-flex items-center gap-1">Itens <SortIcon field="num_lines" /></span></th>
                <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("total_quantity")}>
                  <span className="inline-flex items-center gap-1 justify-end">Qtd <SortIcon field="total_quantity" /></span></th>
                <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_total")}>
                  <span className="inline-flex items-center gap-1 justify-end">Valor (BRL) <SortIcon field="doc_total" /></span></th>
                <th className="text-center py-2.5 px-3 font-semibold">Status</th>
                <th className="text-center py-2.5 px-3 font-semibold">Vend.</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map((order, rowIdx) => {
                const isExpanded = expanded.has(order.doc_entry);
                const isCancelled = order.cancelled === "Y";
                const isOpen = order.doc_status === "O" && !isCancelled;
                const lines = orderLines[order.doc_entry] ?? order.lines ?? [];
                const isLoadingLines = loadingLines.has(order.doc_entry);
                const qty = Number(order.total_quantity) || lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
                const nLines = lines.length || order.num_lines || 0;

                return (
                  <Fragment key={order.doc_entry}>
                    <tr onClick={() => toggleExpand(order.doc_entry)}
                      className={`border-b border-cockpit-border/30 cursor-pointer transition-colors ${isExpanded ? "bg-cockpit-accent/[0.03]" : rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-cockpit-accent/[0.05]`}>
                      <td className="pl-2.5 pr-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-cockpit-accent" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-gray-900 tabular-nums text-sm">{order.doc_num}</td>
                      <td className="py-2.5 px-3 text-gray-600 tabular-nums whitespace-nowrap">{fmtDateShort(order.doc_date)}</td>
                      <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{order.card_code}</td>
                      <td className="py-2.5 px-3 text-gray-800 max-w-[200px] truncate font-medium" title={order.card_name}>{order.card_name || order.card_code}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 tabular-nums">{nLines}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-gray-800">{fmtQty(qty)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-900">{fmtBRL(Number(order.doc_total) || 0)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                          isCancelled ? "bg-red-50 text-red-600 ring-1 ring-red-200" : isOpen ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
                        }`}>
                          {isCancelled ? "Cancelado" : isOpen ? "Aberto" : "Fechado"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums text-xs text-gray-500">{order.sales_person_code ?? "—"}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-transparent">
                        <td colSpan={10} className="p-0 align-top">
                          {isLoadingLines ? (
                            <div className="px-8 py-6 flex items-center gap-2 text-sm text-cockpit-muted bg-gray-50/90 border-x border-b border-cockpit-border/50">
                              <Loader2 className="w-4 h-4 animate-spin text-cockpit-accent" /> Carregando itens do SAP...
                            </div>
                          ) : <OrderDetailPanel lines={lines} />}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {visibleDocs.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-cockpit-muted">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-500">Nenhum pedido encontrado</p>
                    <p className="text-xs mt-1">Altere os filtros ou expanda o período</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {visibleDocs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-cockpit-border bg-cockpit-accent/[0.03] text-xs">
            <span className="text-cockpit-muted">Subtotal visível ({visibleDocs.length} pedidos)</span>
            <div className="flex items-center gap-6 tabular-nums">
              <span className="text-gray-600">Itens: <strong className="text-gray-800">{visibleDocs.reduce((s, o) => s + (o.lines?.length ?? o.num_lines ?? 0), 0)}</strong></span>
              <span className="text-gray-600">Qtd: <strong className="text-gray-800">{fmtQty(visibleDocs.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0))}</strong></span>
              <span className="text-cockpit-accent font-bold">{fmtBRL(visibleDocs.reduce((s, o) => s + (Number(o.doc_total) || 0), 0))}</span>
            </div>
          </div>
        )}

        {hasMore && (
          <div className="px-4 py-3 border-t border-cockpit-border space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #A81C2C 0%, #c42538 100%)" }} />
              </div>
              <span className="text-[10px] text-cockpit-muted whitespace-nowrap tabular-nums font-medium">{visibleCount}/{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleLoadMore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-accent text-white text-sm font-medium hover:bg-cockpit-accent/90 transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> Carregar +{nextBatch}
              </button>
              {remaining > BATCH_SIZE && (
                <button type="button" onClick={handleShowAll}
                  className="px-4 py-2 rounded-lg border border-cockpit-border text-sm text-gray-600 hover:bg-black/5 transition-colors">
                  Mostrar todos ({remaining.toLocaleString("pt-BR")})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
