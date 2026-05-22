"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  ReferenceLine,
} from "recharts";
import {
  Calendar,
  BarChart3,
  Hash,
  Package,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Copy } from "lucide-react";
import { fmtBRL, fmtNum } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/export-csv";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import {
  CHART_GRID,
  CHART_SERIES_PRIMARY,
  CHART_SERIES_PALETTE,
  chartAxisTick,
  formatYAxisCompact,
} from "@/lib/chart-theme";
import { BI_ROUTE_PREFIX } from "@/lib/bi-routes";
import type { ExecutiveSummary } from "@/lib/bi/executive-aggregate";
import { BiEmptyState } from "@/components/cockpit/BiEmptyState";

type Range = { from: Date; to: Date };

export function ExecutiveDashboardCharts({
  summary,
}: {
  summary: ExecutiveSummary;
  range: Range;
}) {
  const {
    businessDayTrend,
    businessDayMedian,
    weeklyTrend,
    weeklyMedian,
    topVendedores,
    statusData,
    topProdutos,
  } = summary;
  const totalFat = summary.kpis.fat;
  const businessDayCount = businessDayTrend.length;
  const businessDaysWithSales = businessDayTrend.filter((d) => d.Faturamento > 0).length;
  const weeksWithSales = weeklyTrend.filter((w) => w.Faturamento > 0).length;
  const totalProductFat = topProdutos.reduce((s, p) => s + p.fat, 0);
  const totalProductQty = topProdutos.reduce((s, p) => s + p.qty, 0);

  return (
    <>
      <section className="rounded-xl border border-cockpit-border bg-white p-3 sm:p-5" aria-labelledby="exec-trend-heading">
        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cockpit-accent" aria-hidden />
            <h2 id="exec-trend-heading" className="text-xs sm:text-sm font-semibold text-gray-900">
              Evolução de Faturamento
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-cockpit-muted">
            <span className="uppercase tracking-wider">Dias úteis · Seg–Sex</span>
            {businessDaysWithSales > 0 && (
              <span className="hidden sm:inline">
                {businessDaysWithSales}/{businessDayCount} dias com vendas
              </span>
            )}
            {businessDayMedian > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold">
                <span className="inline-block w-2 h-px bg-violet-600 align-middle" />
                Mediana {fmtBRL(businessDayMedian, 0)}
              </span>
            )}
          </div>
        </div>
        {businessDayTrend.length === 0 ? (
          <BiEmptyState />
        ) : (
          <div className="h-52 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={businessDayTrend}
                barCategoryGap="18%"
                margin={{ left: -10, right: 5, top: 5, bottom: 0 }}
              >
                <title>Evolução de faturamento por dia útil</title>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="label"
                  tick={chartAxisTick("sm")}
                  axisLine={false}
                  tickLine={false}
                  interval={businessDayTrend.length > 15 ? Math.floor(businessDayTrend.length / 10) : 0}
                />
                <YAxis
                  tick={chartAxisTick("sm")}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                {businessDayMedian > 0 && (
                  <ReferenceLine
                    y={businessDayMedian}
                    stroke="#7c3aed"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    ifOverflow="extendDomain"
                    label={{
                      value: `Mediana ${formatYAxisCompact(businessDayMedian)}`,
                      fill: "#7c3aed",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
                <Bar dataKey="Faturamento" radius={[3, 3, 0, 0]}>
                  {businessDayTrend.map((d) => (
                    <Cell
                      key={d.date}
                      fill={d.Faturamento >= businessDayMedian && d.Faturamento > 0 ? CHART_SERIES_PRIMARY : "#d4b5b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
        <section className="xl:col-span-2 rounded-xl border border-cockpit-border bg-white p-3 sm:p-5" aria-labelledby="exec-vend-heading">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cockpit-accent" aria-hidden />
              <h2 id="exec-vend-heading" className="text-xs sm:text-sm font-semibold text-gray-900">
                Faturamento por Vendedor
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {topVendedores.length > 0 && (
                <>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-gray-600 hover:text-cockpit-accent min-h-[44px] sm:min-h-0 px-2"
                    onClick={() => {
                      const rows = topVendedores.map((v) => [v.nome, String(v.pedidos), String(v.fat)]);
                      downloadCsv(
                        "bi-top-vendedores.csv",
                        toCsv(rows, ["Vendedor", "Pedidos", "Faturamento"])
                      );
                      toast.success("CSV exportado");
                    }}
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden />
                    CSV
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-gray-600 hover:text-cockpit-accent min-h-[44px] sm:min-h-0 px-2"
                    onClick={async () => {
                      const text = topVendedores
                        .map((v, i) => `${i + 1}. ${v.nome}: ${fmtBRL(v.fat)} (${v.pedidos} ped.)`)
                        .join("\n");
                      await navigator.clipboard.writeText(text);
                      toast.success("Resumo copiado");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden />
                    Copiar
                  </button>
                </>
              )}
              <Link
                href={`${BI_ROUTE_PREFIX}/vendedores`}
                className="text-[11px] text-cockpit-accent hover:underline font-medium"
              >
                Ver →
              </Link>
            </div>
          </div>
          {topVendedores.length === 0 ? (
            <BiEmptyState />
          ) : (
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVendedores.map((v) => ({ name: v.nome.split(" ")[0], Faturamento: v.fat }))}
                  barCategoryGap="20%"
                  margin={{ left: -10, right: 5, top: 5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="name" tick={chartAxisTick("sm")} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={chartAxisTick("sm")}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v: number) => formatYAxisCompact(v)}
                  />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  <Bar dataKey="Faturamento" radius={[6, 6, 0, 0]} fill={CHART_SERIES_PRIMARY} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-cockpit-border bg-white p-3 sm:p-5" aria-labelledby="exec-status-heading">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Hash className="w-4 h-4 text-cockpit-accent" aria-hidden />
            <h2 id="exec-status-heading" className="text-xs sm:text-sm font-semibold text-gray-900">
              Status dos Pedidos
            </h2>
          </div>
          {statusData.length === 0 ? (
            <BiEmptyState title="Sem dados" />
          ) : (
            <div className="flex flex-col items-center justify-center h-48 sm:h-64">
              <div className="h-36 sm:h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <title>Distribuição de pedidos por status</title>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={4}
                      label={(props: { name?: string; percent?: number }) =>
                        `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {statusData.map((s) => (
                        <Cell key={s.name} fill={s.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={(_, v) => fmtNum(v)} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex gap-3 sm:gap-4 mt-2 list-none p-0 m-0" aria-label="Legenda de status">
                {statusData.map((s) => (
                  <li key={s.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} aria-hidden />
                    <span className="text-gray-600">{s.name}</span>
                    <span className="font-semibold text-gray-900">{fmtNum(s.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        {/* TOP 10 PRODUTOS — visão unificada */}
        <section className="rounded-xl border border-cockpit-border bg-white p-3 sm:p-5" aria-labelledby="exec-prod-heading">
          <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package className="w-4 h-4 text-cockpit-accent" aria-hidden />
              <h2 id="exec-prod-heading" className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                Top 10 Produtos
              </h2>
              <span className="text-[10px] text-cockpit-muted font-medium hidden sm:inline">
                · visão unificada
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-cockpit-muted">
              <span className="tabular-nums hidden sm:inline">{fmtNum(Math.round(totalProductQty))} un</span>
              <span className="font-semibold text-gray-700 tabular-nums">{fmtBRL(totalProductFat, 0)}</span>
              <Link
                href="/catalogo"
                className="text-cockpit-accent hover:underline font-medium ml-1"
              >
                Ver →
              </Link>
            </div>
          </div>
          {topProdutos.length === 0 ? (
            <BiEmptyState title="Sem dados de produtos" />
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {topProdutos.map((p, i) => {
                const maxFat = topProdutos[0]?.fat || 1;
                const pct = (p.fat / maxFat) * 100;
                const color = CHART_SERIES_PALETTE[i % CHART_SERIES_PALETTE.length];
                return (
                  <div key={p.key} className="group">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-gray-400 tabular-nums w-4 text-right shrink-0">
                          {i + 1}
                        </span>
                        <span
                          className="inline-flex items-center justify-center text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 text-white"
                          style={{ background: color }}
                          title={`Sigla ${p.prefix}`}
                        >
                          {p.prefix}
                        </span>
                        <span
                          className="text-[11px] sm:text-xs text-gray-800 font-medium truncate"
                          title={p.desc}
                        >
                          {p.desc}
                        </span>
                        {p.skus > 1 && (
                          <span
                            className="inline-flex items-center text-[9px] font-bold bg-gray-100 text-gray-600 px-1 py-0.5 rounded shrink-0"
                            title={`${p.skus} SKUs unificados — embalagens: ${p.embalas.join(", ")}`}
                          >
                            ×{p.skus}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs shrink-0 tabular-nums">
                        <span className="text-gray-400 hidden sm:inline">{fmtNum(Math.round(p.qty))} un</span>
                        <span className="text-gray-900 font-semibold">{fmtBRL(p.fat)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 tabular-nums w-9 text-right shrink-0">
                        {(p.fat / Math.max(totalProductFat, 1) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* VENDAS POR SEMANA — últimas 8 semanas */}
        <section className="rounded-xl border border-cockpit-border bg-white p-3 sm:p-5" aria-labelledby="exec-week-heading">
          <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-4 h-4 text-cockpit-accent" aria-hidden />
              <h2 id="exec-week-heading" className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                Vendas — Últimas 8 Semanas
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-cockpit-muted">
              <span className="hidden sm:inline">{weeksWithSales}/{weeklyTrend.length} semanas com vendas</span>
              {weeklyMedian > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold">
                  <span className="inline-block w-2 h-px bg-violet-600 align-middle" />
                  Mediana {fmtBRL(weeklyMedian, 0)}
                </span>
              )}
            </div>
          </div>
          {weeklyTrend.length === 0 || weeksWithSales === 0 ? (
            <BiEmptyState title="Sem dados nas últimas 8 semanas" />
          ) : (
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyTrend}
                  barCategoryGap="22%"
                  margin={{ left: -10, right: 5, top: 5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="label" tick={chartAxisTick("sm")} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={chartAxisTick("sm")}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v: number) => formatYAxisCompact(v)}
                  />
                  <Tooltip
                    content={(props: { active?: boolean; payload?: readonly { payload?: { rangeLabel: string; Faturamento: number; Pedidos: number } }[] }) => {
                      const p = props.payload?.[0]?.payload;
                      if (!props.active || !p) return null;
                      return (
                        <BiChartTooltip
                          active
                          variant="cockpit"
                          label={`Semana ${p.rangeLabel}`}
                          payload={[
                            { name: "Faturamento", value: p.Faturamento },
                            { name: "Pedidos", value: p.Pedidos },
                          ]}
                          formatValue={(name, v) => (name === "Pedidos" ? fmtNum(v) : fmtBRL(v))}
                        />
                      );
                    }}
                  />
                  {weeklyMedian > 0 && (
                    <ReferenceLine
                      y={weeklyMedian}
                      stroke="#7c3aed"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                      label={{
                        value: `Med ${formatYAxisCompact(weeklyMedian)}`,
                        fill: "#7c3aed",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                  )}
                  <Bar dataKey="Faturamento" radius={[6, 6, 0, 0]}>
                    {weeklyTrend.map((w, i) => {
                      const isCurrentWeek = i === weeklyTrend.length - 1;
                      const fill = w.Faturamento === 0
                        ? "#e5e7eb"
                        : isCurrentWeek
                          ? "#f59e0b"
                          : w.Faturamento >= weeklyMedian ? CHART_SERIES_PRIMARY : "#d4b5b8";
                      return <Cell key={w.weekStart} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-cockpit-muted flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CHART_SERIES_PRIMARY }} />
              ≥ mediana
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#d4b5b8]" />
              &lt; mediana
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500" />
              Semana atual (parcial)
            </span>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-cockpit-border bg-white overflow-hidden" aria-labelledby="exec-clients-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3 sm:py-4 border-b border-cockpit-border/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cockpit-accent" aria-hidden />
            <h2 id="exec-clients-heading" className="text-xs sm:text-sm font-semibold text-gray-900">
              Top 10 Clientes
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {summary.topClientes.length > 0 && (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-gray-600 hover:text-cockpit-accent min-h-[44px] sm:min-h-0 px-2"
                  onClick={() => {
                    const rows = summary.topClientes.map((c, i) => [
                      String(i + 1),
                      c.nome,
                      String(c.pedidos),
                      String(c.fat),
                    ]);
                    downloadCsv(
                      "bi-top-clientes.csv",
                      toCsv(rows, ["#", "Cliente", "Pedidos", "Faturamento"])
                    );
                    toast.success("CSV exportado");
                  }}
                >
                  <Download className="w-3.5 h-3.5" aria-hidden />
                  CSV
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-gray-600 hover:text-cockpit-accent min-h-[44px] sm:min-h-0 px-2"
                  onClick={async () => {
                    const text = summary.topClientes
                      .map((c, i) => `${i + 1}. ${c.nome}: ${fmtBRL(c.fat)} (${c.pedidos} ped.)`)
                      .join("\n");
                    await navigator.clipboard.writeText(text);
                    toast.success("Resumo copiado");
                  }}
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden />
                  Copiar
                </button>
              </>
            )}
            <Link
              href="/clientes"
              className="text-[11px] text-cockpit-accent hover:underline font-medium"
            >
              Ver →
            </Link>
          </div>
        </div>
        {summary.topClientes.length === 0 ? (
          <BiEmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="bg-gray-50/60">
                  <th scope="col" className="text-left py-2.5 px-3 sm:px-5 text-[10px] sm:text-xs font-semibold text-cockpit-muted uppercase tracking-wider w-8">
                    #
                  </th>
                  <th scope="col" className="text-left py-2.5 px-2 sm:px-3 text-[10px] sm:text-xs font-semibold text-cockpit-muted uppercase tracking-wider">
                    Cliente
                  </th>
                  <th scope="col" className="text-right py-2.5 px-2 sm:px-5 text-[10px] sm:text-xs font-semibold text-cockpit-muted uppercase tracking-wider">
                    Ped.
                  </th>
                  <th scope="col" className="text-right py-2.5 px-2 sm:px-5 text-[10px] sm:text-xs font-semibold text-cockpit-muted uppercase tracking-wider">
                    Faturamento
                  </th>
                  <th
                    scope="col"
                    className="text-right py-2.5 px-2 sm:px-5 text-[10px] sm:text-xs font-semibold text-cockpit-muted uppercase tracking-wider hidden sm:table-cell"
                  >
                    %
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-2 sm:px-5 text-[10px] sm:text-xs font-semibold text-cockpit-muted uppercase tracking-wider w-24 sm:w-36 hidden md:table-cell"
                  >
                    Conc.
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.topClientes.map((c, i) => {
                  const pct = totalFat > 0 ? (c.fat / totalFat) * 100 : 0;
                  return (
                    <tr key={c.cardCode} className="border-t border-gray-50 hover:bg-gray-50/50 motion-safe:transition-colors">
                      <td className="py-2.5 px-3 sm:px-5 text-gray-400 font-medium text-xs">{i + 1}</td>
                      <td className="py-2.5 px-2 sm:px-3 font-medium text-gray-900 truncate max-w-[140px] sm:max-w-[260px] text-xs sm:text-sm">
                        {c.nome}
                      </td>
                      <td className="py-2.5 px-2 sm:px-5 text-right text-gray-600 tabular-nums text-xs">{c.pedidos}</td>
                      <td className="py-2.5 px-2 sm:px-5 text-right font-semibold text-gray-900 tabular-nums text-xs sm:text-sm">
                        {fmtBRL(c.fat)}
                      </td>
                      <td className="py-2.5 px-2 sm:px-5 text-right text-gray-500 tabular-nums text-xs hidden sm:table-cell">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-2 sm:px-5 hidden md:table-cell">
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-cockpit-accent/70 motion-safe:transition-all"
                            style={{ width: `${Math.min(pct * 3, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
