"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import {
  Megaphone,
  CalendarDays,
  GitBranch,
  Target,
  Link2,
  Info,
  BarChart3,
  CircleDollarSign,
} from "lucide-react";
import { fmtBRL, fmtNum } from "@/lib/format";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { useRdOverviewBi } from "@/hooks/useCockpitQueries";
import { BiEmptyState } from "@/components/cockpit/BiEmptyState";
import { BI_ROUTE_PREFIX } from "@/lib/bi-routes";

const MarketingFunnelChart = dynamic(
  () =>
    import("./MarketingFunnelChart").then((m) => ({
      default: m.MarketingFunnelChart,
    })),
  {
    loading: () => (
      <div
        className="h-72 rounded-lg border border-cockpit-border bg-white animate-pulse motion-reduce:animate-none"
        aria-busy="true"
        aria-label="Carregando gráfico"
      />
    ),
    ssr: false,
  }
);

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  const d = iso.includes("T") ? iso.split("T")[0] : iso;
  if (d?.length !== 10) return iso.slice(0, 10);
  return format(new Date(d + "T12:00:00"), "dd/MM/yyyy");
}

export default function MarketingCrmBiPage() {
  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data, isLoading, isError, error, refetch } = useRdOverviewBi({
    dateFrom,
    dateTo,
    salesPersonCode,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/10">
            <Megaphone className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketing & CRM</h1>
            <p className="text-cockpit-muted mt-1 text-sm">Carregando RD Station...</p>
          </div>
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Marketing & CRM</h1>
        <ErrorState
          message={error instanceof Error ? error.message : "Falha ao carregar dados"}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/10">
            <Megaphone className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketing & CRM</h1>
            <p className="text-cockpit-muted mt-1 flex items-center gap-2 text-sm flex-wrap">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              RD Station — visão apenas leitura
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-950">
          <div className="flex gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-3">
              <p className="font-medium">Integração RD Station CRM não configurada neste ambiente.</p>
              <p className="text-amber-900/90 leading-relaxed">
                Defina <code className="bg-white/70 px-1 rounded text-xs font-mono">RD_STATION_CRM_ACCESS_TOKEN</code>{" "}
                com o Bearer OAuth da API CRM v2 para funis e negociações, e opcionalmente{" "}
                <code className="bg-white/70 px-1 rounded text-xs font-mono">RD_STATION_MARKETING_ACCESS_TOKEN</code>{" "}
                para o bloco &quot;Cliente 360&quot; em{" "}
                <Link href={`${BI_ROUTE_PREFIX}/clientes`} className="font-medium underline underline-offset-2">
                  Clientes
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data.error && !data.ongoingTotals) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Marketing & CRM</h1>
        <div className="rounded-xl border border-red-100 bg-red-50/90 p-4 text-sm text-red-900">{data.error}</div>
      </div>
    );
  }

  const totals = data.ongoingTotals;
  const chartRows = [...(data.pipelinesWithCounts ?? [])]
    .sort((a, b) => b.ongoingDealCount - a.ongoingDealCount)
    .slice(0, 16)
    .map((r) => ({
      name: r.name,
      abertos: r.ongoingDealCount,
      etapas: r.stageCount,
    }));

  const sapBridge = data.sapBridge;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-purple-600/10">
            <Megaphone className="w-6 h-6 text-purple-700" aria-hidden />
          </span>
          Marketing & CRM
        </h1>
        <p className="text-cockpit-muted mt-1 flex flex-wrap items-center gap-2 text-sm">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          RD Station CRM · <span className="text-gray-700">{periodoLabel}</span>
          {sapBridge ? (
            <>
              <span className="text-cockpit-border" aria-hidden>
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-gray-700">
                <Link2 className="w-3 h-3" aria-hidden /> Período alinhado ao filtro BI (liga SAP na caixa &quot;Ponte SAP&quot;).
              </span>
            </>
          ) : (
            <>
              <span className="text-cockpit-border" aria-hidden>
                ·
              </span>
              <span>Inclua datas válidas no período BI para estimar Pedidos SAP no mesmo intervalo.</span>
            </>
          )}
        </p>
        <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-3xl border-l-2 border-purple-200 pl-3 py-0.5">
          <strong className="font-semibold text-gray-800">Separação de origem:</strong> funis, negócios e amostras vêm da API{" "}
          <strong className="text-purple-900">RD Station</strong>; totais marcados como SAP usam os mesmos agregados ERP do cockpit, servidos pelo backend (nunca direto no navegador).
        </p>
      </div>

      {/* KPIs CRM */}
      <section
        aria-label="Indicadores RD CRM"
        className={`grid grid-cols-2 gap-3 ${sapBridge ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}
      >
        {(
          [
            {
              title: "Funis cadastrados",
              value: String(totals?.pipelineCount ?? 0),
              Icon: GitBranch,
              tintClass: "text-violet-600",
              bgClass: "bg-violet-50",
            },
            {
              title: "Negociações em aberto",
              value: totals ? fmtNum(totals.ongoingDealCount) : "—",
              sub: totals?.dealsTruncated ? "(amostra ≥250)" : undefined,
              Icon: Target,
              tintClass: "text-emerald-600",
              bgClass: "bg-emerald-50",
            },
            {
              title: "Com pipeline ativa",
              value: String(
                (data.pipelinesWithCounts ?? []).filter((p) => p.ongoingDealCount > 0).length
              ),
              Icon: BarChart3,
              tintClass: "text-sky-600",
              bgClass: "bg-sky-50",
            },
            ...(sapBridge
              ? [
                  {
                    title: "Pedidos SAP (período)",
                    value: fmtNum(sapBridge.pedidosNoPeriodo),
                    Icon: Link2,
                    tintClass: "text-cockpit-accent",
                    bgClass: "bg-red-50",
                  },
                  {
                    title: "Fat. SAP (período)",
                    value: fmtBRL(sapBridge.faturamentoNoPeriodo),
                    Icon: CircleDollarSign,
                    tintClass: "text-amber-700",
                    bgClass: "bg-amber-50",
                  },
                ]
              : []),
          ]
        ).map((k) => (
          <div
            key={k.title}
            className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-purple-400/35 motion-safe:transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`rounded-md p-1 ${k.bgClass}`}>
                <k.Icon className={`w-3.5 h-3.5 ${k.tintClass}`} aria-hidden />
              </div>
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.title}</span>
            </div>
            <span className="text-xl font-bold text-gray-900">{k.value}</span>
            {"sub" in k && k.sub ? <p className="text-[10px] text-amber-600 mt-0.5">{k.sub}</p> : null}
          </div>
        ))}
      </section>

      {sapBridge && (
        <div className="rounded-xl border border-cockpit-border bg-gradient-to-br from-white to-purple-50/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-purple-700" aria-hidden /> Ponte comercial SAP ↔ RD
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed mb-4">
            <strong>Pedidos SAP</strong> e <strong>faturamento</strong> são os mesmos agregados usados nas outras páginas do BI
            neste período e filtro de vendedor. Negociações <strong>em aberto</strong> são do CRM RD (funil), conceito distinto —
            não confundir com Pedido de Venda liberado ou faturamento contábil.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-white/90 border border-cockpit-border/80 p-3">
              <dt className="text-cockpit-muted uppercase tracking-wide font-semibold">Negociações abertas (RD)</dt>
              <dd className="text-lg font-bold text-emerald-700 mt-1">{fmtNum(data.ongoingTotals?.ongoingDealCount ?? 0)}</dd>
            </div>
            <div className="rounded-lg bg-white/90 border border-cockpit-border/80 p-3">
              <dt className="text-cockpit-muted uppercase tracking-wide font-semibold">Linhas SAP (ativo, período)</dt>
              <dd className="text-lg font-bold text-cockpit-accent mt-1">{fmtNum(sapBridge.pedidosNoPeriodo)}</dd>
            </div>
            <div className="rounded-lg bg-white/90 border border-cockpit-border/80 p-3">
              <dt className="text-cockpit-muted uppercase tracking-wide font-semibold">Interpretação</dt>
              <dd className="text-gray-700 mt-1">
                Combine funil RD para <em>prognóstico</em>; SAP para performance fiscal no período.
              </dd>
            </div>
          </dl>
        </div>
      )}

      <section
        className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6"
        aria-labelledby="marketing-funnel-heading"
      >
        <h2 id="marketing-funnel-heading" className="text-sm font-semibold text-gray-900 mb-1">
          Negociações em aberto por funil
        </h2>
        <p className="text-xs text-cockpit-muted mb-4">
          Contagem atual de deals com status <code className="text-[10px]">ongoing</code>.
        </p>
        {chartRows.length === 0 ? (
          <BiEmptyState title="Nenhuma negociação em aberto retornada" />
        ) : (
          <MarketingFunnelChart rows={chartRows} />
        )}
      </section>

      {/* Tabela pipelines */}
      <section className="rounded-xl border border-cockpit-border overflow-hidden bg-white">
        <div className="px-5 py-3 border-b border-cockpit-border bg-cockpit-bg/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Funis — etapas e negócios abertos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[480px]">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-muted uppercase text-[10px]">
                <th scope="col" className="py-3 px-4 font-semibold">
                  Funil
                </th>
                <th scope="col" className="py-3 px-4 font-semibold text-center">
                  Etapas
                </th>
                <th scope="col" className="py-3 px-4 font-semibold text-center">
                  Em aberto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/60">
              {(data.pipelinesWithCounts ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-cockpit-accent/[0.03] motion-safe:transition-colors">
                  <td className="py-2.5 px-4 font-medium text-gray-800">{p.name}</td>
                  <td className="py-2.5 px-4 text-center font-mono text-gray-600">{p.stageCount}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 font-semibold ${
                        p.ongoingDealCount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.ongoingDealCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Amostra de deals */}
      <section className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Amostra — negócios em aberto</h2>
        {(data.ongoingDealsSample ?? []).length === 0 ? (
          <BiEmptyState title="Nenhuma amostra disponível" />
        ) : (
          <ul className="divide-y divide-cockpit-border/60 border border-cockpit-border rounded-lg overflow-hidden bg-white">
            {(data.ongoingDealsSample ?? []).map((d) => (
              <li key={d.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{d.name}</p>
                  <p className="text-[11px] text-cockpit-muted font-mono">Deal {d.id.slice(0, 12)}…</p>
                </div>
                <div className="flex shrink-0 gap-4 text-xs text-gray-600">
                  <span>Prev.: {formatShortDate(d.expectedClose)}</span>
                  {d.totalPrice != null ? <span className="font-medium text-purple-700">{fmtBRL(d.totalPrice)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
