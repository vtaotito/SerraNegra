"use client";

import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
} from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });

const kpis = [
  { label: "Fat. 90 Dias Total", value: fmt(7521452), icon: DollarSign, color: "text-cockpit-accent" },
  { label: "Média Fat./Mês", value: fmt(2507151), icon: TrendingUp, color: "text-blue-400" },
  { label: "Média Positivações", value: "904,67", icon: Target, color: "text-yellow-400" },
  { label: "Média SKU/Cliente", value: "7,89", icon: BarChart3, color: "text-purple-400" },
];

const carteira = [
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Carteira Geral</h1>
        <p className="text-cockpit-muted mt-1">
          Dashboard por vendedor — pipeline, ticket médio, segmentação.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <span className="text-xs text-cockpit-muted uppercase tracking-wide">
                {k.label}
              </span>
            </div>
            <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Carteira por Vendedor
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
              {carteira.map((row) => (
                <tr key={row.vendedor} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 font-medium text-white">{row.vendedor}</td>
                  <td className="py-3 pr-4 text-right text-white">
                    {row.total.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="text-red-400 mr-2">
                      {row.perdidos.toLocaleString("pt-BR")}
                    </span>
                    <PctBadge perdidos={row.perdidos} total={row.total} />
                  </td>
                  <td className="py-3 pr-4 text-right text-yellow-400">
                    {row.atencao.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 pr-4 text-right text-blue-400">
                    {row.pareto.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 pr-4 text-right text-yellow-400">
                    {row.gold.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 pr-4 text-right text-white">{fmt(row.ticket)}</td>
                  <td className="py-3 text-right text-cockpit-accent font-medium">
                    {fmt(row.fatMes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Dados: aba CARTEIRA GERAL — 50.073 registos
      </p>
    </div>
  );
}
