"use client";

import { useState, useMemo } from "react";
import {
  Users, DollarSign, TrendingUp, Target, Search, CalendarDays, ShoppingCart,
  Award, BarChart3, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ComposedChart, Line, ScatterChart, Scatter, ZAxis,
  ReferenceLine,
} from "recharts";
import { fmtBRL, fmtNum } from "@/lib/format";
import {
  fetchSalesOrders, fetchSalesPersons, fetchCustomers,
  type SalesOrderRow, type SapSalesPerson,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { format, parseISO, startOfMonth } from "date-fns";

const COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5", "#16a34a", "#ea580c"];

interface VendRow {
  nome: string;
  code: number;
  fat: number;
  pedidos: number;
  ticket: number;
  active: boolean;
  clientesUnicos: number;
  qtdTotal: number;
  rank: number;
  pctFat: number;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildVendRows(orders: SalesOrderRow[], persons: SapSalesPerson[]): VendRow[] {
  const agg = new Map<number, { fat: number; pedidos: number; clientes: Set<string>; qtd: number }>();
  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const c = o.sales_person_code ?? -1;
    const cur = agg.get(c) ?? { fat: 0, pedidos: 0, clientes: new Set(), qtd: 0 };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    cur.clientes.add(o.card_code);
    cur.qtd += Number(o.total_quantity) || 0;
    agg.set(c, cur);
  }

  const totalFat = Array.from(agg.values()).reduce((s, a) => s + a.fat, 0);

  const rows = persons.map((p) => {
    const a = agg.get(p.SalesEmployeeCode) ?? { fat: 0, pedidos: 0, clientes: new Set(), qtd: 0 };
    return {
      nome: p.SalesEmployeeName,
      code: p.SalesEmployeeCode,
      fat: a.fat,
      pedidos: a.pedidos,
      ticket: a.pedidos > 0 ? a.fat / a.pedidos : 0,
      active: p.Active === "tYES",
      clientesUnicos: a.clientes.size,
      qtdTotal: a.qtd,
      rank: 0,
      pctFat: totalFat > 0 ? (a.fat / totalFat) * 100 : 0,
    };
  }).sort((a, b) => b.fat - a.fat);

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

function buildEvolution(orders: SalesOrderRow[], persons: SapSalesPerson[]) {
  const pMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));
  const byMonth = new Map<string, Map<string, number>>();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const month = format(parseISO(o.doc_date), "yyyy-MM");
    const nome = pMap.get(o.sales_person_code ?? -1) ?? "Outros";
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const m = byMonth.get(month)!;
    m.set(nome, (m.get(nome) ?? 0) + (Number(o.doc_total) || 0));
  }

  const vendedoresTop = [...new Set(
    orders.filter((o) => o.cancelled !== "Y").map((o) => pMap.get(o.sales_person_code ?? -1) ?? "Outros")
  )].slice(0, 5);

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, map]) => {
      const row: Record<string, any> = { month: month.substring(5) + "/" + month.substring(2, 4) };
      for (const v of vendedoresTop) {
        row[v] = map.get(v) ?? 0;
      }
      return row;
    });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-cockpit-border bg-white px-3 py-2 shadow-lg text-xs max-w-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span className="truncate">{p.name}:</span>
          <span className="font-semibold">{typeof p.value === "number" ? fmtBRL(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function VendedoresPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo }), [dateFrom, dateTo]);
  const { data: spData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchSalesPersons(), []);

  const loading = l1 && l2;
  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const persons = useMemo(() => spData?.items ?? [], [spData]);

  const rows = useMemo(() => buildVendRows(orders, persons), [orders, persons]);
  const evolution = useMemo(() => buildEvolution(orders, persons), [orders, persons]);

  const topVendorNames = useMemo(() => {
    return rows.filter((r) => r.fat > 0).slice(0, 5).map((r) => r.nome);
  }, [rows]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ranking" | "evolucao" | "scatter">("ranking");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch = r.nome.toLowerCase().includes(search.toLowerCase());
      const matchActive = !showOnlyActive || r.active;
      return matchSearch && matchActive;
    });
  }, [rows, search, showOnlyActive]);

  const kpis = useMemo(() => {
    const activeWithSales = filtered.filter((r) => r.fat > 0);
    const totalFat = filtered.reduce((s, r) => s + r.fat, 0);
    const totalPed = filtered.reduce((s, r) => s + r.pedidos, 0);
    const medianFat = median(activeWithSales.map((r) => r.fat));
    return { total: filtered.length, activeWithSales: activeWithSales.length, totalFat, totalPed, medianFat };
  }, [filtered]);

  const scatterData = useMemo(() => {
    return filtered.filter((r) => r.fat > 0).map((r) => ({
      x: r.pedidos,
      y: r.ticket,
      z: r.fat,
      name: r.nome,
    }));
  }, [filtered]);

  const medianTicket = useMemo(() => median(scatterData.map((d) => d.y)), [scatterData]);

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Vendedores</h1><p className="text-cockpit-muted mt-1">Carregando...</p></div><LoadingSkeleton /></div>;
  if (e2) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Vendedores</h1></div><ErrorState message={e2} onRetry={r2} /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Users className="w-5 h-5 text-cockpit-accent" /></div>
          Mapa de Vendedores
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{persons.length} vendedores no SAP</span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Vendedores", value: String(kpis.total), icon: Users, color: "text-cockpit-accent" },
          { label: "Com Vendas", value: String(kpis.activeWithSales), icon: Target, color: "text-emerald-500" },
          { label: "Fat. Total", value: fmtBRL(kpis.totalFat), icon: DollarSign, color: "text-sky-500" },
          { label: "Mediana Fat.", value: fmtBRL(kpis.medianFat), icon: BarChart3, color: "text-amber-500" },
          { label: "Total Pedidos", value: fmtNum(kpis.totalPed), icon: ShoppingCart, color: "text-purple-500" },
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedor..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 transition-all" />
        </div>
        <label className="flex items-center gap-2 text-xs text-cockpit-muted cursor-pointer select-none">
          <input type="checkbox" checked={showOnlyActive} onChange={(e) => setShowOnlyActive(e.target.checked)}
            className="rounded border-cockpit-border text-cockpit-accent focus:ring-cockpit-accent/30" />
          Apenas ativos
        </label>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1">
        {([
          { id: "ranking", label: "Ranking" },
          { id: "evolucao", label: "Evolução Mensal" },
          { id: "scatter", label: "Volume × Ticket" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
        {tab === "ranking" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Ranking — Faturamento</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filtered.filter((r) => r.fat > 0).slice(0, 12).map((r) => ({ name: r.nome.split(" ")[0], Fat: r.fat }))} layout="vertical" barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#78696c", fontSize: 11 }}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#78696c", fontSize: 11 }} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine x={kpis.medianFat} stroke="#7c3aed" strokeDasharray="5 5" label={{ value: "Mediana", fill: "#7c3aed", fontSize: 10 }} />
                  <Bar dataKey="Fat" name="Faturamento" radius={[0, 6, 6, 0]}>
                    {filtered.filter((r) => r.fat > 0).slice(0, 12).map((r, i) => (
                      <Cell key={i} fill={r.fat >= kpis.medianFat ? "#A81C2C" : "#9ca3af"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "evolucao" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Evolução Mensal — Top 5 Vendedores</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="month" tick={{ fill: "#78696c", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#78696c", fontSize: 11 }}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  {topVendorNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-cockpit-muted">
              {topVendorNames.map((name, i) => (
                <span key={name} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                  {name}
                </span>
              ))}
            </div>
          </>
        )}

        {tab === "scatter" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Volume de Pedidos × Ticket Médio</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="x" type="number" name="Pedidos" tick={{ fill: "#78696c", fontSize: 11 }}
                    label={{ value: "Pedidos", position: "bottom", fill: "#78696c", fontSize: 11 }} />
                  <YAxis dataKey="y" type="number" name="Ticket" tick={{ fill: "#78696c", fontSize: 11 }}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <ZAxis dataKey="z" range={[100, 800]} name="Faturamento" />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-cockpit-border bg-white px-3 py-2 shadow-lg text-xs">
                        <p className="font-medium text-gray-900">{d?.name}</p>
                        <p>Pedidos: {d?.x}</p>
                        <p>Ticket: {fmtBRL(d?.y, 2)}</p>
                        <p>Fat. Total: {fmtBRL(d?.z)}</p>
                      </div>
                    );
                  }} />
                  <ReferenceLine y={medianTicket} stroke="#7c3aed" strokeDasharray="5 5" label={{ value: "Med. Ticket", fill: "#7c3aed", fontSize: 10 }} />
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
                <th className="py-3 px-4 w-8"><Award className="w-3.5 h-3.5 inline" /></th>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4 text-right">Faturamento</th>
                <th className="py-3 px-4 text-right">Pedidos</th>
                <th className="py-3 px-4 text-right">Ticket Médio</th>
                <th className="py-3 px-4 text-right">Clientes</th>
                <th className="py-3 px-4 text-right">% Fat.</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-cockpit-muted">Nenhum vendedor encontrado</td></tr>
              ) : (
                <>
                  {filtered.map((r) => (
                    <tr key={r.code} className={`hover:bg-cockpit-accent/[0.04] transition-colors ${r.fat === 0 ? "opacity-50" : ""}`}>
                      <td className="py-2.5 px-4">
                        {r.rank <= 3 && r.fat > 0 ? (
                          <span className={`text-sm ${r.rank === 1 ? "text-amber-500" : r.rank === 2 ? "text-gray-400" : "text-amber-700"}`}>
                            {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
                          </span>
                        ) : (
                          <span className="text-xs text-cockpit-muted">{r.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{r.code}</td>
                      <td className="py-2.5 px-4 font-medium text-gray-900">{r.nome}</td>
                      <td className="py-2.5 px-4 text-right text-cockpit-accent font-medium">{fmtBRL(r.fat)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{r.pedidos}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{fmtBRL(r.ticket, 2)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{r.clientesUnicos}</td>
                      <td className="py-2.5 px-4 text-right text-gray-500">{r.pctFat.toFixed(1)}%</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        }`}>{r.active ? "Ativo" : "Inativo"}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-cockpit-bg/60 text-gray-900 font-bold">
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4">TOTAL ({filtered.filter((r) => r.fat > 0).length})</td>
                    <td className="py-3 px-4 text-right text-cockpit-accent">{fmtBRL(kpis.totalFat)}</td>
                    <td className="py-3 px-4 text-right">{kpis.totalPed}</td>
                    <td className="py-3 px-4 text-right">{kpis.totalPed > 0 ? fmtBRL(kpis.totalFat / kpis.totalPed, 2) : "—"}</td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">100%</td>
                    <td className="py-3 px-4" />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          {filtered.length} vendedores — Pedidos de Venda SAP B1
        </div>
      </div>
    </div>
  );
}
