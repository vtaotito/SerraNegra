"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  CalendarDays,
  ShoppingCart,
  Users,
  Target,
  Layers,
  Percent,
  BarChart3,
  Package,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  MapPin,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { format, parseISO, getDay, differenceInCalendarDays } from "date-fns";

import {
  fmtBRL,
  fmtNum,
  getProductGroup,
  STATE_TO_REGION,
  exportCSV,
} from "@/lib/format";
import {
  fetchSalesOrders,
  fetchSalesPersons,
  fetchCustomers,
  fetchCatalog,
  fetchInventory,
  type SalesOrderRow,
  type SalesOrderLine,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import {
  CHART_AXIS_LINE,
  CHART_GRID,
  CHART_SERIES_PRIMARY,
  CHART_AXIS_LABEL_PROPS,
  chartAxisTick,
  formatYAxisCompact,
} from "@/lib/chart-theme";

const COLORS = [
  "#A81C2C",
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#4f46e5",
  "#16a34a",
  "#ea580c",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_COLORS = [
  "#9ca3af",
  "#A81C2C",
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#9ca3af",
];

type TabKey =
  | "resumo"
  | "evolucao"
  | "grupos"
  | "descontos"
  | "vendedores"
  | "indicadores";

const TABS: { id: TabKey; label: string; aliases?: string[] }[] = [
  { id: "resumo", label: "Resumo Executivo" },
  { id: "evolucao", label: "Evolução Temporal" },
  { id: "grupos", label: "Grupos de Produto" },
  { id: "descontos", label: "Descontos & Margem", aliases: ["margens"] },
  { id: "vendedores", label: "Vendedores" },
  { id: "indicadores", label: "Indicadores" },
];

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface GroupRow {
  group: string;
  fat: number;
  qty: number;
  pedidos: number;
  itens: number;
  precoMedio: number;
  descontoMedio: number;
  ticketMedio: number;
  pctFat: number;
}

function buildGroupAnalytics(orders: SalesOrderRow[]): GroupRow[] {
  const map = new Map<
    string,
    {
      fat: number;
      qty: number;
      pedidos: Set<number>;
      itens: Set<string>;
      precos: number[];
      descontos: number[];
    }
  >();

  for (const o of orders) {
    for (const l of o.lines ?? []) {
      const g = getProductGroup(l.ItemCode);
      const cur =
        map.get(g) ??
        { fat: 0, qty: 0, pedidos: new Set(), itens: new Set(), precos: [], descontos: [] };
      cur.fat += Number(l.LineTotal) || 0;
      cur.qty += Number(l.Quantity) || 0;
      cur.pedidos.add(o.doc_entry);
      if (l.ItemCode) cur.itens.add(l.ItemCode);
      if (l.UnitPrice) cur.precos.push(Number(l.UnitPrice));
      if (l.DiscountPercent) cur.descontos.push(Number(l.DiscountPercent));
      map.set(g, cur);
    }
  }

  const totalFat = Array.from(map.values()).reduce((s, v) => s + v.fat, 0);

  return Array.from(map.entries())
    .map(([g, v]) => ({
      group: g,
      fat: v.fat,
      qty: v.qty,
      pedidos: v.pedidos.size,
      itens: v.itens.size,
      precoMedio:
        v.precos.length > 0 ? v.precos.reduce((s, p) => s + p, 0) / v.precos.length : 0,
      descontoMedio:
        v.descontos.length > 0
          ? v.descontos.reduce((s, d) => s + d, 0) / v.descontos.length
          : 0,
      ticketMedio: v.pedidos.size > 0 ? v.fat / v.pedidos.size : 0,
      pctFat: totalFat > 0 ? (v.fat / totalFat) * 100 : 0,
    }))
    .sort((a, b) => b.fat - a.fat);
}

function buildDiscountDistribution(orders: SalesOrderRow[]) {
  const bins = [
    { label: "0%", min: 0, max: 0.01 },
    { label: "0-5%", min: 0.01, max: 5 },
    { label: "5-10%", min: 5, max: 10 },
    { label: "10-15%", min: 10, max: 15 },
    { label: "15-20%", min: 15, max: 20 },
    { label: ">20%", min: 20, max: 100 },
  ];

  const counts = bins.map((b) => ({ label: b.label, count: 0, fat: 0 }));
  for (const o of orders) {
    for (const l of o.lines ?? []) {
      const d = Number(l.DiscountPercent) || 0;
      for (let i = 0; i < bins.length; i++) {
        if (d >= bins[i].min && d < bins[i].max) {
          counts[i].count += 1;
          counts[i].fat += Number(l.LineTotal) || 0;
          break;
        }
      }
    }
  }
  return counts;
}

function FaturamentoUnifiedInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const initialTab = useMemo<TabKey>(() => {
    const raw = (searchParams?.get("tab") ?? "").toLowerCase();
    const found = TABS.find(
      (t) => t.id === raw || t.aliases?.includes(raw),
    );
    return found?.id ?? "resumo";
  }, [searchParams]);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const handleTabChange = useCallback(
    (id: TabKey) => {
      setTab(id);
      setSearch("");
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (id === "resumo") params.delete("tab");
      else params.set("tab", id);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const {
    data: ordersData,
    loading: l1,
    error: e1,
    refetch: r1,
  } = useFetch(
    () =>
      fetchSalesOrders({
        limit: 50000,
        dateFrom,
        dateTo,
        salesPerson: salesPersonCode,
      }),
    [dateFrom, dateTo, salesPersonCode],
  );
  const { data: spData, loading: l2, error: e2, refetch: r2 } = useFetch(
    () => fetchSalesPersons(),
    [],
  );
  const { data: custData } = useFetch(() => fetchCustomers({ limit: 500 }), []);
  const { data: catData } = useFetch(() => fetchCatalog({ limit: 1 }), []);
  const { data: invData } = useFetch(() => fetchInventory({ limit: 1 }), []);

  const loading = l1 || l2;

  const allOrders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const orders = useMemo(
    () => allOrders.filter((o) => o.cancelled !== "Y"),
    [allOrders],
  );
  const persons = useMemo(() => spData?.items ?? [], [spData]);
  const customers = useMemo(() => custData?.data ?? [], [custData]);
  const pMap = useMemo(
    () =>
      new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName])),
    [persons],
  );

  const totalFat = useMemo(
    () => orders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0),
    [orders],
  );
  const totalPed = orders.length;
  const totalQty = useMemo(
    () => orders.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0),
    [orders],
  );
  const totalDays = useMemo(
    () => Math.max(1, differenceInCalendarDays(range.to, range.from) + 1),
    [range],
  );
  const uniqueClients = useMemo(
    () => new Set(orders.map((o) => o.card_code)).size,
    [orders],
  );
  const uniqueVendors = useMemo(
    () =>
      new Set(orders.map((o) => o.sales_person_code).filter(Boolean)).size,
    [orders],
  );
  const medianOrder = useMemo(
    () => median(orders.map((o) => Number(o.doc_total) || 0)),
    [orders],
  );

  const allLines = useMemo(() => {
    const lines: (SalesOrderLine & { docDate: string })[] = [];
    for (const o of orders) {
      for (const l of o.lines ?? []) lines.push({ ...l, docDate: o.doc_date });
    }
    return lines;
  }, [orders]);

  const avgDiscount = useMemo(
    () =>
      allLines.length > 0
        ? allLines.reduce((s, l) => s + (Number(l.DiscountPercent) || 0), 0) /
          allLines.length
        : 0,
    [allLines],
  );

  const monthlyData = useMemo(() => {
    const map = new Map<string, { fat: number; pedidos: number }>();
    for (const o of orders) {
      const m = format(parseISO(o.doc_date), "yyyy-MM");
      const cur = map.get(m) ?? { fat: 0, pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.pedidos += 1;
      map.set(m, cur);
    }
    const arr = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, v]) => ({
        month: m.substring(5) + "/" + m.substring(2, 4),
        fat: v.fat,
        pedidos: v.pedidos,
        ticket: v.pedidos > 0 ? v.fat / v.pedidos : 0,
      }));
    let cum = 0;
    return arr.map((d) => {
      cum += d.fat;
      return { ...d, cum };
    });
  }, [orders]);

  const medianMonth = useMemo(
    () => median(monthlyData.map((d) => d.fat)),
    [monthlyData],
  );

  const weekdayData = useMemo(() => {
    const map = new Map<number, { fat: number; count: number }>();
    for (const o of orders) {
      const wd = getDay(parseISO(o.doc_date));
      const cur = map.get(wd) ?? { fat: 0, count: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.count += 1;
      map.set(wd, cur);
    }
    return WEEKDAYS.map((name, i) => {
      const d = map.get(i) ?? { fat: 0, count: 0 };
      return {
        name,
        fat: d.fat,
        pedidos: d.count,
        avg: d.count > 0 ? d.fat / d.count : 0,
      };
    });
  }, [orders]);

  const medianWeekday = useMemo(
    () => median(weekdayData.map((d) => d.fat)),
    [weekdayData],
  );

  const groups = useMemo(() => buildGroupAnalytics(orders), [orders]);
  const discountDist = useMemo(
    () => buildDiscountDistribution(orders),
    [orders],
  );

  const filteredGroups = useMemo(
    () =>
      groups.filter((g) =>
        g.group.toLowerCase().includes(search.toLowerCase()),
      ),
    [groups, search],
  );

  const vendorData = useMemo(() => {
    const map = new Map<number, { fat: number; pedidos: number }>();
    for (const o of orders) {
      const c = o.sales_person_code ?? -1;
      const cur = map.get(c) ?? { fat: 0, pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.pedidos += 1;
      map.set(c, cur);
    }
    return Array.from(map.entries())
      .map(([code, v]) => ({
        code,
        name: pMap.get(code) ?? `Vend. ${code}`,
        fat: v.fat,
        pedidos: v.pedidos,
        ticket: v.pedidos > 0 ? v.fat / v.pedidos : 0,
        pct: totalFat > 0 ? (v.fat / totalFat) * 100 : 0,
      }))
      .sort((a, b) => b.fat - a.fat);
  }, [orders, pMap, totalFat]);

  const filteredVendors = useMemo(
    () =>
      vendorData.filter((v) =>
        v.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [vendorData, search],
  );

  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders)
      map.set(o.card_name, (map.get(o.card_name) ?? 0) + (Number(o.doc_total) || 0));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, fat]) => ({ name: name.substring(0, 18), fat }));
  }, [orders]);

  const regionData = useMemo(() => {
    const custMap = new Map(customers.map((c) => [c.card_code, c]));
    const map = new Map<string, number>();
    for (const o of orders) {
      const cust = custMap.get(o.card_code);
      const st = cust?.state ?? "—";
      const region = STATE_TO_REGION[st] ?? "Outro";
      map.set(region, (map.get(region) ?? 0) + (Number(o.doc_total) || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [orders, customers]);

  const scatterData = useMemo(
    () =>
      groups
        .filter((g) => g.fat > 0)
        .map((g) => ({
          x: g.qty,
          y: g.precoMedio,
          z: g.fat,
          name: g.group,
          desc: g.descontoMedio,
        })),
    [groups],
  );

  const medianGroupPrice = useMemo(
    () => median(scatterData.map((d) => d.y)),
    [scatterData],
  );

  const avgPrice = useMemo(
    () =>
      allLines.length > 0
        ? allLines.reduce((s, l) => s + (Number(l.UnitPrice) || 0), 0) /
          allLines.length
        : 0,
    [allLines],
  );

  const handleExport = useCallback(() => {
    if (tab === "evolucao") {
      exportCSV(
        monthlyData.map((r) => ({
          mes: r.month,
          faturamento: r.fat,
          pedidos: r.pedidos,
          ticket_medio: r.ticket,
          acumulado: r.cum,
        })),
        `faturamento-mensal-${dateFrom}-${dateTo}`,
      );
    } else if (tab === "grupos" || tab === "descontos") {
      exportCSV(
        filteredGroups.map((g) => ({
          grupo: g.group,
          faturamento: g.fat,
          quantidade: g.qty,
          pedidos: g.pedidos,
          skus: g.itens,
          preco_medio: g.precoMedio,
          desconto_medio_pct: g.descontoMedio,
          ticket_medio: g.ticketMedio,
          pct_faturamento: g.pctFat,
        })),
        `faturamento-grupos-${dateFrom}-${dateTo}`,
      );
    } else if (tab === "vendedores") {
      exportCSV(
        filteredVendors.map((v) => ({
          codigo: v.code,
          nome: v.name,
          faturamento: v.fat,
          pedidos: v.pedidos,
          ticket_medio: v.ticket,
          pct_faturamento: v.pct,
        })),
        `faturamento-vendedores-${dateFrom}-${dateTo}`,
      );
    } else {
      exportCSV(
        [
          { indicador: "Faturamento Bruto", valor: totalFat },
          { indicador: "Mediana por Pedido", valor: medianOrder },
          {
            indicador: "Ticket Médio",
            valor: totalPed > 0 ? totalFat / totalPed : 0,
          },
          { indicador: "Média Diária", valor: totalFat / totalDays },
          { indicador: "Total de Pedidos", valor: totalPed },
          { indicador: "Quantidade Vendida", valor: totalQty },
          { indicador: "Clientes Ativos", valor: uniqueClients },
          { indicador: "Vendedores Ativos", valor: uniqueVendors },
          { indicador: "Desconto Médio %", valor: avgDiscount },
        ],
        `faturamento-indicadores-${dateFrom}-${dateTo}`,
      );
    }
  }, [
    tab,
    monthlyData,
    filteredGroups,
    filteredVendors,
    dateFrom,
    dateTo,
    totalFat,
    medianOrder,
    totalPed,
    totalDays,
    totalQty,
    uniqueClients,
    uniqueVendors,
    avgDiscount,
  ]);

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faturamento</h1>
          <p className="text-cockpit-muted mt-1">Consolidando dados…</p>
        </div>
        <LoadingSkeleton />
      </div>
    );

  if (e1 || e2)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faturamento</h1>
        </div>
        <ErrorState
          message={e1 || e2 || ""}
          onRetry={() => {
            r1();
            r2();
          }}
        />
      </div>
    );

  const heroKpis = [
    {
      label: "Faturamento",
      value: fmtBRL(totalFat),
      sub: `Mediana ped.: ${fmtBRL(medianOrder)}`,
      icon: DollarSign,
      color: "text-cockpit-accent",
    },
    {
      label: "Pedidos",
      value: fmtNum(totalPed),
      sub: `${fmtNum(Math.round(totalQty))} itens`,
      icon: ShoppingCart,
      color: "text-sky-500",
    },
    {
      label: "Ticket Médio",
      value: totalPed > 0 ? fmtBRL(totalFat / totalPed, 2) : "—",
      sub: `Média/dia: ${fmtBRL(totalFat / totalDays)}`,
      icon: TrendingUp,
      color: "text-amber-500",
    },
    {
      label: "Desc. Médio",
      value: `${avgDiscount.toFixed(1)}%`,
      sub: `Preço médio: ${fmtBRL(avgPrice, 2)}`,
      icon: Percent,
      color: "text-red-500",
    },
    {
      label: "Clientes Ativos",
      value: fmtNum(uniqueClients),
      sub: `de ${custData?.total ?? "—"} na base`,
      icon: Users,
      color: "text-emerald-500",
    },
    {
      label: "Vendedores",
      value: String(uniqueVendors),
      sub: `de ${persons.length} cadastrados`,
      icon: Target,
      color: "text-purple-500",
    },
    {
      label: "Grupos",
      value: String(groups.length),
      sub: "por prefixo SKU",
      icon: Package,
      color: "text-blue-500",
    },
    {
      label: "Catálogo",
      value: fmtNum(catData?.total ?? 0),
      sub: `${fmtNum(invData?.total ?? 0)} pos. estoque`,
      icon: Layers,
      color: "text-violet-500",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10">
            <DollarSign className="w-5 h-5 text-cockpit-accent" />
          </div>
          Faturamento
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2 text-sm flex-wrap">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>
            Período: <span className="text-gray-600">{periodoLabel}</span>
          </span>
          <span className="text-cockpit-border">·</span>
          <span>{fmtNum(totalPed)} pedidos · {fmtNum(allOrders.length - totalPed)} cancelados</span>
          <span className="text-cockpit-border">·</span>
          <span>SAP B1</span>
        </p>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
        {heroKpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-cockpit-border bg-cockpit-surface p-3 sm:p-4 hover:border-cockpit-accent/30 motion-safe:transition-all shadow-sm"
          >
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} aria-hidden />
              <span className="text-[9px] sm:text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider truncate">
                {k.label}
              </span>
            </div>
            <span
              className={`text-base sm:text-lg font-bold ${k.color} block mt-1 tabular-nums truncate`}
            >
              {k.value}
            </span>
            <span className="text-[9px] sm:text-[10px] text-cockpit-muted block truncate">
              {k.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs + actions */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Recortes do faturamento"
          className="flex gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1 overflow-x-auto"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => handleTabChange(t.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold motion-safe:transition-all whitespace-nowrap ${
                tab === t.id
                  ? "bg-white text-cockpit-accent shadow-sm"
                  : "text-cockpit-muted hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {(tab === "grupos" ||
            tab === "descontos" ||
            tab === "vendedores") && (
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "vendedores"
                    ? "Buscar vendedor…"
                    : "Buscar grupo de produto…"
                }
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 motion-safe:transition-all"
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cockpit-border bg-white text-xs font-semibold text-gray-700 hover:border-cockpit-accent/30 hover:text-cockpit-accent motion-safe:transition-all whitespace-nowrap"
            aria-label="Exportar dados em CSV"
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
            CSV
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === "resumo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Evolução Mensal (Faturamento + Acumulado)">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                <XAxis dataKey="month" tick={chartAxisTick("sm")} />
                <YAxis
                  yAxisId="left"
                  tick={chartAxisTick("sm")}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ ...chartAxisTick("sm"), fill: "#059669" }}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                <Bar
                  yAxisId="left"
                  dataKey="fat"
                  name="Faturamento"
                  radius={[3, 3, 0, 0]}
                  fill={CHART_SERIES_PRIMARY}
                />
                <Line
                  yAxisId="right"
                  dataKey="cum"
                  name="Acumulado"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top 8 Clientes" icon={Users}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topClients}
                layout="vertical"
                barCategoryGap="15%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_AXIS_LINE}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={chartAxisTick("sm")}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={chartAxisTick("sm")}
                  width={110}
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                <Bar dataKey="fat" name="Faturamento" radius={[0, 4, 4, 0]}>
                  {topClients.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Mix de Produtos (Grupo)" icon={Package}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={groups.slice(0, 8)}
                  dataKey="fat"
                  nameKey="group"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={85}
                  paddingAngle={3}
                  label={(props: { group?: string; percent?: number }) =>
                    `${props.group ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {groups.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtBRL(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Faturamento por Região" icon={MapPin}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                <XAxis dataKey="name" tick={chartAxisTick("md")} />
                <YAxis
                  tick={chartAxisTick("sm")}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                <Bar dataKey="value" name="Faturamento" radius={[4, 4, 0, 0]}>
                  {regionData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {tab === "evolucao" && (
        <div className="space-y-4">
          <ChartCard
            title="Faturamento Mensal (vs Mediana)"
            height="h-80"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="month" tick={chartAxisTick("md")} />
                <YAxis
                  yAxisId="left"
                  tick={chartAxisTick("md")}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ ...chartAxisTick("md"), fill: "#059669" }}
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                <ReferenceLine
                  yAxisId="left"
                  y={medianMonth}
                  stroke="#7c3aed"
                  strokeDasharray="5 5"
                  label={{
                    value: `Mediana ${fmtBRL(medianMonth)}`,
                    fill: "#7c3aed",
                    fontSize: 10,
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="fat"
                  name="Faturamento"
                  radius={[4, 4, 0, 0]}
                >
                  {monthlyData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.fat >= medianMonth ? "#A81C2C" : CHART_AXIS_LINE}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  dataKey="pedidos"
                  name="Pedidos"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Padrão por Dia da Semana" height="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekdayData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="name" tick={chartAxisTick("md")} />
                <YAxis
                  tick={chartAxisTick("md")}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                <ReferenceLine
                  y={medianWeekday}
                  stroke="#7c3aed"
                  strokeDasharray="5 5"
                />
                <Bar dataKey="fat" name="Faturamento" radius={[6, 6, 0, 0]}>
                  {weekdayData.map((_, i) => (
                    <Cell key={i} fill={WEEKDAY_COLORS[i]} />
                  ))}
                </Bar>
                <Line
                  dataKey="avg"
                  name="Média/Pedido"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Tabela mensal vs mediana */}
          <DataTable
            head={["Mês", "Faturamento", "Pedidos", "Ticket Médio", "vs Mediana"]}
            empty={monthlyData.length === 0}
            footer={`${monthlyData.length} meses · Mediana mensal: ${fmtBRL(medianMonth)}`}
          >
            {monthlyData.map((r) => {
              const diff =
                medianMonth > 0 ? ((r.fat - medianMonth) / medianMonth) * 100 : 0;
              const above = r.fat >= medianMonth;
              return (
                <tr
                  key={r.month}
                  className="hover:bg-cockpit-accent/[0.04] motion-safe:transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {r.month}
                  </td>
                  <td className="px-4 py-2.5 text-right text-cockpit-accent font-medium tabular-nums">
                    {fmtBRL(r.fat)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                    {r.pedidos}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                    {fmtBRL(r.ticket, 2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                        above ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {above ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(diff).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-cockpit-bg/60 font-bold text-gray-900">
              <td className="px-4 py-3">TOTAL</td>
              <td className="px-4 py-3 text-right text-cockpit-accent tabular-nums">
                {fmtBRL(totalFat)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{totalPed}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {totalPed > 0 ? fmtBRL(totalFat / totalPed, 2) : "—"}
              </td>
              <td className="px-4 py-3" />
            </tr>
          </DataTable>
        </div>
      )}

      {tab === "grupos" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Faturamento por Grupo" icon={BarChart3}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredGroups.slice(0, 12)}
                  layout="vertical"
                  barCategoryGap="15%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_AXIS_LINE}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => formatYAxisCompact(v)}
                  />
                  <YAxis
                    dataKey="group"
                    type="category"
                    tick={{ ...chartAxisTick("md"), fontWeight: 600 }}
                    width={40}
                  />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  <Bar dataKey="fat" name="Faturamento" radius={[0, 6, 6, 0]}>
                    {filteredGroups.slice(0, 12).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Participação no Faturamento" icon={Layers}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredGroups.slice(0, 8)}
                    dataKey="fat"
                    nameKey="group"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    label={(props: { group?: string; percent?: number }) =>
                      `${props.group ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {filteredGroups.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <DataTable
            head={[
              "Grupo",
              "Faturamento",
              "Qtd",
              "SKUs",
              "Pedidos",
              "Preço Médio",
              "Desc. Médio",
              "Ticket/Ped.",
              "% Fat.",
            ]}
            empty={filteredGroups.length === 0}
            footer={`${filteredGroups.length} grupos de produto · Prefixo SKU (ex: GN, TA, GI)`}
            scrollable
          >
            {filteredGroups.map((r, i) => (
              <tr
                key={r.group}
                className="hover:bg-cockpit-accent/[0.04] motion-safe:transition-colors"
              >
                <td className="py-2.5 px-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="font-bold text-gray-900">{r.group}</span>
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right text-cockpit-accent font-medium tabular-nums">
                  {fmtBRL(r.fat)}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {fmtNum(Math.round(r.qty))}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {r.itens}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {r.pedidos}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {fmtBRL(r.precoMedio, 2)}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <span
                    className={`text-xs font-medium tabular-nums ${
                      r.descontoMedio > 10
                        ? "text-red-500"
                        : r.descontoMedio > 5
                        ? "text-amber-500"
                        : "text-gray-500"
                    }`}
                  >
                    {r.descontoMedio.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {fmtBRL(r.ticketMedio, 2)}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-500 tabular-nums">
                  {r.pctFat.toFixed(1)}%
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {tab === "descontos" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Distribuição de Descontos" icon={Percent}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={discountDist} barCategoryGap="20%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_AXIS_LINE}
                  />
                  <XAxis dataKey="label" tick={chartAxisTick("md")} />
                  <YAxis tick={chartAxisTick("md")} />
                  <Tooltip
                    content={(props: {
                      active?: boolean;
                      label?: string | number;
                      payload?: readonly { payload?: { count: number; fat: number } }[];
                    }) => {
                      const { active, payload, label } = props;
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <BiChartTooltip
                          active
                          variant="cockpit"
                          label={`Faixa: ${label != null ? String(label) : ""}`}
                          payload={[
                            { name: "Linhas", value: d?.count ?? 0 },
                            { name: "Faturamento", value: d?.fat ?? 0 },
                          ]}
                          formatValue={(name, v) =>
                            name === "Linhas" ? fmtNum(v) : fmtBRL(v)
                          }
                        />
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Linhas"
                    radius={[4, 4, 0, 0]}
                    fill={CHART_SERIES_PRIMARY}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Desconto Médio por Grupo" icon={BarChart3}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={filteredGroups
                    .filter((g) => g.descontoMedio > 0)
                    .slice(0, 10)}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_AXIS_LINE}
                  />
                  <XAxis dataKey="group" tick={chartAxisTick("md")} />
                  <YAxis
                    yAxisId="left"
                    tick={chartAxisTick("md")}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ ...chartAxisTick("md"), fill: "#059669" }}
                    tickFormatter={(v: number) => formatYAxisCompact(v)}
                  />
                  <Tooltip
                    content={
                      <BiChartTooltip
                        variant="cockpit"
                        formatValue={(name, v) =>
                          name?.includes("Desc") || name?.includes("%")
                            ? `${v.toFixed(1)}%`
                            : fmtBRL(v)
                        }
                      />
                    }
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="descontoMedio"
                    name="Desc. Médio %"
                    radius={[4, 4, 0, 0]}
                    fill="#dc2626"
                  />
                  <Line
                    yAxisId="right"
                    dataKey="fat"
                    name="Faturamento"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard
            title="Volume Vendido × Preço Médio (raio = faturamento)"
            height="h-80"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="Qtd"
                  tick={chartAxisTick("md")}
                  label={{
                    value: "Qtd Vendida",
                    position: "bottom",
                    ...CHART_AXIS_LABEL_PROPS,
                  }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="Preço Médio"
                  tick={chartAxisTick("md")}
                  tickFormatter={(v: number) => fmtBRL(v, 0)}
                />
                <ZAxis dataKey="z" range={[100, 800]} name="Faturamento" />
                <Tooltip
                  content={(props: {
                    active?: boolean;
                    payload?: readonly {
                      payload?: {
                        x: number;
                        y: number;
                        z: number;
                        name: string;
                        desc: number;
                      };
                    }[];
                  }) => {
                    const { active, payload } = props;
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <BiChartTooltip
                        active
                        variant="cockpit"
                        label={d.name}
                        payload={[
                          { name: "Qtd", value: d.x },
                          { name: "Preço Médio", value: d.y },
                          { name: "Faturamento", value: d.z },
                          { name: "Desc. Médio %", value: d.desc },
                        ]}
                        formatValue={(name, v) => {
                          if (name === "Qtd") return fmtNum(v);
                          if (name === "Desc. Médio %")
                            return `${v.toFixed(1)}%`;
                          if (name === "Preço Médio") return fmtBRL(v, 2);
                          return fmtBRL(v);
                        }}
                      />
                    );
                  }}
                />
                <ReferenceLine
                  y={medianGroupPrice}
                  stroke="#7c3aed"
                  strokeDasharray="5 5"
                  label={{
                    value: `Med. ${fmtBRL(medianGroupPrice, 2)}`,
                    fill: "#7c3aed",
                    fontSize: 10,
                  }}
                />
                <Scatter
                  data={scatterData}
                  fill={CHART_SERIES_PRIMARY}
                  fillOpacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {tab === "vendedores" && (
        <div className="space-y-4">
          <ChartCard title="Top Vendedores por Faturamento" height="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredVendors.slice(0, 10)}
                layout="vertical"
                barCategoryGap="15%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_AXIS_LINE}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={chartAxisTick("md")}
                  tickFormatter={(v: number) => formatYAxisCompact(v)}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={chartAxisTick("md")}
                  width={120}
                  tickFormatter={(v: string) =>
                    v.length > 14 ? v.substring(0, 14) + "…" : v
                  }
                />
                <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                <Bar dataKey="fat" name="Faturamento" radius={[0, 6, 6, 0]}>
                  {filteredVendors.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <DataTable
            head={[
              "Vendedor",
              "Faturamento",
              "Pedidos",
              "Ticket Médio",
              "% Fat.",
            ]}
            empty={filteredVendors.length === 0}
            footer={`${filteredVendors.length} vendedores ativos no período`}
            scrollable
          >
            {filteredVendors.map((v, i) => (
              <tr
                key={v.code}
                className="hover:bg-cockpit-accent/[0.04] motion-safe:transition-colors"
              >
                <td className="py-2.5 px-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="font-medium text-gray-900">{v.name}</span>
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right text-cockpit-accent font-medium tabular-nums">
                  {fmtBRL(v.fat)}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {v.pedidos}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {fmtBRL(v.ticket, 2)}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-500 tabular-nums">
                  {v.pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {tab === "indicadores" && (
        <DataTable
          head={["Indicador", "Categoria", "Valor"]}
          empty={false}
          footer="Indicadores consolidados — SAP B1"
        >
          {[
            {
              ind: "Faturamento Bruto",
              cat: "vendas",
              val: fmtBRL(totalFat),
            },
            {
              ind: "Mediana por Pedido",
              cat: "vendas",
              val: fmtBRL(medianOrder),
            },
            {
              ind: "Mediana Mensal",
              cat: "vendas",
              val: fmtBRL(medianMonth),
            },
            {
              ind: "Ticket Médio",
              cat: "vendas",
              val: totalPed > 0 ? fmtBRL(totalFat / totalPed, 2) : "—",
            },
            {
              ind: "Média Diária",
              cat: "vendas",
              val: fmtBRL(totalFat / totalDays),
            },
            { ind: "Total de Pedidos", cat: "vendas", val: fmtNum(totalPed) },
            {
              ind: "Pedidos Cancelados",
              cat: "vendas",
              val: fmtNum(allOrders.length - totalPed),
            },
            {
              ind: "Quantidade Vendida",
              cat: "vendas",
              val: fmtNum(Math.round(totalQty)),
            },
            {
              ind: "Preço Médio (linha)",
              cat: "preços",
              val: fmtBRL(avgPrice, 2),
            },
            {
              ind: "Desconto Médio",
              cat: "preços",
              val: `${avgDiscount.toFixed(1)}%`,
            },
            {
              ind: "Clientes Ativos (período)",
              cat: "clientes",
              val: fmtNum(uniqueClients),
            },
            {
              ind: "Clientes na Base",
              cat: "clientes",
              val: fmtNum(custData?.total ?? 0),
            },
            {
              ind: "Vendedores Ativos",
              cat: "equipe",
              val: String(uniqueVendors),
            },
            {
              ind: "Vendedores Cadastrados",
              cat: "equipe",
              val: String(persons.length),
            },
            {
              ind: "Grupos de Produto",
              cat: "estoque",
              val: String(groups.length),
            },
            {
              ind: "Produtos no Catálogo",
              cat: "estoque",
              val: fmtNum(catData?.total ?? 0),
            },
            {
              ind: "Posições de Estoque",
              cat: "estoque",
              val: fmtNum(invData?.total ?? 0),
            },
          ].map((r) => (
            <tr
              key={r.ind}
              className="hover:bg-cockpit-accent/[0.04] motion-safe:transition-colors"
            >
              <td className="px-4 py-2.5 font-medium text-gray-900">{r.ind}</td>
              <td className="px-4 py-2.5">
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-cockpit-muted capitalize">
                  {r.cat}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900 tabular-nums">
                {r.val}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  height = "h-56",
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  height?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4 flex items-center gap-2">
        {Icon ? <Icon className="w-4 h-4 text-cockpit-muted" /> : null}
        {title}
      </h3>
      <div className={height}>{children}</div>
    </div>
  );
}

function DataTable({
  head,
  children,
  empty,
  footer,
  scrollable,
}: {
  head: string[];
  children: React.ReactNode;
  empty: boolean;
  footer: string;
  scrollable?: boolean;
}) {
  return (
    <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
      <div
        className={`overflow-x-auto ${
          scrollable ? "overflow-y-auto max-h-[calc(100vh-420px)]" : ""
        }`}
      >
        <table className="w-full text-sm text-left table-sticky-head">
          <thead className="bg-cockpit-bg text-cockpit-muted uppercase text-xs">
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 ${i > 0 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cockpit-border/50">
            {empty ? (
              <tr>
                <td
                  colSpan={head.length}
                  className="py-12 text-center text-cockpit-muted"
                >
                  Sem dados no período
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
        {footer}
      </div>
    </div>
  );
}

export default function FaturamentoPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Faturamento</h1>
            <p className="text-cockpit-muted mt-1">Carregando…</p>
          </div>
          <LoadingSkeleton />
        </div>
      }
    >
      <FaturamentoUnifiedInner />
    </Suspense>
  );
}
