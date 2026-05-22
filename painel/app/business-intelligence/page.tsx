"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  DollarSign,
  ShoppingCart,
  Wallet,
  Target,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { fmtBRL, fmtNum } from "@/lib/format";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { useExecutiveSummary } from "@/hooks/useCockpitQueries";
import { useAuth } from "@/components/AuthProvider";
import type { UserRole } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const ExecutiveDashboardCharts = dynamic(
  () =>
    import("./components/ExecutiveDashboardCharts").then((m) => ({
      default: m.ExecutiveDashboardCharts,
    })),
  {
    loading: () => (
      <div className="rounded-xl border border-cockpit-border bg-white p-8 animate-pulse motion-reduce:animate-none h-48" />
    ),
    ssr: false,
  }
);

const KPI_ORDER: Record<UserRole, string[]> = {
  admin: ["Faturamento", "Clientes", "Pedidos", "Ticket Médio", "Qtd. Vendida"],
  supervisor: ["Faturamento", "Clientes", "Pedidos", "Ticket Médio", "Qtd. Vendida"],
  comercial: ["Faturamento", "Pedidos", "Clientes", "Ticket Médio", "Qtd. Vendida"],
  operador: ["Pedidos", "Qtd. Vendida", "Faturamento", "Ticket Médio", "Clientes"],
  viewer: ["Faturamento", "Pedidos", "Ticket Médio", "Clientes", "Qtd. Vendida"],
};

type KpiDef = {
  title: string;
  value: string;
  variation?: number;
  icon: LucideIcon;
  color: string;
  sub?: string;
};

function sortKpis(items: KpiDef[], role: UserRole): KpiDef[] {
  const order = KPI_ORDER[role] ?? KPI_ORDER.viewer;
  return [...items].sort((a, b) => {
    const ia = order.indexOf(a.title);
    const ib = order.indexOf(b.title);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

export default function ExecutiveHomePage() {
  const { user } = useAuth();
  const role: UserRole = user?.role ?? "viewer";
  const { label: periodoLabel, range, monthsInRange } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");
  const prevFrom = format(subMonths(range.from, monthsInRange), "yyyy-MM-dd");
  const prevTo = format(subMonths(range.to, monthsInRange), "yyyy-MM-dd");

  const { data, isLoading, isError, error, refetch } = useExecutiveSummary({
    dateFrom,
    dateTo,
    prevFrom,
    prevTo,
    salesPersonCode,
  });

  const kpiDefs = useMemo((): KpiDef[] => {
    if (!data) return [];
    const k = data.kpis;
    return [
      { title: "Faturamento", value: fmtBRL(k.fat), variation: k.fatVar, icon: DollarSign, color: "text-cockpit-accent" },
      { title: "Pedidos", value: fmtNum(k.pedidos), variation: k.pedVar, icon: ShoppingCart, color: "text-sky-500" },
      { title: "Ticket Médio", value: fmtBRL(k.ticket), variation: k.ticketVar, icon: Target, color: "text-amber-500" },
      { title: "Clientes", value: fmtNum(k.clientesAtivos), variation: k.clientesVar, icon: Wallet, color: "text-teal-500" },
      {
        title: "Qtd. Vendida",
        value: fmtNum(Math.round(k.qty)),
        sub: "unidades (× embalagem)",
        icon: Layers,
        color: "text-violet-500",
      },
    ];
  }, [data]);

  const kpisOrdered = useMemo(() => sortKpis(kpiDefs, role), [kpiDefs, role]);
  const projection = data?.monthProjection ?? null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Executiva</h1>
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState message={error instanceof Error ? error.message : "Erro ao carregar"} onRetry={() => refetch()} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Visão Executiva</h1>
        <p className="text-cockpit-muted mt-1 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <CalendarDays className="w-3.5 h-3.5 shrink-0 text-gray-600" aria-hidden />
          <span className="text-gray-600 font-medium">{periodoLabel}</span>
          <span className="text-[10px] text-cockpit-muted hidden sm:inline">· ordenação de KPIs adaptada ao seu perfil</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3" aria-label="Indicadores do período">
        {kpisOrdered.map((kpi) => {
          const Icon = kpi.icon;
          const hasVar = kpi.variation !== undefined && kpi.variation !== 0;
          const up = (kpi.variation ?? 0) > 0;
          return (
            <div
              key={kpi.title}
              className="rounded-xl border border-cockpit-border bg-white p-3 sm:p-4 hover:border-cockpit-accent/30 motion-safe:transition-all motion-safe:duration-200 group"
            >
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-cockpit-muted">
                  {kpi.title}
                </span>
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${kpi.color} opacity-60 group-hover:opacity-100 motion-safe:transition-opacity`} aria-hidden />
              </div>
              <p className="text-base sm:text-xl font-bold text-gray-900 leading-tight tabular-nums truncate">{kpi.value}</p>
              <div className="mt-1 sm:mt-1.5 flex items-center gap-1 flex-wrap">
                {hasVar && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {up ? <ArrowUpRight className="w-3 h-3" aria-hidden /> : <ArrowDownRight className="w-3 h-3" aria-hidden />}
                    {Math.abs(kpi.variation!).toFixed(1)}%
                  </span>
                )}
                {hasVar && (
                  <span className="text-[9px] sm:text-[10px] text-cockpit-muted hidden sm:inline">vs anterior</span>
                )}
                {kpi.sub && <span className="text-[9px] sm:text-[10px] text-cockpit-muted">{kpi.sub}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {projection && (
        <section
          className="rounded-xl border border-cockpit-border bg-gradient-to-r from-cockpit-accent/[0.04] via-white to-white p-4 sm:p-5"
          aria-labelledby="exec-projection-heading"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex items-start gap-3 min-w-0 lg:min-w-[260px]">
              <div className="p-2 rounded-lg bg-cockpit-accent/10 shrink-0">
                <Sparkles className="w-4 h-4 text-cockpit-accent" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2
                  id="exec-projection-heading"
                  className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider"
                >
                  Projeção do mês corrente
                </h2>
                <p className="text-[11px] text-cockpit-muted mt-0.5">
                  Baseada na média de faturamento por dia útil <strong className="text-gray-700">{projection.monthLabel}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 flex-1">
              <div>
                <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1">
                  Realizado
                </div>
                <div className="text-base sm:text-xl font-bold text-gray-900 tabular-nums">{fmtBRL(projection.realized)}</div>
                <div className="text-[10px] text-cockpit-muted mt-0.5">
                  {projection.realizedOrders} pedidos · {projection.daysElapsed}/{projection.totalBusinessDays} dias úteis
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1">
                  Média/Dia Útil
                </div>
                <div className="text-base sm:text-xl font-bold text-gray-900 tabular-nums">{fmtBRL(projection.avgPerBusinessDay)}</div>
                <div className="text-[10px] text-cockpit-muted mt-0.5">
                  base {projection.daysElapsed} dia{projection.daysElapsed !== 1 ? "s" : ""}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" aria-hidden />Projeção Final
                </div>
                <div className="text-base sm:text-2xl font-bold text-cockpit-accent tabular-nums">{fmtBRL(projection.projection)}</div>
                <div className="text-[10px] text-cockpit-muted mt-0.5">
                  + {fmtBRL(projection.projection - projection.realized)} estimado em {projection.remainingBusinessDays} dia{projection.remainingBusinessDays !== 1 ? "s" : ""}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1">
                  Progresso do Mês
                </div>
                <div className="text-base sm:text-xl font-bold text-gray-900 tabular-nums">{projection.pctElapsed.toFixed(0)}%</div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5" role="progressbar" aria-valuenow={projection.pctElapsed} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="h-1.5 rounded-full bg-cockpit-accent motion-safe:transition-all"
                    style={{ width: `${Math.min(100, projection.pctElapsed)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <ExecutiveDashboardCharts summary={data} range={range} />

      <footer className="text-center text-[10px] sm:text-xs text-cockpit-muted py-3 border-t border-cockpit-border">
        SAP B1 · {data.meta.orderCount} pedidos · {data.meta.clienteAtivos} clientes · {data.meta.spCount} vendedores
      </footer>
    </div>
  );
}
