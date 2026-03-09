"use client";

import { useState, useMemo, useCallback } from "react";
import { FileText, Filter, Download, Search, X, CalendarDays } from "lucide-react";
import { fmtBRL, exportCSV } from "@/lib/format";
import { fetchInvoices, type SapInvoice } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format } from "date-fns";

interface DocRow {
  doc: number;
  data: string;
  cliente: string;
  clienteNome: string;
  vendedorCode: number;
  item: string;
  desc: string;
  qtd: number;
  total: number;
  cancelado: boolean;
}

function flattenInvoices(invoices: SapInvoice[]): DocRow[] {
  const rows: DocRow[] = [];
  for (const inv of invoices) {
    const isCancelled = inv.Cancelled === "tYES";
    for (const line of inv.DocumentLines ?? []) {
      rows.push({
        doc: inv.DocNum,
        data: inv.DocDate,
        cliente: inv.CardCode,
        clienteNome: inv.CardName,
        vendedorCode: inv.SalesPersonCode,
        item: line.ItemCode,
        desc: line.ItemDescription,
        qtd: line.Quantity,
        total: line.LineTotal,
        cancelado: isCancelled,
      });
    }
  }
  return rows;
}

export default function ComercialDadosPage() {
  const { label: periodoLabel, range } = useDateRange();

  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: invoiceData, loading, error, refetch } = useFetch(
    () => fetchInvoices({ limit: 5000, dateFrom, dateTo }),
    [dateFrom, dateTo]
  );

  const allRows = useMemo(() => {
    if (!invoiceData?.items) return [];
    return flattenInvoices(invoiceData.items);
  }, [invoiceData]);

  const [search, setSearch] = useState("");
  const [canceladoFilter, setCanceladoFilter] = useState<"ALL" | "active" | "cancelled">("ALL");

  const vendedoresUnicos = useMemo(() =>
    [...new Set(allRows.map((r) => r.clienteNome))].sort(),
  [allRows]);
  const [clienteFilter, setClienteFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      const q = search.toLowerCase();
      const matchSearch = row.cliente.toLowerCase().includes(q) || row.clienteNome.toLowerCase().includes(q) ||
        row.item.toLowerCase().includes(q) || row.desc.toLowerCase().includes(q) || String(row.doc).includes(q);
      const matchCliente = clienteFilter === "ALL" || row.clienteNome === clienteFilter;
      const matchCanc = canceladoFilter === "ALL"
        ? true
        : canceladoFilter === "active" ? !row.cancelado : row.cancelado;
      return matchSearch && matchCliente && matchCanc;
    });
  }, [allRows, search, clienteFilter, canceladoFilter]);

  const totalQtd = useMemo(() => filtered.reduce((s, d) => s + d.qtd, 0), [filtered]);
  const totalValor = useMemo(() => filtered.reduce((s, d) => s + d.total, 0), [filtered]);
  const hasFilters = search || clienteFilter !== "ALL" || canceladoFilter !== "ALL";

  const clearFilters = useCallback(() => {
    setSearch(""); setClienteFilter("ALL"); setCanceladoFilter("ALL");
  }, []);

  const handleExport = useCallback(() => {
    exportCSV(
      filtered.map((r) => ({
        "Nº Doc": r.doc, Data: r.data, "Cód. Cliente": r.cliente, Cliente: r.clienteNome,
        Item: r.item, "Descrição": r.desc, Quantidade: r.qtd,
        "Total (R$)": r.total.toFixed(2), Cancelado: r.cancelado ? "Sim" : "Não",
      })),
      `documentos-vendas-${new Date().toISOString().slice(0, 10)}`
    );
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileText className="w-6 h-6 text-cockpit-accent" />Documentos / Vendas</h1><p className="text-cockpit-muted mt-1">Carregando notas fiscais do SAP B1...</p></div>
        <LoadingSkeleton rows={8} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileText className="w-6 h-6 text-cockpit-accent" />Documentos / Vendas</h1></div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

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
            <span>{invoiceData?.count ?? 0} notas fiscais · {allRows.length} linhas</span>
          </p>
        </div>
        <button type="button" onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border text-sm text-cockpit-muted hover:text-white hover:border-cockpit-accent/40 transition-colors"
          aria-label="Exportar dados filtrados em CSV">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </button>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-cockpit-muted" /><span className="text-sm font-medium text-cockpit-muted">Filtros</span></div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-cockpit-muted hover:text-white transition-colors" aria-label="Limpar filtros"><X className="w-3 h-3" /> Limpar</button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar doc, cliente, item..." aria-label="Busca"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
          </div>
          {vendedoresUnicos.length > 1 && (
            <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} aria-label="Filtrar por cliente"
              className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 max-w-[200px]">
              <option value="ALL">Todos clientes</option>
              {vendedoresUnicos.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Status">
            {(["ALL", "active", "cancelled"] as const).map((opt) => {
              const labels = { ALL: "Todos", active: "Ativos", cancelled: "Cancelados" };
              return (
                <button key={opt} type="button" onClick={() => setCanceladoFilter(opt)}
                  aria-pressed={canceladoFilter === opt}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    canceladoFilter === opt
                      ? opt === "cancelled" ? "bg-red-500/20 text-red-400" : "bg-cockpit-accent/20 text-cockpit-accent"
                      : "text-cockpit-muted hover:text-white"
                  }`}>{labels[opt]}</button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Totalizadores">
        {[
          { label: "Documentos", value: String(new Set(filtered.map((r) => r.doc)).size) },
          { label: "Linhas", value: filtered.length.toLocaleString("pt-BR") },
          { label: "Valor Total", value: fmtBRL(totalValor, 2), accent: true },
          { label: "Ticket Médio", value: filtered.length > 0 ? fmtBRL(totalValor / new Set(filtered.map((r) => r.doc)).size, 2) : "—" },
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
                <th scope="col" className="text-left py-3 px-4">Item</th>
                <th scope="col" className="text-left py-3 px-4">Descrição</th>
                <th scope="col" className="text-right py-3 px-4">Qtd</th>
                <th scope="col" className="text-right py-3 px-4">Total</th>
                <th scope="col" className="text-center py-3 px-4">Canc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-cockpit-muted">Nenhum documento no período</td></tr>
              ) : (
                filtered.slice(0, 200).map((row, i) => (
                  <tr key={`${row.doc}-${row.item}-${i}`} className={`hover:bg-white/5 ${row.cancelado ? "opacity-50" : ""}`}>
                    <td className="py-3 px-4 text-gray-200 font-medium">{row.doc}</td>
                    <td className="py-3 px-4 text-gray-300">{row.data}</td>
                    <td className="py-3 px-4 text-gray-300 max-w-[160px] truncate" title={row.clienteNome}>{row.clienteNome}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.item}</td>
                    <td className="py-3 px-4 text-gray-300 max-w-[200px] truncate">{row.desc}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{row.qtd.toLocaleString("pt-BR")}</td>
                    <td className="py-3 px-4 text-right text-cockpit-accent font-medium">{fmtBRL(row.total, 2)}</td>
                    <td className="py-3 px-4 text-center">
                      {row.cancelado
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
                  <td className="py-3 px-4" colSpan={5}>TOTAL ({filtered.length} linhas)</td>
                  <td className="py-3 px-4 text-right">{totalQtd.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-4 text-right text-cockpit-accent">{fmtBRL(totalValor, 2)}</td>
                  <td className="py-3 px-4" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          {filtered.length > 200 ? `Exibindo 200 de ${filtered.length} linhas` : `${filtered.length} linhas`} — dados SAP B1 /Invoices
        </div>
      </div>
    </div>
  );
}
