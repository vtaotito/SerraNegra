"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Target, DollarSign, CalendarDays, Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from "recharts";
import { fmtBRL } from "@/lib/format";

const ALL_VENDEDORES = [
  { nome: "Alef Santos", meta: 220000, real: 122883, vol: 36, ticket: 3413.42, perf: -21.8, prev: 172036 },
  { nome: "Alessandro Gomes", meta: 600000, real: 517496, vol: 61, ticket: 8483.54, perf: 20.7, prev: 724495 },
  { nome: "Debora Silva", meta: 520000, real: 530724, vol: 245, ticket: 2166.22, perf: 42.9, prev: 743013 },
  { nome: "Isabela Batista", meta: 40000, real: 46009, vol: 68, ticket: 676.60, perf: 61.0, prev: 64413 },
  { nome: "Tatiana Fernandes", meta: 190000, real: 144534, vol: 92, ticket: 1056.48, perf: 3.5, prev: 202348 },
  { nome: "Thiago Lopes", meta: 130000, real: 144631, vol: 204, ticket: 709.07, perf: 6.6, prev: 202483 },
  { nome: "Ana", meta: 400000, real: 295684, vol: 137, ticket: 2138.43, perf: 20.1, prev: 413957 },
];

export default function FaturamentoPage() {
  const [search, setSearch] = useState("");
  const [perfFilter, setPerfFilter] = useState<"all" | "positive" | "negative">("all");

  const filtered = useMemo(() => {
    return ALL_VENDEDORES.filter((v) => {
      const matchSearch = v.nome.toLowerCase().includes(search.toLowerCase());
      const matchPerf = perfFilter === "all" ? true : perfFilter === "positive" ? v.perf >= 0 : v.perf < 0;
      return matchSearch && matchPerf;
    });
  }, [search, perfFilter]);

  const totais = useMemo(() => ({
    meta: filtered.reduce((s, v) => s + v.meta, 0),
    real: filtered.reduce((s, v) => s + v.real, 0),
    vol: filtered.reduce((s, v) => s + v.vol, 0),
    prev: filtered.reduce((s, v) => s + v.prev, 0),
  }), [filtered]);

  const atingimento = totais.meta > 0 ? ((totais.real / totais.meta) * 100).toFixed(1) : "0.0";

  const chartData = useMemo(() =>
    filtered.map((v) => ({
      name: v.nome.split(" ")[0],
      Meta: v.meta,
      Real: v.real,
      perf: v.perf,
    })),
  [filtered]);

  const kpis = [
    { label: "Meta Total", value: fmtBRL(totais.meta), icon: Target, color: "text-cockpit-muted" },
    { label: "Real Total", value: fmtBRL(totais.real), icon: DollarSign, color: "text-cockpit-accent" },
    { label: "% Atingimento", value: `${atingimento}%`, icon: TrendingUp, color: Number(atingimento) >= 100 ? "text-cockpit-accent" : "text-amber-400" },
    { label: "Previsão", value: fmtBRL(totais.prev), icon: CalendarDays, color: "text-sky-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Faturamento Mês Atual</h1>
        <p className="text-cockpit-muted mt-1">Meta vs realizado por vendedor — 21 dias de venda totais | 15 dias de vendas atuais</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedor..." aria-label="Buscar vendedor"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
        </div>
        <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Filtrar performance">
          {(["all", "positive", "negative"] as const).map((opt) => {
            const labels = { all: "Todos", positive: "Acima", negative: "Abaixo" };
            return (
              <button key={opt} type="button" onClick={() => setPerfFilter(opt)}
                aria-pressed={perfFilter === opt}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  perfFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent" : "text-cockpit-muted hover:text-white"
                }`}>{labels[opt]}</button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="KPIs de faturamento">
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
          <h2 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Meta vs Real</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 12 }} axisLine={{ stroke: "#30363d" }} />
                <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={{ stroke: "#30363d" }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, color: "#e6edf3" }}
                  formatter={(value: number) => fmtBRL(value)} labelStyle={{ color: "#8b949e" }} />
                <Legend wrapperStyle={{ color: "#8b949e", fontSize: 12 }} />
                <Bar dataKey="Meta" radius={[4, 4, 0, 0]} opacity={0.35}>
                  {chartData.map((_, i) => <Cell key={i} fill="#238636" />)}
                </Bar>
                <Bar dataKey="Real" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.perf >= 0 ? "#238636" : "#da3633"} />)}
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
                <th scope="col" className="px-4 py-3 text-right">Meta</th>
                <th scope="col" className="px-4 py-3 text-right">Real</th>
                <th scope="col" className="px-4 py-3 text-right">Vol.</th>
                <th scope="col" className="px-4 py-3 text-right">Ticket</th>
                <th scope="col" className="px-4 py-3 text-right">Perf %</th>
                <th scope="col" className="px-4 py-3 text-right">Previsão</th>
                <th scope="col" className="px-4 py-3 w-32">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-cockpit-muted">Nenhum vendedor encontrado</td></tr>
              ) : (
                <>
                  {filtered.map((v) => {
                    const pct = Math.min((v.real / v.meta) * 100, 100);
                    return (
                      <tr key={v.nome} className="hover:bg-white/5 text-gray-300">
                        <td className="px-4 py-3 font-medium text-white">{v.nome}</td>
                        <td className="px-4 py-3 text-right">{fmtBRL(v.meta)}</td>
                        <td className="px-4 py-3 text-right">{fmtBRL(v.real)}</td>
                        <td className="px-4 py-3 text-right">{v.vol}</td>
                        <td className="px-4 py-3 text-right">{fmtBRL(v.ticket, 2)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${v.perf >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {v.perf >= 0 ? "+" : ""}{v.perf.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right">{fmtBRL(v.prev)}</td>
                        <td className="px-4 py-3">
                          <div className="h-2 w-full rounded-full bg-cockpit-bg">
                            <div className={`h-2 rounded-full transition-all ${v.perf >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-cockpit-bg/60 text-white font-bold">
                    <td className="px-4 py-3">TOTAL ({filtered.length})</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(totais.meta)}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(totais.real)}</td>
                    <td className="px-4 py-3 text-right">{totais.vol}</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className={`px-4 py-3 text-right ${totais.real >= totais.meta ? "text-emerald-400" : "text-amber-400"}`}>{atingimento}%</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(totais.prev)}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full rounded-full bg-cockpit-bg">
                        <div className="h-2 rounded-full bg-amber-500 transition-all"
                          style={{ width: `${totais.meta > 0 ? Math.min((totais.real / totais.meta) * 100, 100) : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          {filtered.length} de {ALL_VENDEDORES.length} vendedores — aba FAT. MÊS ATUAL
        </div>
      </div>
    </div>
  );
}
