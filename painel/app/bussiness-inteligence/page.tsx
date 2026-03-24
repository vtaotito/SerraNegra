"use client";

import { useMemo } from "react";
import {
  DollarSign, ShoppingCart, Users, TrendingUp,
  Wallet, Target, CalendarDays,
  ArrowUpRight, ArrowDownRight, MapPin, BarChart3,
  Layers, Hash,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie,
} from "recharts";
import { fmtBRL, fmtNum, STATE_TO_REGION } from "@/lib/format";
import {
  fetchSalesOrders, fetchSalesPersons, fetchCustomers,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { format, subMonths } from "date-fns";
import Link from "next/link";

const REGION_COLORS: Record<string, string> = {
  "Sudeste": "#AA1A1B", "Sul": "#0ea5e9", "Nordeste": "#f59e0b",
  "Centro-Oeste": "#10b981", "Norte": "#8b5cf6", "Outro": "#78696c",
};

const STATE_COLORS = [
  "#AA1A1B", "#c42538", "#d42b2c", "#e94848", "#f47474",
  "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#6366f1",
  "#14b8a6", "#ec4899", "#78696c",
];

function CTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-gray-600">
          {p.name}: <span className="font-medium text-gray-900">{typeof p.value === "number" && p.value > 100 ? fmtBRL(p.value) : fmtNum(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { label: periodoLabel, range, monthsInRange } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const prevFrom = format(subMonths(range.from, monthsInRange), "yyyy-MM-dd");
  const prevTo = format(subMonths(range.to, monthsInRange), "yyyy-MM-dd");

  const { data: ordersData, loading: loadOrd, error: errOrd, refetch } =
    useFetch(() => fetchSalesOrders({ dateFrom, dateTo, limit: 50000 }), [dateFrom, dateTo]);
  const { data: prevOrdersData } =
    useFetch(() => fetchSalesOrders({ dateFrom: prevFrom, dateTo: prevTo, limit: 50000 }), [prevFrom, prevTo]);
  const { data: spData } = useFetch(() => fetchSalesPersons(), []);
  const { data: custData } = useFetch(() => fetchCustomers({ limit: 50000 }), []);

  const orders = useMemo(() => (ordersData?.items ?? []).filter((o) => o.cancelled !== "Y"), [ordersData]);
  const prevOrders = useMemo(() => (prevOrdersData?.items ?? []).filter((o) => o.cancelled !== "Y"), [prevOrdersData]);
  const customers = useMemo(() => custData?.data ?? [], [custData]);
  const spMap = useMemo(() => {
    const m = new Map<number, string>();
    if (spData?.items) for (const s of spData.items) m.set(s.SalesEmployeeCode, s.SalesEmployeeName);
    return m;
  }, [spData]);

  const kpis = useMemo(() => {
    const fat = orders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0);
    const prevFat = prevOrders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0);
    const fatVar = prevFat > 0 ? ((fat - prevFat) / prevFat) * 100 : 0;
    const pedidos = orders.length;
    const prevPedidos = prevOrders.length;
    const pedVar = prevPedidos > 0 ? ((pedidos - prevPedidos) / prevPedidos) * 100 : 0;
    const ticket = pedidos > 0 ? fat / pedidos : 0;
    const prevTicket = prevPedidos > 0 ? prevFat / prevPedidos : 0;
    const ticketVar = prevTicket > 0 ? ((ticket - prevTicket) / prevTicket) * 100 : 0;
    const clientesAtivos = new Set(orders.map((o) => o.card_code)).size;
    const prevClientes = new Set(prevOrders.map((o) => o.card_code)).size;
    const clientesVar = prevClientes > 0 ? ((clientesAtivos - prevClientes) / prevClientes) * 100 : 0;
    const qty = orders.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0);

    return { fat, fatVar, pedidos, pedVar, ticket, ticketVar, clientesAtivos, clientesVar, qty, totalBase: custData?.total ?? 0 };
  }, [orders, prevOrders, custData]);

  // Top 10 vendedores
  const topVendedores = useMemo(() => {
    const agg = new Map<number, { nome: string; fat: number; pedidos: number }>();
    for (const o of orders) {
      const code = o.sales_person_code ?? -1;
      const cur = agg.get(code) ?? { nome: spMap.get(code) ?? `Vend. ${code}`, fat: 0, pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.pedidos += 1;
      agg.set(code, cur);
    }
    return Array.from(agg.values()).sort((a, b) => b.fat - a.fat).slice(0, 10);
  }, [orders, spMap]);

  // Top 10 clientes
  const topClientes = useMemo(() => {
    const agg = new Map<string, { nome: string; fat: number; pedidos: number }>();
    for (const o of orders) {
      const cur = agg.get(o.card_code) ?? { nome: o.card_name, fat: 0, pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.pedidos += 1;
      agg.set(o.card_code, cur);
    }
    return Array.from(agg.values()).sort((a, b) => b.fat - a.fat).slice(0, 10);
  }, [orders]);

  // Clientes por estado (com faturamento)
  const clientesPorEstado = useMemo(() => {
    const custStateMap = new Map<string, string>();
    for (const c of customers) {
      if (c.card_code && c.state) custStateMap.set(c.card_code, c.state);
    }
    const agg = new Map<string, { fat: number; clientes: Set<string>; pedidos: number }>();
    for (const o of orders) {
      const state = custStateMap.get(o.card_code) || "N/D";
      const cur = agg.get(state) ?? { fat: 0, clientes: new Set(), pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.clientes.add(o.card_code);
      cur.pedidos += 1;
      agg.set(state, cur);
    }
    return Array.from(agg.entries())
      .map(([state, v]) => ({ state, fat: v.fat, clientes: v.clientes.size, pedidos: v.pedidos }))
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 12);
  }, [orders, customers]);

  // Clientes por região
  const clientesPorRegiao = useMemo(() => {
    const custStateMap = new Map<string, string>();
    for (const c of customers) {
      if (c.card_code && c.state) custStateMap.set(c.card_code, c.state);
    }
    const agg = new Map<string, { fat: number; clientes: Set<string> }>();
    for (const o of orders) {
      const state = custStateMap.get(o.card_code) || "";
      const region = STATE_TO_REGION[state] || "Outro";
      const cur = agg.get(region) ?? { fat: 0, clientes: new Set() };
      cur.fat += Number(o.doc_total) || 0;
      cur.clientes.add(o.card_code);
      agg.set(region, cur);
    }
    return Array.from(agg.entries())
      .map(([region, v]) => ({ name: region, value: v.fat, clientes: v.clientes.size }))
      .sort((a, b) => b.value - a.value);
  }, [orders, customers]);

  // Pedidos abertos vs fechados
  const statusData = useMemo(() => {
    const open = orders.filter((o) => o.doc_status === "O").length;
    const closed = orders.filter((o) => o.doc_status === "C").length;
    return [
      { name: "Abertos", value: open, fill: "#10b981" },
      { name: "Fechados", value: closed, fill: "#78696c" },
    ].filter((s) => s.value > 0);
  }, [orders]);

  if (loadOrd) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Visão Executiva</h1></div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (errOrd) return <ErrorState message={errOrd} onRetry={refetch} />;

  const totalFat = kpis.fat;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Executiva</h1>
        <p className="text-cockpit-muted mt-1 text-sm flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          Cockpit BI · <span className="text-gray-600 font-medium">{periodoLabel}</span>
        </p>
      </div>

      {/* KPIs with variation */}
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { title: "Faturamento", value: fmtBRL(kpis.fat), variation: kpis.fatVar, icon: DollarSign, color: "text-cockpit-accent" },
          { title: "Pedidos", value: fmtNum(kpis.pedidos), variation: kpis.pedVar, icon: ShoppingCart, color: "text-sky-500" },
          { title: "Ticket Médio", value: fmtBRL(kpis.ticket), variation: kpis.ticketVar, icon: Target, color: "text-amber-500" },
          { title: "Clientes Ativos", value: fmtNum(kpis.clientesAtivos), variation: kpis.clientesVar, icon: Wallet, color: "text-teal-500" },
          { title: "Qtd. Vendida", value: fmtNum(kpis.qty), icon: Layers, color: "text-violet-500" },
          { title: "Base Total", value: fmtNum(kpis.totalBase), sub: `${kpis.clientesAtivos} ativos`, icon: Users, color: "text-blue-500" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const hasVar = kpi.variation !== undefined && kpi.variation !== 0;
          const up = (kpi.variation ?? 0) > 0;
          return (
            <div key={kpi.title} className="rounded-xl border border-cockpit-border bg-white p-4 hover:border-cockpit-accent/30 transition-all duration-200 group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-muted">{kpi.title}</span>
                <Icon className={`w-4 h-4 ${kpi.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
              </div>
              <p className="text-xl font-bold text-gray-900 leading-tight tabular-nums">{kpi.value}</p>
              <div className="mt-1.5 flex items-center gap-1">
                {hasVar && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
                    {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(kpi.variation!).toFixed(1)}%
                  </span>
                )}
                {hasVar && <span className="text-[10px] text-cockpit-muted">vs período anterior</span>}
                {kpi.sub && <span className="text-[10px] text-cockpit-muted">{kpi.sub}</span>}
              </div>
            </div>
          );
        })}
      </section>

      {/* Charts row: Vendedores + Status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cockpit-accent" />
              <h2 className="text-sm font-semibold text-gray-900">Faturamento por Vendedor</h2>
            </div>
            <Link href="/bussiness-inteligence/vendedores" className="text-[11px] text-cockpit-accent hover:underline font-medium">
              Ver detalhes →
            </Link>
          </div>
          {topVendedores.length === 0 ? (
            <p className="text-center text-cockpit-muted py-12 text-sm">Sem dados no período</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVendedores.map((v) => ({ name: v.nome.split(" ")[0], Faturamento: v.fat }))} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fill: "#78696c", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#78696c", fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<CTooltip />} />
                  <Bar dataKey="Faturamento" radius={[6, 6, 0, 0]} fill="#AA1A1B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-sm font-semibold text-gray-900">Status dos Pedidos</h2>
          </div>
          {statusData.length === 0 ? (
            <p className="text-center text-cockpit-muted py-12 text-sm">Sem dados</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtNum(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Geo: Região + Estado */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cockpit-accent" />
              <h2 className="text-sm font-semibold text-gray-900">Faturamento por Região</h2>
            </div>
            <Link href="/bussiness-inteligence/clientes" className="text-[11px] text-cockpit-accent hover:underline font-medium">
              Ver clientes →
            </Link>
          </div>
          {clientesPorRegiao.length === 0 ? (
            <p className="text-center text-cockpit-muted py-12 text-sm">Sem dados de localização</p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={clientesPorRegiao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {clientesPorRegiao.map((r, i) => <Cell key={i} fill={REGION_COLORS[r.name] || "#78696c"} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5">
                {clientesPorRegiao.map((r) => (
                  <div key={r.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: REGION_COLORS[r.name] || "#78696c" }} />
                    <span className="text-gray-700 font-medium flex-1">{r.name}</span>
                    <span className="text-gray-500 tabular-nums">{r.clientes} clientes</span>
                    <span className="text-gray-900 font-semibold tabular-nums">{fmtBRL(r.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-sm font-semibold text-gray-900">Faturamento por UF</h2>
          </div>
          {clientesPorEstado.length === 0 ? (
            <p className="text-center text-cockpit-muted py-12 text-sm">Sem dados de localização</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientesPorEstado.map((e) => ({ name: e.state, Faturamento: e.fat, Clientes: e.clientes }))} layout="vertical" barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#78696c", fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#78696c", fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CTooltip />} />
                  <Bar dataKey="Faturamento" radius={[0, 6, 6, 0]}>
                    {clientesPorEstado.map((_, i) => <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Top clientes table */}
      <section className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-cockpit-border/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-sm font-semibold text-gray-900">Top 10 Clientes por Faturamento</h2>
          </div>
          <Link href="/bussiness-inteligence/clientes" className="text-[11px] text-cockpit-accent hover:underline font-medium">
            Ver todos →
          </Link>
        </div>
        {topClientes.length === 0 ? (
          <p className="text-center text-cockpit-muted py-12 text-sm">Sem dados no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="text-left py-2.5 px-5 text-xs font-semibold text-cockpit-muted uppercase tracking-wider w-8">#</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-cockpit-muted uppercase tracking-wider">Cliente</th>
                  <th className="text-right py-2.5 px-5 text-xs font-semibold text-cockpit-muted uppercase tracking-wider">Pedidos</th>
                  <th className="text-right py-2.5 px-5 text-xs font-semibold text-cockpit-muted uppercase tracking-wider">Faturamento</th>
                  <th className="text-right py-2.5 px-5 text-xs font-semibold text-cockpit-muted uppercase tracking-wider">% Total</th>
                  <th className="py-2.5 px-5 text-xs font-semibold text-cockpit-muted uppercase tracking-wider w-36">Concentração</th>
                </tr>
              </thead>
              <tbody>
                {topClientes.map((c, i) => {
                  const pct = totalFat > 0 ? (c.fat / totalFat) * 100 : 0;
                  return (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-5 text-gray-400 font-medium">{i + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-900 truncate max-w-[260px]">{c.nome}</td>
                      <td className="py-2.5 px-5 text-right text-gray-600 tabular-nums">{c.pedidos}</td>
                      <td className="py-2.5 px-5 text-right font-semibold text-gray-900 tabular-nums">{fmtBRL(c.fat)}</td>
                      <td className="py-2.5 px-5 text-right text-gray-500 tabular-nums">{pct.toFixed(1)}%</td>
                      <td className="py-2.5 px-5">
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-cockpit-accent/70 transition-all" style={{ width: `${Math.min(pct * 3, 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="text-center text-xs text-cockpit-muted py-3 border-t border-cockpit-border">
        Dados: SAP B1 · {orders.length} pedidos ativos no período · {kpis.clientesAtivos} clientes ativos · {spData?.count ?? 0} vendedores
      </footer>
    </div>
  );
}
