"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Target, DollarSign, CalendarDays, Search, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from "recharts";
import { fmtBRL } from "@/lib/format";
import { fetchInvoices, fetchSalesPersons, type SapInvoice, type SapSalesPerson } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format } from "date-fns";

interface VendRow {
  nome: string;
  code: number;
  real: number;
  vol: number;
  ticket: number;
}

function aggregate(invoices: SapInvoice[], persons: SapSalesPerson[]): VendRow[] {
  const pMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));
  const agg = new Map<number, { real: number; vol: number }>();

  for (const inv of invoices) {
    if (inv.Cancelled === "tYES") continue;
    const code = inv.SalesPersonCode;
    const cur = agg.get(code) ?? { real: 0, vol: 0 };
    cur.real += inv.DocTotal;
    cur.vol += 1;
    agg.set(code, cur);
  }

  return Array.from(agg.entries())
    .map(([code, { real, vol }]) => ({
      nome: pMap.get(code) ?? `Vendedor ${code}`,
      code,
      real,
      vol,
      ticket: vol > 0 ? real / vol : 0,
    }))
    .sort((a, b) => b.real - a.real);
}

export default function FaturamentoPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: invData, loading: loadInv, error: errInv, refetch: rInv } =
    useFetch(() => fetchInvoices({ limit: 5000, dateFrom, dateTo }), [dateFrom, dateTo]);
  const { data: spData, loading: loadSp, error: errSp, refetch: rSp } =
    useFetch(() => fetchSalesPersons(), []);

  const loading = loadInv && loadSp;
  const hasInvError = !!errInv;

  const vendedores = useMemo(() => {
    if (!spData?.items) return [];
    return aggregate(invData?.items ?? [], spData.items);
  }, [invData, spData]);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() =>
    vendedores.filter((v) => v.nome.toLowerCase().includes(search.toLowerCase())),
  [vendedores, search]);

  const totais = useMemo(() => ({
    real: filtered.reduce((s, v) => s + v.real, 0),
    vol: filtered.reduce((s, v) => s + v.vol, 0),
  }), [filtered]);

  const chartData = useMemo(() =>
    filtered.slice(0, 15).map((v) => ({ name: v.nome.split(" ")[0], Real: v.real })),
  [filtered]);

  const kpis = [
    { label: "Real Total", value: fmtBRL(totais.real), icon: DollarSign, color: "text-cockpit-accent" },
    { label: "Notas", value: String(totais.vol), icon: Target, color: "text-sky-400" },
    { label: "Ticket Médio", value: totais.vol > 0 ? fmtBRL(totais.real / totais.vol) : "—", icon: TrendingUp, color: "text-amber-400" },
    { label: "Vendedores", value: String(filtered.length), icon: Users, color: "text-blue-400" },
  ];

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">Faturamento</h1><p className="text-cockpit-muted mt-1">Carregando...</p></div><LoadingSkeleton /></div>;
  if (errSp) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">Faturamento</h1></div><ErrorState message={errSp} onRetry={rSp} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Faturamento</h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-300">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{invData?.count ?? 0} notas fiscais</span>
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar vendedor..." aria-label="Buscar vendedor"
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="KPIs">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className="text-xl font-bold text-white">{k.value}</span>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <h2 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Faturamento por Vendedor</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#33292c" />
                <XAxis dataKey="name" tick={{ fill: "#948a8d", fontSize: 12 }} axisLine={{ stroke: "#33292c" }} />
                <YAxis tick={{ fill: "#948a8d", fontSize: 11 }} axisLine={{ stroke: "#33292c" }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#1a1517", border: "1px solid #33292c", borderRadius: 8, color: "#e6edf3" }}
                  formatter={(value: number) => fmtBRL(value)} labelStyle={{ color: "#948a8d" }} />
                <Legend wrapperStyle={{ color: "#948a8d", fontSize: 12 }} />
                <Bar dataKey="Real" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill="#A81C2C" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-cockpit-bg text-cockpit-muted uppercase text-xs">
              <tr>
                <th scope="col" className="px-4 py-3">Vendedor</th>
                <th scope="col" className="px-4 py-3 text-right">Faturamento</th>
                <th scope="col" className="px-4 py-3 text-right">Notas</th>
                <th scope="col" className="px-4 py-3 text-right">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-cockpit-muted">Nenhum vendedor</td></tr>
              ) : (
                <>
                  {filtered.map((v) => (
                    <tr key={v.code} className="hover:bg-white/5 text-gray-300">
                      <td className="px-4 py-3 font-medium text-white">{v.nome}</td>
                      <td className="px-4 py-3 text-right text-cockpit-accent font-medium">{fmtBRL(v.real)}</td>
                      <td className="px-4 py-3 text-right">{v.vol}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(v.ticket, 2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-cockpit-bg/60 text-white font-bold">
                    <td className="px-4 py-3">TOTAL ({filtered.length})</td>
                    <td className="px-4 py-3 text-right text-cockpit-accent">{fmtBRL(totais.real)}</td>
                    <td className="px-4 py-3 text-right">{totais.vol}</td>
                    <td className="px-4 py-3 text-right">{totais.vol > 0 ? fmtBRL(totais.real / totais.vol, 2) : "—"}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          {filtered.length} vendedores — dados SAP B1 /Invoices + /SalesPersons
        </div>
      </div>
    </div>
  );
}
