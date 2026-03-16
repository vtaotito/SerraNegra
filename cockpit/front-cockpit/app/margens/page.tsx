"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp, Package, Search, CalendarDays, DollarSign, Percent,
  BarChart3, Layers, ArrowUpRight, ArrowDownRight, ShoppingCart,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ComposedChart, Line, PieChart, Pie, ScatterChart,
  Scatter, ZAxis, ReferenceLine,
} from "recharts";
import { fmtBRL, fmtNum, getProductGroup } from "@/lib/format";
import {
  fetchSalesOrders, type SalesOrderRow, type SalesOrderLine,
} from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format } from "date-fns";

const COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5", "#16a34a", "#ea580c"];

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface GroupRow {
  group: string;
  fat: number;
  qty: number;
  pedidos: number;
  itens: number;
  precoMedio: number;
  descontoMedio: number;
  ticketMedio: number;
  pctFat: number;
}

function buildGroupAnalytics(orders: SalesOrderRow[]): GroupRow[] {
  const map = new Map<string, {
    fat: number; qty: number; pedidos: Set<number>; itens: Set<string>;
    precos: number[]; descontos: number[];
  }>();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    for (const l of (o.lines ?? [])) {
      const g = getProductGroup(l.ItemCode);
      const cur = map.get(g) ?? { fat: 0, qty: 0, pedidos: new Set(), itens: new Set(), precos: [], descontos: [] };
      cur.fat += Number(l.LineTotal) || 0;
      cur.qty += Number(l.Quantity) || 0;
      cur.pedidos.add(o.doc_entry);
      if (l.ItemCode) cur.itens.add(l.ItemCode);
      if (l.UnitPrice) cur.precos.push(Number(l.UnitPrice));
      if (l.DiscountPercent) cur.descontos.push(Number(l.DiscountPercent));
      map.set(g, cur);
    }
  }

  const totalFat = Array.from(map.values()).reduce((s, v) => s + v.fat, 0);

  return Array.from(map.entries())
    .map(([g, v]) => ({
      group: g,
      fat: v.fat,
      qty: v.qty,
      pedidos: v.pedidos.size,
      itens: v.itens.size,
      precoMedio: v.precos.length > 0 ? v.precos.reduce((s, p) => s + p, 0) / v.precos.length : 0,
      descontoMedio: v.descontos.length > 0 ? v.descontos.reduce((s, d) => s + d, 0) / v.descontos.length : 0,
      ticketMedio: v.pedidos.size > 0 ? v.fat / v.pedidos.size : 0,
      pctFat: totalFat > 0 ? (v.fat / totalFat) * 100 : 0,
    }))
    .sort((a, b) => b.fat - a.fat);
}

function buildDiscountDistribution(orders: SalesOrderRow[]) {
  const bins = [
    { label: "0%", min: 0, max: 0.01 },
    { label: "0-5%", min: 0.01, max: 5 },
    { label: "5-10%", min: 5, max: 10 },
    { label: "10-15%", min: 10, max: 15 },
    { label: "15-20%", min: 15, max: 20 },
    { label: ">20%", min: 20, max: 100 },
  ];

  const counts = bins.map((b) => ({ label: b.label, count: 0, fat: 0 }));
  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    for (const l of (o.lines ?? [])) {
      const d = Number(l.DiscountPercent) || 0;
      for (let i = 0; i < bins.length; i++) {
        if (d >= bins[i].min && d < bins[i].max) {
          counts[i].count += 1;
          counts[i].fat += Number(l.LineTotal) || 0;
          break;
        }
      }
    }
  }
  return counts;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-cockpit-border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}:</span>
          <span className="font-semibold">
            {p.name.includes("Desc") || p.name.includes("%") ? `${Number(p.value).toFixed(1)}%` :
             typeof p.value === "number" ? fmtBRL(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function MargensPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading, error, refetch } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo }), [dateFrom, dateTo]);

  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const activeOrders = useMemo(() => orders.filter((o) => o.cancelled !== "Y"), [orders]);

  const groups = useMemo(() => buildGroupAnalytics(orders), [orders]);
  const discountDist = useMemo(() => buildDiscountDistribution(orders), [orders]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"grupos" | "descontos" | "scatter">("grupos");

  const filtered = useMemo(
    () => groups.filter((g) => g.group.toLowerCase().includes(search.toLowerCase())),
    [groups, search]
  );

  const allLines = useMemo(() => {
    const lines: (SalesOrderLine & { docDate: string })[] = [];
    for (const o of activeOrders) {
      for (const l of (o.lines ?? [])) {
        lines.push({ ...l, docDate: o.doc_date });
      }
    }
    return lines;
  }, [activeOrders]);

  const kpis = useMemo(() => {
    const totalFat = filtered.reduce((s, g) => s + g.fat, 0);
    const totalQty = filtered.reduce((s, g) => s + g.qty, 0);
    const avgDiscount = allLines.length > 0
      ? allLines.reduce((s, l) => s + (Number(l.DiscountPercent) || 0), 0) / allLines.length
      : 0;
    const avgPrice = allLines.length > 0
      ? allLines.reduce((s, l) => s + (Number(l.UnitPrice) || 0), 0) / allLines.length
      : 0;
    const medianPrice = median(allLines.filter((l) => l.UnitPrice).map((l) => Number(l.UnitPrice)));
    return { totalFat, totalQty, avgDiscount, avgPrice, medianPrice, groups: filtered.length };
  }, [filtered, allLines]);

  const scatterData = useMemo(() => {
    return groups.filter((g) => g.fat > 0).map((g) => ({
      x: g.qty,
      y: g.precoMedio,
      z: g.fat,
      name: g.group,
      desc: g.descontoMedio,
    }));
  }, [groups]);

  const medianGroupPrice = useMemo(() => median(scatterData.map((d) => d.y)), [scatterData]);

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">CMV / Margens</h1><p className="text-cockpit-muted mt-1">Carregando...</p></div><LoadingSkeleton /></div>;
  if (error) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">CMV / Margens</h1></div><ErrorState message={error} onRetry={refetch} /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><BarChart3 className="w-5 h-5 text-cockpit-accent" /></div>
          CMV / Margens
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>Análise por grupo de produto (prefixo SKU)</span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Faturamento", value: fmtBRL(kpis.totalFat), icon: DollarSign, color: "text-cockpit-accent" },
          { label: "Qtd Vendida", value: fmtNum(Math.round(kpis.totalQty)), icon: ShoppingCart, color: "text-sky-500" },
          { label: "Preço Médio", value: fmtBRL(kpis.avgPrice, 2), icon: TrendingUp, color: "text-amber-500" },
          { label: "Mediana Preço", value: fmtBRL(kpis.medianPrice, 2), icon: BarChart3, color: "text-purple-500" },
          { label: "Desc. Médio", value: `${kpis.avgDiscount.toFixed(1)}%`, icon: Percent, color: "text-red-500" },
          { label: "Grupos", value: String(kpis.groups), icon: Package, color: "text-emerald-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-all shadow-sm">
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-lg font-bold ${k.color} block mt-1`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar grupo de produto..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 transition-all" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1">
        {([
          { id: "grupos", label: "Grupos de Produto" },
          { id: "descontos", label: "Análise de Descontos" },
          { id: "scatter", label: "Volume × Preço" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
        {tab === "grupos" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento por Grupo</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filtered.slice(0, 12)} layout="vertical" barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#78696c", fontSize: 11 }}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <YAxis dataKey="group" type="category" tick={{ fill: "#78696c", fontSize: 12, fontWeight: 600 }} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="fat" name="Faturamento" radius={[0, 6, 6, 0]}>
                      {filtered.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                    <Pie data={filtered.slice(0, 8)} dataKey="fat" nameKey="group" cx="50%" cy="50%"
                      innerRadius={50} outerRadius={90} paddingAngle={3}
                      label={({ group, percent }: any) => `${group} ${(percent * 100).toFixed(0)}%`}>
                      {filtered.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === "descontos" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Distribuição de Descontos</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={discountDist} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                    <XAxis dataKey="label" tick={{ fill: "#78696c", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#78696c", fontSize: 11 }} />
                    <Tooltip content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="rounded-lg border border-cockpit-border bg-white px-3 py-2 shadow-lg text-xs">
                          <p className="font-medium text-gray-900">Faixa: {label}</p>
                          <p>Linhas: {fmtNum(d?.count ?? 0)}</p>
                          <p>Faturamento: {fmtBRL(d?.fat ?? 0)}</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="count" name="Linhas" radius={[4, 4, 0, 0]} fill="#A81C2C" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Desconto Médio por Grupo</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filtered.filter((g) => g.descontoMedio > 0).slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                    <XAxis dataKey="group" tick={{ fill: "#78696c", fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#059669", fontSize: 11 }}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar yAxisId="left" dataKey="descontoMedio" name="Desc. Médio %" radius={[4, 4, 0, 0]} fill="#dc2626" />
                    <Line yAxisId="right" dataKey="fat" name="Faturamento" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === "scatter" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Volume Vendido × Preço Médio por Grupo</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="x" type="number" name="Qtd" tick={{ fill: "#78696c", fontSize: 11 }}
                    label={{ value: "Qtd Vendida", position: "bottom", fill: "#78696c", fontSize: 11 }} />
                  <YAxis dataKey="y" type="number" name="Preço Médio" tick={{ fill: "#78696c", fontSize: 11 }}
                    tickFormatter={(v: number) => fmtBRL(v, 0)} />
                  <ZAxis dataKey="z" range={[100, 800]} name="Faturamento" />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-cockpit-border bg-white px-3 py-2 shadow-lg text-xs">
                        <p className="font-bold text-gray-900 text-sm">{d?.name}</p>
                        <p>Qtd: {fmtNum(d?.x ?? 0)}</p>
                        <p>Preço Médio: {fmtBRL(d?.y ?? 0, 2)}</p>
                        <p>Faturamento: {fmtBRL(d?.z ?? 0)}</p>
                        <p>Desc. Médio: {(d?.desc ?? 0).toFixed(1)}%</p>
                      </div>
                    );
                  }} />
                  <ReferenceLine y={medianGroupPrice} stroke="#7c3aed" strokeDasharray="5 5"
                    label={{ value: `Med. ${fmtBRL(medianGroupPrice, 2)}`, fill: "#7c3aed", fontSize: 10 }} />
                  <Scatter data={scatterData} fill="#A81C2C" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-sm text-left table-sticky-head">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th className="py-3 px-4">Grupo</th>
                <th className="py-3 px-4 text-right">Faturamento</th>
                <th className="py-3 px-4 text-right">Qtd</th>
                <th className="py-3 px-4 text-right">SKUs</th>
                <th className="py-3 px-4 text-right">Pedidos</th>
                <th className="py-3 px-4 text-right">Preço Médio</th>
                <th className="py-3 px-4 text-right">Desc. Médio</th>
                <th className="py-3 px-4 text-right">Ticket/Ped.</th>
                <th className="py-3 px-4 text-right">% Fat.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-cockpit-muted">Nenhum grupo encontrado</td></tr>
              ) : (
                <>
                  {filtered.map((r, i) => (
                    <tr key={r.group} className="hover:bg-cockpit-accent/[0.04] transition-colors">
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="font-bold text-gray-900">{r.group}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-cockpit-accent font-medium">{fmtBRL(r.fat)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{fmtNum(Math.round(r.qty))}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{r.itens}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{r.pedidos}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{fmtBRL(r.precoMedio, 2)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span className={`text-xs font-medium ${r.descontoMedio > 10 ? "text-red-500" : r.descontoMedio > 5 ? "text-amber-500" : "text-gray-500"}`}>
                          {r.descontoMedio.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{fmtBRL(r.ticketMedio, 2)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-500">{r.pctFat.toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-cockpit-bg/60 font-bold text-gray-900">
                    <td className="py-3 px-4">TOTAL ({filtered.length})</td>
                    <td className="py-3 px-4 text-right text-cockpit-accent">{fmtBRL(kpis.totalFat)}</td>
                    <td className="py-3 px-4 text-right">{fmtNum(Math.round(kpis.totalQty))}</td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">{fmtBRL(kpis.avgPrice, 2)}</td>
                    <td className="py-3 px-4 text-right">{kpis.avgDiscount.toFixed(1)}%</td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">100%</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          {filtered.length} grupos de produto · Prefixo SKU (ex: GN, TA, GI) — Pedidos de Venda SAP B1
        </div>
      </div>
    </div>
  );
}
