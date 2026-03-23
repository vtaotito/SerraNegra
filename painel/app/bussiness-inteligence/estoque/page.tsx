"use client";

import { useState, useMemo } from "react";
import { Package, Boxes, BadgeDollarSign, AlertTriangle, Search, CalendarDays } from "lucide-react";
import { fmtNum, fmtBRL } from "@/lib/format";
import { fetchCatalog, fetchInventory, type CatalogItem, type InventoryRow } from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";

type Status = "OK" | "ABAIXO" | "RUPTURA";

interface StockRow {
  cod: string;
  item: string;
  descricao: string;
  estoque: number;
  disp: number;
  min: number;
  und: string;
  status: Status;
}

const statusStyles: Record<Status, { bg: string; text: string }> = {
  OK: { bg: "bg-emerald-50", text: "text-emerald-700" },
  ABAIXO: { bg: "bg-amber-500/15", text: "text-amber-400" },
  RUPTURA: { bg: "bg-red-50", text: "text-red-600" },
};

function deriveStatus(onHand: number, free: number, min: number): Status {
  if (free <= 0) return "RUPTURA";
  if (onHand < min) return "ABAIXO";
  return "OK";
}

function codFromSku(sku: string): string {
  const match = sku.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : sku.slice(0, 2).toUpperCase();
}

function mergeStockData(items: CatalogItem[], inventory: InventoryRow[]): StockRow[] {
  const invMap = new Map<string, InventoryRow>();
  for (const inv of inventory) {
    const existing = invMap.get(inv.product_id);
    if (!existing || inv.quantity_available > existing.quantity_available) {
      invMap.set(inv.product_id, inv);
    }
  }

  return items.map((item) => {
    const inv = invMap.get(item.sku);
    const onHand = inv?.quantity_available ?? 0;
    const free = inv?.quantity_free ?? 0;
    const min = 0;
    return {
      cod: codFromSku(item.sku),
      item: item.sku,
      descricao: item.description,
      estoque: onHand,
      disp: free,
      min,
      und: item.unit_of_measure || "UN",
      status: deriveStatus(onHand, free, min),
    };
  });
}

export default function EstoquePage() {
  const { label: periodoLabel } = useDateRange();

  const { data: catalogData, loading: loadingCatalog, error: errCatalog, refetch: refetchCatalog } =
    useFetch(() => fetchCatalog({ limit: 200 }), []);
  const { data: invData, loading: loadingInv, error: errInv, refetch: refetchInv } =
    useFetch(() => fetchInventory({ limit: 200 }), []);

  const loading = loadingCatalog || loadingInv;
  const error = errCatalog || errInv;

  const allItems = useMemo(() => {
    if (!catalogData || !invData) return [];
    return mergeStockData(catalogData.data, invData.data);
  }, [catalogData, invData]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [codFilter, setCodFilter] = useState("ALL");

  const uniqueCods = useMemo(() => [...new Set(allItems.map((i) => i.cod))].sort(), [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter((row) => {
      const q = search.toLowerCase();
      const matchSearch =
        row.item.toLowerCase().includes(q) ||
        row.descricao.toLowerCase().includes(q) ||
        row.cod.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || row.status === statusFilter;
      const matchCod = codFilter === "ALL" || row.cod === codFilter;
      return matchSearch && matchStatus && matchCod;
    });
  }, [allItems, search, statusFilter, codFilter]);

  const kpis = useMemo(() => {
    const totalEstoque = filtered.reduce((s, i) => s + Math.max(i.estoque, 0), 0);
    const alertas = filtered.filter((i) => i.status !== "OK").length;
    return [
      { label: "Itens", value: String(filtered.length), icon: Package, color: "text-cockpit-muted" },
      { label: "Estoque Total", value: `${fmtNum(totalEstoque)} un`, icon: Boxes, color: "text-sky-400" },
      { label: "Valor Estoque", value: "—", icon: BadgeDollarSign, color: "text-cockpit-accent" },
      { label: "Itens em Alerta", value: String(alertas), icon: AlertTriangle, color: alertas > 0 ? "text-red-400" : "text-emerald-400" },
    ];
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-cockpit-muted mt-1">Carregando dados do SAP B1...</p>
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
        </div>
        <ErrorState message={error} onRetry={() => { refetchCatalog(); refetchInv(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{catalogData?.total ?? 0} itens no catálogo · {invData?.total ?? 0} posições de estoque</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, item ou descrição..." aria-label="Buscar item de estoque"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
        </div>
        {uniqueCods.length > 1 && (
          <select value={codFilter} onChange={(e) => setCodFilter(e.target.value)}
            aria-label="Filtrar por código"
            className="px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50">
            <option value="ALL">Todos os CODs</option>
            {uniqueCods.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="flex gap-1 rounded-lg border border-cockpit-border bg-cockpit-bg p-1" role="group" aria-label="Filtrar por status">
          {(["ALL", "OK", "ABAIXO", "RUPTURA"] as const).map((opt) => (
            <button key={opt} type="button" onClick={() => setStatusFilter(opt)}
              aria-pressed={statusFilter === opt}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === opt
                  ? opt === "RUPTURA" ? "bg-red-500/20 text-red-400"
                    : opt === "ABAIXO" ? "bg-amber-500/20 text-amber-400"
                    : opt === "OK" ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-cockpit-accent/20 text-cockpit-accent"
                  : "text-cockpit-muted hover:text-gray-900"
              }`}>{opt === "ALL" ? "Todos" : opt}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className="text-xl font-bold text-gray-900">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-cockpit-muted">OK</span></span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /><span className="text-cockpit-muted">ABAIXO</span></span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /><span className="text-cockpit-muted">RUPTURA</span></span>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th scope="col" className="text-left py-3 px-4">COD</th>
                <th scope="col" className="text-left py-3 px-4">SKU</th>
                <th scope="col" className="text-left py-3 px-4">Descrição</th>
                <th scope="col" className="text-right py-3 px-4">Em Estoque</th>
                <th scope="col" className="text-right py-3 px-4">Disponível</th>
                <th scope="col" className="text-right py-3 px-4">Mínimo</th>
                <th scope="col" className="text-left py-3 px-4">Und</th>
                <th scope="col" className="text-center py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-cockpit-muted">Nenhum item encontrado</td></tr>
              ) : (
                filtered.map((row) => {
                  const st = statusStyles[row.status];
                  return (
                    <tr key={row.item} className={`hover:bg-black/5 ${row.status === "RUPTURA" ? "bg-red-500/5" : ""}`}>
                      <td className="py-3 px-4 text-gray-700 font-medium">{row.cod}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-xs">{row.item}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-[240px] truncate">{row.descricao}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{fmtNum(row.estoque)}</td>
                      <td className={`py-3 px-4 text-right font-medium ${row.disp <= 0 ? "text-red-400" : "text-gray-600"}`}>{fmtNum(row.disp)}</td>
                      <td className="py-3 px-4 text-right text-cockpit-muted">{fmtNum(row.min)}</td>
                      <td className="py-3 px-4 text-gray-500">{row.und}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}>{row.status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          Exibindo {filtered.length} de {allItems.length} itens — dados SAP B1
        </div>
      </div>
    </div>
  );
}
