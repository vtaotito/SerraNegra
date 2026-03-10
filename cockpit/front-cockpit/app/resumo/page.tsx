"use client";

import { useState, useMemo } from "react";
import { DollarSign, Users, TrendingUp, Package, AlertCircle, Search, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { fmtBRL, fmtNum } from "@/lib/format";
import { fetchCatalog, fetchInventory, fetchCustomers, fetchInvoices, fetchSalesPersons } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format } from "date-fns";

export default function ResumoPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: catData, loading: l1, error: e1, refetch: r1 } = useFetch(() => fetchCatalog({ limit: 1 }), []);
  const { data: invStockData, loading: l2, error: e2, refetch: r2 } = useFetch(() => fetchInventory({ limit: 1 }), []);
  const { data: custData, loading: l3, error: e3, refetch: r3 } = useFetch(() => fetchCustomers({ limit: 1 }), []);
  const { data: invoiceData, loading: l4, error: e4, refetch: r4 } = useFetch(() => fetchInvoices({ limit: 5000, dateFrom, dateTo }), [dateFrom, dateTo]);
  const { data: spData, loading: l5, error: e5, refetch: r5 } = useFetch(() => fetchSalesPersons(), []);

  const loading = l1 && l2 && l3 && l5;
  const coreError = e1 || e2 || e3 || e5;

  const stats = useMemo(() => {
    const invoices = invoiceData?.items ?? [];
    const activeInvoices = invoices.filter((i) => i.Cancelled !== "tYES");
    const totalFat = activeInvoices.reduce((s, i) => s + i.DocTotal, 0);
    const uniqueClients = new Set(activeInvoices.map((i) => i.CardCode)).size;
    const activeSp = (spData?.items ?? []).filter((p) => p.Active === "tYES").length;

    return {
      totalProdutos: catData?.total ?? 0,
      totalEstoque: invStockData?.total ?? 0,
      totalClientes: custData?.total ?? 0,
      totalInvoices: invoiceData?.count ?? 0,
      totalFat,
      uniqueClients,
      vendedoresAtivos: activeSp,
      ticketMedio: activeInvoices.length > 0 ? totalFat / activeInvoices.length : 0,
    };
  }, [catData, invStockData, custData, invoiceData, spData]);

  const [search, setSearch] = useState("");
  const [obsExpanded, setObsExpanded] = useState(true);

  const indicadores = useMemo(() => [
    { indicador: "Total Produtos (Catálogo)", valor: fmtNum(stats.totalProdutos), cat: "estoque" },
    { indicador: "Posições de Estoque", valor: fmtNum(stats.totalEstoque), cat: "estoque" },
    { indicador: "Total Clientes (Base)", valor: fmtNum(stats.totalClientes), cat: "clientes" },
    { indicador: "Clientes Ativos (Período)", valor: fmtNum(stats.uniqueClients), cat: "clientes" },
    { indicador: "Notas Fiscais (Período)", valor: fmtNum(stats.totalInvoices), cat: "vendas" },
    { indicador: "Faturamento (Período)", valor: fmtBRL(stats.totalFat), cat: "vendas" },
    { indicador: "Vendedores Ativos", valor: String(stats.vendedoresAtivos), cat: "vendas" },
    { indicador: "Ticket Médio", valor: fmtBRL(stats.ticketMedio, 2), cat: "vendas" },
  ], [stats]);

  const [catFilter, setCatFilter] = useState<"all" | "clientes" | "vendas" | "estoque">("all");

  const filteredInd = useMemo(() => {
    return indicadores.filter((i) => {
      const matchSearch = i.indicador.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "all" || i.cat === catFilter;
      return matchSearch && matchCat;
    });
  }, [indicadores, search, catFilter]);

  const kpis = [
    { label: "Produtos", value: fmtNum(stats.totalProdutos), icon: Package, color: "text-cockpit-accent" },
    { label: "Clientes", value: fmtNum(stats.totalClientes), icon: Users, color: "text-blue-400" },
    { label: "Faturamento", value: fmtBRL(stats.totalFat), icon: TrendingUp, color: "text-amber-400" },
    { label: "Ticket Médio", value: fmtBRL(stats.ticketMedio, 2), icon: DollarSign, color: "text-purple-400" },
  ];

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Resumo Comercial</h1><p className="text-cockpit-muted mt-1">Consolidando dados...</p></div><LoadingSkeleton /></div>;
  if (coreError) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Resumo Comercial</h1></div><ErrorState message={coreError} onRetry={() => { r1(); r2(); r3(); r5(); }} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumo Comercial</h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>Indicadores consolidados SAP B1</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar indicador..." aria-label="Buscar indicador"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
        </div>
        <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Categoria">
          {(["all", "clientes", "vendas", "estoque"] as const).map((opt) => {
            const labels = { all: "Todos", clientes: "Clientes", vendas: "Vendas", estoque: "Estoque" };
            return (
              <button key={opt} type="button" onClick={() => setCatFilter(opt)}
                aria-pressed={catFilter === opt}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  catFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent" : "text-cockpit-muted hover:text-gray-900"
                }`}>{labels[opt]}</button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 hover:border-cockpit-accent/30 transition-colors flex flex-col gap-2">
            <div className="flex items-center gap-2"><k.icon className={`h-5 w-5 ${k.color}`} /><span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span></div>
            <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Indicadores ({filteredInd.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead><tr className="border-b border-cockpit-border text-cockpit-muted"><th scope="col" className="py-3 pr-4">Indicador</th><th scope="col" className="py-3 pr-4">Categoria</th><th scope="col" className="py-3 text-right">Valor</th></tr></thead>
            <tbody className="divide-y divide-cockpit-border">
              {filteredInd.map((r) => (
                <tr key={r.indicador} className="hover:bg-black/5">
                  <td className="py-3 pr-4 font-medium text-gray-900">{r.indicador}</td>
                  <td className="py-3 pr-4"><span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-cockpit-muted capitalize">{r.cat}</span></td>
                  <td className="py-3 text-right text-gray-900 font-medium">{r.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted text-center">{filteredInd.length} de {indicadores.length} indicadores — SAP B1 Service Layer</p>
    </div>
  );
}
