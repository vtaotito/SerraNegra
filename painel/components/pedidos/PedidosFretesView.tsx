"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  Truck, DollarSign, Users, TrendingUp, AlertCircle, Search, X,
  Download, ChevronDown, ChevronRight, CalendarDays, RefreshCw,
  Briefcase, ShoppingCart, ArrowUp, ArrowDown, ArrowUpDown, Receipt,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ComposedChart, Line, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { fmtBRL, fmtNum, exportCSV } from "@/lib/format";
import {
  fetchSalesOrders, fetchSalesPersons, fetchCustomers,
  type SalesOrderRow,
} from "@/lib/cockpit-api";
import { onlyFreight } from "@/lib/orders";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import {
  CHART_AXIS_LINE, CHART_SERIES_PRIMARY, chartAxisTick, formatYAxisCompact,
} from "@/lib/chart-theme";

// ---------------------------------------------------------------------------
// Tipos e helpers
// ---------------------------------------------------------------------------

type View = "cliente" | "pedido";

type SortKey = "cliente" | "qtd" | "total" | "medio" | "ultimo";
type SortDir = "asc" | "desc";

interface ClienteAgg {
  cardCode: string;
  cardName: string;
  qtd: number;
  total: number;
  medio: number;
  min: number;
  max: number;
  ultimo: string | null; // doc_date mais recente
  pedidos: SalesOrderRow[];
}

function fmtDateShort(raw: string | null): string {
  if (!raw) return "—";
  try {
    return format(raw.includes("T") ? parseISO(raw) : new Date(raw), "dd/MM/yyyy", { locale: ptBR });
  } catch { return raw; }
}

function aggregateByClient(orders: SalesOrderRow[]): ClienteAgg[] {
  const map = new Map<string, ClienteAgg>();
  for (const o of orders) {
    const key = o.card_code || "—";
    let agg = map.get(key);
    if (!agg) {
      agg = {
        cardCode: key,
        cardName: o.card_name || key,
        qtd: 0,
        total: 0,
        medio: 0,
        min: Infinity,
        max: -Infinity,
        ultimo: null,
        pedidos: [],
      };
      map.set(key, agg);
    }
    const v = Number(o.doc_total) || 0;
    agg.qtd += 1;
    agg.total += v;
    if (v < agg.min) agg.min = v;
    if (v > agg.max) agg.max = v;
    if (!agg.ultimo || (o.doc_date && o.doc_date > agg.ultimo)) agg.ultimo = o.doc_date;
    agg.pedidos.push(o);
  }
  for (const a of map.values()) {
    a.medio = a.qtd > 0 ? a.total / a.qtd : 0;
    if (a.min === Infinity) a.min = 0;
    if (a.max === -Infinity) a.max = 0;
    a.pedidos.sort((p, q) => (q.doc_date || "").localeCompare(p.doc_date || ""));
  }
  return Array.from(map.values());
}

function aggregateByMonth(orders: SalesOrderRow[]): { mes: string; valor: number; pedidos: number }[] {
  const map = new Map<string, { valor: number; pedidos: number }>();
  for (const o of orders) {
    if (!o.doc_date) continue;
    const key = o.doc_date.slice(0, 7);
    const cur = map.get(key) ?? { valor: 0, pedidos: 0 };
    cur.valor += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([m, v]) => ({
      mes: `${m.substring(5)}/${m.substring(2, 4)}`,
      valor: v.valor,
      pedidos: v.pedidos,
    }));
}

// ---------------------------------------------------------------------------
// View wrapper
// ---------------------------------------------------------------------------

export function PedidosFretesView({ embedded = false }: { embedded?: boolean }) {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <FretesContent embedded={embedded} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function FretesContent({ embedded }: { embedded: boolean }) {
  const { range, label: periodoLabel } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data, loading, error, refetch } = useFetch(
    () => fetchSalesOrders({ dateFrom, dateTo, limit: 50000, salesPerson: salesPersonCode }),
    [dateFrom, dateTo, salesPersonCode],
  );
  const { data: spData } = useFetch(() => fetchSalesPersons(), []);
  const { data: custData } = useFetch(() => fetchCustomers({ limit: 50000 }), []);

  const allOrders = useMemo(() => data?.items ?? [], [data]);

  // Apenas fretes (linhas = 0)
  const fretesAll = useMemo(() => onlyFreight(allOrders), [allOrders]);
  const fretes = useMemo(() => fretesAll.filter((o) => o.cancelled !== "Y"), [fretesAll]);
  const fretesCancel = fretesAll.length - fretes.length;

  // Mapas auxiliares
  const spMap = useMemo(() => {
    const m = new Map<number, string>();
    if (spData?.items) for (const sp of spData.items) m.set(sp.SalesEmployeeCode, sp.SalesEmployeeName);
    return m;
  }, [spData]);

  const custMap = useMemo(() => {
    const m = new Map<string, { city: string; state: string }>();
    if (custData?.data) for (const c of custData.data) {
      if (c.card_code) m.set(c.card_code, { city: c.city ?? "", state: c.state ?? "" });
    }
    return m;
  }, [custData]);

  // Estado UI
  const [view, setView] = useState<View>("cliente");
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Pedidos filtrados (busca + cliente)
  const fretesFiltrados = useMemo(() => {
    let arr = fretes;
    if (clienteFilter) arr = arr.filter((o) => o.card_code === clienteFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((o) =>
        String(o.doc_num).includes(q) ||
        (o.card_name ?? "").toLowerCase().includes(q) ||
        (o.card_code ?? "").toLowerCase().includes(q) ||
        (o.comments ?? "").toLowerCase().includes(q),
      );
    }
    return arr;
  }, [fretes, clienteFilter, search]);

  const totalFrete = useMemo(
    () => fretesFiltrados.reduce((s, o) => s + (Number(o.doc_total) || 0), 0),
    [fretesFiltrados],
  );
  const totalPedidos = fretesFiltrados.length;
  const ticket = totalPedidos > 0 ? totalFrete / totalPedidos : 0;
  const clientesUnicos = useMemo(
    () => new Set(fretesFiltrados.map((o) => o.card_code)).size,
    [fretesFiltrados],
  );

  // Agregação por cliente
  const clientesAgg = useMemo(() => {
    const arr = aggregateByClient(fretesFiltrados);
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "cliente": cmp = a.cardName.localeCompare(b.cardName); break;
        case "qtd": cmp = a.qtd - b.qtd; break;
        case "total": cmp = a.total - b.total; break;
        case "medio": cmp = a.medio - b.medio; break;
        case "ultimo": cmp = (a.ultimo ?? "").localeCompare(b.ultimo ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [fretesFiltrados, sortKey, sortDir]);

  // Por mês
  const monthly = useMemo(() => aggregateByMonth(fretesFiltrados), [fretesFiltrados]);
  const medianMonth = useMemo(() => {
    const vals = [...monthly.map((m) => m.valor)].sort((a, b) => a - b);
    if (vals.length === 0) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  }, [monthly]);

  // Top 5 clientes (KPI lateral)
  const top5 = useMemo(() => clientesAgg.slice(0, 5), [clientesAgg]);
  const totalTop = top5.reduce((s, c) => s + c.total, 0);
  const concentracaoTop = totalFrete > 0 ? (totalTop / totalFrete) * 100 : 0;

  // Lista de clientes para filtro
  const clientesFiltro = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of fretes) {
      if (o.card_code && !map.has(o.card_code)) map.set(o.card_code, o.card_name || o.card_code);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fretes]);

  // Handlers
  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir(key === "cliente" ? "asc" : "desc");
      return key;
    });
  }, []);

  const toggleExpand = useCallback((cardCode: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cardCode)) next.delete(cardCode); else next.add(cardCode);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setClienteFilter("");
  }, []);

  const hasActiveFilters = !!search || !!clienteFilter;

  const handleExport = useCallback(() => {
    if (view === "cliente") {
      exportCSV(
        clientesAgg.map((c) => ({
          "Cód. Cliente": c.cardCode,
          "Cliente": c.cardName,
          "Nº Fretes": c.qtd,
          "Valor Total": c.total,
          "Valor Médio": c.medio,
          "Mínimo": c.min,
          "Máximo": c.max,
          "Último Frete": fmtDateShort(c.ultimo),
        })),
        `fretes-por-cliente-${dateFrom}-${dateTo}`,
      );
    } else {
      exportCSV(
        fretesFiltrados.map((o) => {
          const vName = o.sales_person_code != null
            ? (spMap.get(o.sales_person_code) ?? `Cód ${o.sales_person_code}`)
            : "";
          const cust = custMap.get(o.card_code ?? "");
          const loc = cust ? [cust.city, cust.state].filter(Boolean).join("/") : "";
          return {
            "Nº Pedido": o.doc_num,
            "Data": fmtDateShort(o.doc_date),
            "Cód. Cliente": o.card_code,
            "Cliente": o.card_name,
            "Localização": loc,
            "Valor Frete": Number(o.doc_total) || 0,
            "Vendedor": vName,
            "Observações": o.comments ?? "",
            "Status": o.doc_status === "O" ? "Aberto" : "Fechado",
          };
        }),
        `fretes-${dateFrom}-${dateTo}`,
      );
    }
  }, [view, clientesAgg, fretesFiltrados, dateFrom, dateTo, spMap, custMap]);

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-25" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  }

  // ---------- Render ----------

  if (loading) return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Truck className="w-5 h-5 text-cockpit-accent" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fretes</h1>
            <p className="text-sm text-cockpit-muted mt-0.5">Carregando dados...</p>
          </div>
        </div>
      )}
      {embedded && (
        <p className="text-sm text-cockpit-muted">Carregando pedidos de frete...</p>
      )}
      <LoadingSkeleton rows={6} />
    </div>
  );

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-5">
      {/* Header / toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {!embedded ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-cockpit-accent/10 shrink-0">
              <Truck className="w-5 h-5 text-cockpit-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Fretes</h1>
              <p className="text-xs sm:text-sm text-cockpit-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{periodoLabel}</span>
                <span className="text-cockpit-border">·</span>
                <span>
                  <strong className="text-gray-700">{fmtNum(fretes.length)}</strong> pedidos de frete
                  {fretesCancel > 0 && <span className="text-cockpit-muted"> · {fretesCancel} cancelados</span>}
                </span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-cockpit-muted flex items-center gap-1.5 flex-wrap min-w-0">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{periodoLabel}</span>
            <span className="text-cockpit-border">·</span>
            <span>
              <strong className="text-gray-700">{fmtNum(fretes.length)}</strong> pedidos de frete
              {fretesCancel > 0 && <> · {fretesCancel} cancelados</>}
            </span>
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refetch}
            className="flex items-center justify-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 motion-safe:transition-colors"
          >
            <RefreshCw className="w-4 h-4" />Atualizar
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 motion-safe:transition-colors"
          >
            <Download className="w-4 h-4" />CSV
          </button>
        </div>
      </div>

      {/* Banner contextual */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800">
          <p className="font-semibold mb-0.5">Sessão dedicada de custo de frete</p>
          <p className="text-amber-700">
            Pedidos com <strong>0 itens</strong> são tratados como cobranças avulsas de frete e <strong>não compõem o faturamento</strong> da operação.
            Use esta tela para monitorar quanto cada cliente gastou em frete no período.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { label: "Pedidos de Frete", value: fmtNum(totalPedidos), sub: hasActiveFilters ? "no filtro atual" : "no período", icon: Truck, color: "text-cockpit-accent" },
          { label: "Valor Total", value: fmtBRL(totalFrete), sub: "cobrado em fretes", icon: DollarSign, color: "text-emerald-600" },
          { label: "Frete Médio", value: fmtBRL(ticket), sub: totalPedidos > 0 ? "por pedido de frete" : "—", icon: TrendingUp, color: "text-blue-600" },
          { label: "Clientes Distintos", value: fmtNum(clientesUnicos), sub: `${clientesAgg.length > 0 ? `Top 1: ${clientesAgg[0].cardName.substring(0, 18)}` : "—"}`, icon: Users, color: "text-teal-600" },
          { label: "Top 5 = ", value: `${concentracaoTop.toFixed(0)}%`, sub: `${fmtBRL(totalTop)} concentrado`, icon: Briefcase, color: "text-violet-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-white p-3.5 shadow-sm hover:border-cockpit-accent/30 motion-safe:transition-all">
            <div className="flex items-center gap-2 mb-1.5">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{k.value}</p>
            <p className="text-[10px] text-cockpit-muted mt-0.5 truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de evolução mensal */}
      {monthly.length > 1 && (
        <div className="rounded-xl border border-cockpit-border bg-white p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" />Evolução Mensal — Custo de Frete
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                <XAxis dataKey="mes" tick={chartAxisTick("sm")} />
                <YAxis
                  yAxisId="left"
                  tick={chartAxisTick("sm")}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ ...chartAxisTick("sm"), fill: "#059669" }}
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                <ReferenceLine
                  yAxisId="left"
                  y={medianMonth}
                  stroke="#7c3aed"
                  strokeDasharray="5 5"
                  label={{ value: `Med ${formatYAxisCompact(medianMonth)}`, fill: "#7c3aed", fontSize: 10 }}
                />
                <Bar yAxisId="left" dataKey="valor" name="Valor de Frete" radius={[4, 4, 0, 0]}>
                  {monthly.map((d, i) => (
                    <Cell key={i} fill={d.valor >= medianMonth ? CHART_SERIES_PRIMARY : CHART_AXIS_LINE} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  dataKey="pedidos"
                  name="Nº Pedidos"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabs + filtros */}
      <div className="rounded-xl border border-cockpit-border bg-white p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div role="tablist" aria-label="Modo de visualização" className="inline-flex rounded-lg bg-cockpit-bg p-0.5 border border-cockpit-border">
            {([
              ["cliente", "Por Cliente", Users],
              ["pedido", "Por Pedido", ShoppingCart],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold motion-safe:transition-all ${
                  view === key ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-gray-500">
            <strong className="text-gray-700">{view === "cliente" ? clientesAgg.length : fretesFiltrados.length}</strong>{" "}
            {view === "cliente" ? "cliente(s)" : "pedido(s) de frete"}
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="ml-3 text-cockpit-accent hover:underline">
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="relative sm:col-span-7">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nº pedido, cliente, observação..."
              className="w-full pl-10 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/5 rounded">
                <X className="w-3.5 h-3.5 text-cockpit-muted" />
              </button>
            )}
          </div>
          <div className="sm:col-span-5">
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
            >
              <option value="">Todos os clientes ({clientesFiltro.length})</option>
              {clientesFiltro.map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {view === "cliente" ? (
        <ClientTable
          rows={clientesAgg}
          expanded={expanded}
          onToggle={toggleExpand}
          onSort={toggleSort}
          sortKey={sortKey}
          SortIcon={SortIcon}
          spMap={spMap}
          custMap={custMap}
          totalFrete={totalFrete}
        />
      ) : (
        <OrderTable
          orders={fretesFiltrados}
          spMap={spMap}
          custMap={custMap}
          totalFrete={totalFrete}
        />
      )}

      <div className="text-center text-xs text-cockpit-muted">
        Pedidos com 0 itens ·{" "}
        <Link href="/pedidos?view=analise" className="text-cockpit-accent hover:underline font-medium">
          Ver análise de produtos
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClientTable (agregado por cliente)
// ---------------------------------------------------------------------------

interface ClientTableProps {
  rows: ClienteAgg[];
  expanded: Set<string>;
  onToggle: (code: string) => void;
  onSort: (k: SortKey) => void;
  sortKey: SortKey;
  SortIcon: ({ k }: { k: SortKey }) => React.ReactElement;
  spMap: Map<number, string>;
  custMap: Map<string, { city: string; state: string }>;
  totalFrete: number;
}

function ClientTable({ rows, expanded, onToggle, onSort, sortKey, SortIcon, spMap, custMap, totalFrete }: ClientTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-cockpit-border bg-white p-16 text-center text-cockpit-muted">
        <Truck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-500">Nenhum pedido de frete no período</p>
        <p className="text-xs mt-1">Ajuste os filtros ou amplie o intervalo</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-cockpit-border shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
            <tr>
              <th className="w-7 px-2 py-3" />
              <th
                className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted cursor-pointer hover:text-gray-800"
                onClick={() => onSort("cliente")}
              >
                <span className="inline-flex items-center gap-1">Cliente <SortIcon k="cliente" /></span>
              </th>
              <th
                className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted cursor-pointer hover:text-gray-800"
                onClick={() => onSort("qtd")}
              >
                <span className="inline-flex items-center gap-1 justify-end w-full">Fretes <SortIcon k="qtd" /></span>
              </th>
              <th
                className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted cursor-pointer hover:text-gray-800"
                onClick={() => onSort("total")}
              >
                <span className="inline-flex items-center gap-1 justify-end w-full">Total <SortIcon k="total" /></span>
              </th>
              <th
                className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted cursor-pointer hover:text-gray-800"
                onClick={() => onSort("medio")}
              >
                <span className="inline-flex items-center gap-1 justify-end w-full">Médio <SortIcon k="medio" /></span>
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">
                Min · Max
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">
                % do total
              </th>
              <th
                className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted cursor-pointer hover:text-gray-800"
                onClick={() => onSort("ultimo")}
              >
                <span className="inline-flex items-center gap-1 justify-end w-full">Último <SortIcon k="ultimo" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c) => {
              const isExpanded = expanded.has(c.cardCode);
              const pct = totalFrete > 0 ? (c.total / totalFrete) * 100 : 0;
              return (
                <ClientRow
                  key={c.cardCode}
                  agg={c}
                  pct={pct}
                  isExpanded={isExpanded}
                  onToggle={onToggle}
                  spMap={spMap}
                  custMap={custMap}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
        {rows.length} cliente(s) com fretes no período · Soma total {fmtBRL(totalFrete)}
      </div>
    </div>
  );
}

interface ClientRowProps {
  agg: ClienteAgg;
  pct: number;
  isExpanded: boolean;
  onToggle: (code: string) => void;
  spMap: Map<number, string>;
  custMap: Map<string, { city: string; state: string }>;
}

function ClientRow({ agg, pct, isExpanded, onToggle, spMap, custMap }: ClientRowProps) {
  const cust = custMap.get(agg.cardCode);
  const loc = cust ? [cust.city, cust.state].filter(Boolean).join("/") : "";

  return (
    <>
      <tr
        className={`group cursor-pointer hover:bg-cockpit-accent/5 motion-safe:transition-colors ${
          isExpanded ? "bg-cockpit-accent/5" : ""
        }`}
        onClick={() => onToggle(agg.cardCode)}
      >
        <td className="px-2 py-3">
          <ChevronDown className={`w-4 h-4 text-gray-400 motion-safe:transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 text-sm truncate max-w-[260px]" title={agg.cardName}>{agg.cardName}</span>
            <span className="text-[10px] text-cockpit-muted font-mono">
              {agg.cardCode}{loc && <span className="text-gray-400"> · {loc}</span>}
            </span>
          </div>
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-gray-700">{agg.qtd}</td>
        <td className="px-3 py-3 text-right tabular-nums font-bold text-cockpit-accent">{fmtBRL(agg.total)}</td>
        <td className="px-3 py-3 text-right tabular-nums text-gray-600">{fmtBRL(agg.medio)}</td>
        <td className="px-3 py-3 text-right text-xs text-gray-500 tabular-nums">
          {fmtBRL(agg.min, 0)} <span className="text-gray-300">·</span> {fmtBRL(agg.max, 0)}
        </td>
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-gray-500 tabular-nums">{pct.toFixed(1)}%</span>
            <div className="w-12 h-1.5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-cockpit-accent"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-right text-xs text-gray-500">{fmtDateShort(agg.ultimo)}</td>
      </tr>
      {isExpanded && (
        <tr className="bg-gradient-to-b from-cockpit-accent/[0.03] to-white">
          <td colSpan={8} className="px-6 py-3">
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-[11px] text-gray-600">
                <Truck className="w-3 h-3" />
                <strong>{agg.qtd}</strong> pedido{agg.qtd !== 1 && "s"} de frete &middot; total {fmtBRL(agg.total)}
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50/60 text-cockpit-muted uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2 text-left">Nº</th>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Vendedor</th>
                    <th className="px-3 py-2 text-left">Observações</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agg.pedidos.map((o) => {
                    const vName = o.sales_person_code != null
                      ? (spMap.get(o.sales_person_code) ?? `Cód ${o.sales_person_code}`)
                      : "—";
                    return (
                      <tr key={o.doc_entry} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono font-semibold text-gray-800">{o.doc_num}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDateShort(o.doc_date)}</td>
                        <td className="px-3 py-2 text-gray-600 truncate max-w-[140px]" title={vName}>{vName}</td>
                        <td className="px-3 py-2 text-gray-500 truncate max-w-[260px]" title={o.comments ?? ""}>{o.comments || "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            o.doc_status === "O" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                          }`}>
                            {o.doc_status === "O" ? "Aberto" : "Fechado"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-cockpit-accent">
                          {fmtBRL(Number(o.doc_total) || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// OrderTable (lista plana de pedidos)
// ---------------------------------------------------------------------------

interface OrderTableProps {
  orders: SalesOrderRow[];
  spMap: Map<number, string>;
  custMap: Map<string, { city: string; state: string }>;
  totalFrete: number;
}

function OrderTable({ orders, spMap, custMap, totalFrete }: OrderTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-cockpit-border bg-white p-16 text-center text-cockpit-muted">
        <Truck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-500">Nenhum pedido de frete no período</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-cockpit-border shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Nº</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Data</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Cliente</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Local</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Vendedor</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Observação</th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Status</th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-cockpit-muted">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => {
              const vName = o.sales_person_code != null
                ? (spMap.get(o.sales_person_code) ?? `Cód ${o.sales_person_code}`)
                : "—";
              const cust = custMap.get(o.card_code ?? "");
              const loc = cust ? [cust.city, cust.state].filter(Boolean).join("/") : "";
              return (
                <tr key={o.doc_entry} className="hover:bg-cockpit-accent/5 motion-safe:transition-colors">
                  <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{o.doc_num}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{fmtDateShort(o.doc_date)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 text-xs truncate max-w-[240px]" title={o.card_name}>{o.card_name}</span>
                      <span className="text-[10px] text-cockpit-muted font-mono">{o.card_code}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{loc || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[140px]" title={vName}>{vName}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[240px]" title={o.comments ?? ""}>{o.comments || "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      o.doc_status === "O" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {o.doc_status === "O" ? "Aberto" : "Fechado"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-cockpit-accent">
                    {fmtBRL(Number(o.doc_total) || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50 flex items-center justify-between">
        <span>{orders.length} pedido(s) de frete</span>
        <span>
          Total: <strong className="text-cockpit-accent">{fmtBRL(totalFrete)}</strong>
        </span>
      </div>
    </div>
  );
}
