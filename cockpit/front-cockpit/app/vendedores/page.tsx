"use client";

import { useState, useMemo } from "react";
import { Users, TrendingUp, Target, Search } from "lucide-react";
import { fmtBRL } from "@/lib/format";

const ALL_VENDEDORES = [
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

type SortKey = "real" | "posit" | "prosp" | "ticket";

export default function VendedoresPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("real");
  const [atingFilter, setAtingFilter] = useState<"all" | "above" | "below">("all");

  const filtered = useMemo(() => {
    const list = ALL_VENDEDORES.filter((v) => {
      const matchSearch = v.nome.toLowerCase().includes(search.toLowerCase());
      const pct = (v.real / v.alvo) * 100;
      const matchAting =
        atingFilter === "all" ? true : atingFilter === "above" ? pct >= 100 : pct < 100;
      return matchSearch && matchAting;
    });
    return [...list].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [search, sortBy, atingFilter]);

  const kpis = useMemo(() => {
    const count = filtered.length;
    const mediaVol = count > 0 ? Math.round(filtered.reduce((s, v) => s + v.real, 0) / count) : 0;
    const metaGlobal = filtered.reduce((s, v) => s + v.alvo, 0);
    return [
      { label: "Vendedores", value: String(count), icon: Users, color: "text-cockpit-accent" },
      { label: "Média Vol. Mensal", value: mediaVol.toLocaleString("pt-BR"), icon: TrendingUp, color: "text-blue-400" },
      { label: "Meta Global", value: metaGlobal.toLocaleString("pt-BR"), icon: Target, color: "text-yellow-400" },
    ];
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mapa de Vendedores</h1>
        <p className="text-cockpit-muted mt-1">
          Scorecard com métricas de performance — volume, positivações, prospecções.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedor..." aria-label="Buscar vendedor"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-cockpit-border bg-cockpit-bg p-1">
          {(["all", "above", "below"] as const).map((opt) => {
            const labels = { all: "Todos", above: "Meta batida", below: "Abaixo meta" };
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setAtingFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  atingFilter === opt
                    ? opt === "below" ? "bg-red-500/20 text-red-400"
                      : "bg-cockpit-accent/20 text-cockpit-accent"
                    : "text-cockpit-muted hover:text-white"
                }`}
              >
                {labels[opt]}
              </button>
            );
          })}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          aria-label="Ordenar por"
          className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
        >
          <option value="real">Ordenar: Volume</option>
          <option value="posit">Ordenar: Positivações</option>
          <option value="prosp">Ordenar: Prospecções</option>
          <option value="ticket">Ordenar: Ticket</option>
        </select>
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
          Performance Semestral ({filtered.length} vendedores)
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-cockpit-muted">
                    Nenhum vendedor encontrado para os filtros selecionados
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
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
                    <td className="py-3 pr-4 text-right text-cockpit-accent font-medium">{fmtBRL(v.ticket)}</td>
                    <td className="py-3 text-center">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">{v.metas}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Exibindo {filtered.length} de {ALL_VENDEDORES.length} vendedores — aba MAPA VENDEDORES
      </p>
    </div>
  );
}
