"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FileText, Filter, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  Package, Hash,
} from "lucide-react";
import { fmtBRL, exportCSV } from "@/lib/format";
import { fetchInvoices, type SapInvoice, type SapInvoiceLine } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmtDate(raw: string): string {
  try {
    const d = raw.includes("T") ? parseISO(raw) : new Date(raw);
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return raw;
  }
}

interface GroupedDoc {
  docNum: number;
  data: string;
  cardCode: string;
  cardName: string;
  vendedorCode: number;
  docTotal: number;
  cancelado: boolean;
  lines: SapInvoiceLine[];
  totalItens: number;
  totalQtd: number;
  totalLinhas: number;
}

function groupInvoices(invoices: SapInvoice[]): GroupedDoc[] {
  return invoices.map((inv) => {
    const lines = inv.DocumentLines ?? [];
    return {
      docNum: inv.DocNum,
      data: inv.DocDate,
      cardCode: inv.CardCode,
      cardName: inv.CardName,
      vendedorCode: inv.SalesPersonCode,
      docTotal: inv.DocTotal,
      cancelado: inv.Cancelled === "tYES",
      lines,
      totalItens: lines.length,
      totalQtd: lines.reduce((s, l) => s + (l.Quantity ?? 0), 0),
      totalLinhas: lines.reduce((s, l) => s + (l.LineTotal ?? 0), 0),
    };
  });
}

const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}

function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-cockpit-border bg-cockpit-bg/30">
      {/* Info + page size selector */}
      <div className="flex items-center gap-3 text-xs text-cockpit-muted">
        <span>
          Exibindo{" "}
          <span className="font-semibold text-gray-200">{from}</span>–
          <span className="font-semibold text-gray-200">{to}</span>{" "}
          de <span className="font-semibold text-gray-200">{totalItems.toLocaleString("pt-BR")}</span> documentos
        </span>
        <span className="text-cockpit-border hidden sm:inline">|</span>
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-cockpit-accent/50 [color-scheme:dark]"
            aria-label="Itens por página"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span>por página</span>
        </div>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Paginação">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-md text-cockpit-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Primeira página"
            title="Primeira página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-md text-cockpit-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-0.5 mx-1">
            {pages.map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="w-8 text-center text-xs text-cockpit-muted select-none">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={currentPage === p ? "page" : undefined}
                  className={`min-w-[2rem] h-8 rounded-md text-xs font-medium transition-all ${
                    currentPage === p
                      ? "bg-cockpit-accent text-white shadow-md shadow-cockpit-accent/25"
                      : "text-cockpit-muted hover:text-white hover:bg-white/10"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-md text-cockpit-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Próxima página"
            title="Próxima página"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-md text-cockpit-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Última página"
            title="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

function DocDetailPanel({ lines }: { lines: SapInvoiceLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-cockpit-muted italic">
        Detalhamento de itens não disponível para esta nota fiscal.
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="rounded-lg border border-cockpit-border/60 bg-cockpit-bg/50 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cockpit-border/40 text-cockpit-muted uppercase tracking-wider">
              <th className="text-left py-2.5 px-4 font-semibold">#</th>
              <th className="text-left py-2.5 px-4 font-semibold">Código</th>
              <th className="text-left py-2.5 px-4 font-semibold">Descrição do Produto</th>
              <th className="text-right py-2.5 px-4 font-semibold">Qtd</th>
              <th className="text-right py-2.5 px-4 font-semibold">Preço Unit.</th>
              <th className="text-right py-2.5 px-4 font-semibold">Total Linha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cockpit-border/30">
            {lines.map((line, idx) => (
              <tr key={`${line.ItemCode}-${idx}`} className="hover:bg-white/[0.03]">
                <td className="py-2 px-4 text-cockpit-muted">{idx + 1}</td>
                <td className="py-2 px-4">
                  <span className="inline-flex items-center gap-1 font-mono text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded">
                    {line.ItemCode || "—"}
                  </span>
                </td>
                <td className="py-2 px-4 text-gray-300 max-w-[280px] truncate" title={line.ItemDescription}>
                  {line.ItemDescription || "—"}
                </td>
                <td className="py-2 px-4 text-right text-gray-200 font-medium">
                  {(line.Quantity ?? 0).toLocaleString("pt-BR")}
                </td>
                <td className="py-2 px-4 text-right text-gray-400">
                  {line.UnitPrice != null ? fmtBRL(line.UnitPrice, 2) : "—"}
                </td>
                <td className="py-2 px-4 text-right text-cockpit-accent font-medium">
                  {fmtBRL(line.LineTotal ?? 0, 2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-cockpit-border/50 bg-cockpit-bg/80 font-semibold text-white">
              <td className="py-2.5 px-4" colSpan={3}>Total ({lines.length} itens)</td>
              <td className="py-2.5 px-4 text-right">
                {lines.reduce((s, l) => s + (l.Quantity ?? 0), 0).toLocaleString("pt-BR")}
              </td>
              <td className="py-2.5 px-4" />
              <td className="py-2.5 px-4 text-right text-cockpit-accent">
                {fmtBRL(lines.reduce((s, l) => s + (l.LineTotal ?? 0), 0), 2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function ComercialDadosPage() {
  const { label: periodoLabel, range } = useDateRange();

  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: invoiceData, loading, error, refetch } = useFetch(
    () => fetchInvoices({ limit: 10000, dateFrom, dateTo }),
    [dateFrom, dateTo]
  );

  const allDocs = useMemo(() => {
    if (!invoiceData?.items) return [];
    return groupInvoices(invoiceData.items);
  }, [invoiceData]);

  const [search, setSearch] = useState("");
  const [canceladoFilter, setCanceladoFilter] = useState<"ALL" | "active" | "cancelled">("ALL");
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const clientesUnicos = useMemo(() =>
    [...new Set(allDocs.map((d) => d.cardName))].sort(),
  [allDocs]);
  const [clienteFilter, setClienteFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return allDocs.filter((doc) => {
      const q = search.toLowerCase();
      const lineMatch = doc.lines.some(
        (l) => (l.ItemCode ?? "").toLowerCase().includes(q) ||
               (l.ItemDescription ?? "").toLowerCase().includes(q)
      );
      const matchSearch = !q || doc.cardCode.toLowerCase().includes(q) ||
        doc.cardName.toLowerCase().includes(q) || String(doc.docNum).includes(q) || lineMatch;
      const matchCliente = clienteFilter === "ALL" || doc.cardName === clienteFilter;
      const matchCanc = canceladoFilter === "ALL"
        ? true
        : canceladoFilter === "active" ? !doc.cancelado : doc.cancelado;
      return matchSearch && matchCliente && matchCanc;
    });
  }, [allDocs, search, clienteFilter, canceladoFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedDocs(new Set());
  }, [search, clienteFilter, canceladoFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const safePage = Math.min(currentPage, totalPages);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedDocs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const totalQtd = useMemo(() => filtered.reduce((s, d) => s + d.totalQtd, 0), [filtered]);
  const totalValor = useMemo(() => filtered.reduce((s, d) => s + d.docTotal, 0), [filtered]);
  const totalLinhas = useMemo(() => filtered.reduce((s, d) => s + d.totalItens, 0), [filtered]);

  const pageQtd = useMemo(() => paginatedDocs.reduce((s, d) => s + d.totalQtd, 0), [paginatedDocs]);
  const pageValor = useMemo(() => paginatedDocs.reduce((s, d) => s + d.docTotal, 0), [paginatedDocs]);
  const pageLinhas = useMemo(() => paginatedDocs.reduce((s, d) => s + d.totalItens, 0), [paginatedDocs]);

  const hasFilters = search || clienteFilter !== "ALL" || canceladoFilter !== "ALL";

  const toggleDoc = useCallback((docNum: number) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docNum)) next.delete(docNum);
      else next.add(docNum);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedDocs(new Set(paginatedDocs.map((d) => d.docNum)));
  }, [paginatedDocs]);

  const collapseAll = useCallback(() => {
    setExpandedDocs(new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setSearch(""); setClienteFilter("ALL"); setCanceladoFilter("ALL");
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setExpandedDocs(new Set());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setExpandedDocs(new Set());
  }, []);

  const handleExport = useCallback(() => {
    const rows: Record<string, string | number>[] = [];
    for (const doc of filtered) {
      if (doc.lines.length > 0) {
        for (const line of doc.lines) {
          rows.push({
            "Nº Doc": doc.docNum, Data: fmtDate(doc.data), "Cód. Cliente": doc.cardCode,
            Cliente: doc.cardName, "Cód. Item": line.ItemCode ?? "",
            "Descrição": line.ItemDescription ?? "", Quantidade: line.Quantity ?? 0,
            "Preço Unit.": (line.UnitPrice ?? 0).toFixed(2),
            "Total Linha (R$)": (line.LineTotal ?? 0).toFixed(2),
            "Total Doc (R$)": doc.docTotal.toFixed(2),
            Cancelado: doc.cancelado ? "Sim" : "Não",
          });
        }
      } else {
        rows.push({
          "Nº Doc": doc.docNum, Data: fmtDate(doc.data), "Cód. Cliente": doc.cardCode,
          Cliente: doc.cardName, "Cód. Item": "", "Descrição": "", Quantidade: "",
          "Preço Unit.": "", "Total Linha (R$)": "",
          "Total Doc (R$)": doc.docTotal.toFixed(2),
          Cancelado: doc.cancelado ? "Sim" : "Não",
        });
      }
    }
    exportCSV(rows, `documentos-vendas-${new Date().toISOString().slice(0, 10)}`);
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cockpit-accent" />Documentos / Vendas
          </h1>
          <p className="text-cockpit-muted mt-1">Carregando notas fiscais do SAP B1...</p>
        </div>
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cockpit-accent" />Documentos / Vendas
          </h1>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const anyExpanded = expandedDocs.size > 0;

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
            <span>{filtered.length} documentos · {totalLinhas} itens</span>
          </p>
        </div>
        <button type="button" onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border text-sm text-cockpit-muted hover:text-white hover:border-cockpit-accent/40 transition-colors"
          aria-label="Exportar dados filtrados em CSV">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cockpit-muted" />
            <span className="text-sm font-medium text-cockpit-muted">Filtros</span>
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-cockpit-muted hover:text-white transition-colors"
              aria-label="Limpar filtros">
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nº doc, cliente, item, código..."
              aria-label="Busca"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
          </div>
          {clientesUnicos.length > 1 && (
            <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)}
              aria-label="Filtrar por cliente"
              className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 max-w-[200px] [color-scheme:dark]">
              <option value="ALL">Todos clientes</option>
              {clientesUnicos.map((v) => <option key={v} value={v}>{v}</option>)}
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

      {/* KPIs - totais gerais filtrados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Totalizadores">
        {[
          { label: "Documentos", value: filtered.length.toLocaleString("pt-BR"), icon: FileText },
          { label: "Itens Vendidos", value: totalLinhas.toLocaleString("pt-BR"), icon: Package },
          { label: "Valor Total", value: fmtBRL(totalValor, 2), accent: true },
          { label: "Ticket Médio", value: filtered.length > 0 ? fmtBRL(totalValor / filtered.length, 2) : "—" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors">
            <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.accent ? "text-cockpit-accent" : "text-white"}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela agrupada com paginação */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-cockpit-border bg-cockpit-bg/50">
          <p className="text-xs text-cockpit-muted">
            Página <span className="text-gray-200 font-medium">{safePage}</span> de{" "}
            <span className="text-gray-200 font-medium">{totalPages}</span>
            <span className="hidden sm:inline"> — clique em uma linha para ver itens</span>
          </p>
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-1.5 sm:hidden">
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-cockpit-accent/50 [color-scheme:dark]"
                aria-label="Itens por página"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}/pag</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={anyExpanded ? collapseAll : expandAll}
              className="text-xs text-cockpit-muted hover:text-cockpit-accent transition-colors flex items-center gap-1">
              {anyExpanded ? (
                <><ChevronDown className="w-3 h-3" /> Recolher todos</>
              ) : (
                <><ChevronRight className="w-3 h-3" /> Expandir todos</>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th scope="col" className="w-8 py-3 px-2" />
                <th scope="col" className="text-left py-3 px-3">Nº Doc</th>
                <th scope="col" className="text-left py-3 px-3">Data</th>
                <th scope="col" className="text-left py-3 px-3">Cliente</th>
                <th scope="col" className="text-center py-3 px-3">Itens</th>
                <th scope="col" className="text-right py-3 px-3">Qtd Total</th>
                <th scope="col" className="text-right py-3 px-3">Valor Doc</th>
                <th scope="col" className="text-center py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-cockpit-muted">
                    Nenhum documento no período
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc) => {
                  const isExpanded = expandedDocs.has(doc.docNum);
                  return (
                    <InvoiceRow
                      key={doc.docNum}
                      doc={doc}
                      isExpanded={isExpanded}
                      onToggle={() => toggleDoc(doc.docNum)}
                    />
                  );
                })
              )}
            </tbody>
            {paginatedDocs.length > 0 && (
              <tfoot>
                <tr className="bg-cockpit-bg/60 text-white font-bold border-t border-cockpit-border">
                  <td className="py-3 px-2" />
                  <td className="py-3 px-3" colSpan={3}>
                    Subtotal da página ({paginatedDocs.length} doc{paginatedDocs.length > 1 ? "s" : ""})
                  </td>
                  <td className="py-3 px-3 text-center">{pageLinhas.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-3 text-right">{pageQtd.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-3 text-right text-cockpit-accent">{fmtBRL(pageValor, 2)}</td>
                  <td className="py-3 px-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Paginação */}
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  );
}

function InvoiceRow({ doc, isExpanded, onToggle }: {
  doc: GroupedDoc;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`
          cursor-pointer border-b border-cockpit-border/50 transition-colors
          ${isExpanded ? "bg-cockpit-accent/[0.06]" : "hover:bg-white/[0.04]"}
          ${doc.cancelado ? "opacity-50" : ""}
        `}
      >
        <td className="py-3 px-2 text-center">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-cockpit-accent mx-auto" />
            : <ChevronRight className="w-4 h-4 text-cockpit-muted mx-auto" />
          }
        </td>
        <td className="py-3 px-3">
          <span className="text-gray-200 font-semibold">{doc.docNum}</span>
        </td>
        <td className="py-3 px-3 text-gray-300 whitespace-nowrap">{fmtDate(doc.data)}</td>
        <td className="py-3 px-3 text-gray-300 max-w-[200px] truncate" title={doc.cardName}>
          {doc.cardName}
        </td>
        <td className="py-3 px-3 text-center">
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-cockpit-border/30 text-gray-300 px-2 py-0.5 rounded-full">
            <Hash className="w-3 h-3" />
            {doc.totalItens > 0 ? doc.totalItens : "—"}
          </span>
        </td>
        <td className="py-3 px-3 text-right text-gray-300 font-medium">
          {doc.totalQtd > 0 ? doc.totalQtd.toLocaleString("pt-BR") : "—"}
        </td>
        <td className="py-3 px-3 text-right text-cockpit-accent font-semibold">
          {fmtBRL(doc.docTotal, 2)}
        </td>
        <td className="py-3 px-3 text-center">
          {doc.cancelado
            ? <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 font-medium">Cancelado</span>
            : <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400 font-medium">Ativo</span>
          }
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-cockpit-bg/30">
          <td colSpan={8} className="p-0">
            <DocDetailPanel lines={doc.lines} />
          </td>
        </tr>
      )}
    </>
  );
}
