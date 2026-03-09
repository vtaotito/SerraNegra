"use client";

import { useState, useMemo, useCallback } from "react";
import { FileText, Filter, Download, Search, X, CalendarDays } from "lucide-react";
import { fmtBRL, exportCSV } from "@/lib/format";
import { useDateRange } from "@/contexts/DateRangeContext";

const formasPgto = [
  "Cartão Crédito", "Cartão Débito", "Dinheiro", "Transf. Banco",
  "Transf. Bradesco", "Vale",
];

const ALL_DADOS = [
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

const VENDEDORES = [...new Set(ALL_DADOS.map((d) => d.vendedor))].sort();

export default function ComercialDadosPage() {
  const { isInRange, label: periodoLabel } = useDateRange();
  const [search, setSearch] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState("ALL");
  const [pgtoFilter, setPgtoFilter] = useState("ALL");
  const [canceladoFilter, setCanceladoFilter] = useState<"ALL" | "Não" | "Sim">("ALL");

  const filtered = useMemo(() => {
    return ALL_DADOS.filter((row) => {
      if (!isInRange(row.data)) return false;
      const q = search.toLowerCase();
      const matchSearch = row.cliente.toLowerCase().includes(q) || row.item.toLowerCase().includes(q) ||
        row.desc.toLowerCase().includes(q) || row.vendedor.toLowerCase().includes(q) || String(row.doc).includes(q);
      const matchVendedor = vendedorFilter === "ALL" || row.vendedor === vendedorFilter;
      const matchPgto = pgtoFilter === "ALL" || row.pgto === pgtoFilter;
      const matchCanc = canceladoFilter === "ALL" || row.cancelado === canceladoFilter;
      return matchSearch && matchVendedor && matchPgto && matchCanc;
    });
  }, [search, vendedorFilter, pgtoFilter, canceladoFilter, isInRange]);

  const totalQtd = useMemo(() => filtered.reduce((s, d) => s + d.qtd, 0), [filtered]);
  const totalValor = useMemo(() => filtered.reduce((s, d) => s + d.total, 0), [filtered]);
  const hasFilters = search || vendedorFilter !== "ALL" || pgtoFilter !== "ALL" || canceladoFilter !== "ALL";

  const clearFilters = useCallback(() => {
    setSearch(""); setVendedorFilter("ALL"); setPgtoFilter("ALL"); setCanceladoFilter("ALL");
  }, []);

  const handleExport = useCallback(() => {
    exportCSV(
      filtered.map((r) => ({
        "Nº Doc": r.doc, Data: r.data, Cliente: r.cliente, Vendedor: r.vendedor,
        Item: r.item, "Descrição": r.desc, Quantidade: r.qtd,
        "Total (R$)": r.total.toFixed(2), "Forma Pgto": r.pgto, Cancelado: r.cancelado,
      })),
      `documentos-vendas-${new Date().toISOString().slice(0, 10)}`
    );
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cockpit-accent" />
            Documentos / Vendas
          </h1>
          <p className="text-cockpit-muted mt-1 flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Período: <span className="text-gray-300">{periodoLabel}</span></span>
            <span className="text-cockpit-border">·</span>
            <span>1M+ linhas de histórico</span>
          </p>
        </div>
        <button type="button" onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border text-sm text-cockpit-muted hover:text-white hover:border-cockpit-accent/40 transition-colors"
          aria-label="Exportar dados filtrados em CSV"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </button>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cockpit-muted" />
            <span className="text-sm font-medium text-cockpit-muted">Filtros</span>
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-cockpit-muted hover:text-white transition-colors"
              aria-label="Limpar todos os filtros"
            ><X className="w-3 h-3" /> Limpar</button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar doc, cliente, item, vendedor..."
              aria-label="Busca por documento, cliente, item ou vendedor"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
          </div>
          <select value={vendedorFilter} onChange={(e) => setVendedorFilter(e.target.value)}
            aria-label="Filtrar por vendedor"
            className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50">
            <option value="ALL">Todos vendedores</option>
            {VENDEDORES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={pgtoFilter} onChange={(e) => setPgtoFilter(e.target.value)}
            aria-label="Filtrar por forma de pagamento"
            className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50">
            <option value="ALL">Todas formas pgto</option>
            {formasPgto.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Filtrar por status">
            {(["ALL", "Não", "Sim"] as const).map((opt) => {
              const labels = { ALL: "Todos", Não: "Ativos", Sim: "Cancelados" };
              return (
                <button key={opt} type="button" onClick={() => setCanceladoFilter(opt)}
                  aria-pressed={canceladoFilter === opt}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    canceladoFilter === opt
                      ? opt === "Sim" ? "bg-red-500/20 text-red-400" : "bg-cockpit-accent/20 text-cockpit-accent"
                      : "text-cockpit-muted hover:text-white"
                  }`}>{labels[opt]}</button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Totalizadores">
        {[
          { label: "Documentos", value: String(filtered.length) },
          { label: "Qtd Total", value: totalQtd.toLocaleString("pt-BR") },
          { label: "Valor Total", value: fmtBRL(totalValor, 2), accent: true },
          { label: "Ticket Médio", value: filtered.length > 0 ? fmtBRL(totalValor / filtered.length, 2) : "—" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors">
            <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.accent ? "text-cockpit-accent" : "text-white"}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th scope="col" className="text-left py-3 px-4">Nº doc</th>
                <th scope="col" className="text-left py-3 px-4">Data</th>
                <th scope="col" className="text-left py-3 px-4">Cliente</th>
                <th scope="col" className="text-left py-3 px-4">Vendedor</th>
                <th scope="col" className="text-left py-3 px-4">Item</th>
                <th scope="col" className="text-left py-3 px-4">Descrição</th>
                <th scope="col" className="text-right py-3 px-4">Qtd</th>
                <th scope="col" className="text-right py-3 px-4">Total</th>
                <th scope="col" className="text-left py-3 px-4">Forma pgto</th>
                <th scope="col" className="text-center py-3 px-4">Canc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-8 text-center text-cockpit-muted">Nenhum documento no período selecionado</td></tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={`${row.doc}-${row.item}-${i}`}
                    className={`hover:bg-white/5 ${row.cancelado === "Sim" ? "opacity-50" : ""}`}>
                    <td className="py-3 px-4 text-gray-200 font-medium">{row.doc}</td>
                    <td className="py-3 px-4 text-gray-300">{row.data}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.cliente}</td>
                    <td className="py-3 px-4 text-gray-300">{row.vendedor}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.item}</td>
                    <td className="py-3 px-4 text-gray-300 max-w-[200px] truncate">{row.desc}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{row.qtd.toLocaleString("pt-BR")}</td>
                    <td className="py-3 px-4 text-right text-cockpit-accent font-medium">{fmtBRL(row.total, 2)}</td>
                    <td className="py-3 px-4 text-gray-400">{row.pgto}</td>
                    <td className="py-3 px-4 text-center">
                      {row.cancelado === "Sim"
                        ? <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400">Sim</span>
                        : <span className="text-cockpit-muted">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-cockpit-bg/60 text-white font-bold border-t border-cockpit-border">
                  <td className="py-3 px-4" colSpan={6}>TOTAL ({filtered.length} linhas)</td>
                  <td className="py-3 px-4 text-right">{totalQtd.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-4 text-right text-cockpit-accent">{fmtBRL(totalValor, 2)}</td>
                  <td className="py-3 px-4" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          {filtered.length} de {ALL_DADOS.length} linhas (amostra) — dados completos via SAP B1 /Invoices
        </div>
      </div>
    </div>
  );
}
