"use client";

import {
  Users,
  UserMinus,
  AlertTriangle,
  PieChart,
  Crown,
} from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });

const kpis = [
  { label: "Total Clientes", value: "4.642", icon: Users, color: "text-cockpit-accent" },
  { label: "Perdidos 90 dias", value: "2.368 (51%)", icon: UserMinus, color: "text-red-400" },
  { label: "Em Atenção 90 dias", value: "1.413 (30%)", icon: AlertTriangle, color: "text-yellow-400" },
  { label: "Clientes 80/20", value: "629 (13,5%)", icon: PieChart, color: "text-blue-400" },
  { label: "Clientes Gold", value: "154 (3,3%)", icon: Crown, color: "text-yellow-400" },
];

const ramos = [
  "Cachaça", "Cerveja", "Gin", "Licor", "Azeite", "Conserva",
  "Doce", "Geleia", "Kombucha", "Revenda", "Alimentício", "Destilado",
];

const top10 = [
  { cliente: "DISTRIBUIDORA ABC", ramo: "Cachaça", perfil: "GRANDE", fat: 285000, ticket: 12400, sku: 15 },
  { cliente: "BAR DO ZECA", ramo: "Cerveja", perfil: "GRANDE", fat: 198000, ticket: 9200, sku: 12 },
  { cliente: "EMPÓRIO SERRA", ramo: "Alimentício", perfil: "MÉDIO", fat: 156000, ticket: 7800, sku: 9 },
  { cliente: "ADEGA PREMIUM", ramo: "Gin", perfil: "GRANDE", fat: 142000, ticket: 11300, sku: 8 },
  { cliente: "MERCADO CENTRAL", ramo: "Revenda", perfil: "MÉDIO", fat: 128000, ticket: 6400, sku: 11 },
];

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <p className="text-cockpit-muted mt-1">
          Análise de base de clientes — faturamento, concentração 80/20, clientes em risco.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
        <h2 className="text-lg font-semibold text-white mb-4">Ramos de Atuação</h2>
        <div className="flex flex-wrap gap-2">
          {ramos.map((r) => (
            <span
              key={r}
              className="rounded-full border border-cockpit-border bg-white/5 px-3 py-1 text-xs text-cockpit-muted"
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Top 10 Clientes (Fat. 90 dias)
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
              {top10.map((row, i) => (
                <tr key={row.cliente} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 text-cockpit-muted">{i + 1}</td>
                  <td className="py-3 pr-4 font-medium text-white">{row.cliente}</td>
                  <td className="py-3 pr-4 text-cockpit-muted">{row.ramo}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">
                      {row.perfil}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-cockpit-accent font-medium">
                    {fmt(row.fat)}
                  </td>
                  <td className="py-3 pr-4 text-right text-white">{fmt(row.ticket)}</td>
                  <td className="py-3 text-right text-white">{row.sku}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Dados: aba CARTEIRA GERAL + CLIENTE — 4.642 clientes analisados
      </p>
    </div>
  );
}
