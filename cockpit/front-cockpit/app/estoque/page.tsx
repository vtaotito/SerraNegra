"use client";

import { Package, Boxes, BadgeDollarSign, AlertTriangle } from "lucide-react";

type Status = "OK" | "ABAIXO" | "RUPTURA";

interface ItemEstoque {
  cod: string;
  item: string;
  descricao: string;
  estoque: number;
  disp: number;
  min: number;
  und: string;
  status: Status;
}

const itens: ItemEstoque[] = [
  { cod: "AR", item: "AR00000001", descricao: "BARRICA 3,5 LITROS TRA COM TORNEIRA", estoque: 68, disp: 68, min: 30, und: "UN", status: "OK" },
  { cod: "AR", item: "AR00000002", descricao: "COPINHO 100 ML CAVEIRA - UND", estoque: 273, disp: 273, min: 20, und: "UN", status: "OK" },
  { cod: "AR", item: "AR00000003", descricao: "GARRAFA ACOPLADA 300 ML TRA ROLHA.CORTIÇA", estoque: 120, disp: 120, min: 30, und: "UN", status: "OK" },
  { cod: "AR", item: "AR00000004", descricao: "GARRAFA ARTESANAL 160 ML ROLHA CORTIÇA UND", estoque: 134, disp: 134, min: 50, und: "UN", status: "OK" },
  { cod: "AR", item: "AR00000005", descricao: "GARRAFA ARTESANAL 250 ML COM ROLHA CORTIÇA", estoque: 15, disp: 15, min: 30, und: "UN", status: "ABAIXO" },
  { cod: "GN", item: "GN0000050", descricao: "CACHAÇA PREMIUM 700ML", estoque: 0, disp: -5, min: 10, und: "UN", status: "RUPTURA" },
  { cod: "GN", item: "GN0000116", descricao: "CACHAÇA OURO 670ML", estoque: 450, disp: 450, min: 100, und: "UN", status: "OK" },
  { cod: "GI", item: "GI0000010", descricao: "GIN ARTESANAL 750ML", estoque: 8, disp: 8, min: 20, und: "UN", status: "ABAIXO" },
  { cod: "TA", item: "TA0000010", descricao: "TAMPA METÁLICA 28MM", estoque: 200000, disp: 200000, min: 100000, und: "UN", status: "OK" },
  { cod: "RO", item: "RO0000005", descricao: "ROLHA CORTIÇA NATURAL 45X24", estoque: 3500, disp: -250, min: 5000, und: "UN", status: "RUPTURA" },
];

const alertas = itens.filter((i) => i.status !== "OK").length;

const statusStyles: Record<Status, { bg: string; text: string }> = {
  OK: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  ABAIXO: { bg: "bg-amber-500/15", text: "text-amber-400" },
  RUPTURA: { bg: "bg-red-500/15", text: "text-red-400" },
};

function fmtNum(v: number) {
  return v.toLocaleString("pt-BR");
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

const kpis = [
  { label: "Total Itens", value: "833", icon: Package, color: "text-cockpit-muted" },
  { label: "Estoque Total", value: `${fmtNum(3284445)} un`, icon: Boxes, color: "text-sky-400" },
  { label: "Valor Estoque (CMV)", value: fmtBRL(7012707), icon: BadgeDollarSign, color: "text-cockpit-accent" },
  { label: "Itens em Alerta", value: String(alertas), icon: AlertTriangle, color: "text-red-400" },
];

export default function EstoquePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Estoque</h1>
        <p className="text-cockpit-muted mt-1">
          Posição por item — disponível, mínimo, unidade. Fonte: aba ESTOQUE do Excel.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-xs text-cockpit-muted uppercase tracking-wide">{k.label}</span>
            </div>
            <span className="text-xl font-bold text-white">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-cockpit-muted">OK — estoque normal</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-cockpit-muted">ABAIXO — abaixo do mínimo</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-cockpit-muted">RUPTURA — sem disponibilidade</span>
        </span>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th className="text-left py-3 px-4">COD</th>
                <th className="text-left py-3 px-4">Nº do Item</th>
                <th className="text-left py-3 px-4">Descrição</th>
                <th className="text-right py-3 px-4">Em Estoque</th>
                <th className="text-right py-3 px-4">Disponível</th>
                <th className="text-right py-3 px-4">Mínimo</th>
                <th className="text-left py-3 px-4">Und</th>
                <th className="text-center py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {itens.map((row) => {
                const st = statusStyles[row.status];
                return (
                  <tr
                    key={row.item}
                    className={`hover:bg-white/5 ${
                      row.status === "RUPTURA" ? "bg-red-500/5" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-gray-200 font-medium">{row.cod}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.item}</td>
                    <td className="py-3 px-4 text-gray-300">{row.descricao}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{fmtNum(row.estoque)}</td>
                    <td
                      className={`py-3 px-4 text-right font-medium ${
                        row.disp <= 0 ? "text-red-400" : "text-gray-300"
                      }`}
                    >
                      {fmtNum(row.disp)}
                    </td>
                    <td className="py-3 px-4 text-right text-cockpit-muted">{fmtNum(row.min)}</td>
                    <td className="py-3 px-4 text-gray-400">{row.und}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          Dados reais — aba ESTOQUE do Excel (833 itens totais)
        </div>
      </div>
    </div>
  );
}
