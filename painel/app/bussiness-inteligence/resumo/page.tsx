"use client";

import { useMemo } from "react";
import {
  DollarSign, Users, TrendingUp, Package, CalendarDays, ShoppingCart,
  Target, BarChart3, Layers, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ComposedChart, Line, PieChart, Pie, Area,
  ReferenceLine,
} from "recharts";
import { fmtBRL, fmtNum, STATE_TO_REGION, getProductGroup } from "@/lib/format";
import {
  fetchCatalog, fetchInventory, fetchCustomers, fetchSalesOrders, fetchSalesPersons,
  type SalesOrderRow, type SapSalesPerson,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

const COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5"];

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-cockpit-border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}:</span>
          <span className="font-semibold">{typeof p.value === "number" ? fmtBRL(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function ResumoPage() {
  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: catData, loading: l1 } = useFetch(() => fetchCatalog({ limit: 1 }), []);
  const { data: invData, loading: l2 } = useFetch(() => fetchInventory({ limit: 1 }), []);
  const { data: custData, loading: l3 } = useFetch(() => fetchCustomers({ limit: 500 }), []);
  const { data: ordersData, loading: l4, error: e4, refetch: r4 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo, salesPerson: salesPersonCode }), [dateFrom, dateTo, salesPersonCode]);
  const { data: spData, loading: l5, error: e5, refetch: r5 } =
    useFetch(() => fetchSalesPersons(), []);

  const loading = l4 && l5;
  const error = e4 || e5;

  const orders = useMemo(() => (ordersData?.items ?? []).filter((o) => o.cancelled !== "Y"), [ordersData]);
  const persons = useMemo(() => spData?.items ?? [], [spData]);
  const customers = useMemo(() => custData?.data ?? [], [custData]);
  const pMap = useMemo(() => new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName])), [persons]);

  const totalDays = useMemo(() => Math.max(1, differenceInCalendarDays(range.to, range.from) + 1), [range]);
  const totalFat = useMemo(() => orders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [orders]);
  const totalQty = useMemo(() => orders.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0), [orders]);

  const uniqueClients = useMemo(() => new Set(orders.map((o) => o.card_code)).size, [orders]);
  const uniqueVendors = useMemo(() => new Set(orders.map((o) => o.sales_person_code).filter(Boolean)).size, [orders]);

  const medianOrder = useMemo(() => median(orders.map((o) => Number(o.doc_total) || 0)), [orders]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const m = format(parseISO(o.doc_date), "yyyy-MM");
      map.set(m, (map.get(m) ?? 0) + (Number(o.doc_total) || 0));
    }
    const arr = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cum = 0;
    return arr.map(([m, fat]) => {
      cum += fat;
      return { month: m.substring(5) + "/" + m.substring(2, 4), fat, cum };
    });
  }, [orders]);

  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) { map.set(o.card_name, (map.get(o.card_name) ?? 0) + (Number(o.doc_total) || 0)); }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, fat]) => ({ name: name.substring(0, 15), fat }));
  }, [orders]);

  const topGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      for (const l of (o.lines ?? [])) {
        const g = getProductGroup(l.ItemCode);
        map.set(g, (map.get(g) ?? 0) + (Number(l.LineTotal) || 0));
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [orders]);

  const regionData = useMemo(() => {
    const custMap = new Map(customers.map((c) => [c.card_code, c]));
    const map = new Map<string, number>();
    for (const o of orders) {
      const cust = custMap.get(o.card_code);
      const st = cust?.state ?? "—";
      const region = STATE_TO_REGION[st] ?? "Outro";
      map.set(region, (map.get(region) ?? 0) + (Number(o.doc_total) || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [orders, customers]);

  const kpis = [
    { label: "Faturamento", value: fmtBRL(totalFat), sub: `Mediana: ${fmtBRL(medianOrder)}`, icon: DollarSign, color: "text-cockpit-accent" },
    { label: "Pedidos", value: fmtNum(orders.length), sub: `${fmtNum(Math.round(totalQty))} itens`, icon: ShoppingCart, color: "text-sky-500" },
    { label: "Ticket Médio", value: orders.length > 0 ? fmtBRL(totalFat / orders.length, 2) : "—", sub: `Média/dia: ${fmtBRL(totalFat / totalDays)}`, icon: TrendingUp, color: "text-amber-500" },
    { label: "Clientes Ativos", value: String(uniqueClients), sub: `de ${custData?.total ?? "—"} na base`, icon: Users, color: "text-emerald-500" },
    { label: "Vendedores", value: String(uniqueVendors), sub: `de ${persons.length} cadastrados`, icon: Target, color: "text-purple-500" },
    { label: "Produtos", value: fmtNum(catData?.total ?? 0), sub: `${fmtNum(invData?.total ?? 0)} pos. estoque`, icon: Package, color: "text-blue-500" },
  ];

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Resumo Comercial</h1><p className="text-cockpit-muted mt-1">Consolidando...</p></div><LoadingSkeleton /></div>;
  if (error) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Resumo Comercial</h1></div><ErrorState message={error} onRetry={() => { r4(); r5(); }} /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Layers className="w-5 h-5 text-cockpit-accent" /></div>
          Resumo Comercial
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>Visão consolidada — SAP B1</span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-all shadow-sm">
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-lg font-bold ${k.color} block mt-1`}>{k.value}</span>
            <span className="text-[10px] text-cockpit-muted">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Gráficos Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução Mensal */}
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
          <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Evolução Mensal</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                <XAxis dataKey="month" tick={{ fill: "#78696c", fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: "#78696c", fontSize: 10 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#059669", fontSize: 10 }}
                  tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Bar yAxisId="left" dataKey="fat" name="Faturamento" radius={[3, 3, 0, 0]} fill="#A81C2C" />
                <Line yAxisId="right" dataKey="cum" name="Acumulado" stroke="#059669" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Clientes */}
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
          <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Top Clientes</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClients} layout="vertical" barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#78696c", fontSize: 10 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#78696c", fontSize: 10 }} width={100} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="fat" name="Faturamento" radius={[0, 4, 4, 0]}>
                  {topClients.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grupo de Produto */}
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
          <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Mix de Produtos (Grupo)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={topGroups} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={85} paddingAngle={3}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {topGroups.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtBRL(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Região */}
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
          <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento por Região</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                <XAxis dataKey="name" tick={{ fill: "#78696c", fontSize: 11 }} />
                <YAxis tick={{ fill: "#78696c", fontSize: 10 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Faturamento" radius={[4, 4, 0, 0]}>
                  {regionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela de indicadores */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-cockpit-bg text-cockpit-muted uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Indicador</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {[
                { ind: "Faturamento Bruto", cat: "vendas", val: fmtBRL(totalFat) },
                { ind: "Mediana por Pedido", cat: "vendas", val: fmtBRL(medianOrder) },
                { ind: "Ticket Médio", cat: "vendas", val: orders.length > 0 ? fmtBRL(totalFat / orders.length, 2) : "—" },
                { ind: "Média Diária", cat: "vendas", val: fmtBRL(totalFat / totalDays) },
                { ind: "Total de Pedidos", cat: "vendas", val: fmtNum(orders.length) },
                { ind: "Quantidade Vendida", cat: "vendas", val: fmtNum(Math.round(totalQty)) },
                { ind: "Clientes Ativos (Período)", cat: "clientes", val: fmtNum(uniqueClients) },
                { ind: "Clientes na Base", cat: "clientes", val: fmtNum(custData?.total ?? 0) },
                { ind: "Vendedores Ativos", cat: "equipe", val: String(uniqueVendors) },
                { ind: "Vendedores Cadastrados", cat: "equipe", val: String(persons.length) },
                { ind: "Produtos no Catálogo", cat: "estoque", val: fmtNum(catData?.total ?? 0) },
                { ind: "Posições de Estoque", cat: "estoque", val: fmtNum(invData?.total ?? 0) },
              ].map((r) => (
                <tr key={r.ind} className="hover:bg-cockpit-accent/[0.04] transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.ind}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-cockpit-muted capitalize">{r.cat}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">{r.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          12 indicadores — dados consolidados SAP B1
        </div>
      </div>
    </div>
  );
}
