"use client";

import { Fragment, useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, Package, Plus, Loader2,
  RefreshCw, DollarSign, Users, TrendingUp, BarChart3,
  ArrowUpDown, ArrowUp, ArrowDown, ListOrdered,
  PieChart as PieChartIcon, Clock, Zap,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
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
} from "date-fns";
import { ptBR } from "date-fns/locale";

const BATCH_SIZE = 50;

// ─── Range presets (local, independente do contexto global) ───

type RangePreset = "today" | "7d" | "month" | "3m" | "custom";

interface LocalRange {
  from: Date;
  to: Date;
}

function presetRange(key: Exclude<RangePreset, "custom">): LocalRange {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: now };
    case "7d":
      return { from: subDays(now, 6), to: now };
    case "month":
      return { from: startOfMonth(now), to: now };
    case "3m":
      return { from: startOfMonth(subMonths(now, 2)), to: now };
  }
}

const RANGE_OPTIONS: { key: RangePreset; label: string; hint: string }[] = [
  { key: "today", label: "Hoje", hint: "d0" },
  { key: "7d", label: "7 dias", hint: "semana" },
  { key: "month", label: "Mês atual", hint: "desde dia 1" },
  { key: "3m", label: "3 meses", hint: "trimestre" },
];

// ─── Helpers de formatação ────────────────────────────────────

function fmtDateShort(raw: string | null): string {
  if (!raw) return "—";
  try {
    const d = raw.includes("T") ? parseISO(raw) : new Date(raw);
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return raw;
  }
}

function fmtQty(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── Helpers de agregação (vindos do vendas-dashboard) ─────

const CHART_COLORS = ["#A81C2C", "#c42538", "#e5484d", "#0ea5e9", "#10b981", "#f59e0b"];

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
    .map((v) => ({ nome: v.nome.length > 20 ? v.nome.slice(0, 18) + "…" : v.nome, valor: v.valor }));
}

// ─── Sort ─────────────────────────────────────────────────────

type SortField = "doc_num" | "doc_date" | "card_name" | "doc_total" | "num_lines" | "total_quantity";
type SortDir = "asc" | "desc";

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

  // ─── Range local (inicia em "hoje") ───
  const [rangePreset, setRangePreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const localRange = useMemo<LocalRange>(() => {
    if (rangePreset === "custom" && customFrom && customTo) {
      return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
    }
    if (rangePreset === "custom") return presetRange("today");
    return presetRange(rangePreset);
  }, [rangePreset, customFrom, customTo]);

  const dateFrom = format(localRange.from, "yyyy-MM-dd");
  const dateTo = format(localRange.to, "yyyy-MM-dd");
  const rangeLabel = rangePreset === "custom" && customFrom && customTo
    ? `${format(localRange.from, "dd/MM/yyyy")} — ${format(localRange.to, "dd/MM/yyyy")}`
    : RANGE_OPTIONS.find((o) => o.key === rangePreset)?.label ?? "Hoje";

  // ─── Fetch (único para dashboard + tabela) ───
  const { data, loading, error, refetch } = useFetch(
    () => fetchSalesOrders({ dateFrom, dateTo, limit: 50000 }),
    [dateFrom, dateTo]
  );

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const orders = useMemo(() => data?.items ?? [], [data]);
  const activeOrders = useMemo(() => orders.filter((o) => o.cancelled !== "Y"), [orders]);

  // ─── Filtros de tabela ───
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
  const activeValue = useMemo(() => filtered.filter((o) => o.cancelled !== "Y").reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [filtered]);
  const totalQty = useMemo(() => filtered.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0), [filtered]);
  const ticketMedio = totalDocs > 0 ? activeValue / Math.max(1, totalDocs - cancelledDocs) : 0;
  const uniqueClients = useMemo(() => new Set(filtered.filter((o) => o.cancelled !== "Y").map((o) => o.card_code)).size, [filtered]);

  // ─── Chart data ───
  const chartByDay = useMemo(() => aggregateByDay(orders), [orders]);
  const statusData = useMemo(() => statusAggregate(orders), [orders]);
  const topClients = useMemo(() => aggregateByClient(orders, 5), [orders]);

  const hasMore = visibleCount < filtered.length;
  const remaining = Math.max(0, filtered.length - visibleCount);
  const nextBatch = Math.min(BATCH_SIZE, remaining);
  const progressPct = filtered.length > 0 ? Math.min(100, (visibleCount / filtered.length) * 100) : 100;

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

      {/* ═══ Range selector inline ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="w-4 h-4 text-cockpit-muted shrink-0" />
          <span className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mr-1">Período</span>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRangePreset(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                rangePreset === opt.key
                  ? "bg-cockpit-accent text-white shadow-sm"
                  : "text-gray-600 hover:bg-black/5 border border-cockpit-border/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="h-5 w-px bg-cockpit-border mx-1" />
          <button
            type="button"
            onClick={() => { setRangePreset("custom"); setCustomFrom(dateFrom); setCustomTo(dateTo); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              rangePreset === "custom"
                ? "bg-cockpit-accent text-white shadow-sm"
                : "text-gray-600 hover:bg-black/5 border border-cockpit-border/50"
            }`}
          >
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

      {/* Filtro ativo por cliente (vindo da página Clientes) */}
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

      {/* ═══ Dashboard section ═══ */}
      <section className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Pedidos", value: fmtNum(totalDocs), sub: `${openDocs} abertos · ${closedDocs} fechados`, icon: ShoppingCart, color: "text-cockpit-accent" },
            { label: "Faturamento", value: fmtBRL(activeValue), icon: DollarSign, color: "text-emerald-600" },
            { label: "Ticket Médio", value: fmtBRL(ticketMedio), icon: TrendingUp, color: "text-blue-600" },
            { label: "Qtd Total", value: fmtQty(totalQty), icon: Package, color: "text-violet-600" },
            { label: "Clientes", value: fmtNum(uniqueClients), icon: Users, color: "text-teal-600" },
            { label: "Cancelados", value: fmtNum(cancelledDocs), icon: X, color: "text-red-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-cockpit-border bg-white p-3.5 shadow-sm hover:border-cockpit-accent/30 transition-colors">
              <div className="flex items-center gap-2 mb-1.5">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-cockpit-muted mt-0.5">{kpi.sub}</p>}
            </div>
          ))}
        </div>

        {/* Charts grid */}
        {activeOrders.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Faturamento por dia */}
            <div className="xl:col-span-2 rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-cockpit-accent" />
                <h2 className="text-sm font-semibold text-gray-900">Faturamento por dia</h2>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartByDay} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                    <XAxis dataKey="data" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => (v ? format(parseISO(v), "dd/MM") : "")} />
                    <YAxis tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={40} />
                    <Tooltip
                      formatter={(value: number) => [fmtBRL(value), "Valor"]}
                      labelFormatter={(label) => (label ? format(parseISO(label), "dd/MM/yyyy", { locale: ptBR }) : "")}
                      contentStyle={{ background: "#fff", border: "1px solid #e5dfe1", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="valor" fill="#A81C2C" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status + Top clientes */}
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
                        <Tooltip formatter={(v: number) => [v, "Pedidos"]} contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5dfe1" }} />
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
                ) : (
                  <p className="text-xs text-cockpit-muted text-center py-6">Sem dados</p>
                )}
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
                ) : (
                  <p className="text-xs text-cockpit-muted text-center py-6">Sem dados</p>
                )}
              </div>
            </div>
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
