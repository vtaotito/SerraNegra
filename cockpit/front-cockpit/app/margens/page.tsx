"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Package, Search, CalendarDays, Boxes } from "lucide-react";
import { fmtBRL, fmtNum } from "@/lib/format";
import { fetchCatalog, fetchInventory, type CatalogItem, type InventoryRow } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";

interface CatRow {
  categoria: string;
  itens: number;
  estoqueTotal: number;
  ativos: number;
  inativos: number;
}

function buildCategories(items: CatalogItem[], inventory: InventoryRow[]): CatRow[] {
  const invMap = new Map<string, number>();
  for (const inv of inventory) {
    invMap.set(inv.product_id, (invMap.get(inv.product_id) ?? 0) + inv.quantity_available);
  }

  const catMap = new Map<string, { itens: number; estoque: number; ativos: number; inativos: number }>();
  for (const item of items) {
    const cat = item.category || "Sem Categoria";
    const cur = catMap.get(cat) ?? { itens: 0, estoque: 0, ativos: 0, inativos: 0 };
    cur.itens += 1;
    cur.estoque += invMap.get(item.sku) ?? 0;
    if (item.is_active) cur.ativos += 1; else cur.inativos += 1;
    catMap.set(cat, cur);
  }

  return Array.from(catMap.entries())
    .map(([cat, v]) => ({ categoria: cat, itens: v.itens, estoqueTotal: v.estoque, ativos: v.ativos, inativos: v.inativos }))
    .sort((a, b) => b.estoqueTotal - a.estoqueTotal);
}

export default function MargensPage() {
  const { label: periodoLabel } = useDateRange();

  const { data: catData, loading: l1, error: e1, refetch: r1 } = useFetch(() => fetchCatalog({ limit: 200 }), []);
  const { data: invData, loading: l2, error: e2, refetch: r2 } = useFetch(() => fetchInventory({ limit: 200 }), []);
  const loading = l1 || l2;
  const error = e1 || e2;

  const rows = useMemo(() => {
    if (!catData || !invData) return [];
    return buildCategories(catData.data, invData.data);
  }, [catData, invData]);

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => rows.filter((r) => r.categoria.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const totalItens = filtered.reduce((s, r) => s + r.itens, 0);
  const totalEstoque = filtered.reduce((s, r) => s + r.estoqueTotal, 0);

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">CMV / Margens</h1><p className="text-cockpit-muted mt-1">Carregando...</p></div><LoadingSkeleton /></div>;
  if (error) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">CMV / Margens</h1></div><ErrorState message={error} onRetry={() => { r1(); r2(); }} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CMV / Margens</h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-300">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>Análise por categoria de produto</span>
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoria..." aria-label="Buscar categoria"
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Categorias", value: String(filtered.length), icon: Package, color: "text-cockpit-accent" },
          { label: "Itens", value: fmtNum(totalItens), icon: Boxes, color: "text-blue-400" },
          { label: "Estoque Total", value: `${fmtNum(totalEstoque)} un`, icon: TrendingUp, color: "text-sky-400" },
          { label: "Catálogo", value: String(catData?.total ?? 0), icon: Package, color: "text-amber-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 hover:border-cockpit-accent/30 transition-colors flex flex-col gap-2">
            <div className="flex items-center gap-2"><k.icon className={`h-4 w-4 ${k.color}`} /><span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span></div>
            <span className="text-xl font-bold text-white">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-cockpit-bg text-cockpit-muted uppercase text-xs">
              <tr>
                <th scope="col" className="px-4 py-3">Categoria</th>
                <th scope="col" className="px-4 py-3 text-right">Itens</th>
                <th scope="col" className="px-4 py-3 text-right">Estoque</th>
                <th scope="col" className="px-4 py-3 text-right">Ativos</th>
                <th scope="col" className="px-4 py-3 text-right">Inativos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-cockpit-muted">Nenhuma categoria</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.categoria} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{r.categoria}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{r.itens}</td>
                  <td className="px-4 py-3 text-right text-sky-400 font-medium">{fmtNum(r.estoqueTotal)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{r.ativos}</td>
                  <td className="px-4 py-3 text-right text-red-400">{r.inativos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">{filtered.length} categorias — SAP B1</div>
      </div>
    </div>
  );
}
