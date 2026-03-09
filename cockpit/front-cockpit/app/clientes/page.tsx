"use client";

import { useState, useMemo } from "react";
import { Users, UserMinus, AlertTriangle, PieChart, Crown, Search } from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const ramos = [
  "Cachaça", "Cerveja", "Gin", "Licor", "Azeite", "Conserva",
  "Doce", "Geleia", "Kombucha", "Revenda", "Alimentício", "Destilado",
];

const ALL_CLIENTES = [
  { cliente: "DISTRIBUIDORA ABC", ramo: "Cachaça", perfil: "GRANDE" as const, fat: 285000, ticket: 12400, sku: 15 },
  { cliente: "BAR DO ZECA", ramo: "Cerveja", perfil: "GRANDE" as const, fat: 198000, ticket: 9200, sku: 12 },
  { cliente: "EMPÓRIO SERRA", ramo: "Alimentício", perfil: "MÉDIO" as const, fat: 156000, ticket: 7800, sku: 9 },
  { cliente: "ADEGA PREMIUM", ramo: "Gin", perfil: "GRANDE" as const, fat: 142000, ticket: 11300, sku: 8 },
  { cliente: "MERCADO CENTRAL", ramo: "Revenda", perfil: "MÉDIO" as const, fat: 128000, ticket: 6400, sku: 11 },
  { cliente: "CASA DO DESTILADO", ramo: "Destilado", perfil: "GRANDE" as const, fat: 115000, ticket: 9580, sku: 7 },
  { cliente: "PADARIA DELÍCIA", ramo: "Alimentício", perfil: "PEQUENO" as const, fat: 89000, ticket: 4450, sku: 6 },
  { cliente: "BAR TROPICAL", ramo: "Cerveja", perfil: "MÉDIO" as const, fat: 78000, ticket: 5200, sku: 10 },
  { cliente: "LICORES FINOS", ramo: "Licor", perfil: "MÉDIO" as const, fat: 72000, ticket: 7200, sku: 5 },
  { cliente: "DOCES DA SERRA", ramo: "Doce", perfil: "PEQUENO" as const, fat: 45000, ticket: 3000, sku: 4 },
];

type Perfil = "GRANDE" | "MÉDIO" | "PEQUENO";

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [ramoFilter, setRamoFilter] = useState<string>("ALL");
  const [perfilFilter, setPerfilFilter] = useState<Perfil | "ALL">("ALL");

  const filtered = useMemo(() => {
    return ALL_CLIENTES.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = c.cliente.toLowerCase().includes(q) || c.ramo.toLowerCase().includes(q);
      const matchRamo = ramoFilter === "ALL" || c.ramo === ramoFilter;
      const matchPerfil = perfilFilter === "ALL" || c.perfil === perfilFilter;
      return matchSearch && matchRamo && matchPerfil;
    });
  }, [search, ramoFilter, perfilFilter]);

  const kpis = useMemo(() => {
    const totalFat = filtered.reduce((s, c) => s + c.fat, 0);
    const avgTicket = filtered.length > 0 ? totalFat / filtered.length : 0;
    const avgSku = filtered.length > 0 ? filtered.reduce((s, c) => s + c.sku, 0) / filtered.length : 0;
    const grandes = filtered.filter((c) => c.perfil === "GRANDE").length;
    return [
      { label: "Clientes Exibidos", value: String(filtered.length), icon: Users, color: "text-cockpit-accent" },
      { label: "Fat. Total", value: fmt(totalFat), icon: PieChart, color: "text-blue-400" },
      { label: "Ticket Médio", value: fmt(avgTicket), icon: Crown, color: "text-yellow-400" },
      { label: "Perfil Grande", value: String(grandes), icon: UserMinus, color: "text-emerald-400" },
      { label: "Média SKU", value: avgSku.toFixed(1), icon: AlertTriangle, color: "text-purple-400" },
    ];
  }, [filtered]);

  const ramosUsados = useMemo(() => {
    const set = new Set(filtered.map((c) => c.ramo));
    return ramos.filter((r) => set.has(r));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <p className="text-cockpit-muted mt-1">
          Análise de base de clientes — faturamento, concentração 80/20, clientes em risco.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou ramo..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
          />
        </div>
        <select
          value={ramoFilter}
          onChange={(e) => setRamoFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
        >
          <option value="ALL">Todos os ramos</option>
          {ramos.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex gap-1 rounded-lg border border-cockpit-border bg-cockpit-bg p-1">
          {(["ALL", "GRANDE", "MÉDIO", "PEQUENO"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPerfilFilter(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                perfilFilter === opt
                  ? "bg-cockpit-accent/20 text-cockpit-accent"
                  : "text-cockpit-muted hover:text-white"
              }`}
            >
              {opt === "ALL" ? "Todos" : opt}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
        <h2 className="text-lg font-semibold text-white mb-4">Ramos de Atuação ({ramosUsados.length})</h2>
        <div className="flex flex-wrap gap-2">
          {ramos.map((r) => {
            const active = ramosUsados.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRamoFilter(ramoFilter === r ? "ALL" : r)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  ramoFilter === r
                    ? "border-cockpit-accent bg-cockpit-accent/20 text-cockpit-accent"
                    : active
                    ? "border-cockpit-border bg-white/5 text-white hover:border-cockpit-accent/50"
                    : "border-cockpit-border bg-white/5 text-cockpit-muted opacity-50"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Top Clientes ({filtered.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted">
                <th className="py-3 pr-4">#</th>
                <th className="py-3 pr-4">Cliente</th>
                <th className="py-3 pr-4">Ramo</th>
                <th className="py-3 pr-4">Perfil</th>
                <th className="py-3 pr-4 text-right">Fat. 90d</th>
                <th className="py-3 pr-4 text-right">Ticket</th>
                <th className="py-3 text-right">SKU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-cockpit-muted">
                    Nenhum cliente encontrado para os filtros selecionados
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={row.cliente} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 text-cockpit-muted">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium text-white">{row.cliente}</td>
                    <td className="py-3 pr-4 text-cockpit-muted">{row.ramo}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        row.perfil === "GRANDE" ? "bg-emerald-500/20 text-emerald-400"
                        : row.perfil === "MÉDIO" ? "bg-blue-500/20 text-blue-400"
                        : "bg-white/10 text-white"
                      }`}>
                        {row.perfil}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-cockpit-accent font-medium">{fmt(row.fat)}</td>
                    <td className="py-3 pr-4 text-right text-white">{fmt(row.ticket)}</td>
                    <td className="py-3 text-right text-white">{row.sku}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Exibindo {filtered.length} de {ALL_CLIENTES.length} clientes (amostra) — 4.642 clientes totais
      </p>
    </div>
  );
}
