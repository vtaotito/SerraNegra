"use client";

import { FileText, Filter, Download } from "lucide-react";

const formasPgto = [
  "Cartão Crédito", "Cartão Débito", "Dinheiro", "Transf. Banco",
  "Transf. Bradesco", "Vale",
];

const grupos = ["Cliente Alcoólicos", "Cliente Alimentício", "Cliente Revendedor"];

const categorias = ["AR", "GF", "GI", "GN", "IS", "LA", "PO", "RO", "TA", "TMG", "TMP", "TP"];

const dados = [
  { doc: 448, data: "01/03/2023", cliente: "C00700", vendedor: "Matheus Henrique", item: "GN0000116", desc: "CACHAÇA OURO 670ML", qtd: 96, total: 371.75, pgto: "Cartão Crédito", cancelado: "Não" },
  { doc: 448, data: "01/03/2023", cliente: "C00700", vendedor: "Matheus Henrique", item: "TA0000010", desc: "TAMPA METÁLICA 28MM", qtd: 100, total: 50.00, pgto: "Cartão Crédito", cancelado: "Não" },
  { doc: 449, data: "01/03/2023", cliente: "C00527", vendedor: "Matheus Henrique", item: "GN0000116", desc: "CACHAÇA OURO 670ML", qtd: 120, total: 464.59, pgto: "Transf. Banco", cancelado: "Não" },
  { doc: 450, data: "02/03/2023", cliente: "C01200", vendedor: "Debora Silva", item: "GI0000010", desc: "GIN ARTESANAL 750ML", qtd: 24, total: 1200.00, pgto: "Transf. Banco", cancelado: "Não" },
  { doc: 451, data: "02/03/2023", cliente: "C00815", vendedor: "Alessandro Gomes", item: "AR00000003", desc: "GARRAFA ACOPLADA 300ML", qtd: 50, total: 275.00, pgto: "Dinheiro", cancelado: "Não" },
  { doc: 452, data: "03/03/2023", cliente: "C00340", vendedor: "Thiago Lopes", item: "GN0000050", desc: "CACHAÇA PREMIUM 700ML", qtd: 200, total: 3800.00, pgto: "Transf. Bradesco", cancelado: "Não" },
  { doc: 453, data: "03/03/2023", cliente: "C02100", vendedor: "Ana", item: "PO0000020", desc: "GELEIA ARTESANAL 250G", qtd: 150, total: 1125.00, pgto: "Cartão Débito", cancelado: "Não" },
  { doc: 454, data: "04/03/2023", cliente: "C00150", vendedor: "Tatiana Fernandes", item: "RO0000005", desc: "ROLHA CORTIÇA NATURAL", qtd: 1000, total: 450.00, pgto: "Vale", cancelado: "Não" },
  { doc: 455, data: "05/03/2023", cliente: "C01850", vendedor: "Isabela Batista", item: "LA0000003", desc: "LACRE TERMOENCOLHÍVEL", qtd: 5000, total: 350.00, pgto: "Dinheiro", cancelado: "Não" },
  { doc: 456, data: "05/03/2023", cliente: "C00700", vendedor: "Alef Santos", item: "GN0000116", desc: "CACHAÇA OURO 670ML", qtd: 48, total: 185.88, pgto: "Cartão Crédito", cancelado: "Sim" },
];

const totalQtd = dados.reduce((s, d) => s + d.qtd, 0);
const totalValor = dados.reduce((s, d) => s + d.total, 0);

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ComercialDadosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cockpit-accent" />
            Documentos / Vendas
          </h1>
          <p className="text-cockpit-muted mt-1">
            1M+ linhas — range Mar/2023 a Ago/2025 — 30 meses de histórico
          </p>
        </div>
        <button
          type="button"
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border text-sm text-cockpit-muted hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-cockpit-muted" />
          <span className="text-sm font-medium text-cockpit-muted">Filtros disponíveis</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-cockpit-accent/20 text-cockpit-accent">
            Mar 2023 — Ago 2025
          </span>
          {formasPgto.map((f) => (
            <span key={f} className="px-2.5 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-gray-400">
              {f}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs mt-2">
          {grupos.map((g) => (
            <span key={g} className="px-2.5 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-gray-400">
              {g}
            </span>
          ))}
          {categorias.slice(0, 6).map((c) => (
            <span key={c} className="px-2.5 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-gray-400 font-mono">
              {c}
            </span>
          ))}
          <span className="px-2.5 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-cockpit-muted">
            +{categorias.length - 6} categorias
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th className="text-left py-3 px-4">Nº doc</th>
                <th className="text-left py-3 px-4">Data</th>
                <th className="text-left py-3 px-4">Cliente</th>
                <th className="text-left py-3 px-4">Vendedor</th>
                <th className="text-left py-3 px-4">Item</th>
                <th className="text-left py-3 px-4">Descrição</th>
                <th className="text-right py-3 px-4">Qtd</th>
                <th className="text-right py-3 px-4">Total</th>
                <th className="text-left py-3 px-4">Forma pgto</th>
                <th className="text-center py-3 px-4">Canc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {dados.map((row, i) => (
                <tr
                  key={i}
                  className={`hover:bg-white/5 ${row.cancelado === "Sim" ? "opacity-50" : ""}`}
                >
                  <td className="py-3 px-4 text-gray-200 font-medium">{row.doc}</td>
                  <td className="py-3 px-4 text-gray-300">{row.data}</td>
                  <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.cliente}</td>
                  <td className="py-3 px-4 text-gray-300">{row.vendedor}</td>
                  <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.item}</td>
                  <td className="py-3 px-4 text-gray-300 max-w-[200px] truncate">{row.desc}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{row.qtd.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-4 text-right text-cockpit-accent font-medium">{fmt(row.total)}</td>
                  <td className="py-3 px-4 text-gray-400">{row.pgto}</td>
                  <td className="py-3 px-4 text-center">
                    {row.cancelado === "Sim" ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400">Sim</span>
                    ) : (
                      <span className="text-cockpit-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-cockpit-bg/60 text-white font-bold border-t border-cockpit-border">
                <td className="py-3 px-4" colSpan={6}>TOTAL (amostra)</td>
                <td className="py-3 px-4 text-right">{totalQtd.toLocaleString("pt-BR")}</td>
                <td className="py-3 px-4 text-right text-cockpit-accent">{fmt(totalValor)}</td>
                <td className="py-3 px-4" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted flex justify-between">
          <span>Amostra de 10 linhas — dados completos via API (1M+ registos na aba DADOS)</span>
          <span>Vendedores encontrados: Matheus Henrique, Debora Silva, Alessandro Gomes, Thiago Lopes, Ana, Tatiana Fernandes, Isabela Batista, Alef Santos</span>
        </div>
      </div>
    </div>
  );
}
