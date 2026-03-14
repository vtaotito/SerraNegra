"use client";

import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, Target, Users, Search, CalendarDays, ShoppingCart } from "lucide-react";
import { fmtBRL } from "@/lib/format";
import { fetchSalesOrders, fetchSalesPersons, type SalesOrderRow, type SapSalesPerson } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format } from "date-fns";

interface CarteiraRow {
  nome: string;
  code: number;
  clientes: number;
  fat: number;
  pedidos: number;
  ticket: number;
}

function buildCarteira(orders: SalesOrderRow[], persons: SapSalesPerson[]): CarteiraRow[] {
  const pMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));
  const agg = new Map<number, { fat: number; pedidos: number; clients: Set<string> }>();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const c = o.sales_person_code ?? -1;
    const cur = agg.get(c) ?? { fat: 0, pedidos: 0, clients: new Set<string>() };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    cur.clients.add(o.card_code);
    agg.set(c, cur);
  }

  return Array.from(agg.entries())
    .map(([code, { fat, pedidos, clients }]) => ({
      nome: pMap.get(code) ?? `Vendedor ${code}`,
      code,
      clientes: clients.size,
      fat,
      pedidos,
      ticket: pedidos > 0 ? fat / pedidos : 0,
    }))
    .sort((a, b) => b.fat - a.fat);
}

export default function CarteiraPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo }), [dateFrom, dateTo]);
  const { data: spData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchSalesPersons(), []);
  const loading = l2;

  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);

  const rows = useMemo(() => {
    if (!spData?.items) return [];
    return buildCarteira(orders, spData.items);
  }, [orders, spData]);

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => rows.filter((r) => r.nome.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const totalClientes = filtered.reduce((s, r) => s + r.clientes, 0);
  const totalFat = filtered.reduce((s, r) => s + r.fat, 0);
  const totalPedidos = filtered.reduce((s, r) => s + r.pedidos, 0);

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Carteira</h1><p className="text-cockpit-muted mt-1">Carregando...</p></div><LoadingSkeleton /></div>;
  if (e2) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Carteira</h1></div><ErrorState message={e2} onRetry={r2} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Carteira Geral</h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>Clientes por vendedor</span>
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar vendedor..." aria-label="Buscar vendedor"
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vendedores", value: String(filtered.length), icon: Users, color: "text-cockpit-accent" },
          { label: "Clientes Únicos", value: String(totalClientes), icon: Target, color: "text-blue-500" },
          { label: "Fat. Total", value: fmtBRL(totalFat), icon: DollarSign, color: "text-sky-500" },
          { label: "Ticket Médio", value: totalPedidos > 0 ? fmtBRL(totalFat / totalPedidos) : "—", icon: TrendingUp, color: "text-amber-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 hover:border-cockpit-accent/30 transition-colors flex flex-col gap-2">
            <div className="flex items-center gap-2"><k.icon className={`h-4 w-4 ${k.color}`} /><span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span></div>
            <span className="text-xl font-bold text-gray-900">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-cockpit-bg text-cockpit-muted uppercase text-xs">
              <tr>
                <th scope="col" className="px-4 py-3">Vendedor</th>
                <th scope="col" className="px-4 py-3 text-right">Clientes</th>
                <th scope="col" className="px-4 py-3 text-right">Faturamento</th>
                <th scope="col" className="px-4 py-3 text-right">Pedidos</th>
                <th scope="col" className="px-4 py-3 text-right">Ticket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-cockpit-muted">Nenhum vendedor</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.code} className="hover:bg-black/5">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.nome}</td>
                  <td className="px-4 py-3 text-right text-blue-500 font-medium">{r.clientes}</td>
                  <td className="px-4 py-3 text-right text-cockpit-accent font-medium">{fmtBRL(r.fat)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.pedidos}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtBRL(r.ticket, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted">{filtered.length} vendedores — Pedidos de Venda SAP B1</div>
      </div>
    </div>
  );
}
