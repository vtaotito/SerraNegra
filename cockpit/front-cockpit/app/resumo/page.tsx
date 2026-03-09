"use client";

import {
  DollarSign,
  Users,
  TrendingUp,
  Star,
  AlertCircle,
  Truck,
  PackageX,
  CreditCard,
} from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });

const kpis = [
  { label: "Custo Estoque CMV", value: fmt(7012707), icon: DollarSign, color: "text-cockpit-accent" },
  { label: "Total Clientes", value: "4.642", icon: Users, color: "text-blue-400" },
  { label: "Média Fat./Mês", value: fmt(2507151), icon: TrendingUp, color: "text-yellow-400" },
  { label: "Ticket Médio 80/20", value: fmt(8861), icon: Star, color: "text-purple-400" },
];

const indicadores = [
  { indicador: "Total Clientes Ativos", valor: "4.642", evolucao: "—", danger: false },
  { indicador: "Clientes Perdidos 90d", valor: "2.368", evolucao: "51%", danger: true },
  { indicador: "Média Positivações", valor: "904,67", evolucao: "—", danger: false },
  { indicador: "Média Fat. 90 Dias", valor: fmt(7521452), evolucao: "—", danger: false },
  { indicador: "Média SKU/Cliente", valor: "7,89", evolucao: "—", danger: false },
  { indicador: "Ticket Médio 80/20", valor: "R$ 8.860,74", evolucao: "—", danger: false },
];

const observacoes = [
  { icon: Truck, text: "Logística: atrasos na entrega região Norte" },
  { icon: PackageX, text: "Ruptura de estoque: itens GN abaixo do mínimo" },
  { icon: CreditCard, text: "Política de crédito: 3 clientes com inadimplência > 60 dias" },
];

export default function ResumoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Resumo Comercial</h1>
        <p className="text-cockpit-muted mt-1">
          Reconciliação e indicadores consolidados — estoque, custo, evolução.
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
          Indicadores Consolidados
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted">
                <th className="py-3 pr-4">Indicador</th>
                <th className="py-3 pr-4 text-right">Valor</th>
                <th className="py-3 text-right">Evolução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {indicadores.map((row) => (
                <tr key={row.indicador} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 font-medium text-white">{row.indicador}</td>
                  <td className="py-3 pr-4 text-right text-white">{row.valor}</td>
                  <td className={`py-3 text-right font-medium ${row.danger ? "text-red-400" : "text-cockpit-muted"}`}>
                    {row.evolucao}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          Observações Operacionais
        </h2>
        <ul className="space-y-3">
          {observacoes.map((obs) => (
            <li key={obs.text} className="flex items-start gap-3">
              <obs.icon className="h-4 w-4 mt-0.5 text-cockpit-muted shrink-0" />
              <span className="text-sm text-cockpit-muted">{obs.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-cockpit-muted text-center">
        Dados: aba RESUMO COMERCIAL — reconciliação DW vs Excel
      </p>
    </div>
  );
}
