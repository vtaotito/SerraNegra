"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Search, CalendarDays,
  ChevronRight, MapPin, Crown, BarChart3, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie, ComposedChart, Line, Area,
} from "recharts";
import { fmtBRL, fmtNum, fmtDateShort, STATE_TO_REGION } from "@/lib/format";
import {
  fetchSalesOrders, fetchCustomers, fetchSalesPersons,
  type SalesOrderRow, type CustomerRow, type SapSalesPerson,
} from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format } from "date-fns";

const COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5", "#16a34a", "#ea580c"];
const PIE_COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#6b7280"];

interface ClientAgg {
  cardCode: string;
  cardName: string;
  city: string;
  state: string;
  region: string;
  phone: string;
  isActive: boolean;
  fat: number;
  pedidos: number;
  ticket: number;
  qtd: number;
  firstOrder: string;
  lastOrder: string;
  pctFat: number;
  pctCum: number;
  classe: "A" | "B" | "C";
  vendorCode: number | null;
  vendorName: string;
}

function buildClientAnalytics(
  orders: SalesOrderRow[],
  customers: CustomerRow[],
  persons: SapSalesPerson[]
): ClientAgg[] {
  const pMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));
  const custMap = new Map(customers.map((c) => [c.card_code, c]));

  const agg = new Map<string, {
    fat: number; pedidos: number; qtd: number; first: string; last: string; vendor: number | null;
  }>();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const cur = agg.get(o.card_code) ?? { fat: 0, pedidos: 0, qtd: 0, first: o.doc_date, last: o.doc_date, vendor: null };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    cur.qtd += Number(o.total_quantity) || 0;
    if (o.doc_date < cur.first) cur.first = o.doc_date;
    if (o.doc_date > cur.last) cur.last = o.doc_date;
    if (o.sales_person_code) cur.vendor = o.sales_person_code;
    agg.set(o.card_code, cur);
  }

  const totalFat = Array.from(agg.values()).reduce((s, a) => s + a.fat, 0);

  const rows: ClientAgg[] = Array.from(agg.entries())
    .map(([code, a]) => {
      const cust = custMap.get(code);
      const st = cust?.state ?? "—";
      return {
        cardCode: code,
        cardName: cust?.card_name ?? code,
        city: cust?.city ?? "—",
        state: st,
        region: STATE_TO_REGION[st] ?? "Outro",
        phone: cust?.phone ?? "—",
        isActive: cust?.is_active ?? true,
        fat: a.fat,
        pedidos: a.pedidos,
        ticket: a.pedidos > 0 ? a.fat / a.pedidos : 0,
        qtd: a.qtd,
        firstOrder: a.first,
        lastOrder: a.last,
        pctFat: totalFat > 0 ? (a.fat / totalFat) * 100 : 0,
        pctCum: 0,
        classe: "C" as const,
        vendorCode: a.vendor,
        vendorName: a.vendor ? (pMap.get(a.vendor) ?? `Vend. ${a.vendor}`) : "—",
      };
    })
    .sort((a, b) => b.fat - a.fat);

  let cum = 0;
  for (const r of rows) {
    cum += r.pctFat;
    r.pctCum = cum;
    if (cum <= 80) r.classe = "A";
    else if (cum <= 95) r.classe = "B";
    else r.classe = "C";
  }

  return rows;
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

export default function ClientesPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo }), [dateFrom, dateTo]);
  const { data: custData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchCustomers({ limit: 500 }), []);
  const { data: spData, loading: l3, error: e3, refetch: r3 } =
    useFetch(() => fetchSalesPersons(), []);

  const loading = l1 && l2;
  const error = e1 || e2 || e3;

  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const customers = useMemo(() => custData?.data ?? [], [custData]);
  const persons = useMemo(() => spData?.items ?? [], [spData]);

  const allClients = useMemo(
    () => buildClientAnalytics(orders, customers, persons),
    [orders, customers, persons]
  );

  const [search, setSearch] = useState("");
  const [classeFilter, setClasseFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [tab, setTab] = useState<"carteira" | "geo" | "pareto">("carteira");

  const uniqueEstados = useMemo(
    () => [...new Set(allClients.map((c) => c.state).filter((e) => e !== "—"))].sort(),
    [allClients]
  );

  const filtered = useMemo(() => {
    return allClients.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = c.cardName.toLowerCase().includes(q) || c.cardCode.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) || c.vendorName.toLowerCase().includes(q);
      const matchClasse = classeFilter === "ALL" || c.classe === classeFilter;
      const matchEstado = estadoFilter === "ALL" || c.state === estadoFilter;
      return matchSearch && matchClasse && matchEstado;
    });
  }, [allClients, search, classeFilter, estadoFilter]);

  const kpis = useMemo(() => {
    const totalFat = filtered.reduce((s, r) => s + r.fat, 0);
    const totalPed = filtered.reduce((s, r) => s + r.pedidos, 0);
    const classeA = filtered.filter((c) => c.classe === "A").length;
    return {
      total: filtered.length,
      fat: totalFat,
      pedidos: totalPed,
      ticket: totalPed > 0 ? totalFat / totalPed : 0,
      classeA,
    };
  }, [filtered]);

  const geoData = useMemo(() => {
    const map = new Map<string, { fat: number; count: number }>();
    for (const c of filtered) {
      if (c.state === "—") continue;
      const cur = map.get(c.state) ?? { fat: 0, count: 0 };
      cur.fat += c.fat;
      cur.count += 1;
      map.set(c.state, cur);
    }
    return Array.from(map.entries())
      .map(([state, v]) => ({ state, fat: v.fat, count: v.count, region: STATE_TO_REGION[state] ?? "Outro" }))
      .sort((a, b) => b.fat - a.fat);
  }, [filtered]);

  const regionData = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of geoData) {
      map.set(g.region, (map.get(g.region) ?? 0) + g.fat);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [geoData]);

  const paretoData = useMemo(() => {
    return allClients.slice(0, 30).map((c, i) => ({
      name: c.cardName.split(" ")[0].substring(0, 12),
      fat: c.fat,
      cumPct: c.pctCum,
    }));
  }, [allClients]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Clientes</h1><p className="text-cockpit-muted mt-1">Carregando dados...</p></div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Clientes</h1></div>
        <ErrorState message={error} onRetry={() => { r1(); r2(); r3(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Users className="w-5 h-5 text-cockpit-accent" /></div>
          Clientes
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{allClients.length} clientes com pedidos no período</span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Clientes", value: String(kpis.total), icon: Users, color: "text-cockpit-accent" },
          { label: "Faturamento", value: fmtBRL(kpis.fat), icon: DollarSign, color: "text-emerald-500" },
          { label: "Pedidos", value: fmtNum(kpis.pedidos), icon: ShoppingCart, color: "text-sky-500" },
          { label: "Ticket Médio", value: fmtBRL(kpis.ticket, 2), icon: TrendingUp, color: "text-amber-500" },
          { label: "Classe A (80%)", value: String(kpis.classeA), icon: Crown, color: "text-purple-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-all duration-200 shadow-sm">
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-xl font-bold ${k.color} block mt-1`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, código, cidade ou vendedor..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 focus:border-cockpit-accent/50 transition-all" />
        </div>
        <div className="flex gap-0.5 rounded-xl border border-cockpit-border bg-cockpit-bg p-0.5">
          {(["ALL", "A", "B", "C"] as const).map((opt) => (
            <button key={opt} onClick={() => setClasseFilter(opt)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                classeFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-900 hover:bg-black/5"
              }`}>{opt === "ALL" ? "Todas" : `Classe ${opt}`}</button>
          ))}
        </div>
        {uniqueEstados.length > 1 && (
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 transition-all">
            <option value="ALL">Todos UFs</option>
            {uniqueEstados.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {/* Tabs de gráficos */}
      <div className="flex gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1">
        {([
          { id: "carteira", label: "Carteira" },
          { id: "geo", label: "Geográfico" },
          { id: "pareto", label: "Curva 80-20" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
        {tab === "carteira" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Top 15 Clientes — Faturamento</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filtered.slice(0, 15).map((c) => ({ name: c.cardName.split(" ")[0].substring(0, 10), Fat: c.fat, Pedidos: c.pedidos }))} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="name" tick={{ fill: "#78696c", fontSize: 11 }} axisLine={{ stroke: "#e5dfe1" }} />
                  <YAxis tick={{ fill: "#78696c", fontSize: 11 }} axisLine={{ stroke: "#e5dfe1" }}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Fat" name="Faturamento" radius={[4, 4, 0, 0]}>
                    {filtered.slice(0, 15).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "geo" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento por UF</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={geoData.slice(0, 12)} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#78696c", fontSize: 11 }}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <YAxis dataKey="state" type="category" tick={{ fill: "#78696c", fontSize: 11 }} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="fat" name="Faturamento" radius={[0, 4, 4, 0]}>
                      {geoData.slice(0, 12).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento por Região</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={regionData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={50} outerRadius={90} paddingAngle={3} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {regionData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === "pareto" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Curva ABC — Top 30 Clientes</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="name" tick={{ fill: "#78696c", fontSize: 10 }} axisLine={{ stroke: "#e5dfe1" }} angle={-30} textAnchor="end" height={50} />
                  <YAxis yAxisId="left" tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#7c3aed", fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar yAxisId="left" dataKey="fat" name="Faturamento" radius={[4, 4, 0, 0]}>
                    {paretoData.map((d, i) => (
                      <Cell key={i} fill={d.cumPct <= 80 ? "#A81C2C" : d.cumPct <= 95 ? "#d97706" : "#9ca3af"} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" dataKey="cumPct" name="% Acumulado" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-cockpit-muted">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#A81C2C]" /> Classe A (80%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#d97706]" /> Classe B (15%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#9ca3af]" /> Classe C (5%)</span>
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
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">UF</th>
                <th className="py-3 px-4 text-right">Faturamento</th>
                <th className="py-3 px-4 text-right">Pedidos</th>
                <th className="py-3 px-4 text-right">Ticket</th>
                <th className="py-3 px-4 text-right">% Fat.</th>
                <th className="py-3 px-4 text-center">ABC</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4">Último Pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-cockpit-muted">Nenhum cliente encontrado</td></tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.cardCode} className="hover:bg-cockpit-accent/[0.04] transition-colors">
                    <td className="py-2.5 px-4 text-cockpit-muted text-xs">{i + 1}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{r.cardCode}</td>
                    <td className="py-2.5 px-4 font-medium text-gray-900 max-w-[180px] truncate">{r.cardName}</td>
                    <td className="py-2.5 px-4 text-gray-500">{r.state}</td>
                    <td className="py-2.5 px-4 text-right text-cockpit-accent font-medium">{fmtBRL(r.fat)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{r.pedidos}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{fmtBRL(r.ticket, 2)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-500">{r.pctFat.toFixed(1)}%</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.classe === "A" ? "bg-cockpit-accent/15 text-cockpit-accent" :
                        r.classe === "B" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                      }`}>{r.classe}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs max-w-[120px] truncate">{r.vendorName}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{fmtDateShort(r.lastOrder)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          {filtered.length} de {allClients.length} clientes · Faturamento total: {fmtBRL(kpis.fat)} — Pedidos de Venda SAP B1
        </div>
      </div>
    </div>
  );
}
