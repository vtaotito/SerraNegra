"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DollarSign, Package, Users, TrendingUp, TrendingDown,
  Wallet, AlertTriangle, Target, BarChart3, Search,
  Loader2, CheckCircle2, XCircle, Zap, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from "recharts";
import { fmtBRL } from "@/lib/format";
import { syncSAP, fetchInvoices, fetchSalesPersons, fetchCustomers, type SapInvoice, type SapSalesPerson } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/DataState";
import { format } from "date-fns";

interface VendedorAgg {
  nome: string;
  code: number;
  real: number;
  volume: number;
}

function aggregateBySalesPerson(invoices: SapInvoice[], persons: SapSalesPerson[]): VendedorAgg[] {
  const personMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));
  const agg = new Map<number, { real: number; volume: number }>();

  for (const inv of invoices) {
    if (inv.Cancelled === "tYES") continue;
    const code = inv.SalesPersonCode;
    const cur = agg.get(code) ?? { real: 0, volume: 0 };
    cur.real += inv.DocTotal;
    cur.volume += 1;
    agg.set(code, cur);
  }

  return Array.from(agg.entries())
    .map(([code, { real, volume }]) => ({
      nome: personMap.get(code) ?? `Vendedor ${code}`,
      code,
      real,
      volume,
    }))
    .sort((a, b) => b.real - a.real);
}

const SYNC_ENDPOINTS = [
  { key: "cockpit" as const, label: "Sync Completo", desc: "Todas entidades" },
  { key: "invoices" as const, label: "Notas Fiscais", desc: "A/R Invoices" },
  { key: "products" as const, label: "Produtos", desc: "Items + UDFs" },
  { key: "inventory" as const, label: "Estoque", desc: "Warehouse info" },
  { key: "customers" as const, label: "Clientes", desc: "BusinessPartners" },
  { key: "salespersons" as const, label: "Vendedores", desc: "SalesPersons" },
];

export default function HomePage() {
  const { label: periodoLabel, range, monthsInRange } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: invData, loading: loadInv, error: errInv, refetch: refetchInv } =
    useFetch(() => fetchInvoices({ limit: 5000, dateFrom, dateTo }), [dateFrom, dateTo]);
  const { data: spData, loading: loadSp, error: errSp, refetch: refetchSp } =
    useFetch(() => fetchSalesPersons(), []);
  const { data: custData } = useFetch(() => fetchCustomers({ limit: 1 }), []);

  const loading = loadInv && loadSp;
  const hasInvoiceError = !!errInv;

  const vendedores = useMemo(() => {
    if (!invData?.items || !spData?.items) return [];
    return aggregateBySalesPerson(invData.items, spData.items);
  }, [invData, spData]);

  const [vendedorSearch, setVendedorSearch] = useState("");
  const [perfFilter, setPerfFilter] = useState<"all" | "top" | "bottom">("all");
  const [syncStates, setSyncStates] = useState<Record<string, "idle" | "loading" | "ok" | "error">>({});

  const mediana = useMemo(() => {
    if (vendedores.length === 0) return 0;
    const sorted = [...vendedores].sort((a, b) => a.real - b.real);
    return sorted[Math.floor(sorted.length / 2)].real;
  }, [vendedores]);

  const filtered = useMemo(() => {
    return vendedores.filter((v) => {
      const matchSearch = v.nome.toLowerCase().includes(vendedorSearch.toLowerCase());
      const matchPerf =
        perfFilter === "all" ? true : perfFilter === "top" ? v.real >= mediana : v.real < mediana;
      return matchSearch && matchPerf;
    });
  }, [vendedores, vendedorSearch, perfFilter, mediana]);

  const totais = useMemo(() => ({
    real: filtered.reduce((s, v) => s + v.real, 0),
    volume: filtered.reduce((s, v) => s + v.volume, 0),
  }), [filtered]);

  const chartData = useMemo(() =>
    filtered.slice(0, 15).map((v) => ({
      name: v.nome.split(" ")[0],
      Real: v.real,
      aboveMedian: v.real >= mediana,
    })),
  [filtered, mediana]);

  const totalClientes = custData?.total ?? 0;

  const kpis = useMemo(() => [
    { title: `Fat. ${monthsInRange}m`, value: fmtBRL(totais.real), icon: DollarSign, color: "text-cockpit-accent" },
    { title: "Notas no Período", value: String(totais.volume), icon: Package, color: "text-sky-400" },
    { title: "Ticket Médio", value: totais.volume > 0 ? fmtBRL(totais.real / totais.volume) : "—", icon: Target, color: "text-amber-400" },
    { title: "Vendedores Ativos", value: String(filtered.length), icon: Users, color: "text-blue-400" },
    { title: "Total Clientes", value: String(totalClientes), icon: Wallet, color: "text-cockpit-accent" },
    { title: "NFs no SAP", value: String(invData?.count ?? 0), icon: TrendingUp, color: "text-purple-400" },
  ], [totais, filtered, totalClientes, invData, monthsInRange]);

  const handleSync = useCallback(async (endpoint: typeof SYNC_ENDPOINTS[number]["key"]) => {
    setSyncStates((prev) => ({ ...prev, [endpoint]: "loading" }));
    try {
      await syncSAP(endpoint);
      setSyncStates((prev) => ({ ...prev, [endpoint]: "ok" }));
      setTimeout(() => setSyncStates((prev) => ({ ...prev, [endpoint]: "idle" })), 3000);
      if (endpoint === "cockpit" || endpoint === "invoices") refetchInv();
      if (endpoint === "cockpit" || endpoint === "salespersons") refetchSp();
    } catch {
      setSyncStates((prev) => ({ ...prev, [endpoint]: "error" }));
      setTimeout(() => setSyncStates((prev) => ({ ...prev, [endpoint]: "idle" })), 5000);
    }
  }, [refetchInv, refetchSp]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div><h1 className="text-2xl font-bold text-gray-900">Visão executiva</h1><p className="text-cockpit-muted mt-1 text-sm">Carregando dados do SAP B1...</p></div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão executiva</h1>
        <p className="text-cockpit-muted mt-1 text-sm flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          Serra Negra · <span className="text-gray-600">{periodoLabel}</span>
        </p>
      </div>

      {hasInvoiceError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">Não foi possível carregar notas fiscais do SAP</p>
            <p className="text-xs text-cockpit-muted mt-1">{errInv}</p>
            <p className="text-xs text-cockpit-muted mt-1">Use os botões de Sincronização abaixo para forçar uma nova tentativa, ou mude o período.</p>
          </div>
          <button type="button" onClick={refetchInv} className="text-xs text-amber-400 hover:text-gray-900 transition-colors">Tentar novamente</button>
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Indicadores principais">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.title} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-muted">{kpi.title}</span>
                <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
              <span className="text-lg font-bold text-gray-900 leading-tight">{kpi.value}</span>
            </div>
          );
        })}
      </section>

      {!hasInvoiceError && (
        <section className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cockpit-accent" />
              <h2 className="text-lg font-semibold text-gray-900">Faturamento por Vendedor ({filtered.length})</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
                <input type="text" value={vendedorSearch} onChange={(e) => setVendedorSearch(e.target.value)}
                  placeholder="Filtrar vendedor..." aria-label="Filtrar vendedores"
                  className="w-full sm:w-44 pl-9 pr-4 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50" />
              </div>
              <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Performance">
                {(["all", "top", "bottom"] as const).map((opt) => {
                  const labels = { all: "Todos", top: "Top", bottom: "Abaixo" };
                  return (
                    <button key={opt} type="button" onClick={() => setPerfFilter(opt)}
                      aria-pressed={perfFilter === opt}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        perfFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent" : "text-cockpit-muted hover:text-gray-900"
                      }`}>{labels[opt]}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-cockpit-muted py-12">Nenhum vendedor encontrado</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="name" tick={{ fill: "#78696c", fontSize: 12 }} axisLine={{ stroke: "#e5dfe1" }} />
                  <YAxis tick={{ fill: "#78696c", fontSize: 11 }} axisLine={{ stroke: "#e5dfe1" }}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5dfe1", borderRadius: 8, color: "#1f2937" }}
                    formatter={(value: number) => fmtBRL(value)} labelStyle={{ color: "#78696c" }} />
                  <Legend wrapperStyle={{ color: "#78696c", fontSize: 12 }} />
                  <Bar dataKey="Real" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.aboveMedian ? "#A81C2C" : "#e5484d"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-cockpit-accent" />
          <h2 className="text-lg font-semibold text-gray-900">Integração SAP B1</h2>
          <span className="ml-auto text-[10px] text-cockpit-muted uppercase tracking-wider">Service Layer</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {SYNC_ENDPOINTS.map((ep) => {
            const state = syncStates[ep.key] || "idle";
            return (
              <button key={ep.key} type="button" onClick={() => handleSync(ep.key)}
                disabled={state === "loading"}
                className={`rounded-lg p-3 border text-left transition-all ${
                  state === "ok" ? "border-cockpit-accent bg-cockpit-accent/10"
                  : state === "error" ? "border-cockpit-danger bg-cockpit-danger/10"
                  : "border-cockpit-border bg-cockpit-bg hover:border-cockpit-accent/40 hover:bg-cockpit-accent/5"
                } disabled:opacity-60`}
                aria-label={`Sincronizar ${ep.label}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-900">{ep.label}</p>
                  {state === "loading" && <Loader2 className="w-3.5 h-3.5 text-cockpit-accent animate-spin" />}
                  {state === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-cockpit-accent" />}
                  {state === "error" && <XCircle className="w-3.5 h-3.5 text-cockpit-danger" />}
                </div>
                <p className="text-[10px] text-cockpit-muted">{ep.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="text-center text-xs text-cockpit-muted py-4 border-t border-cockpit-border">
        Dados: SAP B1 Service Layer · {invData?.count ?? 0} invoices · {spData?.count ?? 0} vendedores
      </footer>
    </div>
  );
}
