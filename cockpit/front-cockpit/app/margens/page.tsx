"use client";

import { useState, useMemo } from "react";
import { DollarSign, Clock, Layers, MapPin, Search } from "lucide-react";
import { fmtBRL } from "@/lib/format";

const ALL_CATEGORIAS = [
  { nome: "Garrafa Nacional (GN)", tempo: 2.8, status: "Normal" as const, cmv: 2850000 },
  { nome: "Garrafa Importada (GI)", tempo: 4.1, status: "Alto" as const, cmv: 1420000 },
  { nome: "Garrafão + Artesanal", tempo: 1.9, status: "OK" as const, cmv: 980000 },
  { nome: "Pote Alimentício", tempo: 3.5, status: "Alto" as const, cmv: 890000 },
  { nome: "Tampas Rolhas e Lacres", tempo: 1.2, status: "OK" as const, cmv: 872707 },
];

type StatusType = "OK" | "Normal" | "Alto";

function tempoColor(t: number) {
  if (t <= 2) return "text-green-400";
  if (t <= 3) return "text-yellow-400";
  return "text-red-400";
}

const statusColors: Record<StatusType, string> = {
  OK: "bg-green-500/20 text-green-400",
  Normal: "bg-yellow-500/20 text-yellow-400",
  Alto: "bg-red-500/20 text-red-400",
};

export default function MargensPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType | "ALL">("ALL");

  const filtered = useMemo(() => {
    return ALL_CATEGORIAS.filter((c) => {
      const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const kpis = useMemo(() => {
    const totalCmv = filtered.reduce((s, c) => s + c.cmv, 0);
    const avgTempo = filtered.length > 0
      ? filtered.reduce((s, c) => s + c.tempo, 0) / filtered.length
      : 0;
    return [
      { label: "CMV Total Estoque", value: fmtBRL(totalCmv), icon: DollarSign, color: "text-cockpit-accent" },
      { label: "Tempo Médio Estoque", value: `${avgTempo.toFixed(1)} meses`, icon: Clock, color: "text-yellow-400" },
      { label: "Categorias Exibidas", value: String(filtered.length), icon: Layers, color: "text-blue-400" },
    ];
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CMV / Margens</h1>
        <p className="text-cockpit-muted mt-1">
          Análise de custos — tempo de estoque por categoria, CMV por região.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categoria..." aria-label="Buscar categoria"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-cockpit-border bg-cockpit-bg p-1">
          {(["ALL", "OK", "Normal", "Alto"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === opt
                  ? opt === "Alto" ? "bg-red-500/20 text-red-400"
                    : opt === "Normal" ? "bg-yellow-500/20 text-yellow-400"
                    : opt === "OK" ? "bg-green-500/20 text-green-400"
                    : "bg-cockpit-accent/20 text-cockpit-accent"
                  : "text-cockpit-muted hover:text-white"
              }`}
            >
              {opt === "ALL" ? "Todos" : opt}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 hover:border-cockpit-accent/30 transition-colors flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Tempo Médio de Estoque por Categoria ({filtered.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted">
                <th className="py-3 pr-4">Categoria</th>
                <th className="py-3 pr-4 text-right">CMV</th>
                <th className="py-3 pr-4 text-right">Tempo Médio (meses)</th>
                <th className="py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-cockpit-muted">
                    Nenhuma categoria encontrada para os filtros selecionados
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.nome} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-medium text-white">{c.nome}</td>
                    <td className="py-3 pr-4 text-right text-cockpit-accent font-medium">{fmtBRL(c.cmv)}</td>
                    <td className={`py-3 pr-4 text-right font-bold ${tempoColor(c.tempo)}`}>
                      {c.tempo.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Dados CMV por Região</h2>
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
        Exibindo {filtered.length} de {ALL_CATEGORIAS.length} categorias — abas CMV + ESTUDO DE MARGENS
      </p>
    </div>
  );
}
