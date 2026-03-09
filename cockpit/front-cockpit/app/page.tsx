"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Target,
  BarChart3,
  Search,
} from "lucide-react";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ALL_VENDEDORES = [
  { nome: "Alef Santos", meta: 220_000, real: 122_883, perf: -21.8 },
  { nome: "Alessandro Gomes", meta: 600_000, real: 517_496, perf: 20.7 },
  { nome: "Debora Silva", meta: 520_000, real: 530_724, perf: 42.9 },
  { nome: "Isabela Batista", meta: 40_000, real: 46_009, perf: 61.0 },
  { nome: "Tatiana Fernandes", meta: 190_000, real: 144_534, perf: 3.5 },
  { nome: "Thiago Lopes", meta: 130_000, real: 144_631, perf: 6.6 },
  { nome: "Ana", meta: 400_000, real: 295_684, perf: 20.1 },
];

const ALL_CARTEIRA = [
  { label: "Clientes 80/20", value: 629 },
  { label: "Clientes Gold", value: 154 },
  { label: "Clientes Atenção", value: 1413 },
  { label: "Média SKU/cliente", value: 7.89 },
  { label: "Média positivações", value: 904.67 },
  { label: "Média fat./mês", value: 2_507_150.56 },
];

export default function HomePage() {
  const [vendedorSearch, setVendedorSearch] = useState("");
  const [perfFilter, setPerfFilter] = useState<"all" | "positive" | "negative">("all");

  const filteredVendedores = useMemo(() => {
    return ALL_VENDEDORES.filter((v) => {
      const matchSearch = v.nome.toLowerCase().includes(vendedorSearch.toLowerCase());
      const matchPerf =
        perfFilter === "all" ? true : perfFilter === "positive" ? v.perf >= 0 : v.perf < 0;
      return matchSearch && matchPerf;
    });
  }, [vendedorSearch, perfFilter]);

  const totais = useMemo(() => ({
    meta: filteredVendedores.reduce((s, v) => s + v.meta, 0),
    real: filteredVendedores.reduce((s, v) => s + v.real, 0),
  }), [filteredVendedores]);

  const kpis = useMemo(() => [
    { title: "Faturamento", value: BRL(totais.real * 3.71), sub: "VLT. FAT. 90 DIAS (proporcional)", icon: DollarSign, color: "text-cockpit-accent" },
    { title: "Volume", value: String(filteredVendedores.length > 0 ? Math.round(843 * filteredVendedores.length / ALL_VENDEDORES.length) : 0), sub: "vendas mês atual", icon: Package, color: "text-cockpit-accent" },
    { title: "Margem %", value: "—", sub: "aguardando ETL completo", icon: TrendingUp, color: "text-cockpit-muted" },
    { title: "Ticket Médio", value: filteredVendedores.length > 0 ? BRL(totais.real / filteredVendedores.length) : "—", sub: "por vendedor selecionado", icon: Target, color: "text-cockpit-accent" },
    { title: "Valor Estoque CMV", value: BRL(7_012_707), sub: "custo mercadoria", icon: Wallet, color: "text-cockpit-accent" },
    { title: "Total Clientes", value: "4.642", sub: "carteira geral", icon: Users, color: "text-cockpit-accent" },
    { title: "Clientes Perdidos 90d", value: "2.368", sub: "51% da carteira", icon: TrendingDown, color: "text-cockpit-danger" },
  ], [totais, filteredVendedores]);

  const maxVal = Math.max(...filteredVendedores.flatMap((v) => [v.meta, v.real]), 1);

  const bestPerf = useMemo(() => {
    if (filteredVendedores.length === 0) return null;
    return filteredVendedores.reduce((best, v) => v.perf > best.perf ? v : best);
  }, [filteredVendedores]);

  const worstPerf = useMemo(() => {
    if (filteredVendedores.length === 0) return null;
    return filteredVendedores.reduce((worst, v) => v.perf < worst.perf ? v : worst);
  }, [filteredVendedores]);

  const insights = useMemo(() => {
    const list: Array<{ text: string; border: string; badge: string; badgeBg: string; icon: typeof AlertTriangle }> = [];
    list.push({
      text: "51% dos clientes foram perdidos nos últimos 90 dias (2.368 de 4.642)",
      border: "border-cockpit-danger",
      badge: "Alerta",
      badgeBg: "bg-cockpit-danger/20 text-cockpit-danger",
      icon: AlertTriangle,
    });
    if (bestPerf && bestPerf.perf > 0) {
      list.push({
        text: `${bestPerf.nome} atingiu ${(100 + bestPerf.perf).toFixed(1)}% da meta mensal — melhor performance`,
        border: "border-cockpit-accent",
        badge: "Destaque",
        badgeBg: "bg-cockpit-accent/20 text-cockpit-accent",
        icon: TrendingUp,
      });
    }
    if (worstPerf && worstPerf.perf < 0) {
      list.push({
        text: `${worstPerf.nome} está ${Math.abs(worstPerf.perf).toFixed(1)}% abaixo da meta — requer atenção`,
        border: "border-cockpit-gold",
        badge: "Atenção",
        badgeBg: "bg-cockpit-gold/20 text-cockpit-gold",
        icon: Target,
      });
    }
    return list;
  }, [bestPerf, worstPerf]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Visão executiva</h1>
        <p className="text-cockpit-muted mt-1 text-sm">
          Panorama comercial e operacional — Serra Negra · Março 2026
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-cockpit-muted">
                  {kpi.title}
                </span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-xl font-bold text-white leading-tight">{kpi.value}</span>
              <span className="text-xs text-cockpit-muted">{kpi.sub}</span>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cockpit-accent" />
            <h2 className="text-lg font-semibold text-white">
              Meta vs Real — Vendedores ({filteredVendedores.length})
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
                className="w-full sm:w-48 pl-9 pr-4 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-cockpit-border bg-cockpit-bg p-1">
              {(["all", "positive", "negative"] as const).map((opt) => {
                const labels = { all: "Todos", positive: "Acima", negative: "Abaixo" };
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPerfFilter(opt)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      perfFilter === opt
                        ? "bg-cockpit-accent/20 text-cockpit-accent"
                        : "text-cockpit-muted hover:text-white"
                    }`}
                  >
                    {labels[opt]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredVendedores.length === 0 ? (
            <p className="text-center text-cockpit-muted py-8">Nenhum vendedor encontrado</p>
          ) : (
            filteredVendedores.map((v) => {
              const metaW = (v.meta / maxVal) * 100;
              const realW = (v.real / maxVal) * 100;
              const isPositive = v.perf >= 0;

              return (
                <div key={v.nome} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 font-medium">{v.nome}</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        isPositive ? "text-cockpit-accent" : "text-cockpit-danger"
                      }`}
                    >
                      {isPositive ? "+" : ""}{v.perf.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-5 rounded bg-cockpit-bg overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-cockpit-accent/25"
                      style={{ width: `${metaW}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-cockpit-accent"
                      style={{ width: `${realW}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-cockpit-muted">
                    <span>Meta: {v.meta.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span>
                    <span>Real: {v.real.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-cockpit-border text-xs text-cockpit-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-cockpit-accent/25" />
            Meta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-cockpit-accent" />
            Real
          </span>
          <span className="ml-auto">
            {filteredVendedores.length < ALL_VENDEDORES.length &&
              `Filtrado: ${filteredVendedores.length}/${ALL_VENDEDORES.length} vendedores`
            }
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-cockpit-accent" />
            <h2 className="text-lg font-semibold text-white">Carteira de Clientes</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ALL_CARTEIRA.map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-cockpit-border bg-cockpit-bg p-4"
              >
                <p className="text-xs text-cockpit-muted mb-1">{c.label}</p>
                <p className="text-base font-bold text-white">
                  {c.label.includes("fat.") ? BRL(c.value) : c.value.toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-5 h-5 text-cockpit-gold" />
            <h2 className="text-lg font-semibold text-white">Insights para hoje</h2>
          </div>
          <div className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-cockpit-muted text-sm py-4 text-center">Selecione vendedores para ver insights</p>
            ) : (
              insights.map((ins) => {
                const Icon = ins.icon;
                return (
                  <div
                    key={ins.text}
                    className={`rounded-lg border ${ins.border} bg-cockpit-bg p-4 flex items-start gap-3`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
                    <div className="flex-1 min-w-0">
                      <span
                        className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${ins.badgeBg}`}
                      >
                        {ins.badge}
                      </span>
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
        <h2 className="text-lg font-semibold text-white mb-4">Integração SAP B1</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-cockpit-bg p-3 border border-cockpit-border">
            <p className="text-xs text-cockpit-muted">Notas Fiscais</p>
            <p className="text-sm font-medium text-cockpit-accent">POST /sap/sync/invoices</p>
          </div>
          <div className="rounded-lg bg-cockpit-bg p-3 border border-cockpit-border">
            <p className="text-xs text-cockpit-muted">Vendedores</p>
            <p className="text-sm font-medium text-cockpit-accent">POST /sap/sync/salespersons</p>
          </div>
          <div className="rounded-lg bg-cockpit-bg p-3 border border-cockpit-border">
            <p className="text-xs text-cockpit-muted">Estoque + UDFs</p>
            <p className="text-sm font-medium text-cockpit-accent">POST /sap/sync/inventory</p>
          </div>
          <div className="rounded-lg bg-cockpit-bg p-3 border border-cockpit-border">
            <p className="text-xs text-cockpit-muted">Sync Completo</p>
            <p className="text-sm font-medium text-cockpit-accent">POST /sap/sync/cockpit</p>
          </div>
        </div>
        <p className="text-xs text-cockpit-muted mt-3">
          Endpoints disponíveis para automação — substitui dados estáticos do Excel por dados em tempo real do SAP B1 Service Layer
        </p>
      </section>

      <footer className="text-center text-xs text-cockpit-muted py-4 border-t border-cockpit-border">
        Dados: VOLUME COMERCIAL 10.12.xlsx — última extração: Mar 2026 · Integração SAP B1 disponível
      </footer>
    </div>
  );
}
