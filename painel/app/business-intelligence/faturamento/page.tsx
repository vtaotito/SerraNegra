"use client";

import { useState, useMemo } from "react";
import {
  DollarSign, TrendingUp, CalendarDays, ShoppingCart, Users, BarChart3,
  ArrowUpRight, ArrowDownRight, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ComposedChart, Line, Area, PieChart, Pie,
  ReferenceLine,
} from "recharts";
import { fmtBRL, fmtNum, getProductGroup } from "@/lib/format";
import {
  fetchSalesOrders, fetchSalesPersons,
  type SalesOrderRow, type SapSalesPerson,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import { CHART_AXIS_LINE, CHART_GRID, chartAxisTick, formatYAxisCompact } from "@/lib/chart-theme";
import { format, parseISO, getDay, differenceInCalendarDays, startOfMonth, endOfMonth } from "date-fns";

const COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5", "#16a34a", "#ea580c"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_COLORS = ["#9ca3af", "#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#9ca3af"];

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export default function FaturamentoPage() {
  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo, salesPerson: salesPersonCode }), [dateFrom, dateTo, salesPersonCode]);
  const { data: spData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchSalesPersons(), []);

  const loading = l1 && l2;
  const orders = useMemo(() => (ordersData?.items ?? []).filter((o) => o.cancelled !== "Y"), [ordersData]);
  const persons = useMemo(() => spData?.items ?? [], [spData]);
  const pMap = useMemo(() => new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName])), [persons]);

  const [tab, setTab] = useState<"mensal" | "semanal" | "grupo" | "vendedor">("mensal");

  const totalFat = useMemo(() => orders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [orders]);
  const totalPed = orders.length;
  const totalDays = useMemo(() => Math.max(1, differenceInCalendarDays(range.to, range.from) + 1), [range]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { fat: number; pedidos: number }>();
    for (const o of orders) {
      const m = format(parseISO(o.doc_date), "yyyy-MM");
      const cur = map.get(m) ?? { fat: 0, pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.pedidos += 1;
      map.set(m, cur);
    }
    const arr = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, v]) => ({
        month: m.substring(5) + "/" + m.substring(2, 4),
        fat: v.fat,
        pedidos: v.pedidos,
        ticket: v.pedidos > 0 ? v.fat / v.pedidos : 0,
      }));
    return arr;
  }, [orders]);

  const medianMonth = useMemo(() => median(monthlyData.map((d) => d.fat)), [monthlyData]);

  const weekdayData = useMemo(() => {
    const map = new Map<number, { fat: number; count: number }>();
    for (const o of orders) {
      const wd = getDay(parseISO(o.doc_date));
      const cur = map.get(wd) ?? { fat: 0, count: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.count += 1;
      map.set(wd, cur);
    }
    return WEEKDAYS.map((name, i) => {
      const d = map.get(i) ?? { fat: 0, count: 0 };
      return { name, fat: d.fat, pedidos: d.count, avg: d.count > 0 ? d.fat / d.count : 0 };
    });
  }, [orders]);

  const medianWeekday = useMemo(() => median(weekdayData.map((d) => d.fat)), [weekdayData]);

  const groupData = useMemo(() => {
    const map = new Map<string, { fat: number; qty: number; pedidos: Set<number> }>();
    for (const o of orders) {
      for (const l of (o.lines ?? [])) {
        const g = getProductGroup(l.ItemCode);
        const cur = map.get(g) ?? { fat: 0, qty: 0, pedidos: new Set() };
        cur.fat += Number(l.LineTotal) || 0;
        cur.qty += Number(l.Quantity) || 0;
        cur.pedidos.add(o.doc_entry);
        map.set(g, cur);
      }
    }
    return Array.from(map.entries())
      .map(([g, v]) => ({ group: g, fat: v.fat, qty: v.qty, pedidos: v.pedidos.size }))
      .sort((a, b) => b.fat - a.fat);
  }, [orders]);

  const vendorData = useMemo(() => {
    const map = new Map<number, { fat: number; pedidos: number }>();
    for (const o of orders) {
      const c = o.sales_person_code ?? -1;
      const cur = map.get(c) ?? { fat: 0, pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.pedidos += 1;
      map.set(c, cur);
    }
    return Array.from(map.entries())
      .map(([code, v]) => ({
        name: pMap.get(code) ?? `Vend. ${code}`,
        fat: v.fat,
        pedidos: v.pedidos,
        pct: totalFat > 0 ? (v.fat / totalFat) * 100 : 0,
      }))
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 10);
  }, [orders, pMap, totalFat]);

  const kpis = useMemo(() => ({
    totalFat,
    totalPed,
    ticket: totalPed > 0 ? totalFat / totalPed : 0,
    mediaDiaria: totalFat / totalDays,
    vendedores: new Set(orders.map((o) => o.sales_person_code).filter(Boolean)).size,
  }), [totalFat, totalPed, totalDays, orders]);

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Faturamento</h1><p className="text-cockpit-muted mt-1">Carregando...</p></div><LoadingSkeleton /></div>;
  if (e1 || e2) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Faturamento</h1></div><ErrorState message={e1 || e2 || ""} onRetry={() => { r1(); r2(); }} /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><DollarSign className="w-5 h-5 text-cockpit-accent" /></div>
          Faturamento
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{orders.length} pedidos de venda</span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Faturamento", value: fmtBRL(kpis.totalFat), icon: DollarSign, color: "text-cockpit-accent" },
          { label: "Pedidos", value: fmtNum(kpis.totalPed), icon: ShoppingCart, color: "text-sky-500" },
          { label: "Ticket Médio", value: fmtBRL(kpis.ticket, 2), icon: TrendingUp, color: "text-amber-500" },
          { label: "Média/Dia", value: fmtBRL(kpis.mediaDiaria), icon: Target, color: "text-emerald-500" },
          { label: "Vendedores", value: String(kpis.vendedores), icon: Users, color: "text-purple-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-all shadow-sm">
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-xl font-bold ${k.color} block mt-1`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1">
        {([
          { id: "mensal", label: "Evolução Mensal" },
          { id: "semanal", label: "Dia da Semana" },
          { id: "grupo", label: "Grupo de Produto" },
          { id: "vendedor", label: "Por Vendedor" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
        {tab === "mensal" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento Mensal</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="month" tick={chartAxisTick("md")} />
                  <YAxis yAxisId="left" tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => formatYAxisCompact(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ ...chartAxisTick("md"), fill: "#059669" }} />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  <ReferenceLine yAxisId="left" y={medianMonth} stroke="#7c3aed" strokeDasharray="5 5"
                    label={{ value: `Mediana ${fmtBRL(medianMonth)}`, fill: "#7c3aed", fontSize: 10 }} />
                  <Bar yAxisId="left" dataKey="fat" name="Faturamento" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((d, i) => (
                      <Cell key={i} fill={d.fat >= medianMonth ? "#A81C2C" : CHART_AXIS_LINE} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" dataKey="pedidos" name="Pedidos" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "semanal" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Padrão por Dia da Semana</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weekdayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="name" tick={chartAxisTick("md")} />
                  <YAxis tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => formatYAxisCompact(v)} />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  <ReferenceLine y={medianWeekday} stroke="#7c3aed" strokeDasharray="5 5" />
                  <Bar dataKey="fat" name="Faturamento" radius={[6, 6, 0, 0]}>
                    {weekdayData.map((_, i) => <Cell key={i} fill={WEEKDAY_COLORS[i]} />)}
                  </Bar>
                  <Line dataKey="avg" name="Média/Pedido" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "grupo" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento por Grupo</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupData.slice(0, 12)} layout="vertical" barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} horizontal={false} />
                    <XAxis type="number" tick={chartAxisTick("md")}
                      tickFormatter={(v: number) => formatYAxisCompact(v)} />
                    <YAxis dataKey="group" type="category" tick={chartAxisTick("md")} width={40} />
                    <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                    <Bar dataKey="fat" name="Faturamento" radius={[0, 4, 4, 0]}>
                      {groupData.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Participação</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={groupData.slice(0, 8)} dataKey="fat" nameKey="group" cx="50%" cy="50%"
                      innerRadius={50} outerRadius={90} paddingAngle={2}
                      label={({ group, percent }: any) => `${group} ${(percent * 100).toFixed(0)}%`}>
                      {groupData.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === "vendedor" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento por Vendedor — Top 10</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorData} layout="vertical" barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} horizontal={false} />
                  <XAxis type="number" tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => formatYAxisCompact(v)} />
                  <YAxis dataKey="name" type="category" tick={chartAxisTick("md")} width={100}
                    tickFormatter={(v: string) => v.length > 12 ? v.substring(0, 12) + "..." : v} />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  <Bar dataKey="fat" name="Faturamento" radius={[0, 6, 6, 0]}>
                    {vendorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Tabela mensal */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-cockpit-bg text-cockpit-muted uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Mês</th>
                <th className="px-4 py-3 text-right">Faturamento</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-right">Ticket Médio</th>
                <th className="px-4 py-3 text-right">vs Mediana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {monthlyData.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-cockpit-muted">Sem dados no período</td></tr>
              ) : (
                <>
                  {monthlyData.map((r) => {
                    const diff = medianMonth > 0 ? ((r.fat - medianMonth) / medianMonth) * 100 : 0;
                    const above = r.fat >= medianMonth;
                    return (
                      <tr key={r.month} className="hover:bg-cockpit-accent/[0.04] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.month}</td>
                        <td className="px-4 py-2.5 text-right text-cockpit-accent font-medium">{fmtBRL(r.fat)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{r.pedidos}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmtBRL(r.ticket, 2)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${above ? "text-emerald-600" : "text-red-500"}`}>
                            {above ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(diff).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-cockpit-bg/60 font-bold text-gray-900">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right text-cockpit-accent">{fmtBRL(totalFat)}</td>
                    <td className="px-4 py-3 text-right">{totalPed}</td>
                    <td className="px-4 py-3 text-right">{totalPed > 0 ? fmtBRL(totalFat / totalPed, 2) : "—"}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          {monthlyData.length} meses · Mediana mensal: {fmtBRL(medianMonth)} — Pedidos de Venda SAP B1
        </div>
      </div>
    </div>
  );
}
