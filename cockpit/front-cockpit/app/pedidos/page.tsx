"use client";

import { Fragment, useState, useMemo, useCallback, useEffect } from "react";
import {
  ShoppingCart, Filter, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, Package, Hash, Plus, Loader2,
  RefreshCw,
} from "lucide-react";
import { fmtBRL, exportCSV } from "@/lib/format";
import {
  fetchSalesOrders, syncSalesOrders,
  type SalesOrderRow, type SalesOrderLine,
} from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { KPICard } from "@/components/KPICard";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BATCH_SIZE = 20;

function fmtDate(raw: string | null): string {
  if (!raw) return "—";
  try {
    const d = raw.includes("T") ? parseISO(raw) : new Date(raw);
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return raw;
  }
}

function OrderDetailPanel({ lines }: { lines: SalesOrderLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-cockpit-muted italic">
        Detalhamento de itens não disponível para este pedido.
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="rounded-lg border border-cockpit-border/60 bg-cockpit-bg/60 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cockpit-border/40 text-cockpit-muted uppercase tracking-wider">
              <th className="text-left py-2.5 px-4 font-semibold">#</th>
              <th className="text-left py-2.5 px-4 font-semibold">Código</th>
              <th className="text-left py-2.5 px-4 font-semibold">Descrição</th>
              <th className="text-right py-2.5 px-4 font-semibold">Qtd</th>
              <th className="text-right py-2.5 px-4 font-semibold">Preço Unit.</th>
              <th className="text-right py-2.5 px-4 font-semibold">Total Linha</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr
                key={`${l.ItemCode}-${idx}`}
                className="border-b border-cockpit-border/20 last:border-b-0 hover:bg-black/[0.02]"
              >
                <td className="py-2 px-4 text-cockpit-muted">{(l.LineNum ?? idx) + 1}</td>
                <td className="py-2 px-4 font-mono text-blue-600">{l.ItemCode ?? "—"}</td>
                <td className="py-2 px-4 text-gray-700 max-w-[280px] truncate">
                  {l.ItemDescription ?? "—"}
                </td>
                <td className="py-2 px-4 text-right tabular-nums font-medium text-gray-900">
                  {l.Quantity?.toLocaleString("pt-BR") ?? "—"}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-cockpit-muted">
                  {l.UnitPrice != null ? fmtBRL(l.UnitPrice) : l.Price != null ? fmtBRL(l.Price) : "—"}
                </td>
                <td className="py-2 px-4 text-right tabular-nums font-medium text-cockpit-accent">
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
    () => fetchSalesOrders({ dateFrom, dateTo, limit: 5000 }),
    [dateFrom, dateTo]
  );

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const orders = useMemo(() => data?.items ?? [], [data]);

  // Filtros
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "cancelled">("all");

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

    return result;
  }, [orders, statusFilter, clienteFilter, search]);

  // Load-more
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    setExpanded(new Set());
  }, [dateFrom, dateTo, statusFilter, clienteFilter, search]);

  const visibleDocs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // KPIs globais
  const totalDocs = filtered.length;
  const totalValue = useMemo(() => filtered.reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [filtered]);
  const totalItems = useMemo(
    () => filtered.reduce((s, o) => s + (o.lines?.length ?? o.num_lines ?? 0), 0),
    [filtered]
  );
  const ticketMedio = totalDocs > 0 ? totalValue / totalDocs : 0;

  const hasMore = visibleCount < filtered.length;
  const remaining = Math.max(0, filtered.length - visibleCount);
  const nextBatch = Math.min(BATCH_SIZE, remaining);
  const progressPct = filtered.length > 0 ? Math.min(100, (visibleCount / filtered.length) * 100) : 100;

  const handleLoadMore = useCallback(() => setVisibleCount((c) => c + BATCH_SIZE), []);
  const handleShowAll = useCallback(() => setVisibleCount(filtered.length), [filtered.length]);

  const toggleExpand = useCallback((docNum: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(docNum) ? next.delete(docNum) : next.add(docNum);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(visibleDocs.map((d) => d.doc_num)));
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
      Data: fmtDate(o.doc_date),
      "Cod. Cliente": o.card_code,
      Cliente: o.card_name,
      "Valor Total": Number(o.doc_total) || 0,
      Moeda: o.doc_currency,
      Status: o.cancelled === "Y" ? "Cancelado" : o.doc_status === "O" ? "Aberto" : "Fechado",
      Itens: o.lines?.length ?? o.num_lines ?? 0,
    }));
    exportCSV(rows, `pedidos-venda-${dateFrom}-${dateTo}`);
  }, [filtered, dateFrom, dateTo]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-cockpit-accent" />
            Pedidos de Venda
          </h1>
          <p className="text-sm text-cockpit-muted flex items-center gap-1.5 mt-1">
            <CalendarDays className="w-3.5 h-3.5" />
            Período: {rangeLabel} &middot; {totalDocs} pedidos &middot; {totalItems} itens
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-cockpit-accent text-cockpit-accent hover:bg-cockpit-accent/10 transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Sincronizando..." : "Sync SAP"}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-cockpit-accent/10 text-cockpit-accent text-sm border border-cockpit-accent/20">
          {syncMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
          <Filter className="w-4 h-4" /> Filtros
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nº pedido, cliente, item..."
              className="w-full pl-10 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-1 focus:ring-cockpit-accent focus:border-cockpit-accent"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5">
                <X className="w-3.5 h-3.5 text-cockpit-muted" />
              </button>
            )}
          </div>
          <select
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-1 focus:ring-cockpit-accent"
          >
            <option value="">Todos clientes</option>
            {clientes.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <div className="flex items-center rounded-lg border border-cockpit-border overflow-hidden">
            {(["all", "open", "closed", "cancelled"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-cockpit-accent text-white"
                    : "text-gray-500 hover:bg-black/5"
                }`}
              >
                {s === "all" ? "Todos" : s === "open" ? "Abertos" : s === "closed" ? "Fechados" : "Cancelados"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="PEDIDOS" value={totalDocs} icon={<ShoppingCart className="w-4 h-4" />} />
        <KPICard title="ITENS VENDIDOS" value={totalItems} icon={<Package className="w-4 h-4" />} />
        <KPICard
          title="VALOR TOTAL"
          value={fmtBRL(totalValue)}
          subtitle={totalValue > 0 ? `${filtered.filter((o) => o.cancelled !== "Y").length} pedidos ativos` : undefined}
        />
        <KPICard title="TICKET MÉDIO" value={fmtBRL(ticketMedio)} />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cockpit-border bg-cockpit-bg/50">
          <p className="text-xs text-cockpit-muted">
            Exibindo <strong className="text-gray-900">{visibleDocs.length}</strong> de{" "}
            <strong className="text-gray-900">{filtered.length}</strong> pedidos — clique em uma linha para ver itens
          </p>
          <button
            type="button"
            onClick={expanded.size > 0 ? collapseAll : expandAll}
            className="text-xs text-cockpit-muted hover:text-gray-900 transition-colors"
          >
            {expanded.size > 0 ? "Recolher todos" : "Expandir todos"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted text-[11px] uppercase tracking-wider">
                <th className="w-8" />
                <th className="text-left py-3 px-4 font-semibold">Nº Pedido</th>
                <th className="text-left py-3 px-4 font-semibold">Data</th>
                <th className="text-left py-3 px-4 font-semibold">Cliente</th>
                <th className="text-center py-3 px-4 font-semibold">Itens</th>
                <th className="text-right py-3 px-4 font-semibold">Qtd Total</th>
                <th className="text-right py-3 px-4 font-semibold">Valor</th>
                <th className="text-center py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map((order) => {
                const isExpanded = expanded.has(order.doc_num);
                const isCancelled = order.cancelled === "Y";
                const isOpen = order.doc_status === "O" && !isCancelled;
                const lines = order.lines ?? [];

                return (
                  <Fragment key={order.doc_entry}>
                    <tr
                      onClick={() => toggleExpand(order.doc_num)}
                      className="border-b border-cockpit-border/40 cursor-pointer hover:bg-black/[0.02] transition-colors"
                    >
                      <td className="pl-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-cockpit-accent" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-cockpit-muted" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 tabular-nums">
                        {order.doc_num}
                      </td>
                      <td className="py-3 px-4 text-gray-600 tabular-nums">{fmtDate(order.doc_date)}</td>
                      <td className="py-3 px-4 text-gray-700 max-w-[220px] truncate" title={order.card_name}>
                        {order.card_name || order.card_code}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                          <Hash className="w-3 h-3" /> {lines.length}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-gray-900">
                        {lines.reduce((s, l) => s + (l.Quantity ?? 0), 0).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-cockpit-accent">
                        {fmtBRL(Number(order.doc_total) || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isCancelled
                              ? "bg-red-50 text-red-600"
                              : isOpen
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {isCancelled ? "Cancelado" : isOpen ? "Aberto" : "Fechado"}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <OrderDetailPanel lines={lines} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {visibleDocs.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-cockpit-muted">
                    Nenhum pedido de venda encontrado para o período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="px-4 py-4 border-t border-cockpit-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-cockpit-border/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, #A81C2C 0%, #d4a853 100%)`,
                  }}
                />
              </div>
              <span className="text-xs text-cockpit-muted whitespace-nowrap tabular-nums">
                {visibleCount}/{filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-accent text-white text-sm font-medium hover:bg-cockpit-accentHover transition-colors"
              >
                <Plus className="w-4 h-4" />
                Carregar +{nextBatch} pedidos
              </button>
              {remaining > BATCH_SIZE && (
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="px-4 py-2 rounded-lg border border-cockpit-border text-sm text-gray-600 hover:bg-black/5 transition-colors"
                >
                  Mostrar todos ({remaining})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
