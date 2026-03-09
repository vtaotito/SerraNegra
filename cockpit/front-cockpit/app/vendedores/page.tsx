"use client";

import {
  Users,
  TrendingUp,
  Target,
} from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });

const vendedores = [
  { nome: "ALEF", alvo: 50, real: 36, posit: 85, prosp: 12, recup: 8, ticket: 3413, metas: "2/6" },
  { nome: "ALESSANDRO", alvo: 80, real: 61, posit: 142, prosp: 18, recup: 15, ticket: 8484, metas: "4/6" },
  { nome: "DEBORA", alvo: 175, real: 245, posit: 310, prosp: 25, recup: 22, ticket: 2166, metas: "6/6" },
  { nome: "ISABELA", alvo: 30, real: 68, posit: 95, prosp: 8, recup: 5, ticket: 677, metas: "5/6" },
  { nome: "TATIANA", alvo: 60, real: 92, posit: 120, prosp: 15, recup: 10, ticket: 1056, metas: "3/6" },
  { nome: "THIAGO", alvo: 80, real: 204, posit: 280, prosp: 20, recup: 18, ticket: 709, metas: "5/6" },
  { nome: "ANA", alvo: 100, real: 137, posit: 180, prosp: 22, recup: 14, ticket: 2138, metas: "4/6" },
];

function AtingBadge({ real, alvo }: { real: number; alvo: number }) {
  const pct = Math.round((real / alvo) * 100);
  let color = "bg-green-500/20 text-green-400";
  if (pct < 80) color = "bg-red-500/20 text-red-400";
  else if (pct < 100) color = "bg-yellow-500/20 text-yellow-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}

const totalVendedores = vendedores.length;
const mediaVolMensal = Math.round(
  vendedores.reduce((s, v) => s + v.real, 0) / totalVendedores
);
const metaGlobal = vendedores.reduce((s, v) => s + v.alvo, 0);

const kpis = [
  { label: "Total Vendedores", value: String(totalVendedores), icon: Users, color: "text-cockpit-accent" },
  { label: "Média Vol. Mensal", value: mediaVolMensal.toLocaleString("pt-BR"), icon: TrendingUp, color: "text-blue-400" },
  { label: "Meta Global", value: metaGlobal.toLocaleString("pt-BR"), icon: Target, color: "text-yellow-400" },
];

export default function VendedoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mapa de Vendedores</h1>
        <p className="text-cockpit-muted mt-1">
          Scorecard com métricas de performance — volume, positivações, prospecções.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
          Performance Semestral (Jan–Jun)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted">
                <th className="py-3 pr-4">Vendedor</th>
                <th className="py-3 pr-4 text-right">Vol. Alvo</th>
                <th className="py-3 pr-4 text-right">Vol. Real</th>
                <th className="py-3 pr-4 text-center">Ating.</th>
                <th className="py-3 pr-4 text-right">Positivações</th>
                <th className="py-3 pr-4 text-right">Prospecções</th>
                <th className="py-3 pr-4 text-right">Recuperações</th>
                <th className="py-3 pr-4 text-right">Ticket Médio</th>
                <th className="py-3 text-center">Metas Batidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {vendedores.map((v) => (
                <tr key={v.nome} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 font-medium text-white">{v.nome}</td>
                  <td className="py-3 pr-4 text-right text-cockpit-muted">{v.alvo}</td>
                  <td className="py-3 pr-4 text-right text-white">{v.real}</td>
                  <td className="py-3 pr-4 text-center">
                    <AtingBadge real={v.real} alvo={v.alvo} />
                  </td>
                  <td className="py-3 pr-4 text-right text-white">{v.posit}</td>
                  <td className="py-3 pr-4 text-right text-white">{v.prosp}</td>
                  <td className="py-3 pr-4 text-right text-white">{v.recup}</td>
                  <td className="py-3 pr-4 text-right text-cockpit-accent font-medium">
                    {fmt(v.ticket)}
                  </td>
                  <td className="py-3 text-center">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">
                      {v.metas}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Dados: aba MAPA VENDEDORES — Semestre 1/2025
      </p>
    </div>
  );
}
