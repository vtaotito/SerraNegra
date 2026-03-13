"use client";

import { Fragment, useState, useMemo, useCallback, useEffect } from "react";
import {
  ShoppingCart, Filter, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, Package, Hash, Plus, Loader2,
  RefreshCw, DollarSign, Users, TrendingUp, BarChart3,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { fmtBRL, exportCSV } from "@/lib/format";
import {
  fetchSalesOrders, syncSalesOrders,
  type SalesOrderRow, type SalesOrderLine,
} from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BATCH_SIZE = 50;

function fmtDate(raw: string | null): string {
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

type SortField = "doc_num" | "doc_date" | "card_name" | "doc_total" | "num_lines" | "total_quantity";
type SortDir = "asc" | "desc";

function OrderDetailPanel({ lines }: { lines: SalesOrderLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="px-8 py-4 text-sm text-cockpit-muted italic bg-amber-50/50">
        Detalhamento de itens indisponível para este pedido.
      </div>
    );
  }

  const totalQty = lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
  const totalVal = lines.reduce((s, l) => s + (l.LineTotal ?? 0), 0);

  return (
    <div className="px-4 py-3 bg-gray-50/80">
      <div className="rounded-lg border border-cockpit-border/50 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-2 bg-cockpit-accent/5 border-b border-cockpit-border/30 flex items-center justify-between">
          <span className="text-xs font-semibold text-cockpit-accent uppercase tracking-wider">
            Itens do Pedido ({lines.length})
          </span>
          <span className="text-xs text-gray-500">
            Qtd total: <strong className="text-gray-700">{fmtQty(totalQty)}</strong> &middot; Valor: <strong className="text-cockpit-accent">{fmtBRL(totalVal)}</strong>
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cockpit-border/30 text-cockpit-muted uppercase tracking-wider text-[10px]">
              <th className="text-left py-2 px-3 font-semibold w-10">#</th>
              <th className="text-left py-2 px-3 font-semibold w-28">Código</th>
              <th className="text-left py-2 px-3 font-semibold">Descrição</th>
              <th className="text-left py-2 px-3 font-semibold w-16">Depósito</th>
              <th className="text-right py-2 px-3 font-semibold w-20">Qtd</th>
              <th className="text-right py-2 px-3 font-semibold w-24">Preço Unit.</th>
              <th className="text-right py-2 px-3 font-semibold w-16">Desc%</th>
              <th className="text-right py-2 px-3 font-semibold w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr
                key={`${l.ItemCode}-${l.LineNum ?? idx}`}
                className="border-b border-cockpit-border/15 last:border-b-0 hover:bg-cockpit-accent/[0.02] transition-colors"
              >
                <td className="py-1.5 px-3 text-cockpit-muted tabular-nums">{(l.LineNum ?? idx) + 1}</td>
                <td className="py-1.5 px-3 font-mono text-xs text-blue-700 font-medium">{l.ItemCode ?? "—"}</td>
                <td className="py-1.5 px-3 text-gray-700 truncate max-w-[300px]" title={l.ItemDescription ?? ""}>
                  {l.ItemDescription ?? "—"}
                </td>
                <td className="py-1.5 px-3 text-gray-500 font-mono text-[10px]">{l.WarehouseCode ?? "—"}</td>
                <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-gray-900">
                  {fmtQty(l.Quantity ?? 0)}
                </td>
                <td className="py-1.5 px-3 text-right tabular-nums text-gray-600">
                  {l.UnitPrice != null ? fmtBRL(l.UnitPrice) : l.Price != null ? fmtBRL(l.Price) : "—"}
                </td>
                <td className="py-1.5 px-3 text-right tabular-nums text-gray-500">
                  {(l.DiscountPercent ?? 0) > 0 ? `${l.DiscountPercent}%` : "—"}
                </td>
                <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-cockpit-accent">
                  {l.LineTotal != null ? fmtBRL(l.LineTotal) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PedidosPage() {
  const { range, label: rangeLabel } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data, loading, error, refetch } = useFetch(
    () => fetchSalesOrders({ dateFrom, dateTo, limit: 50000 }),
    [dateFrom, dateTo]
  );

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const orders = useMemo(() => data?.items ?? [], [data]);
  const dbTotal = data?.total ?? 0;

  // Filtros
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "cancelled">("all");

  // Ordenação
  const [sortField, setSortField] = useState<SortField>("doc_num");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("desc");
      return field;
    });
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.card_code && !map.has(o.card_code)) {
        map.set(o.card_code, o.card_name || o.card_code);
      }
    }
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
        String(o.doc_num).includes(q) ||
        (o.card_name ?? "").toLowerCase().includes(q) ||
        (o.card_code ?? "").toLowerCase().includes(q) ||
        (o.lines ?? []).some((l) =>
          (l.ItemCode ?? "").toLowerCase().includes(q) ||
          (l.ItemDescription ?? "").toLowerCase().includes(q)
        )
      );
    }

    // Ordenação
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "doc_num":
          cmp = (a.doc_num ?? 0) - (b.doc_num ?? 0);
          break;
        case "doc_date":
          cmp = (a.doc_date ?? "").localeCompare(b.doc_date ?? "");
          break;
        case "card_name":
          cmp = (a.card_name ?? "").localeCompare(b.card_name ?? "");
          break;
        case "doc_total":
          cmp = (Number(a.doc_total) || 0) - (Number(b.doc_total) || 0);
          break;
        case "num_lines":
          cmp = (a.lines?.length ?? a.num_lines ?? 0) - (b.lines?.length ?? b.num_lines ?? 0);
          break;
        case "total_quantity":
          cmp = (Number(a.total_quantity) || 0) - (Number(b.total_quantity) || 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [orders, statusFilter, clienteFilter, search, sortField, sortDir]);

  // Load-more
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    setExpanded(new Set());
  }, [dateFrom, dateTo, statusFilter, clienteFilter, search, sortField, sortDir]);

  const visibleDocs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // KPIs
  const totalDocs = filtered.length;
  const openDocs = useMemo(() => filtered.filter((o) => o.doc_status === "O" && o.cancelled !== "Y").length, [filtered]);
  const closedDocs = useMemo(() => filtered.filter((o) => o.doc_status === "C" && o.cancelled !== "Y").length, [filtered]);
  const cancelledDocs = useMemo(() => filtered.filter((o) => o.cancelled === "Y").length, [filtered]);
  const totalValue = useMemo(() => filtered.reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [filtered]);
  const activeValue = useMemo(() => filtered.filter((o) => o.cancelled !== "Y").reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [filtered]);
  const totalItems = useMemo(() => filtered.reduce((s, o) => s + (o.lines?.length ?? o.num_lines ?? 0), 0), [filtered]);
  const totalQty = useMemo(() => filtered.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0), [filtered]);
  const ticketMedio = totalDocs > 0 ? activeValue / Math.max(1, totalDocs - cancelledDocs) : 0;
  const uniqueClients = useMemo(() => new Set(filtered.filter((o) => o.cancelled !== "Y").map((o) => o.card_code)).size, [filtered]);

  const hasMore = visibleCount < filtered.length;
  const remaining = Math.max(0, filtered.length - visibleCount);
  const nextBatch = Math.min(BATCH_SIZE, remaining);
  const progressPct = filtered.length > 0 ? Math.min(100, (visibleCount / filtered.length) * 100) : 100;

  const handleLoadMore = useCallback(() => setVisibleCount((c) => c + BATCH_SIZE), []);
  const handleShowAll = useCallback(() => setVisibleCount(filtered.length), [filtered.length]);

  const toggleExpand = useCallback((docEntry: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(docEntry) ? next.delete(docEntry) : next.add(docEntry);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(visibleDocs.map((d) => d.doc_entry)));
  }, [visibleDocs]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncSalesOrders();
      setSyncMsg(res.message);
      refetch();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  const handleExportCSV = useCallback(() => {
    const rows = filtered.map((o) => ({
      "Nº Pedido": o.doc_num,
      "Data Pedido": fmtDate(o.doc_date),
      "Data Entrega": fmtDate(o.doc_due_date),
      "Cód. Cliente": o.card_code,
      "Cliente": o.card_name,
      "Valor Total": Number(o.doc_total) || 0,
      "Moeda": o.doc_currency,
      "Status": o.cancelled === "Y" ? "Cancelado" : o.doc_status === "O" ? "Aberto" : "Fechado",
      "Itens": o.lines?.length ?? o.num_lines ?? 0,
      "Qtd Total": Number(o.total_quantity) || 0,
      "Vendedor": o.sales_person_code ?? "",
      "Observações": o.comments ?? "",
    }));
    exportCSV(rows, `pedidos-venda-${dateFrom}-${dateTo}`);
  }, [filtered, dateFrom, dateTo]);

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-cockpit-accent" />
      : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cockpit-accent/10">
              <ShoppingCart className="w-5 h-5 text-cockpit-accent" />
            </div>
            Pedidos de Venda
          </h1>
          <p className="text-sm text-cockpit-muted flex items-center gap-1.5 mt-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {rangeLabel} &middot; <strong className="text-gray-700">{dbTotal.toLocaleString("pt-BR")}</strong> registros no banco
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg bg-cockpit-accent text-white font-medium hover:bg-cockpit-accentHover transition-colors disabled:opacity-50 shadow-sm"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar SAP"}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-cockpit-accent/10 text-cockpit-accent text-sm border border-cockpit-accent/20 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 flex-shrink-0" /> {syncMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Pedidos", value: totalDocs.toLocaleString("pt-BR"), sub: `${openDocs} abertos · ${closedDocs} fechados`, icon: ShoppingCart, color: "text-cockpit-accent" },
          { label: "Valor Total", value: fmtBRL(activeValue), sub: cancelledDocs > 0 ? `${fmtBRL(totalValue)} bruto` : undefined, icon: DollarSign, color: "text-emerald-600" },
          { label: "Ticket Médio", value: fmtBRL(ticketMedio), icon: TrendingUp, color: "text-blue-600" },
          { label: "Itens Vendidos", value: totalItems.toLocaleString("pt-BR"), icon: Package, color: "text-violet-600" },
          { label: "Qtd Total", value: fmtQty(totalQty), icon: BarChart3, color: "text-amber-600" },
          { label: "Clientes", value: uniqueClients.toLocaleString("pt-BR"), icon: Users, color: "text-teal-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-cockpit-border bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-cockpit-muted mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="relative sm:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nº pedido, cliente, item..."
              className="w-full pl-10 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-black/5 rounded">
                <X className="w-3.5 h-3.5 text-cockpit-muted" />
              </button>
            )}
          </div>
          <div className="sm:col-span-4">
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
            >
              <option value="">Todos clientes ({clientes.length})</option>
              {clientes.map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4 flex items-center rounded-lg border border-cockpit-border overflow-hidden bg-cockpit-bg">
            {(["all", "open", "closed", "cancelled"] as const).map((s) => {
              const counts = { all: totalDocs, open: openDocs, closed: closedDocs, cancelled: cancelledDocs };
              const labels = { all: "Todos", open: "Abertos", closed: "Fechados", cancelled: "Cancelados" };
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-cockpit-accent text-white shadow-sm"
                      : "text-gray-500 hover:bg-black/5 hover:text-gray-700"
                  }`}
                >
                  {labels[s]} <span className="opacity-70">({counts[s]})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-cockpit-border bg-gray-50/80">
          <p className="text-xs text-cockpit-muted">
            Exibindo <strong className="text-gray-800">{visibleDocs.length}</strong> de{" "}
            <strong className="text-gray-800">{filtered.length}</strong> pedidos filtrados
            {filtered.length < orders.length && (
              <span className="ml-1">({orders.length} total no período)</span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {visibleDocs.length > 0 && (
              <button
                type="button"
                onClick={expanded.size > 0 ? collapseAll : expandAll}
                className="text-xs text-cockpit-accent hover:text-cockpit-accentHover font-medium transition-colors"
              >
                {expanded.size > 0 ? "Recolher todos" : "Expandir todos"}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50/50 text-[10px] uppercase tracking-wider text-cockpit-muted">
                <th className="w-8" />
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_num")}>
                  <span className="inline-flex items-center gap-1">Nº <SortIcon field="doc_num" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_date")}>
                  <span className="inline-flex items-center gap-1">Data <SortIcon field="doc_date" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold">Cód. PN</th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("card_name")}>
                  <span className="inline-flex items-center gap-1">Parceiro de Negócios <SortIcon field="card_name" /></span>
                </th>
                <th className="text-center py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("num_lines")}>
                  <span className="inline-flex items-center gap-1">Itens <SortIcon field="num_lines" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("total_quantity")}>
                  <span className="inline-flex items-center gap-1 justify-end">Qtd <SortIcon field="total_quantity" /></span>
                </th>
                <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_total")}>
                  <span className="inline-flex items-center gap-1 justify-end">Valor Total (BRL) <SortIcon field="doc_total" /></span>
                </th>
                <th className="text-center py-2.5 px-3 font-semibold">Status</th>
                <th className="text-center py-2.5 px-3 font-semibold">Vend.</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map((order, rowIdx) => {
                const isExpanded = expanded.has(order.doc_entry);
                const isCancelled = order.cancelled === "Y";
                const isOpen = order.doc_status === "O" && !isCancelled;
                const lines = order.lines ?? [];
                const qty = Number(order.total_quantity) || lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
                const nLines = lines.length || order.num_lines || 0;

                return (
                  <Fragment key={order.doc_entry}>
                    <tr
                      onClick={() => toggleExpand(order.doc_entry)}
                      className={`border-b border-cockpit-border/30 cursor-pointer transition-colors ${
                        isExpanded ? "bg-cockpit-accent/[0.03]" : rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                      } hover:bg-cockpit-accent/[0.05]`}
                    >
                      <td className="pl-2.5 pr-0">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-cockpit-accent" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" />
                        }
                      </td>
                      <td className="py-2.5 px-3 font-bold text-gray-900 tabular-nums text-sm">
                        {order.doc_num}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 tabular-nums whitespace-nowrap">
                        {fmtDate(order.doc_date)}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">
                        {order.card_code}
                      </td>
                      <td className="py-2.5 px-3 text-gray-800 max-w-[200px] truncate font-medium" title={order.card_name}>
                        {order.card_name || order.card_code}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 tabular-nums">
                          {nLines}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-gray-800">
                        {fmtQty(qty)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-900">
                        {fmtBRL(Number(order.doc_total) || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            isCancelled
                              ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                              : isOpen
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
                          }`}
                        >
                          {isCancelled ? "Cancelado" : isOpen ? "Aberto" : "Fechado"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums text-xs text-gray-500">
                        {order.sales_person_code ?? "—"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <OrderDetailPanel lines={lines} />
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
                    <p className="text-xs mt-1">Altere os filtros ou o período de datas</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totalizador da tabela visível */}
        {visibleDocs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-cockpit-border bg-cockpit-accent/[0.03] text-xs">
            <span className="text-cockpit-muted">
              Subtotal visível ({visibleDocs.length} pedidos)
            </span>
            <div className="flex items-center gap-6 tabular-nums">
              <span className="text-gray-600">
                Itens: <strong className="text-gray-800">{visibleDocs.reduce((s, o) => s + (o.lines?.length ?? o.num_lines ?? 0), 0)}</strong>
              </span>
              <span className="text-gray-600">
                Qtd: <strong className="text-gray-800">{fmtQty(visibleDocs.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0))}</strong>
              </span>
              <span className="text-cockpit-accent font-bold">
                {fmtBRL(visibleDocs.reduce((s, o) => s + (Number(o.doc_total) || 0), 0))}
              </span>
            </div>
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="px-4 py-3 border-t border-cockpit-border space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, #A81C2C 0%, #c42538 100%)`,
                  }}
                />
              </div>
              <span className="text-[10px] text-cockpit-muted whitespace-nowrap tabular-nums font-medium">
                {visibleCount}/{filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-accent text-white text-sm font-medium hover:bg-cockpit-accentHover transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Carregar +{nextBatch}
              </button>
              {remaining > BATCH_SIZE && (
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="px-4 py-2 rounded-lg border border-cockpit-border text-sm text-gray-600 hover:bg-black/5 transition-colors"
                >
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
