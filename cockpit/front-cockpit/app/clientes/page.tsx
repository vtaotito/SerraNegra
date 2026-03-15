"use client";

import { useState, useMemo, useCallback } from "react";
import { Users, UserMinus, PieChart, Crown, Search, CalendarDays, ChevronRight } from "lucide-react";
import { fetchCustomers, type CustomerRow } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { ClientDetailDrawer, type ClientDetailData } from "@/components/ClientDetailDrawer";

export default function ClientesPage() {
  const { label: periodoLabel } = useDateRange();

  const { data: customerData, loading, error, refetch } = useFetch(
    () => fetchCustomers({ limit: 200 }),
    []
  );

  const allClientes = useMemo(() => {
    if (!customerData) return [];
    return customerData.data.map((c: CustomerRow) => ({
      cliente: c.card_name,
      codigo: c.card_code,
      tipo: c.card_type === "cCustomer" ? "Cliente" : c.card_type === "cSupplier" ? "Fornecedor" : c.card_type,
      cidade: c.city ?? "—",
      estado: c.state ?? "—",
      telefone: c.phone ?? "—",
      email: c.email ?? "—",
      ativo: c.is_active,
    }));
  }, [customerData]);

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("ALL");
  const [estadoFilter, setEstadoFilter] = useState<string>("ALL");
  const [drawerClient, setDrawerClient] = useState<ClientDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback((row: typeof allClientes[0]) => {
    setDrawerClient({
      codigo: row.codigo,
      cliente: row.cliente,
      tipo: row.tipo,
      cidade: row.cidade,
      estado: row.estado,
      telefone: row.telefone,
      email: row.email,
      ativo: row.ativo,
    });
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerClient(null), 300);
  }, []);

  const uniqueEstados = useMemo(() =>
    [...new Set(allClientes.map((c) => c.estado).filter((e) => e !== "—"))].sort(),
  [allClientes]);

  const filtered = useMemo(() => {
    return allClientes.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = c.cliente.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) ||
        c.cidade.toLowerCase().includes(q);
      const matchTipo = tipoFilter === "ALL" || c.tipo === tipoFilter;
      const matchEstado = estadoFilter === "ALL" || c.estado === estadoFilter;
      return matchSearch && matchTipo && matchEstado;
    });
  }, [allClientes, search, tipoFilter, estadoFilter]);

  const kpis = useMemo(() => {
    const ativos = filtered.filter((c) => c.ativo).length;
    const inativos = filtered.filter((c) => !c.ativo).length;
    return [
      { label: "Clientes Exibidos", value: String(filtered.length), icon: Users, color: "text-cockpit-accent" },
      { label: "Ativos", value: String(ativos), icon: Crown, color: "text-emerald-400" },
      { label: "Inativos", value: String(inativos), icon: UserMinus, color: "text-red-400" },
      { label: "Total na Base", value: String(customerData?.total ?? 0), icon: PieChart, color: "text-blue-400" },
    ];
  }, [filtered, customerData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Clientes</h1><p className="text-cockpit-muted mt-1">Carregando dados do SAP B1...</p></div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Clientes</h1></div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10">
            <Users className="w-5 h-5 text-cockpit-accent" />
          </div>
          Clientes
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{customerData?.total ?? 0} clientes na base SAP B1</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, código ou cidade..." aria-label="Buscar cliente"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 focus:border-cockpit-accent/50 transition-all" />
        </div>
        <div className="flex gap-0.5 rounded-xl border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Filtrar por tipo">
          {["ALL", "Cliente", "Fornecedor"].map((opt) => (
            <button key={opt} type="button" onClick={() => setTipoFilter(opt)}
              aria-pressed={tipoFilter === opt}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                tipoFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-900 hover:bg-black/5"
              }`}>{opt === "ALL" ? "Todos" : opt}</button>
          ))}
        </div>
        {uniqueEstados.length > 1 && (
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
            aria-label="Filtrar por estado"
            className="px-3 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 transition-all">
            <option value="ALL">Todos os estados</option>
            {uniqueEstados.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="KPIs clientes">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 hover:border-cockpit-accent/30 transition-all duration-200 shadow-sm">
            <div className="flex items-center gap-2">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-380px)]">
          <table className="w-full text-sm text-left table-sticky-head">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th scope="col" className="py-3 px-4 w-8" />
                <th scope="col" className="py-3 px-4">#</th>
                <th scope="col" className="py-3 px-4">Código</th>
                <th scope="col" className="py-3 px-4">Nome</th>
                <th scope="col" className="py-3 px-4">Tipo</th>
                <th scope="col" className="py-3 px-4">Cidade</th>
                <th scope="col" className="py-3 px-4">UF</th>
                <th scope="col" className="py-3 px-4">Telefone</th>
                <th scope="col" className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-cockpit-muted">Nenhum cliente encontrado</td></tr>
              ) : (
                filtered.map((row, i) => (
                  <tr
                    key={row.codigo}
                    onClick={() => openDrawer(row)}
                    className="hover:bg-cockpit-accent/[0.04] active:bg-cockpit-accent/[0.06] transition-colors duration-150 cursor-pointer group"
                  >
                    <td className="py-3 px-2 text-cockpit-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-cockpit-accent" />
                    </td>
                    <td className="py-3 px-4 text-cockpit-muted">{i + 1}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{row.codigo}</td>
                    <td className="py-3 px-4 font-medium text-gray-900 max-w-[200px] truncate">{row.cliente}</td>
                    <td className="py-3 px-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        row.tipo === "Cliente" ? "bg-blue-500/20 text-blue-600" : "bg-purple-500/20 text-purple-600"
                      }`}>{row.tipo}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{row.cidade}</td>
                    <td className="py-3 px-4 text-gray-500">{row.estado}</td>
                    <td className="py-3 px-4 text-gray-500">{row.telefone}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.ativo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      }`}>{row.ativo ? "Ativo" : "Inativo"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          Clique em um cliente para ver detalhes · Exibindo {filtered.length} de {allClientes.length} — dados SAP B1 BusinessPartners
        </div>
      </div>

      <ClientDetailDrawer client={drawerClient} open={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}
