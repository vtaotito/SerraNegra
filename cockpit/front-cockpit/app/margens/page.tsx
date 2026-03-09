"use client";

import {
  DollarSign,
  Clock,
  Layers,
  MapPin,
} from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });

const kpis = [
  { label: "CMV Total Estoque", value: fmt(7012707), icon: DollarSign, color: "text-cockpit-accent" },
  { label: "Tempo Médio Estoque", value: "2,8 meses (GN)", icon: Clock, color: "text-yellow-400" },
  { label: "Categorias Analisadas", value: "5", icon: Layers, color: "text-blue-400" },
];

const categorias = [
  { nome: "Garrafa Nacional (GN)", tempo: 2.8, status: "Normal" },
  { nome: "Garrafa Importada (GI)", tempo: 4.1, status: "Alto" },
  { nome: "Garrafão + Artesanal", tempo: 1.9, status: "OK" },
  { nome: "Pote Alimentício", tempo: 3.5, status: "Alto" },
  { nome: "Tampas Rolhas e Lacres", tempo: 1.2, status: "OK" },
];

function tempoColor(t: number) {
  if (t <= 2) return "text-green-400";
  if (t <= 3) return "text-yellow-400";
  return "text-red-400";
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    OK: "bg-green-500/20 text-green-400",
    Normal: "bg-yellow-500/20 text-yellow-400",
    Alto: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "text-cockpit-muted"}`}>
      {status}
    </span>
  );
}

export default function MargensPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CMV / Margens</h1>
        <p className="text-cockpit-muted mt-1">
          Análise de custos — tempo de estoque por categoria, CMV por região.
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
          Tempo Médio de Estoque por Categoria
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted">
                <th className="py-3 pr-4">Categoria</th>
                <th className="py-3 pr-4 text-right">Tempo Médio (meses)</th>
                <th className="py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {categorias.map((c) => (
                <tr key={c.nome} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 font-medium text-white">{c.nome}</td>
                  <td className={`py-3 pr-4 text-right font-bold ${tempoColor(c.tempo)}`}>
                    {c.tempo.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                  </td>
                  <td className="py-3 text-center">{statusBadge(c.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Dados CMV por Região
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-cockpit-accent" />
            <span className="text-white font-medium">SUDESTE</span>
            <span className="text-cockpit-muted text-sm">— principal região</span>
          </div>
          <span className="rounded-full border border-cockpit-border bg-white/5 px-3 py-1 text-xs text-cockpit-muted">
            541 linhas de CMV analisadas
          </span>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Dados: abas CMV + ESTUDO DE MARGENS + RESUMO COMERCIAL
      </p>
    </div>
  );
}
