"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FileText, Filter, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, Package, Hash, Loader2,
  RefreshCw, Receipt, Link2, AlertCircle, ExternalLink,
  Copy, Check, Users, DollarSign, TrendingUp,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import { fmtBRL, fmtNum, exportCSV } from "@/lib/format";
import {
  fetchInvoicesLocal, syncInvoices, fetchSalesPersons,
  type SapInvoice, type SapInvoiceLine,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BATCH_SIZE = 25;
const PAGE_SIZES = [25, 50, 100, 250] as const;

// ─── Helpers ─────────────────────────────────────────────────────

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  try {
    const d = raw.includes("T") ? parseISO(raw) : new Date(raw);
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return raw;
  }
}

function fmtNfeKey(key: string | null | undefined): string {
  if (!key) return "—";
  const clean = key.replace(/\D/g, "");
  if (clean.length !== 44) return key;
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

interface GroupedDoc {
  docEntry: number;
  docNum: number;
  /** Número da NF-e (U_TX_NDfe) */
  nfeNumber: string | null;
  /** Folio impresso */
  folioNumber: string | null;
  /** Chave de acesso 44 dígitos */
  nfeKey: string | null;
  /** Série fiscal */
  series: number | null;
  data: string;
  dataEntrega: string | null;
  cardCode: string;
  cardName: string;
  vendedorCode: number;
  docTotal: number;
  cancelado: boolean;
  /** DocNum do pedido base no SAP, quando resolvido */
  baseDocNum: number | null;
  baseDocEntry: number | null;
  lines: SapInvoiceLine[];
  totalItens: number;
  totalQtd: number;
  totalLinhas: number;
}

function groupInvoices(invoices: SapInvoice[]): GroupedDoc[] {
  return invoices.map((inv) => {
    const lines = inv.DocumentLines ?? [];
    return {
      docEntry: inv.DocEntry,
      docNum: inv.DocNum,
      nfeNumber: inv.NfeNumber ?? null,
      folioNumber: inv.FolioNumber ?? null,
      nfeKey: inv.NfeKey ?? null,
      series: inv.SeriesNumber ?? null,
      data: inv.DocDate,
      dataEntrega: inv.DocDueDate ?? null,
      cardCode: inv.CardCode,
      cardName: inv.CardName,
      vendedorCode: inv.SalesPersonCode,
      docTotal: Number(inv.DocTotal) || 0,
      cancelado: inv.Cancelled === "tYES" || inv.Cancelled === "Y",
      baseDocNum: inv.BaseDocNum ?? null,
      baseDocEntry: inv.BaseDocEntry ?? null,
      lines,
      totalItens: lines.length,
      totalQtd: lines.reduce((s, l) => s + (Number(l.Quantity) || 0), 0),
      totalLinhas: lines.reduce((s, l) => s + (Number(l.LineTotal) || 0), 0),
    };
  });
}

// ─── Pequenos componentes ────────────────────────────────────────

function NfeKeyChip({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-gray-300">—</span>;

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(value.replace(/\s/g, ""));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={`Chave de acesso: ${fmtNfeKey(value)}\nClique para copiar`}
      className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-500 hover:text-cockpit-accent motion-safe:transition-colors"
    >
      <KeyRound className="w-3 h-3" />
      <span className="font-mono">…{value.slice(-8)}</span>
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 opacity-50" />}
    </button>
  );
}

function PedidoLink({ docNum }: { docNum: number | null }) {
  if (docNum == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400" title="Pedido base não localizado">
        <AlertCircle className="w-3 h-3" />sem vínculo
      </span>
    );
  }
  return (
    <Link
      href={`/pedidos?view=analise&search=${encodeURIComponent(String(docNum))}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 motion-safe:transition-colors"
      title="Abrir pedido vinculado em Pedidos de Venda"
    >
      <Link2 className="w-3 h-3" />#{docNum}
    </Link>
  );
}

// ─── Detalhe dos itens ───────────────────────────────────────────

function DocDetailPanel({ doc }: { doc: GroupedDoc }) {
  if (doc.lines.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-cockpit-muted italic">
        Detalhamento de itens não disponível para esta nota fiscal.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Header com chave de acesso completa */}
      {doc.nfeKey && (
        <div className="rounded-lg bg-blue-50/50 border border-blue-100 px-3 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-blue-900 uppercase tracking-wider">Chave de Acesso NF-e</div>
              <div className="text-[10px] font-mono text-blue-700 break-all">{fmtNfeKey(doc.nfeKey)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(doc.nfeKey!.replace(/\s/g, ""))}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-blue-700 hover:bg-blue-100 shrink-0"
          >
            <Copy className="w-3 h-3" /> Copiar
          </button>
        </div>
      )}

      <div className="rounded-lg border border-cockpit-border/60 bg-cockpit-bg/60 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cockpit-border/40 text-cockpit-muted uppercase tracking-wider">
              <th className="text-left py-2.5 px-3 font-semibold w-7">#</th>
              <th className="text-left py-2.5 px-3 font-semibold w-[110px]">Cód SAP</th>
              <th className="text-left py-2.5 px-3 font-semibold">Descrição</th>
              <th className="text-center py-2.5 px-3 font-semibold w-14">CFOP</th>
              <th className="text-right py-2.5 px-3 font-semibold w-16">Qtd</th>
              <th className="text-right py-2.5 px-3 font-semibold w-20">P. Unit.</th>
              <th className="text-right py-2.5 px-3 font-semibold w-12">Desc.</th>
              <th className="text-right py-2.5 px-3 font-semibold w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cockpit-border/40">
            {doc.lines.map((line, idx) => (
              <tr key={`${line.ItemCode}-${idx}`} className="hover:bg-black/[0.02]">
                <td className="py-1.5 px-3 text-cockpit-muted tabular-nums">{idx + 1}</td>
                <td className="py-1.5 px-3">
                  <span className="inline-flex items-center gap-1 font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                    {line.ItemCode || "—"}
                  </span>
                </td>
                <td className="py-1.5 px-3 text-gray-700 max-w-[300px] truncate" title={line.ItemDescription}>
                  {line.ItemDescription || "—"}
                </td>
                <td className="py-1.5 px-3 text-center text-gray-500 font-mono text-[10px]">
                  {line.CFOPCode || "—"}
                </td>
                <td className="py-1.5 px-3 text-right text-gray-700 font-medium tabular-nums">
                  {(Number(line.Quantity) || 0).toLocaleString("pt-BR")}
                </td>
                <td className="py-1.5 px-3 text-right text-gray-500 tabular-nums">
                  {line.UnitPrice != null ? fmtBRL(line.UnitPrice, 2) : "—"}
                </td>
                <td className="py-1.5 px-3 text-right tabular-nums">
                  {(Number(line.DiscountPercent) || 0) > 0 ? (
                    <span className="text-amber-600 text-[10px] font-semibold">
                      {Number(line.DiscountPercent).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="py-1.5 px-3 text-right text-cockpit-accent font-semibold tabular-nums">
                  {fmtBRL(Number(line.LineTotal) || 0, 2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-cockpit-border/40 bg-cockpit-bg/80 font-bold text-gray-900">
              <td className="py-2.5 px-3" colSpan={4}>Total ({doc.lines.length} itens)</td>
              <td className="py-2.5 px-3 text-right tabular-nums">
                {doc.totalQtd.toLocaleString("pt-BR")}
              </td>
              <td colSpan={2} />
              <td className="py-2.5 px-3 text-right text-cockpit-accent tabular-nums">
                {fmtBRL(doc.totalLinhas, 2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Linha da tabela principal ───────────────────────────────────

function InvoiceRow({ doc, isExpanded, onToggle, vendorName }: {
  doc: GroupedDoc;
  isExpanded: boolean;
  onToggle: () => void;
  vendorName: string;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`
          cursor-pointer border-b border-cockpit-border/40 motion-safe:transition-colors group
          ${isExpanded ? "bg-cockpit-accent/[0.05]" : "hover:bg-black/[0.025]"}
          ${doc.cancelado ? "opacity-60" : ""}
        `}
      >
        <td className="py-3 px-2 text-center align-top pt-3.5">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-cockpit-accent mx-auto" />
            : <ChevronRight className="w-4 h-4 text-cockpit-muted mx-auto group-hover:text-gray-700" />
          }
        </td>

        {/* Coluna NF — número + folio + chave */}
        <td className="py-2.5 px-3 align-top">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Receipt className="w-3 h-3 text-cockpit-accent" />
              <span className="font-mono font-bold text-gray-900 tabular-nums text-sm">
                {doc.nfeNumber ?? doc.docNum}
              </span>
              {doc.series != null && (
                <span className="text-[9px] text-gray-400 font-mono">S{doc.series}</span>
              )}
            </div>
            <NfeKeyChip value={doc.nfeKey} />
          </div>
        </td>

        {/* Pedido vinculado */}
        <td className="py-3 px-3 align-top pt-3.5">
          <PedidoLink docNum={doc.baseDocNum} />
        </td>

        {/* Data */}
        <td className="py-3 px-3 align-top pt-3.5 text-gray-600 text-xs whitespace-nowrap">
          {fmtDate(doc.data)}
        </td>

        {/* Cliente */}
        <td className="py-2.5 px-3 align-top">
          <div className="flex flex-col">
            <span className="text-gray-900 text-sm font-medium truncate max-w-[220px]" title={doc.cardName}>
              {doc.cardName}
            </span>
            <span className="text-[10px] font-mono text-gray-400">{doc.cardCode}</span>
          </div>
        </td>

        {/* Vendedor */}
        <td className="py-3 px-3 align-top pt-3.5 text-gray-500 text-xs truncate max-w-[120px]" title={vendorName}>
          {vendorName}
        </td>

        {/* Itens */}
        <td className="py-3 px-3 align-top pt-3.5 text-center">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
            <Hash className="w-2.5 h-2.5" />
            {doc.totalItens > 0 ? doc.totalItens : "—"}
          </span>
        </td>

        {/* Qtd */}
        <td className="py-3 px-3 align-top pt-3.5 text-right text-gray-600 text-xs font-medium tabular-nums">
          {doc.totalQtd > 0 ? doc.totalQtd.toLocaleString("pt-BR") : "—"}
        </td>

        {/* Valor */}
        <td className="py-3 px-3 align-top pt-3.5 text-right text-cockpit-accent font-semibold tabular-nums">
          {fmtBRL(doc.docTotal, 2)}
        </td>

        {/* Status */}
        <td className="py-3 px-3 align-top pt-3.5 text-center">
          {doc.cancelado
            ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-red-50 text-red-600 font-semibold ring-1 ring-red-100">Cancelado</span>
            : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-100">Ativo</span>
          }
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-cockpit-bg/40">
          <td colSpan={10} className="p-0">
            <DocDetailPanel doc={doc} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Página ──────────────────────────────────────────────────────

export default function ComercialDadosPage() {
  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();

  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: invoiceData, loading, error, refetch } = useFetch(
    () => fetchInvoicesLocal({
      dateFrom,
      dateTo,
      salesPerson: salesPersonCode ?? undefined,
      limit: 10000,
    }),
    [dateFrom, dateTo, salesPersonCode]
  );

  const { data: spData } = useFetch(() => fetchSalesPersons(), []);
  const spMap = useMemo(() => {
    const m = new Map<number, string>();
    if (spData?.items) for (const sp of spData.items) m.set(sp.SalesEmployeeCode, sp.SalesEmployeeName);
    return m;
  }, [spData]);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const allDocs = useMemo(() => {
    if (!invoiceData?.items) return [];
    return groupInvoices(invoiceData.items);
  }, [invoiceData]);

  const [search, setSearch] = useState("");
  const [canceladoFilter, setCanceladoFilter] = useState<"ALL" | "active" | "cancelled">("active");
  const [vinculoFilter, setVinculoFilter] = useState<"ALL" | "linked" | "unlinked">("ALL");
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());
  const [pageSize, setPageSize] = useState<number>(BATCH_SIZE);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const clientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of allDocs) {
      if (d.cardCode && !map.has(d.cardCode)) map.set(d.cardCode, d.cardName || d.cardCode);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allDocs]);
  const [clienteFilter, setClienteFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return allDocs.filter((doc) => {
      const q = search.toLowerCase().trim();
      const lineMatch = doc.lines.some(
        (l) => (l.ItemCode ?? "").toLowerCase().includes(q) ||
               (l.ItemDescription ?? "").toLowerCase().includes(q)
      );
      const matchSearch = !q ||
        doc.cardCode.toLowerCase().includes(q) ||
        doc.cardName.toLowerCase().includes(q) ||
        String(doc.docNum).includes(q) ||
        (doc.nfeNumber ?? "").toLowerCase().includes(q) ||
        (doc.folioNumber ?? "").toLowerCase().includes(q) ||
        (doc.nfeKey ?? "").includes(q) ||
        (doc.baseDocNum != null && String(doc.baseDocNum).includes(q)) ||
        lineMatch;
      const matchCliente = clienteFilter === "ALL" || doc.cardCode === clienteFilter;
      const matchCanc = canceladoFilter === "ALL"
        ? true
        : canceladoFilter === "active" ? !doc.cancelado : doc.cancelado;
      const matchVinculo = vinculoFilter === "ALL"
        ? true
        : vinculoFilter === "linked" ? doc.baseDocNum != null : doc.baseDocNum == null;
      return matchSearch && matchCliente && matchCanc && matchVinculo;
    });
  }, [allDocs, search, clienteFilter, canceladoFilter, vinculoFilter]);

  useEffect(() => {
    setVisibleCount(pageSize);
    setExpandedDocs(new Set());
  }, [pageSize, search, clienteFilter, canceladoFilter, vinculoFilter, dateFrom, dateTo]);

  const visibleDocs = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const remaining = filtered.length - visibleCount;
  const hasMore = remaining > 0;

  // KPIs sobre o conjunto FILTRADO
  const activeDocs = useMemo(() => filtered.filter((d) => !d.cancelado), [filtered]);
  const totalValor = useMemo(() => activeDocs.reduce((s, d) => s + d.docTotal, 0), [activeDocs]);
  const totalItens = useMemo(() => activeDocs.reduce((s, d) => s + d.totalItens, 0), [activeDocs]);
  const totalQtd = useMemo(() => activeDocs.reduce((s, d) => s + d.totalQtd, 0), [activeDocs]);
  const ticketMedio = activeDocs.length > 0 ? totalValor / activeDocs.length : 0;
  const clientesAtivos = useMemo(() => new Set(activeDocs.map((d) => d.cardCode)).size, [activeDocs]);

  // Vínculo NF↔Pedido
  const linkedCount = useMemo(() => allDocs.filter((d) => d.baseDocNum != null).length, [allDocs]);
  const linkedPct = allDocs.length > 0 ? (linkedCount / allDocs.length) * 100 : 0;

  const cancelledCount = useMemo(() => allDocs.filter((d) => d.cancelado).length, [allDocs]);

  const hasFilters = search || clienteFilter !== "ALL" || canceladoFilter !== "active" || vinculoFilter !== "ALL";

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
    setSearch("");
    setClienteFilter("ALL");
    setCanceladoFilter("active");
    setVinculoFilter("ALL");
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + pageSize, filtered.length));
  }, [pageSize, filtered.length]);

  const handleShowAll = useCallback(() => {
    setVisibleCount(filtered.length);
  }, [filtered.length]);

  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await syncInvoices();
      setSyncMsg(res.message);
      refetch();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  const handleExport = useCallback(() => {
    const rows: Record<string, string | number>[] = [];
    for (const doc of filtered) {
      const vendor = doc.vendedorCode != null ? (spMap.get(doc.vendedorCode) ?? "") : "";
      if (doc.lines.length > 0) {
        for (const line of doc.lines) {
          rows.push({
            "NF-e": doc.nfeNumber ?? "",
            "Folio": doc.folioNumber ?? "",
            "Série": doc.series ?? "",
            "Chave de Acesso": doc.nfeKey ?? "",
            "Nº Doc SAP": doc.docNum,
            "Pedido Vinculado": doc.baseDocNum ?? "",
            "Data": fmtDate(doc.data),
            "Cód. Cliente": doc.cardCode,
            "Cliente": doc.cardName,
            "Vendedor": vendor,
            "Cód. Item": line.ItemCode ?? "",
            "Descrição": line.ItemDescription ?? "",
            "CFOP": line.CFOPCode ?? "",
            "Quantidade": Number(line.Quantity) || 0,
            "Preço Unit.": (Number(line.UnitPrice) || 0).toFixed(2),
            "Desconto %": (Number(line.DiscountPercent) || 0).toFixed(2),
            "Total Linha (R$)": (Number(line.LineTotal) || 0).toFixed(2),
            "Total Doc (R$)": doc.docTotal.toFixed(2),
            "Cancelado": doc.cancelado ? "Sim" : "Não",
          });
        }
      } else {
        rows.push({
          "NF-e": doc.nfeNumber ?? "", "Folio": doc.folioNumber ?? "",
          "Série": doc.series ?? "", "Chave de Acesso": doc.nfeKey ?? "",
          "Nº Doc SAP": doc.docNum, "Pedido Vinculado": doc.baseDocNum ?? "",
          "Data": fmtDate(doc.data),
          "Cód. Cliente": doc.cardCode, "Cliente": doc.cardName, "Vendedor": vendor,
          "Cód. Item": "", "Descrição": "", "CFOP": "", "Quantidade": "",
          "Preço Unit.": "", "Desconto %": "", "Total Linha (R$)": "",
          "Total Doc (R$)": doc.docTotal.toFixed(2),
          "Cancelado": doc.cancelado ? "Sim" : "Não",
        });
      }
    }
    exportCSV(rows, `notas-fiscais-${dateFrom}-${dateTo}`);
  }, [filtered, spMap, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-cockpit-accent" />Notas Fiscais &middot; Vendas
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
            <Receipt className="w-6 h-6 text-cockpit-accent" />Notas Fiscais &middot; Vendas
          </h1>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const anyExpanded = expandedDocs.size > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-cockpit-accent/10 shrink-0">
            <Receipt className="w-5 h-5 text-cockpit-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Notas Fiscais &middot; Vendas</h1>
            <p className="text-xs sm:text-sm text-cockpit-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>{periodoLabel}</span>
              <span className="text-cockpit-border">·</span>
              <span>
                <strong className="text-gray-700">{fmtNum(allDocs.length)}</strong> NFs ·{" "}
                <strong className="text-gray-700">{fmtNum(linkedCount)}</strong> vinculadas a pedidos
                {cancelledCount > 0 && <> · {cancelledCount} canceladas</>}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cockpit-accent text-white text-sm font-medium hover:bg-cockpit-accent/90 motion-safe:transition-colors disabled:opacity-50 shadow-sm"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Sincronizando..." : "Sync SAP"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-cockpit-border text-sm text-gray-600 hover:text-gray-900 hover:border-cockpit-accent/40 motion-safe:transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-cockpit-accent/10 text-cockpit-accent text-sm border border-cockpit-accent/20 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 shrink-0" /> {syncMsg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="Totalizadores">
        {[
          { label: "Notas Fiscais", value: fmtNum(activeDocs.length), sub: cancelledCount > 0 ? `${cancelledCount} canceladas` : "todas ativas", icon: FileText, color: "text-cockpit-accent" },
          { label: "Faturamento", value: fmtBRL(totalValor), sub: "valor das NFs ativas", icon: DollarSign, color: "text-emerald-600" },
          { label: "Ticket Médio", value: activeDocs.length > 0 ? fmtBRL(ticketMedio) : "—", sub: "por nota fiscal", icon: TrendingUp, color: "text-blue-600" },
          { label: "Itens Vendidos", value: fmtNum(totalItens), sub: `${fmtNum(Math.round(totalQtd))} un totais`, icon: Package, color: "text-violet-600" },
          { label: "Clientes", value: fmtNum(clientesAtivos), sub: "distintos no filtro", icon: Users, color: "text-teal-600" },
          {
            label: "NF ↔ Pedido",
            value: `${linkedPct.toFixed(0)}%`,
            sub: `${fmtNum(linkedCount)} de ${fmtNum(allDocs.length)} vinculadas`,
            icon: Link2,
            color: linkedPct >= 90 ? "text-emerald-600" : linkedPct >= 50 ? "text-amber-600" : "text-red-500",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-white p-3.5 shadow-sm hover:border-cockpit-accent/30 motion-safe:transition-all">
            <div className="flex items-center gap-2 mb-1.5">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{k.value}</p>
            <p className="text-[10px] text-cockpit-muted mt-0.5 truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Aviso de fonte */}
      {allDocs.length > 0 && linkedCount === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold mb-0.5">Vínculo com pedidos não disponível</p>
            <p className="text-amber-700">
              Nenhuma NF tem pedido base resolvido. Execute <strong>Sync SAP</strong> para popular a relação NF ↔ Pedido.
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-cockpit-border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cockpit-muted" />
            <span className="text-xs font-semibold text-gray-700">Filtros</span>
          </div>
          <div className="text-[11px] text-cockpit-muted">
            <strong className="text-gray-700">{fmtNum(filtered.length)}</strong> NFs no filtro
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-3 text-cockpit-accent hover:underline inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="relative sm:col-span-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="NF, pedido, cliente, item, chave de acesso..."
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/5 rounded">
                <X className="w-3.5 h-3.5 text-cockpit-muted" />
              </button>
            )}
          </div>

          <div className="sm:col-span-4">
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent"
            >
              <option value="ALL">Todos clientes ({clientesUnicos.length})</option>
              {clientesUnicos.map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 inline-flex rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Status">
            {(["ALL", "active", "cancelled"] as const).map((opt) => {
              const labels = { ALL: "Todas", active: "Ativas", cancelled: "Cancel." };
              const colors = {
                ALL: "bg-white text-gray-700",
                active: "bg-emerald-100 text-emerald-700",
                cancelled: "bg-red-100 text-red-600",
              };
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCanceladoFilter(opt)}
                  className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold motion-safe:transition-colors ${
                    canceladoFilter === opt ? `${colors[opt]} shadow-sm` : "text-cockpit-muted hover:text-gray-700"
                  }`}
                >{labels[opt]}</button>
              );
            })}
          </div>
        </div>

        {/* Chips de vínculo */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase text-cockpit-muted font-semibold tracking-wider">Vínculo NF ↔ Pedido:</span>
          {([
            ["ALL", "Todas", allDocs.length],
            ["linked", "Com pedido", linkedCount],
            ["unlinked", "Sem vínculo", allDocs.length - linkedCount],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setVinculoFilter(key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 motion-safe:transition-all ${
                vinculoFilter === key
                  ? "bg-cockpit-accent text-white ring-cockpit-accent"
                  : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {key === "linked" && <Link2 className="w-3 h-3" />}
              {key === "unlinked" && <AlertCircle className="w-3 h-3" />}
              {label}
              <span className={`inline-flex items-center justify-center min-w-[16px] h-[14px] px-1 rounded-full text-[9px] font-bold ${
                vinculoFilter === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              }`}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-cockpit-border bg-gray-50/80 gap-2 flex-wrap">
          <p className="text-xs text-cockpit-muted">
            Exibindo <strong className="text-gray-800">{visibleDocs.length}</strong> de <strong className="text-gray-800">{filtered.length}</strong> NFs
            <span className="hidden sm:inline"> · clique em uma linha para ver itens</span>
          </p>
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={anyExpanded ? collapseAll : expandAll}
              className="text-xs text-cockpit-accent hover:underline font-medium inline-flex items-center gap-1"
            >
              {anyExpanded ? <><ChevronDown className="w-3 h-3" /> Recolher todas</> : <><ChevronRight className="w-3 h-3" /> Expandir visíveis</>}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50 text-cockpit-muted uppercase text-xs">
                <th className="w-8 py-3 px-2" />
                <th className="text-left py-3 px-3">NF-e</th>
                <th className="text-left py-3 px-3">Pedido</th>
                <th className="text-left py-3 px-3">Data</th>
                <th className="text-left py-3 px-3">Cliente</th>
                <th className="text-left py-3 px-3">Vendedor</th>
                <th className="text-center py-3 px-3">Itens</th>
                <th className="text-right py-3 px-3">Qtd</th>
                <th className="text-right py-3 px-3">Valor</th>
                <th className="text-center py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-cockpit-muted">
                    <Receipt className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-500">Nenhuma nota fiscal no período</p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 text-sm text-cockpit-accent hover:underline"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                visibleDocs.map((doc) => {
                  const vendor = doc.vendedorCode != null ? (spMap.get(doc.vendedorCode) ?? `Cód ${doc.vendedorCode}`) : "—";
                  return (
                    <InvoiceRow
                      key={doc.docEntry}
                      doc={doc}
                      isExpanded={expandedDocs.has(doc.docNum)}
                      onToggle={() => toggleDoc(doc.docNum)}
                      vendorName={vendor}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação / load more */}
        <div className="px-4 py-3 border-t border-cockpit-border bg-cockpit-bg/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-cockpit-muted">
            <label className="inline-flex items-center gap-1.5">
              Por página:
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded border border-cockpit-border bg-white text-xs focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {filtered.length > 0 && (
              <span>
                Total: <strong className="text-gray-700">{fmtBRL(totalValor)}</strong>
              </span>
            )}
          </div>

          {hasMore ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-3 py-2 rounded-lg bg-cockpit-accent text-white text-xs font-semibold hover:bg-cockpit-accent/90 motion-safe:transition-colors inline-flex items-center gap-1.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Carregar mais {Math.min(remaining, pageSize)}
              </button>
              {remaining > pageSize && (
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="px-3 py-2 rounded-lg border border-cockpit-border text-xs text-gray-600 hover:bg-gray-50 motion-safe:transition-colors"
                >
                  Exibir todas ({filtered.length})
                </button>
              )}
            </div>
          ) : (
            filtered.length > 0 && (
              <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                Todas as {filtered.length} NFs estão visíveis
              </span>
            )
          )}
        </div>
      </div>

      <footer className="text-center text-[10px] text-cockpit-muted py-2">
        Origem: SAP B1 · Sincronização horária ·{" "}
        <Link href="/pedidos?view=analise" className="text-cockpit-accent hover:underline inline-flex items-center gap-1">
          Ver Pedidos de Venda <ExternalLink className="w-3 h-3" />
        </Link>
      </footer>
    </div>
  );
}
