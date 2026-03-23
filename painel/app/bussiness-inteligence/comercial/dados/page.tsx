"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FileText, Filter, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, Package, Hash, Plus, Loader2,
} from "lucide-react";
import { fmtBRL, exportCSV } from "@/lib/format";
import { fetchInvoices, type SapInvoice, type SapInvoiceLine } from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BATCH_SIZE = 20;

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
      <div className="rounded-lg border border-cockpit-border/60 bg-cockpit-bg/60 overflow-hidden">
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
          <tbody className="divide-y divide-cockpit-border/40">
            {lines.map((line, idx) => (
              <tr key={`${line.ItemCode}-${idx}`} className="hover:bg-black/[0.02]">
                <td className="py-2 px-4 text-cockpit-muted">{idx + 1}</td>
                <td className="py-2 px-4">
                  <span className="inline-flex items-center gap-1 font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {line.ItemCode || "—"}
                  </span>
                </td>
                <td className="py-2 px-4 text-gray-600 max-w-[280px] truncate" title={line.ItemDescription}>
                  {line.ItemDescription || "—"}
                </td>
                <td className="py-2 px-4 text-right text-gray-700 font-medium">
                  {(line.Quantity ?? 0).toLocaleString("pt-BR")}
                </td>
                <td className="py-2 px-4 text-right text-gray-500">
                  {line.UnitPrice != null ? fmtBRL(line.UnitPrice, 2) : "—"}
                </td>
                <td className="py-2 px-4 text-right text-cockpit-accent font-medium">
                  {fmtBRL(line.LineTotal ?? 0, 2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-cockpit-border/40 bg-cockpit-bg/80 font-semibold text-gray-900">
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
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

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
    setVisibleCount(BATCH_SIZE);
    setExpandedDocs(new Set());
  }, [search, clienteFilter, canceladoFilter, dateFrom, dateTo]);

  const visibleDocs = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const remaining = filtered.length - visibleCount;
  const hasMore = remaining > 0;
  const nextBatch = Math.min(remaining, BATCH_SIZE);
  const progressPct = filtered.length > 0 ? Math.min(100, (visibleCount / filtered.length) * 100) : 100;

  const totalQtd = useMemo(() => filtered.reduce((s, d) => s + d.totalQtd, 0), [filtered]);
  const totalValor = useMemo(() => filtered.reduce((s, d) => s + d.docTotal, 0), [filtered]);
  const totalLinhas = useMemo(() => filtered.reduce((s, d) => s + d.totalItens, 0), [filtered]);

  const visibleValor = useMemo(() => visibleDocs.reduce((s, d) => s + d.docTotal, 0), [visibleDocs]);
  const visibleLinhas = useMemo(() => visibleDocs.reduce((s, d) => s + d.totalItens, 0), [visibleDocs]);
  const visibleQtd = useMemo(() => visibleDocs.reduce((s, d) => s + d.totalQtd, 0), [visibleDocs]);

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
    setExpandedDocs(new Set(visibleDocs.map((d) => d.docNum)));
  }, [visibleDocs]);

  const collapseAll = useCallback(() => {
    setExpandedDocs(new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setSearch(""); setClienteFilter("ALL"); setCanceladoFilter("ALL");
  }, []);

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + BATCH_SIZE);
      setLoadingMore(false);
    }, 300);
  }, []);

  const handleShowAll = useCallback(() => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(filtered.length);
      setLoadingMore(false);
    }, 300);
  }, [filtered.length]);

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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-cockpit-accent" />
            Documentos / Vendas
          </h1>
          <p className="text-cockpit-muted mt-1 flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
            <span className="text-cockpit-border">·</span>
            <span>{filtered.length} documentos · {totalLinhas} itens</span>
          </p>
        </div>
        <button type="button" onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border text-sm text-cockpit-muted hover:text-gray-900 hover:border-cockpit-accent/40 transition-colors"
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
              className="flex items-center gap-1 text-xs text-cockpit-muted hover:text-gray-900 transition-colors"
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
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
          </div>
          {clientesUnicos.length > 1 && (
            <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)}
              aria-label="Filtrar por cliente"
              className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 max-w-[200px]">
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
                      : "text-cockpit-muted hover:text-gray-900"
                  }`}>{labels[opt]}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Totalizadores">
        {[
          { label: "Documentos", value: filtered.length.toLocaleString("pt-BR"), icon: FileText },
          { label: "Itens Vendidos", value: totalLinhas.toLocaleString("pt-BR"), icon: Package },
          { label: "Valor Total", value: fmtBRL(totalValor, 2), accent: true },
          { label: "Ticket Médio", value: filtered.length > 0 ? fmtBRL(totalValor / filtered.length, 2) : "—" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors">
            <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.accent ? "text-cockpit-accent" : "text-gray-900"}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela com load more */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-cockpit-border bg-cockpit-bg/60">
          <p className="text-xs text-cockpit-muted">
            Exibindo{" "}
            <span className="text-cockpit-gold font-semibold">{visibleDocs.length}</span>{" "}
            de <span className="text-gray-700 font-medium">{filtered.length}</span> documentos
            <span className="hidden sm:inline"> — clique em uma linha para ver itens</span>
          </p>
          <div className="flex gap-3 items-center">
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
              {visibleDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-cockpit-muted">
                    Nenhum documento no período
                  </td>
                </tr>
              ) : (
                visibleDocs.map((doc) => {
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
            {visibleDocs.length > 0 && (
              <tfoot>
                <tr className="bg-cockpit-bg/50 text-gray-900 font-bold border-t border-cockpit-border">
                  <td className="py-3 px-2" />
                  <td className="py-3 px-3" colSpan={3}>
                    Subtotal exibido ({visibleDocs.length} doc{visibleDocs.length > 1 ? "s" : ""})
                  </td>
                  <td className="py-3 px-3 text-center">{visibleLinhas.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-3 text-right">{visibleQtd.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-3 text-right text-cockpit-accent">{fmtBRL(visibleValor, 2)}</td>
                  <td className="py-3 px-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Load more / progress section */}
        <div className="border-t border-cockpit-border">
          {/* Progress bar */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between text-xs text-cockpit-muted mb-2">
              <span>
                {visibleDocs.length} de {filtered.length} documentos carregados
              </span>
              <span className="font-medium text-cockpit-gold">
                {Math.round(progressPct)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-cockpit-border/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct >= 100
                    ? "#A81C2C"
                    : "linear-gradient(90deg, #A81C2C, #d4a853)",
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          {hasMore ? (
            <div className="px-4 pb-4 pt-1 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="
                  w-full sm:flex-1 flex items-center justify-center gap-2.5 py-3 px-6
                  rounded-lg font-semibold text-sm
                  bg-gradient-to-r from-cockpit-accent to-cockpit-accentHover
                  text-gray-900 shadow-lg shadow-cockpit-accent/20
                  hover:shadow-cockpit-accent/40 hover:brightness-110
                  active:scale-[0.98]
                  disabled:opacity-60 disabled:cursor-wait
                  transition-all duration-200
                "
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {loadingMore
                  ? "Carregando..."
                  : `Carregar mais ${nextBatch} documento${nextBatch > 1 ? "s" : ""}`
                }
              </button>

              {remaining > BATCH_SIZE && (
                <button
                  type="button"
                  onClick={handleShowAll}
                  disabled={loadingMore}
                  className="
                    w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6
                    rounded-lg font-medium text-sm
                    border-2 border-cockpit-gold/40 text-cockpit-gold
                    hover:bg-cockpit-gold/10 hover:border-cockpit-gold/60
                    active:scale-[0.98]
                    disabled:opacity-60 disabled:cursor-wait
                    transition-all duration-200
                  "
                >
                  Exibir todos ({filtered.length})
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 pb-3 pt-1 text-center">
              <p className="text-xs text-cockpit-accent flex items-center justify-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Todos os {filtered.length} documentos estão exibidos
              </p>
            </div>
          )}
        </div>
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
          cursor-pointer border-b border-cockpit-border/40 transition-colors
          ${isExpanded ? "bg-cockpit-accent/[0.06]" : "hover:bg-black/[0.03]"}
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
          <span className="text-gray-700 font-semibold">{doc.docNum}</span>
        </td>
        <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{fmtDate(doc.data)}</td>
        <td className="py-3 px-3 text-gray-600 max-w-[200px] truncate" title={doc.cardName}>
          {doc.cardName}
        </td>
        <td className="py-3 px-3 text-center">
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-cockpit-border/40 text-gray-600 px-2 py-0.5 rounded-full">
            <Hash className="w-3 h-3" />
            {doc.totalItens > 0 ? doc.totalItens : "—"}
          </span>
        </td>
        <td className="py-3 px-3 text-right text-gray-600 font-medium">
          {doc.totalQtd > 0 ? doc.totalQtd.toLocaleString("pt-BR") : "—"}
        </td>
        <td className="py-3 px-3 text-right text-cockpit-accent font-semibold">
          {fmtBRL(doc.docTotal, 2)}
        </td>
        <td className="py-3 px-3 text-center">
          {doc.cancelado
            ? <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 font-medium">Cancelado</span>
            : <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 font-medium">Ativo</span>
          }
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-cockpit-bg/40">
          <td colSpan={8} className="p-0">
            <DocDetailPanel lines={doc.lines} />
          </td>
        </tr>
      )}
    </>
  );
}
