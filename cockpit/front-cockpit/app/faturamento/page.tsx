"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Target, DollarSign, CalendarDays, Search } from "lucide-react";

const ALL_VENDEDORES = [
  { nome: "Alef Santos", meta: 220000, real: 122883, vol: 36, ticket: 3413.42, perf: -21.8, prev: 172036 },
  { nome: "Alessandro Gomes", meta: 600000, real: 517496, vol: 61, ticket: 8483.54, perf: 20.7, prev: 724495 },
  { nome: "Debora Silva", meta: 520000, real: 530724, vol: 245, ticket: 2166.22, perf: 42.9, prev: 743013 },
  { nome: "Isabela Batista", meta: 40000, real: 46009, vol: 68, ticket: 676.60, perf: 61.0, prev: 64413 },
  { nome: "Tatiana Fernandes", meta: 190000, real: 144534, vol: 92, ticket: 1056.48, perf: 3.5, prev: 202348 },
  { nome: "Thiago Lopes", meta: 130000, real: 144631, vol: 204, ticket: 709.07, perf: 6.6, prev: 202483 },
  { nome: "Ana", meta: 400000, real: 295684, vol: 137, ticket: 2138.43, perf: 20.1, prev: 413957 },
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function fmtTicket(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export default function FaturamentoPage() {
  const [search, setSearch] = useState("");
  const [perfFilter, setPerfFilter] = useState<"all" | "positive" | "negative">("all");

  const filtered = useMemo(() => {
    return ALL_VENDEDORES.filter((v) => {
      const matchSearch = v.nome.toLowerCase().includes(search.toLowerCase());
      const matchPerf =
        perfFilter === "all" ? true : perfFilter === "positive" ? v.perf >= 0 : v.perf < 0;
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

  const kpis = [
    { label: "Meta Total", value: fmt(totais.meta), icon: Target, color: "text-cockpit-muted" },
    { label: "Real Total", value: fmt(totais.real), icon: DollarSign, color: "text-cockpit-accent" },
    { label: "% Atingimento", value: `${atingimento}%`, icon: TrendingUp, color: "text-amber-400" },
    { label: "Previsão", value: fmt(totais.prev), icon: CalendarDays, color: "text-sky-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Faturamento Mês Atual</h1>
        <p className="text-cockpit-muted mt-1">
          Meta vs realizado por vendedor — 21 dias de venda totais | 15 dias de vendas atuais
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedor..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-cockpit-border bg-cockpit-bg p-1">
          {(["all", "positive", "negative"] as const).map((opt) => {
            const labels = { all: "Todos", positive: "Acima", negative: "Abaixo" };
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setPerfFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  perfFilter === opt
                    ? "bg-cockpit-accent/20 text-cockpit-accent"
                    : "text-cockpit-muted hover:text-white"
                }`}
              >
                {labels[opt]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-xs text-cockpit-muted uppercase tracking-wide">{k.label}</span>
            </div>
            <span className="text-xl font-bold text-white">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-cockpit-bg text-cockpit-muted uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3 text-right">Meta</th>
                <th className="px-4 py-3 text-right">Real</th>
                <th className="px-4 py-3 text-right">Vol.</th>
                <th className="px-4 py-3 text-right">Ticket</th>
                <th className="px-4 py-3 text-right">Perf %</th>
                <th className="px-4 py-3 text-right">Prev. Fechamento</th>
                <th className="px-4 py-3 w-40">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-cockpit-muted">
                    Nenhum vendedor encontrado para os filtros selecionados
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map((v) => {
                    const pct = Math.min((v.real / v.meta) * 100, 100);
                    return (
                      <tr key={v.nome} className="hover:bg-white/5 text-gray-300">
                        <td className="px-4 py-3 font-medium text-white">{v.nome}</td>
                        <td className="px-4 py-3 text-right">{fmt(v.meta)}</td>
                        <td className="px-4 py-3 text-right">{fmt(v.real)}</td>
                        <td className="px-4 py-3 text-right">{v.vol}</td>
                        <td className="px-4 py-3 text-right">{fmtTicket(v.ticket)}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            v.perf >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {v.perf >= 0 ? "+" : ""}{v.perf.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right">{fmt(v.prev)}</td>
                        <td className="px-4 py-3">
                          <div className="h-2 w-full rounded-full bg-cockpit-bg">
                            <div
                              className={`h-2 rounded-full ${v.perf >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-cockpit-bg/60 text-white font-bold">
                    <td className="px-4 py-3">TOTAL ({filtered.length}/{ALL_VENDEDORES.length})</td>
                    <td className="px-4 py-3 text-right">{fmt(totais.meta)}</td>
                    <td className="px-4 py-3 text-right">{fmt(totais.real)}</td>
                    <td className="px-4 py-3 text-right">{totais.vol}</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        totais.real >= totais.meta ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {atingimento}%
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(totais.prev)}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full rounded-full bg-cockpit-bg">
                        <div
                          className="h-2 rounded-full bg-amber-500"
                          style={{ width: `${totais.meta > 0 ? Math.min((totais.real / totais.meta) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          Exibindo {filtered.length} de {ALL_VENDEDORES.length} vendedores — dados aba FAT. MÊS ATUAL
        </div>
      </div>
    </div>
  );
}
