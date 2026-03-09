"use client";

import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, Target, BarChart3, Search } from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const ALL_CARTEIRA = [
  { vendedor: "ALEF", total: 620, perdidos: 310, atencao: 186, pareto: 84, gold: 21, ticket: 6200, fatMes: 310000 },
  { vendedor: "ALESSANDRO", total: 890, perdidos: 445, atencao: 267, pareto: 120, gold: 30, ticket: 9800, fatMes: 480000 },
  { vendedor: "DEBORA", total: 780, perdidos: 390, atencao: 234, pareto: 105, gold: 26, ticket: 7500, fatMes: 410000 },
  { vendedor: "ISABELA", total: 350, perdidos: 175, atencao: 105, pareto: 47, gold: 12, ticket: 4200, fatMes: 120000 },
  { vendedor: "TATIANA", total: 520, perdidos: 260, atencao: 156, pareto: 70, gold: 17, ticket: 5800, fatMes: 280000 },
  { vendedor: "THIAGO", total: 680, perdidos: 340, atencao: 204, pareto: 92, gold: 23, ticket: 6900, fatMes: 350000 },
  { vendedor: "ANA", total: 802, perdidos: 448, atencao: 261, pareto: 111, gold: 25, ticket: 8100, fatMes: 557000 },
];

function PctBadge({ perdidos, total }: { perdidos: number; total: number }) {
  const pct = Math.round((perdidos / total) * 100);
  const color = pct > 50 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}

export default function CarteiraPage() {
  const [search, setSearch] = useState("");
  const [metricSort, setMetricSort] = useState<"fatMes" | "total" | "perdidos" | "gold">("fatMes");

  const filtered = useMemo(() => {
    const list = ALL_CARTEIRA.filter((row) =>
      row.vendedor.toLowerCase().includes(search.toLowerCase())
    );
    return [...list].sort((a, b) => b[metricSort] - a[metricSort]);
  }, [search, metricSort]);

  const kpis = useMemo(() => {
    const totalFat = filtered.reduce((s, r) => s + r.fatMes, 0);
    const avgFat = filtered.length > 0 ? totalFat / filtered.length : 0;
    const avgPosit = filtered.length > 0
      ? filtered.reduce((s, r) => s + (r.total - r.perdidos - r.atencao), 0) / filtered.length
      : 0;
    const avgSku = filtered.length > 0
      ? (filtered.reduce((s, r) => s + r.pareto, 0) / filtered.length * 0.094).toFixed(2)
      : "0";
    return [
      { label: "Fat. 90 Dias Total", value: fmt(totalFat * 3), icon: DollarSign, color: "text-cockpit-accent" },
      { label: "Média Fat./Mês", value: fmt(avgFat), icon: TrendingUp, color: "text-blue-400" },
      { label: "Média Positivações", value: avgPosit.toFixed(0), icon: Target, color: "text-yellow-400" },
      { label: "Média SKU/Cliente", value: avgSku, icon: BarChart3, color: "text-purple-400" },
    ];
  }, [filtered]);

  const sortOptions = [
    { value: "fatMes", label: "Fat. Mês" },
    { value: "total", label: "Total Clientes" },
    { value: "perdidos", label: "Perdidos" },
    { value: "gold", label: "Gold" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Carteira Geral</h1>
        <p className="text-cockpit-muted mt-1">
          Dashboard por vendedor — pipeline, ticket médio, segmentação.
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
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMetricSort(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                metricSort === opt.value
                  ? "bg-cockpit-accent/20 text-cockpit-accent"
                  : "text-cockpit-muted hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <span className="text-xs text-cockpit-muted uppercase tracking-wide">{k.label}</span>
            </div>
            <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Carteira por Vendedor ({filtered.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted">
                <th className="py-3 pr-4">Vendedor</th>
                <th className="py-3 pr-4 text-right">Total</th>
                <th className="py-3 pr-4 text-right">Perdidos 90d</th>
                <th className="py-3 pr-4 text-right">Atenção</th>
                <th className="py-3 pr-4 text-right">80/20</th>
                <th className="py-3 pr-4 text-right">Gold</th>
                <th className="py-3 pr-4 text-right">Ticket Médio</th>
                <th className="py-3 text-right">Fat. Mês</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-cockpit-muted">
                    Nenhum vendedor encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.vendedor} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-medium text-white">{row.vendedor}</td>
                    <td className="py-3 pr-4 text-right text-white">{row.total.toLocaleString("pt-BR")}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-red-400 mr-2">{row.perdidos.toLocaleString("pt-BR")}</span>
                      <PctBadge perdidos={row.perdidos} total={row.total} />
                    </td>
                    <td className="py-3 pr-4 text-right text-yellow-400">{row.atencao.toLocaleString("pt-BR")}</td>
                    <td className="py-3 pr-4 text-right text-blue-400">{row.pareto.toLocaleString("pt-BR")}</td>
                    <td className="py-3 pr-4 text-right text-yellow-400">{row.gold.toLocaleString("pt-BR")}</td>
                    <td className="py-3 pr-4 text-right text-white">{fmt(row.ticket)}</td>
                    <td className="py-3 text-right text-cockpit-accent font-medium">{fmt(row.fatMes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Exibindo {filtered.length} de {ALL_CARTEIRA.length} vendedores — dados aba CARTEIRA GERAL
      </p>
    </div>
  );
}
