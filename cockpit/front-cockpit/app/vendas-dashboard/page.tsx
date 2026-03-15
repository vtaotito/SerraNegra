"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  ShoppingCart,
  Target,
  Users,
  TrendingUp,
  CalendarDays,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { fmtBRL, fmtNum } from "@/lib/format";
import {
  fetchSalesOrders,
  fetchSalesPersons,
  type SalesOrderRow,
  type SapSalesPerson,
} from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format, parseISO, startOfDay, eachDayOfInterval, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

type ChartView = "overview" | "daily" | "clients";

const CHART_COLORS = ["#A81C2C", "#c42538", "#e5484d", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6"];

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

function aggregateByClient(orders: SalesOrderRow[], limit = 10): { nome: string; codigo: string; valor: number; pedidos: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byClient = new Map<string, { nome: string; valor: number; pedidos: number }>();
  for (const o of active) {
    const key = o.card_code ?? "?";
    const cur = byClient.get(key) ?? { nome: o.card_name ?? key, valor: 0, pedidos: 0 };
    cur.valor += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    byClient.set(key, cur);
  }
  return Array.from(byClient.entries())
    .map(([codigo, v]) => ({ codigo, nome: v.nome.length > 25 ? v.nome.slice(0, 22) + "…" : v.nome, valor: v.valor, pedidos: v.pedidos }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit);
}

function statusAggregate(orders: SalesOrderRow[]): { name: string; value: number; fill: string }[] {
  const open = orders.filter((o) => o.doc_status === "O" && o.cancelled !== "Y").length;
  const closed = orders.filter((o) => o.doc_status === "C" && o.cancelled !== "Y").length;
  const cancelled = orders.filter((o) => o.cancelled === "Y").length;
  return [
    { name: "Abertos", value: open, fill: CHART_COLORS[2] },
    { name: "Fechados", value: closed, fill: CHART_COLORS[4] },
    { name: "Cancelados", value: cancelled, fill: CHART_COLORS[0] },
  ].filter((s) => s.value > 0);
}

function weeklySeries(orders: SalesOrderRow[], range: { from: Date; to: Date }): { semana: string; valor: number; pedidos: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const days = eachDayOfInterval({ start: range.from, end: range.to });
  const byWeek = new Map<string, { valor: number; pedidos: number }>();
  for (const d of days) {
    const key = format(d, "yyyy-'S'ww", { locale: ptBR });
    byWeek.set(key, { valor: 0, pedidos: 0 });
  }
  for (const o of active) {
    const d = o.doc_date ? parseISO(o.doc_date.slice(0, 10)) : null;
    if (!d || !isWithinInterval(d, { start: range.from, end: range.to })) continue;
    const key = format(d, "yyyy-'S'ww", { locale: ptBR });
    const cur = byWeek.get(key) ?? { valor: 0, pedidos: 0 };
    cur.valor += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    byWeek.set(key, cur);
  }
  return Array.from(byWeek.entries())
    .map(([semana, v]) => ({ semana, valor: v.valor, pedidos: v.pedidos }))
    .sort((a, b) => a.semana.localeCompare(b.semana));
}

export default function VendasDashboardPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading: loadOrd, error: errOrd, refetch: refetchOrd } = useFetch(
    () => fetchSalesOrders({ dateFrom, dateTo, limit: 50000 }),
    [dateFrom, dateTo]
  );
  const { data: spData, loading: loadSp } = useFetch(() => fetchSalesPersons(), []);

  const loading = loadOrd && loadSp;
  const hasError = !!errOrd;

  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const activeOrders = useMemo(() => orders.filter((o) => o.cancelled !== "Y"), [orders]);

  const totais = useMemo(
    () => ({
      valor: activeOrders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0),
      pedidos: activeOrders.length,
      ticket: activeOrders.length > 0 ? activeOrders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0) / activeOrders.length : 0,
      clientes: new Set(activeOrders.map((o) => o.card_code)).size,
    }),
    [activeOrders]
  );

  const chartByDay = useMemo(() => aggregateByDay(orders), [orders]);
  const chartByClient = useMemo(() => aggregateByClient(orders, 12), [orders]);
  const statusData = useMemo(() => statusAggregate(orders), [orders]);
  const weeklyData = useMemo(() => weeklySeries(orders, range), [orders, range]);

  const [chartView, setChartView] = useState<ChartView>("overview");

  const ultimosPedidos = useMemo(
    () =>
      [...orders]
        .sort((a, b) => (b.doc_date ?? "").localeCompare(a.doc_date ?? ""))
        .slice(0, 8),
    [orders]
  );

  const kpis = useMemo(
    () => [
      { title: "Faturamento", value: fmtBRL(totais.valor), icon: DollarSign, color: "text-cockpit-accent" },
      { title: "Pedidos", value: fmtNum(totais.pedidos), icon: ShoppingCart, color: "text-sky-500" },
      { title: "Ticket Médio", value: totais.pedidos > 0 ? fmtBRL(totais.ticket) : "—", icon: Target, color: "text-amber-500" },
      { title: "Clientes Ativos", value: String(totais.clientes), icon: Users, color: "text-teal-500" },
    ],
    [totais]
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Vendas</h1>
          <p className="text-cockpit-muted mt-1 text-sm">Carregando dados dos pedidos...</p>
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cockpit-accent/10">
              <BarChart3 className="w-5 h-5 text-cockpit-accent" />
            </div>
            Dashboard Vendas
          </h1>
          <p className="text-cockpit-muted mt-1 text-sm flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="text-gray-600">{periodoLabel}</span>
            <span className="text-cockpit-border">·</span>
            <span>{ordersData?.total ?? 0} pedidos no período</span>
          </p>
        </div>
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 hover:border-cockpit-accent/40 transition-colors text-sm font-medium"
        >
          Ver todos os pedidos
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {hasError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600">Não foi possível carregar pedidos de venda</p>
            <p className="text-xs text-cockpit-muted mt-1">{errOrd}</p>
          </div>
          <button type="button" onClick={refetchOrd} className="text-xs text-amber-500 hover:text-gray-900 transition-colors">
            Tentar novamente
          </button>
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Indicadores">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-muted">{kpi.title}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-xl font-bold text-gray-900 leading-tight tabular-nums">{kpi.value}</span>
            </div>
          );
        })}
      </section>

      {!hasError && activeOrders.length > 0 && (
        <>
          {/* Tabs de vista */}
          <div className="flex gap-1 p-1 rounded-lg border border-cockpit-border bg-cockpit-bg w-fit">
            {(
              [
                { id: "overview" as ChartView, label: "Visão geral", icon: Activity },
                { id: "daily" as ChartView, label: "Por dia", icon: CalendarDays },
                { id: "clients" as ChartView, label: "Top clientes", icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChartView(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    chartView === tab.id ? "bg-cockpit-accent text-white shadow-sm" : "text-gray-600 hover:bg-black/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Gráficos dinâmicos por aba */}
          {chartView === "overview" && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <PieChartIcon className="w-5 h-5 text-cockpit-accent" />
                  <h2 className="text-lg font-semibold text-gray-900">Pedidos por Status</h2>
                </div>
                {statusData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {statusData.map((_, i) => (
                            <Cell key={i} fill={statusData[i].fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [v, "Pedidos"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5dfe1" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-cockpit-muted py-12">Sem dados para exibir</p>
                )}
              </div>

              <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-cockpit-accent" />
                  <h2 className="text-lg font-semibold text-gray-900">Evolução Semanal</h2>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData}>
                      <defs>
                        <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A81C2C" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#A81C2C" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                      <XAxis dataKey="semana" tick={{ fill: "#78696c", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => [fmtBRL(value), "Faturamento"]}
                        contentStyle={{ background: "#fff", border: "1px solid #e5dfe1", borderRadius: 8 }}
                        labelStyle={{ color: "#78696c" }}
                      />
                      <Area type="monotone" dataKey="valor" stroke="#A81C2C" fillOpacity={1} fill="url(#colorValor)" name="Faturamento" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {chartView === "daily" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-cockpit-accent" />
                  <h2 className="text-lg font-semibold text-gray-900">Faturamento por Dia</h2>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                      <XAxis dataKey="data" tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v) => (v ? format(parseISO(v), "dd/MM") : "")} />
                      <YAxis tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => [fmtBRL(value), "Valor"]}
                        labelFormatter={(label) => (label ? format(parseISO(label), "dd/MM/yyyy", { locale: ptBR }) : "")}
                        contentStyle={{ background: "#fff", border: "1px solid #e5dfe1", borderRadius: 8 }}
                      />
                      <Line type="monotone" dataKey="valor" stroke="#A81C2C" strokeWidth={2} dot={{ fill: "#A81C2C" }} name="Faturamento" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="w-5 h-5 text-cockpit-accent" />
                  <h2 className="text-lg font-semibold text-gray-900">Volume de Pedidos por Dia</h2>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartByDay} barCategoryGap="12%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                      <XAxis dataKey="data" tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v) => (v ? format(parseISO(v), "dd/MM") : "")} />
                      <YAxis tick={{ fill: "#78696c", fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [value, "Pedidos"]}
                        labelFormatter={(label) => (label ? format(parseISO(label), "dd/MM/yyyy", { locale: ptBR }) : "")}
                        contentStyle={{ background: "#fff", border: "1px solid #e5dfe1", borderRadius: 8 }}
                      />
                      <Bar dataKey="pedidos" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Pedidos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {chartView === "clients" && (
            <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-cockpit-accent" />
                <h2 className="text-lg font-semibold text-gray-900">Top Clientes por Faturamento</h2>
              </div>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartByClient} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap="8%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" width={140} tick={{ fill: "#78696c", fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: number) => [fmtBRL(value), "Faturamento"]}
                      contentStyle={{ background: "#fff", border: "1px solid #e5dfe1", borderRadius: 8 }}
                    />
                    <Bar dataKey="valor" fill="#A81C2C" radius={[0, 4, 4, 0]} name="Faturamento" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Últimos pedidos */}
          <section className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-cockpit-border bg-cockpit-bg/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Últimos pedidos</h2>
              <Link href="/pedidos" className="text-xs text-cockpit-accent hover:underline font-medium">
                Ver todos
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cockpit-border text-[10px] uppercase tracking-wider text-cockpit-muted bg-gray-50/50">
                    <th className="text-left py-2.5 px-4 font-semibold">Nº</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Data</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Cliente</th>
                    <th className="text-right py-2.5 px-4 font-semibold">Valor</th>
                    <th className="text-center py-2.5 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cockpit-border/50">
                  {ultimosPedidos.map((o) => {
                    const isCancelled = o.cancelled === "Y";
                    const isOpen = o.doc_status === "O" && !isCancelled;
                    return (
                      <tr key={o.doc_entry} className="hover:bg-black/[0.02] transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-gray-900 tabular-nums">{o.doc_num}</td>
                        <td className="py-2.5 px-4 text-gray-600 tabular-nums">
                          {o.doc_date ? format(parseISO(o.doc_date.slice(0, 10)), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-gray-800 max-w-[200px] truncate" title={o.card_name ?? undefined}>
                          {o.card_name ?? o.card_code ?? "—"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-cockpit-accent tabular-nums">
                          {fmtBRL(Number(o.doc_total) || 0)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isCancelled ? "bg-red-50 text-red-600" : isOpen ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {isCancelled ? "Cancelado" : isOpen ? "Aberto" : "Fechado"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {!hasError && activeOrders.length === 0 && (
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-12 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">Nenhum pedido no período</p>
          <p className="text-sm text-cockpit-muted mt-1">Altere o período no seletor acima ou sincronize os pedidos de venda.</p>
        </div>
      )}

      <footer className="text-center text-xs text-cockpit-muted py-4 border-t border-cockpit-border">
        Dados: Pedidos de Venda SAP B1 · Dashboard dinâmico · {orders.length} pedidos no período
      </footer>
    </div>
  );
}
