"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { fetchOrders, fmtBRL, fmtDate, type B2BOrder } from "@/lib/b2b-api";
import { StatusBadge } from "@/components/b2b/StatusBadge";
import { EmptyState } from "@/components/b2b/EmptyState";
import { ErrorState } from "@/components/cockpit/DataState";

type DocFilter = "all" | "O" | "C";
type SortField = "doc_num" | "doc_date" | "doc_total";
type SortDir = "asc" | "desc";

export default function PedidosPage() {
  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<DocFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("doc_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [openRes, closedRes] = await Promise.all([
        fetchOrders({ docStatus: "O" }),
        fetchOrders({ docStatus: "C" }),
      ]);
      setOrders([...openRes.items, ...closedRes.items]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...orders];
    if (filter !== "all") list = list.filter((o) => o.doc_status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          String(o.doc_num).includes(q) ||
          o.card_name?.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "doc_num") cmp = a.doc_num - b.doc_num;
      else if (sortField === "doc_date") cmp = a.doc_date.localeCompare(b.doc_date);
      else cmp = a.doc_total - b.doc_total;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orders, filter, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cockpit-accent" /> : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10">
            <ClipboardList className="w-5 h-5 text-cockpit-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Meus Pedidos</h1>
            <p className="text-xs text-cockpit-muted">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} no total
            </p>
          </div>
        </div>
        <Link
          href="/portal/catalogo"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Pedido
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 bg-cockpit-bg rounded-lg p-1">
          {([
            ["all", "Todos"],
            ["O", "Abertos"],
            ["C", "Fechados"],
          ] as [DocFilter, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === val
                  ? "bg-white text-cockpit-accent shadow-sm"
                  : "text-cockpit-muted hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nº do pedido..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-cockpit-border bg-white text-sm placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8 text-cockpit-accent" />}
          title="Nenhum pedido encontrado"
          description={search ? "Tente alterar os filtros de busca." : "Você ainda não fez nenhum pedido."}
          action={
            <Link
              href="/portal/catalogo"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover transition-colors"
            >
              Ir ao Catálogo
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-sticky-head">
              <thead>
                <tr className="bg-cockpit-bg/50">
                  <th
                    className="text-left px-5 py-3 text-xs font-semibold text-cockpit-muted cursor-pointer select-none"
                    onClick={() => toggleSort("doc_num")}
                  >
                    <span className="inline-flex items-center gap-1">Nº Pedido <SortIcon field="doc_num" /></span>
                  </th>
                  <th
                    className="text-left px-5 py-3 text-xs font-semibold text-cockpit-muted cursor-pointer select-none"
                    onClick={() => toggleSort("doc_date")}
                  >
                    <span className="inline-flex items-center gap-1">Data <SortIcon field="doc_date" /></span>
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-cockpit-muted">
                    Itens
                  </th>
                  <th
                    className="text-right px-5 py-3 text-xs font-semibold text-cockpit-muted cursor-pointer select-none"
                    onClick={() => toggleSort("doc_total")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">Valor <SortIcon field="doc_total" /></span>
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-cockpit-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cockpit-border">
                {filtered.map((o) => (
                  <tr key={o.doc_entry} className="hover:bg-cockpit-bg/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/portal/pedidos/${o.doc_entry}`}
                        className="font-medium text-cockpit-accent hover:underline"
                      >
                        #{o.doc_num}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{fmtDate(o.doc_date)}</td>
                    <td className="px-5 py-3.5 text-gray-700 tabular-nums">
                      {o.num_lines} {o.num_lines === 1 ? "item" : "itens"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900 tabular-nums">
                      {fmtBRL(o.doc_total)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={o.doc_status} cancelled={o.cancelled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse motion-reduce:animate-none">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-cockpit-border rounded-lg" />
        <div>
          <div className="h-5 w-32 bg-cockpit-border rounded mb-1" />
          <div className="h-3 w-20 bg-cockpit-border rounded" />
        </div>
      </div>
      <div className="rounded-xl border border-cockpit-border bg-white p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <div className="h-3 w-16 bg-cockpit-border rounded" />
            <div className="h-3 w-20 bg-cockpit-border rounded" />
            <div className="h-3 flex-1 bg-cockpit-border rounded" />
            <div className="h-3 w-20 bg-cockpit-border rounded" />
            <div className="h-3 w-16 bg-cockpit-border rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
