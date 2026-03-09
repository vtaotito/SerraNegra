"use client";

import { useState, useMemo } from "react";
import {
  DollarSign, Users, TrendingUp, Star, AlertCircle,
  Truck, PackageX, CreditCard, Search, ChevronDown, ChevronUp,
} from "lucide-react";
import { fmtBRL } from "@/lib/format";

const ALL_INDICADORES = [
  { indicador: "Total Clientes Ativos", valor: 4642, evolucao: null, danger: false, cat: "clientes" },
  { indicador: "Clientes Perdidos 90d", valor: 2368, evolucao: 51, danger: true, cat: "clientes" },
  { indicador: "Média Positivações", valor: 904.67, evolucao: null, danger: false, cat: "vendas" },
  { indicador: "Média Fat. 90 Dias", valor: 7521452, evolucao: null, danger: false, cat: "vendas" },
  { indicador: "Média SKU/Cliente", valor: 7.89, evolucao: null, danger: false, cat: "clientes" },
  { indicador: "Ticket Médio 80/20", valor: 8860.74, evolucao: null, danger: false, cat: "vendas" },
  { indicador: "CMV Total Estoque", valor: 7012707, evolucao: null, danger: false, cat: "estoque" },
  { indicador: "Itens em Ruptura", valor: 2, evolucao: null, danger: true, cat: "estoque" },
];

const observacoes = [
  { icon: Truck, text: "Logística: atrasos na entrega região Norte", severity: "warning" as const },
  { icon: PackageX, text: "Ruptura de estoque: itens GN abaixo do mínimo", severity: "danger" as const },
  { icon: CreditCard, text: "Política de crédito: 3 clientes com inadimplência > 60 dias", severity: "danger" as const },
];

type Cat = "all" | "clientes" | "vendas" | "estoque";

export default function ResumoPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Cat>("all");
  const [obsExpanded, setObsExpanded] = useState(true);

  const filtered = useMemo(() => {
    return ALL_INDICADORES.filter((i) => {
      const matchSearch = i.indicador.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "all" || i.cat === catFilter;
      return matchSearch && matchCat;
    });
  }, [search, catFilter]);

  const kpis = useMemo(() => {
    const totalClientes = filtered.find((i) => i.indicador.includes("Total Clientes"))?.valor ?? 4642;
    const cmv = filtered.find((i) => i.indicador.includes("CMV"))?.valor ?? 7012707;
    const fatMes = filtered.find((i) => i.indicador.includes("Média Fat"))?.valor ?? 7521452;
    const ticket = filtered.find((i) => i.indicador.includes("Ticket"))?.valor ?? 8860.74;
    return [
      { label: "Custo Estoque CMV", value: fmtBRL(cmv), icon: DollarSign, color: "text-cockpit-accent" },
      { label: "Total Clientes", value: totalClientes.toLocaleString("pt-BR"), icon: Users, color: "text-blue-400" },
      { label: "Média Fat. 90d", value: fmtBRL(fatMes), icon: TrendingUp, color: "text-amber-400" },
      { label: "Ticket 80/20", value: fmtBRL(ticket, 2), icon: Star, color: "text-purple-400" },
    ];
  }, [filtered]);

  const dangerCount = filtered.filter((i) => i.danger).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Resumo Comercial</h1>
        <p className="text-cockpit-muted mt-1">Reconciliação e indicadores consolidados — estoque, custo, evolução.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar indicador..."
            aria-label="Buscar indicador"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
        </div>
        <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Filtrar por categoria">
          {(["all", "clientes", "vendas", "estoque"] as const).map((opt) => {
            const labels = { all: "Todos", clientes: "Clientes", vendas: "Vendas", estoque: "Estoque" };
            return (
              <button key={opt} type="button" onClick={() => setCatFilter(opt)}
                aria-pressed={catFilter === opt}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  catFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent" : "text-cockpit-muted hover:text-white"
                }`}>{labels[opt]}</button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="KPIs resumo">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 hover:border-cockpit-accent/30 transition-colors flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Indicadores Consolidados ({filtered.length})
          </h2>
          {dangerCount > 0 && (
            <span className="text-xs bg-cockpit-danger/20 text-cockpit-danger px-2 py-0.5 rounded-full">
              {dangerCount} alerta{dangerCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted">
                <th scope="col" className="py-3 pr-4">Indicador</th>
                <th scope="col" className="py-3 pr-4">Categoria</th>
                <th scope="col" className="py-3 pr-4 text-right">Valor</th>
                <th scope="col" className="py-3 text-right">Evolução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-cockpit-muted">Nenhum indicador encontrado</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.indicador} className={`hover:bg-white/5 transition-colors ${row.danger ? "bg-cockpit-danger/5" : ""}`}>
                    <td className="py-3 pr-4 font-medium text-white">{row.indicador}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-cockpit-muted capitalize">{row.cat}</span>
                    </td>
                    <td className="py-3 pr-4 text-right text-white font-medium">
                      {row.valor > 10000 ? fmtBRL(row.valor) : row.valor.toLocaleString("pt-BR")}
                    </td>
                    <td className={`py-3 text-right font-medium ${row.danger ? "text-red-400" : "text-cockpit-muted"}`}>
                      {row.evolucao !== null ? `${row.evolucao}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setObsExpanded(!obsExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
          aria-expanded={obsExpanded}
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            Observações Operacionais ({observacoes.length})
          </h2>
          {obsExpanded ? <ChevronUp className="w-5 h-5 text-cockpit-muted" /> : <ChevronDown className="w-5 h-5 text-cockpit-muted" />}
        </button>
        {obsExpanded && (
          <ul className="px-6 pb-6 space-y-3">
            {observacoes.map((obs) => (
              <li key={obs.text} className={`flex items-start gap-3 rounded-lg p-3 border ${
                obs.severity === "danger" ? "border-cockpit-danger/30 bg-cockpit-danger/5" : "border-cockpit-gold/30 bg-cockpit-gold/5"
              }`}>
                <obs.icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                  obs.severity === "danger" ? "text-cockpit-danger" : "text-cockpit-gold"
                }`} />
                <span className="text-sm text-gray-300">{obs.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        {filtered.length} de {ALL_INDICADORES.length} indicadores — aba RESUMO COMERCIAL
      </p>
    </div>
  );
}
