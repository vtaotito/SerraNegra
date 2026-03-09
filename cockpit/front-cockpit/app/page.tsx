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
import { syncSAP } from "@/lib/api";
import { useDateRange } from "@/contexts/DateRangeContext";

const ALL_VENDEDORES = [
  { nome: "Alef Santos", meta: 220_000, real: 122_883, perf: -21.8 },
  { nome: "Alessandro Gomes", meta: 600_000, real: 517_496, perf: 20.7 },
  { nome: "Debora Silva", meta: 520_000, real: 530_724, perf: 42.9 },
  { nome: "Isabela Batista", meta: 40_000, real: 46_009, perf: 61.0 },
  { nome: "Tatiana Fernandes", meta: 190_000, real: 144_534, perf: 3.5 },
  { nome: "Thiago Lopes", meta: 130_000, real: 144_631, perf: 6.6 },
  { nome: "Ana", meta: 400_000, real: 295_684, perf: 20.1 },
];

const CARTEIRA = [
  { label: "Clientes 80/20", value: 629 },
  { label: "Clientes Gold", value: 154 },
  { label: "Clientes Atenção", value: 1413 },
  { label: "Média SKU/cliente", value: 7.89 },
  { label: "Média positivações", value: 904.67 },
  { label: "Média fat./mês", value: 2_507_150.56 },
];

const SYNC_ENDPOINTS = [
  { key: "cockpit" as const, label: "Sync Completo", desc: "Todas entidades" },
  { key: "invoices" as const, label: "Notas Fiscais", desc: "A/R Invoices" },
  { key: "products" as const, label: "Produtos", desc: "Items + UDFs" },
  { key: "inventory" as const, label: "Estoque", desc: "Warehouse info" },
  { key: "customers" as const, label: "Clientes", desc: "BusinessPartners" },
  { key: "salespersons" as const, label: "Vendedores", desc: "SalesPersons" },
];

export default function HomePage() {
  const { label: periodoLabel, monthsInRange } = useDateRange();
  const [vendedorSearch, setVendedorSearch] = useState("");
  const [perfFilter, setPerfFilter] = useState<"all" | "positive" | "negative">("all");
  const [syncStates, setSyncStates] = useState<Record<string, "idle" | "loading" | "ok" | "error">>({});

  const filtered = useMemo(() => {
    return ALL_VENDEDORES.filter((v) => {
      const matchSearch = v.nome.toLowerCase().includes(vendedorSearch.toLowerCase());
      const matchPerf =
        perfFilter === "all" ? true : perfFilter === "positive" ? v.perf >= 0 : v.perf < 0;
      return matchSearch && matchPerf;
    });
  }, [vendedorSearch, perfFilter]);

  const totais = useMemo(() => ({
    meta: filtered.reduce((s, v) => s + v.meta, 0),
    real: filtered.reduce((s, v) => s + v.real, 0),
  }), [filtered]);

  const chartData = useMemo(() =>
    filtered.map((v) => ({
      name: v.nome.split(" ")[0],
      Meta: v.meta,
      Real: v.real,
      perf: v.perf,
    })),
  [filtered]);

  const kpis = useMemo(() => [
    { title: `Fat. ${monthsInRange}m`, value: fmtBRL(totais.real * (monthsInRange / 3)), icon: DollarSign, color: "text-cockpit-accent" },
    { title: "Volume Mês", value: String(Math.round(843 * filtered.length / Math.max(ALL_VENDEDORES.length, 1))), icon: Package, color: "text-sky-400" },
    { title: "Ticket Médio", value: filtered.length > 0 ? fmtBRL(totais.real / filtered.length) : "—", icon: Target, color: "text-amber-400" },
    { title: "Estoque CMV", value: fmtBRL(7_012_707), icon: Wallet, color: "text-cockpit-accent" },
    { title: "Total Clientes", value: "4.642", icon: Users, color: "text-blue-400" },
    { title: "Perdidos 90d", value: "2.368", icon: TrendingDown, color: "text-cockpit-danger" },
  ], [totais, filtered, monthsInRange]);

  const bestPerf = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.reduce((best, v) => v.perf > best.perf ? v : best);
  }, [filtered]);

  const worstPerf = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.reduce((worst, v) => v.perf < worst.perf ? v : worst);
  }, [filtered]);

  const insights = useMemo(() => {
    const list: Array<{ text: string; border: string; badge: string; badgeBg: string; icon: typeof AlertTriangle }> = [];
    list.push({
      text: "51% dos clientes foram perdidos nos últimos 90 dias (2.368 de 4.642)",
      border: "border-cockpit-danger", badge: "Alerta",
      badgeBg: "bg-cockpit-danger/20 text-cockpit-danger", icon: AlertTriangle,
    });
    if (bestPerf && bestPerf.perf > 0) {
      list.push({
        text: `${bestPerf.nome} atingiu ${(100 + bestPerf.perf).toFixed(1)}% da meta — melhor performance`,
        border: "border-cockpit-accent", badge: "Destaque",
        badgeBg: "bg-cockpit-accent/20 text-cockpit-accent", icon: TrendingUp,
      });
    }
    if (worstPerf && worstPerf.perf < 0) {
      list.push({
        text: `${worstPerf.nome} está ${Math.abs(worstPerf.perf).toFixed(1)}% abaixo da meta — requer atenção`,
        border: "border-cockpit-gold", badge: "Atenção",
        badgeBg: "bg-cockpit-gold/20 text-cockpit-gold", icon: Target,
      });
    }
    return list;
  }, [bestPerf, worstPerf]);

  const handleSync = useCallback(async (endpoint: typeof SYNC_ENDPOINTS[number]["key"]) => {
    setSyncStates((prev) => ({ ...prev, [endpoint]: "loading" }));
    try {
      await syncSAP(endpoint);
      setSyncStates((prev) => ({ ...prev, [endpoint]: "ok" }));
      setTimeout(() => setSyncStates((prev) => ({ ...prev, [endpoint]: "idle" })), 3000);
    } catch {
      setSyncStates((prev) => ({ ...prev, [endpoint]: "error" }));
      setTimeout(() => setSyncStates((prev) => ({ ...prev, [endpoint]: "idle" })), 5000);
    }
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Visão executiva</h1>
        <p className="text-cockpit-muted mt-1 text-sm flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          Serra Negra · <span className="text-gray-300">{periodoLabel}</span>
        </p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Indicadores principais">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.title} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-muted">{kpi.title}</span>
                <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
              <span className="text-lg font-bold text-white leading-tight">{kpi.value}</span>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cockpit-accent" />
            <h2 className="text-lg font-semibold text-white">
              Meta vs Real ({filtered.length})
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
              <input
                type="text"
                value={vendedorSearch}
                onChange={(e) => setVendedorSearch(e.target.value)}
                placeholder="Filtrar vendedor..."
                aria-label="Filtrar vendedores"
                className="w-full sm:w-44 pl-9 pr-4 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
              />
            </div>
            <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5" role="group" aria-label="Filtrar por performance">
              {(["all", "positive", "negative"] as const).map((opt) => {
                const labels = { all: "Todos", positive: "Acima", negative: "Abaixo" };
                return (
                  <button key={opt} type="button" onClick={() => setPerfFilter(opt)}
                    aria-pressed={perfFilter === opt}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      perfFilter === opt
                        ? "bg-cockpit-accent/20 text-cockpit-accent"
                        : "text-cockpit-muted hover:text-white"
                    }`}
                  >{labels[opt]}</button>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 12 }} axisLine={{ stroke: "#30363d" }} />
                <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={{ stroke: "#30363d" }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, color: "#e6edf3" }}
                  formatter={(value: number) => fmtBRL(value)}
                  labelStyle={{ color: "#8b949e" }}
                />
                <Legend wrapperStyle={{ color: "#8b949e", fontSize: 12 }} />
                <Bar dataKey="Meta" radius={[4, 4, 0, 0]} opacity={0.35}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="#238636" />
                  ))}
                </Bar>
                <Bar dataKey="Real" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.perf >= 0 ? "#238636" : "#da3633"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-cockpit-accent" />
            <h2 className="text-lg font-semibold text-white">Carteira de Clientes</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CARTEIRA.map((c) => (
              <div key={c.label} className="rounded-lg border border-cockpit-border bg-cockpit-bg p-4 hover:border-cockpit-accent/30 transition-colors">
                <p className="text-xs text-cockpit-muted mb-1">{c.label}</p>
                <p className="text-base font-bold text-white">
                  {c.label.includes("fat.") ? fmtBRL(c.value) : c.value.toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-5 h-5 text-cockpit-gold" />
            <h2 className="text-lg font-semibold text-white">Insights</h2>
          </div>
          <div className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-cockpit-muted text-sm py-4 text-center">Selecione vendedores para ver insights</p>
            ) : (
              insights.map((ins) => {
                const Icon = ins.icon;
                return (
                  <div key={ins.text} className={`rounded-lg border ${ins.border} bg-cockpit-bg p-4 flex items-start gap-3`}>
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 ${ins.badgeBg}`}>{ins.badge}</span>
                      <p className="text-sm text-gray-300 leading-relaxed">{ins.text}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-cockpit-accent" />
          <h2 className="text-lg font-semibold text-white">Integração SAP B1</h2>
          <span className="ml-auto text-[10px] text-cockpit-muted uppercase tracking-wider">Service Layer</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {SYNC_ENDPOINTS.map((ep) => {
            const state = syncStates[ep.key] || "idle";
            return (
              <button
                key={ep.key}
                type="button"
                onClick={() => handleSync(ep.key)}
                disabled={state === "loading"}
                className={`rounded-lg p-3 border text-left transition-all ${
                  state === "ok" ? "border-cockpit-accent bg-cockpit-accent/10"
                  : state === "error" ? "border-cockpit-danger bg-cockpit-danger/10"
                  : "border-cockpit-border bg-cockpit-bg hover:border-cockpit-accent/40 hover:bg-cockpit-accent/5"
                } disabled:opacity-60`}
                aria-label={`Sincronizar ${ep.label}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-white">{ep.label}</p>
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
        Dados: SAP B1 Service Layer + VOLUME COMERCIAL 10.12.xlsx
      </footer>
    </div>
  );
}
