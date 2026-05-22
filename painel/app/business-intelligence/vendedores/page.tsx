"use client";

import { useState, useMemo } from "react";
import {
  Users, DollarSign, TrendingUp, Target, Search, CalendarDays, ShoppingCart,
  Award, BarChart3, History,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ComposedChart, ScatterChart, Scatter, ZAxis,
  ReferenceLine,
} from "recharts";
import { fmtBRL, fmtNum } from "@/lib/format";
import {
  fetchSalesOrders, fetchSalesPersons,
  type SalesOrderRow, type SapSalesPerson,
} from "@/lib/cockpit-api";
import { isFreightOrder } from "@/lib/orders";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import {
  CHART_AXIS_LINE,
  CHART_SERIES_PRIMARY,
  CHART_AXIS_LABEL_PROPS,
  chartAxisTick,
  formatYAxisCompact,
} from "@/lib/chart-theme";
import {
  format, parseISO, startOfMonth, subMonths, isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5", "#16a34a", "#ea580c"];

interface VendRow {
  nome: string;
  code: number;
  fat: number;
  pedidos: number;
  ticket: number;
  active: boolean;
  clientesUnicos: number;
  qtdTotal: number;
  rank: number;
  pctFat: number;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildVendRows(orders: SalesOrderRow[], persons: SapSalesPerson[]): VendRow[] {
  const agg = new Map<number, { fat: number; pedidos: number; clientes: Set<string>; qtd: number }>();
  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    if (isFreightOrder(o)) continue; // frete não compõe faturamento de produto
    const c = o.sales_person_code ?? -1;
    const cur = agg.get(c) ?? { fat: 0, pedidos: 0, clientes: new Set(), qtd: 0 };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    cur.clientes.add(o.card_code);
    cur.qtd += Number(o.total_quantity) || 0;
    agg.set(c, cur);
  }

  const totalFat = Array.from(agg.values()).reduce((s, a) => s + a.fat, 0);

  const rows = persons.map((p) => {
    const a = agg.get(p.SalesEmployeeCode) ?? { fat: 0, pedidos: 0, clientes: new Set(), qtd: 0 };
    return {
      nome: p.SalesEmployeeName,
      code: p.SalesEmployeeCode,
      fat: a.fat,
      pedidos: a.pedidos,
      ticket: a.pedidos > 0 ? a.fat / a.pedidos : 0,
      active: p.Active === "tYES",
      clientesUnicos: a.clientes.size,
      qtdTotal: a.qtd,
      rank: 0,
      pctFat: totalFat > 0 ? (a.fat / totalFat) * 100 : 0,
    };
  }).sort((a, b) => b.fat - a.fat);

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

function buildEvolution(orders: SalesOrderRow[], persons: SapSalesPerson[]) {
  const pMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));
  const byMonth = new Map<string, Map<string, number>>();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    if (isFreightOrder(o)) continue;
    const month = format(parseISO(o.doc_date), "yyyy-MM");
    const nome = pMap.get(o.sales_person_code ?? -1) ?? "Outros";
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const m = byMonth.get(month)!;
    m.set(nome, (m.get(nome) ?? 0) + (Number(o.doc_total) || 0));
  }

  const vendedoresTop = [...new Set(
    orders.filter((o) => o.cancelled !== "Y" && !isFreightOrder(o)).map((o) => pMap.get(o.sales_person_code ?? -1) ?? "Outros")
  )].slice(0, 5);

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, map]) => {
      const row: Record<string, any> = { month: month.substring(5) + "/" + month.substring(2, 4) };
      for (const v of vendedoresTop) {
        row[v] = map.get(v) ?? 0;
      }
      return row;
    });
}

// ─── Componente da aba "Histórico 12 meses" ───────────────────────

const METRIC_CONFIG = {
  pedidos: { label: "Quantidade de Pedidos", short: "pedidos", icon: ShoppingCart, format: (v: number) => fmtNum(Math.round(v)) },
  fat: { label: "Faturamento", short: "R$", icon: DollarSign, format: (v: number) => fmtBRL(v) },
  itens: { label: "Itens Vendidos", short: "itens", icon: BarChart3, format: (v: number) => fmtNum(Math.round(v)) },
} as const;
type YearMetric = keyof typeof METRIC_CONFIG;

function YearTrendSection({
  yearTrend,
  yearMetric,
  setYearMetric,
  yearVendorCode,
  setYearVendorCode,
  vendors,
  vendorName,
  kpis,
}: {
  yearTrend: MonthlyVendDatum[];
  yearMetric: YearMetric;
  setYearMetric: (m: YearMetric) => void;
  yearVendorCode: "ALL" | number;
  setYearVendorCode: (v: "ALL" | number) => void;
  vendors: SapSalesPerson[];
  vendorName: string;
  kpis: {
    sum: number; monthsWithSales: number; avg: number; med: number;
    max: number; min: number;
    maxMonth: MonthlyVendDatum | undefined;
    minMonth: MonthlyVendDatum | undefined;
    trendPct: number;
  };
}) {
  const metric = METRIC_CONFIG[yearMetric];
  const trendUp = kpis.trendPct > 0;
  const trendNeutral = Math.abs(kpis.trendPct) < 1;

  return (
    <div className="space-y-4">
      {/* Header com controles */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4 text-cockpit-accent" />
            Histórico — Últimos 12 Meses
          </h3>
          <p className="text-[11px] text-cockpit-muted mt-0.5 truncate">
            <strong className="text-gray-700">{vendorName}</strong> · independente do período selecionado no topo
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle métrica */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
            {(Object.keys(METRIC_CONFIG) as YearMetric[]).map((m) => {
              const Icon = METRIC_CONFIG[m].icon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setYearMetric(m)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold motion-safe:transition-all ${
                    yearMetric === m
                      ? "bg-white text-cockpit-accent shadow-sm"
                      : "text-cockpit-muted hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {METRIC_CONFIG[m].label}
                </button>
              );
            })}
          </div>
          {/* Seletor de vendedor */}
          <select
            value={String(yearVendorCode)}
            onChange={(e) => setYearVendorCode(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-cockpit-border text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 max-w-[220px]"
          >
            <option value="ALL">Todos os vendedores ({vendors.length})</option>
            {vendors.map((v) => (
              <option key={v.SalesEmployeeCode} value={v.SalesEmployeeCode}>
                {v.SalesEmployeeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs do recorte anual */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-cockpit-border bg-gray-50/40 px-3 py-2.5">
          <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <metric.icon className="w-3 h-3" />Total no período
          </div>
          <div className="text-lg font-bold text-gray-900 tabular-nums">{metric.format(kpis.sum)}</div>
          <div className="text-[10px] text-cockpit-muted mt-0.5">{kpis.monthsWithSales}/12 meses com vendas</div>
        </div>
        <div className="rounded-lg border border-cockpit-border bg-gray-50/40 px-3 py-2.5">
          <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1">Média/Mês</div>
          <div className="text-lg font-bold text-gray-900 tabular-nums">{metric.format(kpis.avg)}</div>
          <div className="text-[10px] text-cockpit-muted mt-0.5">mediana {metric.format(kpis.med)}</div>
        </div>
        <div className="rounded-lg border border-cockpit-border bg-gray-50/40 px-3 py-2.5">
          <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1">Melhor Mês</div>
          <div className="text-lg font-bold text-emerald-700 tabular-nums">{kpis.max > 0 ? metric.format(kpis.max) : "—"}</div>
          <div className="text-[10px] text-cockpit-muted mt-0.5 capitalize">{kpis.maxMonth?.label ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-cockpit-border bg-gray-50/40 px-3 py-2.5">
          <div className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-1">Tendência (3M)</div>
          <div className={`text-lg font-bold tabular-nums ${
            trendNeutral ? "text-gray-700" : trendUp ? "text-emerald-700" : "text-red-600"
          }`}>
            {trendNeutral ? "≈" : trendUp ? "▲" : "▼"} {Math.abs(kpis.trendPct).toFixed(1)}%
          </div>
          <div className="text-[10px] text-cockpit-muted mt-0.5">vs 3 meses anteriores</div>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={yearTrend} barCategoryGap="20%" margin={{ left: -10, right: 5, top: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
            <XAxis dataKey="label" tick={chartAxisTick("md")} axisLine={false} tickLine={false} />
            <YAxis
              tick={chartAxisTick("sm")}
              axisLine={false}
              tickLine={false}
              width={50}
              tickFormatter={(v: number) =>
                yearMetric === "fat" ? formatYAxisCompact(v) : fmtNum(Math.round(v))
              }
            />
            <Tooltip
              content={(props: { active?: boolean; payload?: readonly { payload?: MonthlyVendDatum }[] }) => {
                const d = props.payload?.[0]?.payload;
                if (!props.active || !d) return null;
                return (
                  <BiChartTooltip
                    active
                    variant="cockpit"
                    label={`${d.label}${d.isCurrentMonth ? " · parcial" : ""}`}
                    payload={[
                      { name: "Pedidos", value: d.pedidos },
                      { name: "Itens", value: d.itens },
                      { name: "Faturamento", value: d.fat },
                    ]}
                    formatValue={(name, v) => {
                      if (name === "Faturamento") return fmtBRL(v);
                      return fmtNum(Math.round(v));
                    }}
                  />
                );
              }}
            />
            {kpis.med > 0 && (
              <ReferenceLine
                y={kpis.med}
                stroke="#7c3aed"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{
                  value: `Mediana ${metric.format(kpis.med)}`,
                  fill: "#7c3aed",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}
            <Bar dataKey={yearMetric} name={metric.label} radius={[6, 6, 0, 0]}>
              {yearTrend.map((d) => {
                const v = d[yearMetric] as number;
                let fill = v === 0
                  ? "#e5e7eb"
                  : d.isCurrentMonth
                    ? "#f59e0b"
                    : v >= kpis.med ? CHART_SERIES_PRIMARY : "#d4b5b8";
                if (kpis.maxMonth?.monthKey === d.monthKey && v > 0 && !d.isCurrentMonth) fill = "#10b981";
                return <Cell key={d.monthKey} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-cockpit-muted flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#10b981]" />
          Melhor mês
        </span>
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
          Mês corrente (parcial)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-px border-t border-dashed border-violet-600" />
          Mediana
        </span>
      </div>
    </div>
  );
}

// ─── Agregação por mês — últimos 12 meses para 1 vendedor ────────────

interface MonthlyVendDatum {
  /** "yyyy-MM" */
  monthKey: string;
  /** "mai/26" */
  label: string;
  /** Quantidade de pedidos do vendedor no mês */
  pedidos: number;
  /** Faturamento (R$) do vendedor no mês */
  fat: number;
  /** Total de itens (linhas de pedido) no mês */
  itens: number;
  /** Indica se é o mês corrente (parcial) */
  isCurrentMonth: boolean;
}

function buildMonthlyTrend(
  orders: SalesOrderRow[],
  salesPersonCode: number | null,
  today = new Date(),
): MonthlyVendDatum[] {
  const monthSlots = new Map<string, { pedidos: number; fat: number; itens: number; isCurrent: boolean }>();

  // Inicializa 12 meses (do mais antigo ao corrente).
  for (let i = 11; i >= 0; i--) {
    const m = startOfMonth(subMonths(today, i));
    const key = format(m, "yyyy-MM");
    monthSlots.set(key, {
      pedidos: 0,
      fat: 0,
      itens: 0,
      isCurrent: isSameMonth(m, today),
    });
  }

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    if (isFreightOrder(o)) continue;
    if (salesPersonCode !== null && (o.sales_person_code ?? -1) !== salesPersonCode) continue;
    if (!o.doc_date) continue;
    const key = o.doc_date.slice(0, 7);
    const slot = monthSlots.get(key);
    if (!slot) continue;
    slot.pedidos += 1;
    slot.fat += Number(o.doc_total) || 0;
    slot.itens += Array.isArray(o.lines) ? o.lines.length : Number(o.num_lines) || 0;
  }

  return Array.from(monthSlots.entries()).map(([monthKey, v]) => {
    const d = parseISO(monthKey + "-01T12:00:00");
    return {
      monthKey,
      label: format(d, "MMM/yy", { locale: ptBR }),
      pedidos: v.pedidos,
      fat: v.fat,
      itens: v.itens,
      isCurrentMonth: v.isCurrent,
    };
  });
}

export default function VendedoresPage() {
  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  // Janela fixa dos últimos 12 meses (independente do range global) — usada na aba "Histórico 12 meses".
  const today = useMemo(() => new Date(), []);
  const yearFrom = useMemo(() => format(startOfMonth(subMonths(today, 11)), "yyyy-MM-dd"), [today]);
  const yearTo = useMemo(() => format(today, "yyyy-MM-dd"), [today]);

  const { data: ordersData, loading: l1 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo, salesPerson: salesPersonCode }), [dateFrom, dateTo, salesPersonCode]);
  const { data: yearOrdersData } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom: yearFrom, dateTo: yearTo, salesPerson: salesPersonCode }), [yearFrom, yearTo, salesPersonCode]);
  const { data: spData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchSalesPersons(), []);

  const loading = l1 && l2;
  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const yearOrders = useMemo(() => yearOrdersData?.items ?? [], [yearOrdersData]);
  const persons = useMemo(() => spData?.items ?? [], [spData]);

  const rows = useMemo(() => buildVendRows(orders, persons), [orders, persons]);
  const evolution = useMemo(() => buildEvolution(orders, persons), [orders, persons]);

  const topVendorNames = useMemo(() => {
    return rows.filter((r) => r.fat > 0).slice(0, 5).map((r) => r.nome);
  }, [rows]);

  // Vendedores que aparecem nos últimos 12 meses (para o seletor da nova aba)
  const yearVendors = useMemo(() => {
    const set = new Set<number>();
    for (const o of yearOrders) {
      if (o.cancelled === "Y") continue;
      if (isFreightOrder(o)) continue;
      if (o.sales_person_code != null) set.add(o.sales_person_code);
    }
    return persons
      .filter((p) => set.has(p.SalesEmployeeCode))
      .sort((a, b) => a.SalesEmployeeName.localeCompare(b.SalesEmployeeName));
  }, [yearOrders, persons]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ranking" | "evolucao" | "scatter" | "ano">("ranking");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  // Estado da aba "Histórico 12 meses"
  const [yearVendorCode, setYearVendorCode] = useState<"ALL" | number>("ALL");
  const [yearMetric, setYearMetric] = useState<"pedidos" | "fat" | "itens">("pedidos");

  const yearTrend = useMemo(
    () => buildMonthlyTrend(yearOrders, yearVendorCode === "ALL" ? null : yearVendorCode, today),
    [yearOrders, yearVendorCode, today],
  );

  const yearVendorName = useMemo(() => {
    if (yearVendorCode === "ALL") return "Todos os vendedores";
    return persons.find((p) => p.SalesEmployeeCode === yearVendorCode)?.SalesEmployeeName ?? `Cód ${yearVendorCode}`;
  }, [yearVendorCode, persons]);

  const yearKpis = useMemo(() => {
    const data = yearTrend;
    const values = data.map((d) => d[yearMetric] as number);
    const valuesWithSales = values.filter((v) => v > 0);
    const sum = values.reduce((s, v) => s + v, 0);
    const monthsWithSales = valuesWithSales.length;
    const avg = monthsWithSales > 0 ? sum / monthsWithSales : 0;
    const sorted = [...valuesWithSales].sort((a, b) => a - b);
    const med = sorted.length > 0
      ? (sorted.length % 2 !== 0 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : 0;
    const max = Math.max(0, ...values);
    const min = monthsWithSales > 0 ? Math.min(...valuesWithSales) : 0;
    const maxMonth = data.find((d) => (d[yearMetric] as number) === max && max > 0);
    const minMonth = data.find((d) => (d[yearMetric] as number) === min && min > 0);
    // Trend: compara últimos 3 meses (excluindo corrente parcial) com os 3 anteriores.
    const finished = data.filter((d) => !d.isCurrentMonth).map((d) => d[yearMetric] as number);
    const last3 = finished.slice(-3).reduce((s, v) => s + v, 0);
    const prev3 = finished.slice(-6, -3).reduce((s, v) => s + v, 0);
    const trendPct = prev3 > 0 ? ((last3 - prev3) / prev3) * 100 : 0;
    return { sum, monthsWithSales, avg, med, max, min, maxMonth, minMonth, trendPct };
  }, [yearTrend, yearMetric]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch = r.nome.toLowerCase().includes(search.toLowerCase());
      const matchActive = !showOnlyActive || r.active;
      return matchSearch && matchActive;
    });
  }, [rows, search, showOnlyActive]);

  const kpis = useMemo(() => {
    const activeWithSales = filtered.filter((r) => r.fat > 0);
    const totalFat = filtered.reduce((s, r) => s + r.fat, 0);
    const totalPed = filtered.reduce((s, r) => s + r.pedidos, 0);
    const medianFat = median(activeWithSales.map((r) => r.fat));
    return { total: filtered.length, activeWithSales: activeWithSales.length, totalFat, totalPed, medianFat };
  }, [filtered]);

  const scatterData = useMemo(() => {
    return filtered.filter((r) => r.fat > 0).map((r) => ({
      x: r.pedidos,
      y: r.ticket,
      z: r.fat,
      name: r.nome,
    }));
  }, [filtered]);

  const medianTicket = useMemo(() => median(scatterData.map((d) => d.y)), [scatterData]);

  if (loading) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Vendedores</h1><p className="text-cockpit-muted mt-1">Carregando...</p></div><LoadingSkeleton /></div>;
  if (e2) return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Vendedores</h1></div><ErrorState message={e2} onRetry={r2} /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Users className="w-5 h-5 text-cockpit-accent" /></div>
          Mapa de Vendedores
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{persons.length} vendedores no SAP</span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Vendedores", value: String(kpis.total), icon: Users, color: "text-cockpit-accent" },
          { label: "Com Vendas", value: String(kpis.activeWithSales), icon: Target, color: "text-emerald-500" },
          { label: "Fat. Total", value: fmtBRL(kpis.totalFat), icon: DollarSign, color: "text-sky-500" },
          { label: "Mediana Fat.", value: fmtBRL(kpis.medianFat), icon: BarChart3, color: "text-amber-500" },
          { label: "Total Pedidos", value: fmtNum(kpis.totalPed), icon: ShoppingCart, color: "text-purple-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 motion-safe:transition-all shadow-sm">
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-xl font-bold ${k.color} block mt-1`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedor..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 motion-safe:transition-all" />
        </div>
        <label className="flex items-center gap-2 text-xs text-cockpit-muted cursor-pointer select-none">
          <input type="checkbox" checked={showOnlyActive} onChange={(e) => setShowOnlyActive(e.target.checked)}
            className="rounded border-cockpit-border text-cockpit-accent focus:ring-cockpit-accent/30" />
          Apenas ativos
        </label>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1 overflow-x-auto">
        {([
          { id: "ranking", label: "Ranking", icon: BarChart3 },
          { id: "ano", label: "Histórico 12 meses", icon: History },
          { id: "evolucao", label: "Evolução no Período", icon: TrendingUp },
          { id: "scatter", label: "Volume × Ticket", icon: Target },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold motion-safe:transition-all whitespace-nowrap ${
              tab === t.id ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-700"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">
        {tab === "ano" && (
          <YearTrendSection
            yearTrend={yearTrend}
            yearMetric={yearMetric}
            setYearMetric={setYearMetric}
            yearVendorCode={yearVendorCode}
            setYearVendorCode={setYearVendorCode}
            vendors={yearVendors}
            vendorName={yearVendorName}
            kpis={yearKpis}
          />
        )}

        {tab === "ranking" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Ranking — Faturamento</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filtered.filter((r) => r.fat > 0).slice(0, 12).map((r) => ({ name: r.nome.split(" ")[0], Fat: r.fat }))} layout="vertical" barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} horizontal={false} />
                  <XAxis type="number" tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => formatYAxisCompact(v)} />
                  <YAxis dataKey="name" type="category" tick={chartAxisTick("md")} width={80} />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  <ReferenceLine x={kpis.medianFat} stroke="#7c3aed" strokeDasharray="5 5" label={{ value: "Mediana", fill: "#7c3aed", fontSize: 10 }} />
                  <Bar dataKey="Fat" name="Faturamento" radius={[0, 6, 6, 0]}>
                    {filtered.filter((r) => r.fat > 0).slice(0, 12).map((r, i) => (
                      <Cell key={i} fill={r.fat >= kpis.medianFat ? CHART_SERIES_PRIMARY : "#9ca3af"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "evolucao" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">
              Evolução Mensal — Top 5 Vendedores no Período Selecionado
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                  <XAxis dataKey="month" tick={chartAxisTick("md")} />
                  <YAxis tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => formatYAxisCompact(v)} />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  {topVendorNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-cockpit-muted">
              {topVendorNames.map((name, i) => (
                <span key={name} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                  {name}
                </span>
              ))}
            </div>
          </>
        )}

        {tab === "scatter" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Volume de Pedidos × Ticket Médio</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                  <XAxis dataKey="x" type="number" name="Pedidos" tick={chartAxisTick("md")}
                    label={{ value: "Pedidos", position: "bottom", ...CHART_AXIS_LABEL_PROPS }} />
                  <YAxis dataKey="y" type="number" name="Ticket" tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => formatYAxisCompact(v)} />
                  <ZAxis dataKey="z" range={[100, 800]} name="Faturamento" />
                  <Tooltip
                    content={(props: {
                      active?: boolean;
                      payload?: readonly { payload?: { x: number; y: number; z: number; name: string } }[];
                    }) => {
                      const { active, payload } = props;
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <BiChartTooltip
                          active
                          label={d.name}
                          variant="cockpit"
                          payload={[
                            { name: "Pedidos", value: d.x },
                            { name: "Ticket médio", value: d.y },
                            { name: "Faturamento", value: d.z },
                          ]}
                          formatValue={(name, v) => {
                            if (name === "Pedidos") return fmtNum(v);
                            if (name === "Ticket médio") return fmtBRL(v, 2);
                            return fmtBRL(v);
                          }}
                        />
                      );
                    }}
                  />
                  <ReferenceLine y={medianTicket} stroke="#7c3aed" strokeDasharray="5 5" label={{ value: "Med. Ticket", fill: "#7c3aed", fontSize: 10 }} />
                  <Scatter data={scatterData} fill={CHART_SERIES_PRIMARY} fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-sm text-left table-sticky-head">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th className="py-3 px-4 w-8"><Award className="w-3.5 h-3.5 inline" /></th>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4 text-right">Faturamento</th>
                <th className="py-3 px-4 text-right">Pedidos</th>
                <th className="py-3 px-4 text-right">Ticket Médio</th>
                <th className="py-3 px-4 text-right">Clientes</th>
                <th className="py-3 px-4 text-right">% Fat.</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-cockpit-muted">Nenhum vendedor encontrado</td></tr>
              ) : (
                <>
                  {filtered.map((r) => (
                    <tr key={r.code} className={`hover:bg-cockpit-accent/[0.04] motion-safe:transition-colors ${r.fat === 0 ? "opacity-50" : ""}`}>
                      <td className="py-2.5 px-4">
                        {r.rank <= 3 && r.fat > 0 ? (
                          <span className={`text-sm ${r.rank === 1 ? "text-amber-500" : r.rank === 2 ? "text-gray-400" : "text-amber-700"}`}>
                            {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
                          </span>
                        ) : (
                          <span className="text-xs text-cockpit-muted">{r.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{r.code}</td>
                      <td className="py-2.5 px-4 font-medium text-gray-900">{r.nome}</td>
                      <td className="py-2.5 px-4 text-right text-cockpit-accent font-medium">{fmtBRL(r.fat)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{r.pedidos}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{fmtBRL(r.ticket, 2)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{r.clientesUnicos}</td>
                      <td className="py-2.5 px-4 text-right text-gray-500">{r.pctFat.toFixed(1)}%</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        }`}>{r.active ? "Ativo" : "Inativo"}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-cockpit-bg/60 text-gray-900 font-bold">
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4">TOTAL ({filtered.filter((r) => r.fat > 0).length})</td>
                    <td className="py-3 px-4 text-right text-cockpit-accent">{fmtBRL(kpis.totalFat)}</td>
                    <td className="py-3 px-4 text-right">{kpis.totalPed}</td>
                    <td className="py-3 px-4 text-right">{kpis.totalPed > 0 ? fmtBRL(kpis.totalFat / kpis.totalPed, 2) : "—"}</td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">100%</td>
                    <td className="py-3 px-4" />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          {filtered.length} vendedores — Pedidos de Venda SAP B1
        </div>
      </div>
    </div>
  );
}
