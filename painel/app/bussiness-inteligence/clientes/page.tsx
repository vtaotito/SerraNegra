"use client";

import { useState, useMemo } from "react";
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Search, CalendarDays,
  Crown, Clock, X, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie, ComposedChart, Line,
} from "recharts";
import { fmtBRL, fmtNum, fmtDateShort, STATE_TO_REGION } from "@/lib/format";
import {
  fetchSalesOrders, fetchCustomers, fetchSalesPersons,
  type SalesOrderRow, type CustomerRow, type SapSalesPerson,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { format, differenceInDays } from "date-fns";

const COLORS = [
  "#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed",
  "#0891b2", "#dc2626", "#4f46e5", "#16a34a", "#ea580c",
];
const PIE_COLORS = ["#A81C2C", "#2563eb", "#059669", "#d97706", "#7c3aed", "#6b7280"];

const CARTO: Array<[string, number, number]> = [
  ["RR", 3, 0], ["AP", 4, 0],
  ["AM", 0, 1], ["PA", 2, 1], ["MA", 3, 1], ["PI", 4, 1], ["CE", 5, 1], ["RN", 6, 1],
  ["AC", 0, 2], ["TO", 2, 2], ["BA", 4, 2], ["PB", 5, 2], ["PE", 6, 2],
  ["RO", 0, 3], ["MT", 1, 3], ["GO", 2, 3], ["DF", 3, 3], ["MG", 4, 3], ["AL", 5, 3], ["SE", 6, 3],
  ["MS", 1, 4], ["SP", 3, 4], ["RJ", 4, 4], ["ES", 5, 4],
  ["PR", 2, 5],
  ["SC", 2, 6],
  ["RS", 2, 7],
];

const UF_NAME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

function extractUF(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const m = addr.match(/-([A-Z]{2})\s*[\r\n]/);
  return m && STATE_TO_REGION[m[1]] ? m[1] : null;
}

function daysSince(dateStr: string): number {
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
  return Math.max(0, differenceInDays(new Date(), d));
}

function heatColor(value: number, max: number): string {
  if (!max || value === 0) return "#f3f4f6";
  const t = Math.pow(Math.min(value / max, 1), 0.45);
  const r = Math.round(243 + (168 - 243) * t);
  const g = Math.round(244 + (28 - 244) * t);
  const b = Math.round(246 + (44 - 246) * t);
  return `rgb(${r},${g},${b})`;
}

function daysColor(d: number) {
  if (d <= 7) return "text-emerald-600 bg-emerald-50";
  if (d <= 30) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

interface ClientAgg {
  cardCode: string;
  cardName: string;
  city: string;
  state: string;
  region: string;
  phone: string;
  isActive: boolean;
  fat: number;
  pedidos: number;
  ticket: number;
  qtd: number;
  firstOrder: string;
  lastOrder: string;
  daysInactive: number;
  pctFat: number;
  pctCum: number;
  classe: "A" | "B" | "C";
  vendorCode: number | null;
  vendorName: string;
}

function buildClientAnalytics(
  orders: SalesOrderRow[],
  customers: CustomerRow[],
  persons: SapSalesPerson[]
): ClientAgg[] {
  const pMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));
  const custMap = new Map(customers.map((c) => [c.card_code, c]));

  const agg = new Map<string, {
    fat: number; pedidos: number; qtd: number; first: string; last: string;
    vendor: number | null; uf: string | null; city: string | null;
  }>();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const cur = agg.get(o.card_code) ?? {
      fat: 0, pedidos: 0, qtd: 0, first: o.doc_date, last: o.doc_date,
      vendor: null, uf: null, city: null,
    };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    cur.qtd += Number(o.total_quantity) || 0;
    if (o.doc_date < cur.first) cur.first = o.doc_date;
    if (o.doc_date > cur.last) cur.last = o.doc_date;
    if (o.sales_person_code) cur.vendor = o.sales_person_code;
    if (!cur.uf) {
      cur.uf = extractUF(o.address) || extractUF(o.address2);
      const cityMatch = (o.address || "").match(/\d{5}-?\d{3}-([^-\r\n]+)-[A-Z]{2}/);
      if (cityMatch) cur.city = cityMatch[1].trim();
    }
    agg.set(o.card_code, cur);
  }

  const totalFat = Array.from(agg.values()).reduce((s, a) => s + a.fat, 0);

  const rows: ClientAgg[] = Array.from(agg.entries())
    .map(([code, a]) => {
      const cust = custMap.get(code);
      const st = cust?.state || a.uf || "—";
      const city = cust?.city || a.city || "—";
      return {
        cardCode: code,
        cardName: cust?.card_name ?? code,
        city,
        state: st,
        region: STATE_TO_REGION[st] ?? "Outro",
        phone: cust?.phone ?? "—",
        isActive: cust?.is_active ?? true,
        fat: a.fat,
        pedidos: a.pedidos,
        ticket: a.pedidos > 0 ? a.fat / a.pedidos : 0,
        qtd: a.qtd,
        firstOrder: a.first,
        lastOrder: a.last,
        daysInactive: daysSince(a.last),
        pctFat: totalFat > 0 ? (a.fat / totalFat) * 100 : 0,
        pctCum: 0,
        classe: "C" as const,
        vendorCode: a.vendor,
        vendorName: a.vendor ? (pMap.get(a.vendor) ?? `Vend. ${a.vendor}`) : "—",
      };
    })
    .sort((a, b) => b.fat - a.fat);

  let cum = 0;
  for (const r of rows) {
    cum += r.pctFat;
    r.pctCum = cum;
    if (cum <= 80) r.classe = "A";
    else if (cum <= 95) r.classe = "B";
    else r.classe = "C";
  }
  return rows;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-cockpit-border bg-white px-3 py-2 shadow-lg text-xs z-50">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}:</span>
          <span className="font-semibold">
            {p.name === "% Acumulado" ? `${Number(p.value).toFixed(1)}%` :
             p.name === "Pedidos" ? fmtNum(Number(p.value)) :
             fmtBRL(Number(p.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function ClientesPage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo }), [dateFrom, dateTo]);
  const { data: custData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchCustomers({ limit: 5000 }), []);
  const { data: spData, loading: l3, error: e3, refetch: r3 } =
    useFetch(() => fetchSalesPersons(), []);

  const loading = l1 && l2;
  const error = e1 || e2 || e3;

  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const customers = useMemo(() => custData?.data ?? [], [custData]);
  const persons = useMemo(() => spData?.items ?? [], [spData]);

  const allClients = useMemo(
    () => buildClientAnalytics(orders, customers, persons),
    [orders, customers, persons]
  );

  const [search, setSearch] = useState("");
  const [classeFilter, setClasseFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [tab, setTab] = useState<"carteira" | "geo" | "pareto">("carteira");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [geoMetric, setGeoMetric] = useState<"fat" | "count">("fat");

  const uniqueEstados = useMemo(
    () => [...new Set(allClients.map((c) => c.state).filter((e) => e !== "—"))].sort(),
    [allClients]
  );

  const filtered = useMemo(() => {
    return allClients.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = c.cardName.toLowerCase().includes(q) || c.cardCode.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) || c.vendorName.toLowerCase().includes(q);
      const matchClasse = classeFilter === "ALL" || c.classe === classeFilter;
      const matchEstado = estadoFilter === "ALL" || c.state === estadoFilter;
      return matchSearch && matchClasse && matchEstado;
    });
  }, [allClients, search, classeFilter, estadoFilter]);

  const kpis = useMemo(() => {
    const totalFat = filtered.reduce((s, r) => s + r.fat, 0);
    const totalPed = filtered.reduce((s, r) => s + r.pedidos, 0);
    const classeA = filtered.filter((c) => c.classe === "A").length;
    const avgDays = filtered.length > 0
      ? Math.round(filtered.reduce((s, r) => s + r.daysInactive, 0) / filtered.length)
      : 0;
    return { total: filtered.length, fat: totalFat, pedidos: totalPed,
      ticket: totalPed > 0 ? totalFat / totalPed : 0, classeA, avgDays };
  }, [filtered]);

  const stateMap = useMemo(() => {
    const map = new Map<string, { fat: number; count: number; pedidos: number }>();
    for (const c of allClients) {
      if (c.state === "—") continue;
      const cur = map.get(c.state) ?? { fat: 0, count: 0, pedidos: 0 };
      cur.fat += c.fat;
      cur.count += 1;
      cur.pedidos += c.pedidos;
      map.set(c.state, cur);
    }
    return map;
  }, [allClients]);

  const geoData = useMemo(() => {
    return Array.from(stateMap.entries())
      .map(([state, v]) => ({ state, fat: v.fat, count: v.count, pedidos: v.pedidos, region: STATE_TO_REGION[state] ?? "Outro" }))
      .sort((a, b) => b.fat - a.fat);
  }, [stateMap]);

  const regionData = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    for (const g of geoData) {
      const cur = map.get(g.region) ?? { value: 0, count: 0 };
      cur.value += g.fat;
      cur.count += g.count;
      map.set(g.region, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, value: v.value, count: v.count }))
      .sort((a, b) => b.value - a.value);
  }, [geoData]);

  const selectedStateClients = useMemo(() => {
    if (!selectedState) return [];
    return allClients.filter((c) => c.state === selectedState).slice(0, 10);
  }, [allClients, selectedState]);

  const selectedStateData = selectedState ? stateMap.get(selectedState) : null;
  const maxGeoVal = useMemo(() => {
    let m = 0;
    for (const v of stateMap.values()) {
      const val = geoMetric === "fat" ? v.fat : v.count;
      if (val > m) m = val;
    }
    return m;
  }, [stateMap, geoMetric]);

  const carteiraChartData = useMemo(() => {
    return filtered.slice(0, 15).map((c) => ({
      name: c.cardName.length > 18 ? c.cardName.substring(0, 18) + "…" : c.cardName,
      Faturamento: c.fat,
      Pedidos: c.pedidos,
      Ticket: c.ticket,
    }));
  }, [filtered]);

  const abcData = useMemo(() => {
    const a = allClients.filter((c) => c.classe === "A").length;
    const b = allClients.filter((c) => c.classe === "B").length;
    const cc = allClients.filter((c) => c.classe === "C").length;
    return [
      { name: `A (${a})`, value: a, fill: "#A81C2C" },
      { name: `B (${b})`, value: b, fill: "#d97706" },
      { name: `C (${cc})`, value: cc, fill: "#9ca3af" },
    ];
  }, [allClients]);

  const paretoData = useMemo(() => {
    return allClients.slice(0, 30).map((c) => ({
      name: c.cardName.split(" ")[0].substring(0, 12),
      fat: c.fat,
      cumPct: c.pctCum,
    }));
  }, [allClients]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Clientes</h1><p className="text-cockpit-muted mt-1">Carregando dados...</p></div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Clientes</h1></div>
        <ErrorState message={error} onRetry={() => { r1(); r2(); r3(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Users className="w-5 h-5 text-cockpit-accent" /></div>
          Clientes
        </h1>
        <p className="text-cockpit-muted mt-1 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Período: <span className="text-gray-600">{periodoLabel}</span></span>
          <span className="text-cockpit-border">·</span>
          <span>{allClients.length} clientes com pedidos</span>
          <span className="text-cockpit-border">·</span>
          <span>{uniqueEstados.length} UFs</span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Clientes", value: String(kpis.total), icon: Users, color: "text-cockpit-accent" },
          { label: "Faturamento", value: fmtBRL(kpis.fat), icon: DollarSign, color: "text-emerald-500" },
          { label: "Pedidos", value: fmtNum(kpis.pedidos), icon: ShoppingCart, color: "text-sky-500" },
          { label: "Ticket Médio", value: fmtBRL(kpis.ticket, 2), icon: TrendingUp, color: "text-amber-500" },
          { label: "Classe A (80%)", value: String(kpis.classeA), icon: Crown, color: "text-purple-500" },
          { label: "Recência Média", value: `${kpis.avgDays}d`, icon: Clock, color: "text-rose-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 transition-all duration-200 shadow-sm">
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
            placeholder="Buscar cliente, código, cidade ou vendedor..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 focus:border-cockpit-accent/50 transition-all" />
        </div>
        <div className="flex gap-0.5 rounded-xl border border-cockpit-border bg-cockpit-bg p-0.5">
          {(["ALL", "A", "B", "C"] as const).map((opt) => (
            <button key={opt} onClick={() => setClasseFilter(opt)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                classeFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-900 hover:bg-black/5"
              }`}>{opt === "ALL" ? "Todas" : `Classe ${opt}`}</button>
          ))}
        </div>
        {uniqueEstados.length > 1 && (
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 transition-all">
            <option value="ALL">Todos UFs</option>
            {uniqueEstados.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1">
        {([
          { id: "carteira", label: "Carteira" },
          { id: "geo", label: "Geográfico" },
          { id: "pareto", label: "Curva 80-20" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "geo") setSelectedState(null); }}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Chart Area */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5">

        {/* ========== CARTEIRA ========== */}
        {tab === "carteira" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">
                Top 15 Clientes — Faturamento × Pedidos
              </h3>
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={carteiraChartData} layout="vertical" barCategoryGap="12%"
                    margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#78696c", fontSize: 11 }} axisLine={{ stroke: "#e5dfe1" }}
                      tickFormatter={(v) => v >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : String(v)} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "#78696c", fontSize: 11 }} width={130} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Faturamento" name="Faturamento" radius={[0, 4, 4, 0]} barSize={16}>
                      {carteiraChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                    <Line dataKey="Ticket" name="Ticket Médio" type="monotone"
                      stroke="#7c3aed" strokeWidth={2} dot={{ r: 3, fill: "#7c3aed" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-3">Classificação ABC</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={abcData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={35} outerRadius={60} paddingAngle={3}
                        label={({ name, percent }: any) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}>
                        {abcData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-2">
                {abcData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: d.fill }} />
                    <span className="text-gray-600">Classe {d.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-3 border-t border-cockpit-border space-y-1.5 text-xs text-cockpit-muted">
                <p>A = 80% do faturamento</p>
                <p>B = 15% do faturamento</p>
                <p>C = 5% do faturamento</p>
              </div>
            </div>
          </div>
        )}

        {/* ========== GEOGRÁFICO ========== */}
        {tab === "geo" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Distribuição Geográfica — Mapa do Brasil
              </h3>
              <div className="flex gap-0.5 rounded-lg border border-cockpit-border bg-cockpit-bg p-0.5">
                <button onClick={() => setGeoMetric("fat")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    geoMetric === "fat" ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted"
                  }`}>Faturamento</button>
                <button onClick={() => setGeoMetric("count")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    geoMetric === "count" ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted"
                  }`}>Nº Clientes</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Cartogram */}
              <div className="lg:col-span-3">
                <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, 56px)", gridTemplateRows: "repeat(8, 48px)" }}>
                  {CARTO.map(([uf, col, row]) => {
                    const sd = stateMap.get(uf);
                    const val = sd ? (geoMetric === "fat" ? sd.fat : sd.count) : 0;
                    const isSelected = selectedState === uf;
                    const hasData = !!sd;
                    return (
                      <button key={uf}
                        onClick={() => setSelectedState(isSelected ? null : uf)}
                        style={{
                          gridColumn: col + 1,
                          gridRow: row + 1,
                          backgroundColor: hasData ? heatColor(val, maxGeoVal) : "#f9fafb",
                        }}
                        className={`rounded-lg flex flex-col items-center justify-center transition-all text-center
                          ${isSelected ? "ring-2 ring-cockpit-accent ring-offset-1 scale-105 z-10" : ""}
                          ${hasData ? "cursor-pointer hover:ring-2 hover:ring-cockpit-accent/40 hover:scale-[1.03] shadow-sm" : "opacity-30 cursor-default border border-gray-200"}
                        `}
                        title={hasData ? `${UF_NAME[uf]}: ${geoMetric === "fat" ? fmtBRL(sd!.fat) : `${sd!.count} clientes`}` : UF_NAME[uf]}
                      >
                        <span className={`text-xs font-bold ${hasData && val > maxGeoVal * 0.5 ? "text-white" : "text-gray-700"}`}>{uf}</span>
                        {hasData && (
                          <span className={`text-[8px] font-medium leading-none mt-0.5 ${val > maxGeoVal * 0.5 ? "text-white/80" : "text-gray-500"}`}>
                            {geoMetric === "fat" ? (sd!.fat >= 1000 ? `${(sd!.fat / 1000).toFixed(0)}k` : fmtNum(Math.round(sd!.fat))) : sd!.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-cockpit-muted">
                  <span>Menor</span>
                  <div className="flex gap-0.5">
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => (
                      <div key={t} className="w-6 h-3 rounded-sm" style={{ backgroundColor: heatColor(t * maxGeoVal, maxGeoVal) }} />
                    ))}
                  </div>
                  <span>Maior</span>
                  <span className="ml-2">· Clique em um estado para detalhes</span>
                </div>
              </div>

              {/* Detail panel */}
              <div className="lg:col-span-2">
                {selectedState && selectedStateData ? (
                  <div className="rounded-xl border border-cockpit-accent/30 bg-cockpit-accent/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">{UF_NAME[selectedState]}</h4>
                        <p className="text-xs text-cockpit-muted">{STATE_TO_REGION[selectedState]} · {selectedState}</p>
                      </div>
                      <button onClick={() => setSelectedState(null)} className="p-1 rounded-md hover:bg-black/5"><X className="w-4 h-4 text-cockpit-muted" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white p-2.5 border border-cockpit-border">
                        <span className="text-[9px] text-cockpit-muted uppercase font-semibold">Clientes</span>
                        <span className="block text-lg font-bold text-cockpit-accent">{selectedStateData.count}</span>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 border border-cockpit-border">
                        <span className="text-[9px] text-cockpit-muted uppercase font-semibold">Faturamento</span>
                        <span className="block text-sm font-bold text-emerald-600">{fmtBRL(selectedStateData.fat)}</span>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 border border-cockpit-border">
                        <span className="text-[9px] text-cockpit-muted uppercase font-semibold">Pedidos</span>
                        <span className="block text-lg font-bold text-sky-600">{selectedStateData.pedidos}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-cockpit-muted uppercase mb-2">Top clientes neste estado</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selectedStateClients.map((c, i) => (
                          <div key={c.cardCode} className="flex items-center justify-between gap-2 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-cockpit-border/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-cockpit-muted w-4 text-right shrink-0">{i + 1}</span>
                              <span className="font-medium text-gray-900 truncate">{c.cardName}</span>
                            </div>
                            <span className="text-cockpit-accent font-semibold whitespace-nowrap">{fmtBRL(c.fat)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-3">Por Região</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={regionData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                              innerRadius={40} outerRadius={70} paddingAngle={3}
                              label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {regionData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {geoData.slice(0, 8).map((g, i) => (
                        <button key={g.state} onClick={() => setSelectedState(g.state)}
                          className="w-full flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg hover:bg-cockpit-accent/5 transition-colors group">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-medium text-gray-700 group-hover:text-cockpit-accent">{g.state}</span>
                            <span className="text-cockpit-muted">{g.count} clientes</span>
                          </div>
                          <span className="font-semibold text-gray-900">{fmtBRL(g.fat)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== PARETO ========== */}
        {tab === "pareto" && (
          <>
            <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-4">Curva ABC — Top 30 Clientes</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="name" tick={{ fill: "#78696c", fontSize: 10 }} axisLine={{ stroke: "#e5dfe1" }} angle={-30} textAnchor="end" height={50} />
                  <YAxis yAxisId="left" tick={{ fill: "#78696c", fontSize: 11 }} tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#7c3aed", fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar yAxisId="left" dataKey="fat" name="Faturamento" radius={[4, 4, 0, 0]}>
                    {paretoData.map((d, i) => (
                      <Cell key={i} fill={d.cumPct <= 80 ? "#A81C2C" : d.cumPct <= 95 ? "#d97706" : "#9ca3af"} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" dataKey="cumPct" name="% Acumulado" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-cockpit-muted">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#A81C2C]" /> Classe A (80%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#d97706]" /> Classe B (15%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#9ca3af]" /> Classe C (5%)</span>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-sm text-left table-sticky-head">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg text-cockpit-muted uppercase text-xs">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">UF</th>
                <th className="py-3 px-4 text-right">Faturamento</th>
                <th className="py-3 px-4 text-right">Pedidos</th>
                <th className="py-3 px-4 text-right">Ticket</th>
                <th className="py-3 px-4 text-right">% Fat.</th>
                <th className="py-3 px-4 text-center">ABC</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4">Último Pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-cockpit-muted">Nenhum cliente encontrado</td></tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.cardCode} className="hover:bg-cockpit-accent/[0.04] transition-colors">
                    <td className="py-2.5 px-4 text-cockpit-muted text-xs">{i + 1}</td>
                    <td className="py-2.5 px-4 max-w-[240px]">
                      <div className="font-medium text-gray-900 truncate" title={r.cardName}>{r.cardName}</div>
                      <div className="text-[10px] text-cockpit-muted font-mono">{r.cardCode}{r.city !== "—" ? ` · ${r.city}` : ""}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      {r.state !== "—" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">{r.state}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-cockpit-accent font-medium">{fmtBRL(r.fat)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{r.pedidos}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{fmtBRL(r.ticket, 2)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-500">{r.pctFat.toFixed(1)}%</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.classe === "A" ? "bg-cockpit-accent/15 text-cockpit-accent" :
                        r.classe === "B" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                      }`}>{r.classe}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs max-w-[120px] truncate">{r.vendorName}</td>
                    <td className="py-2.5 px-4">
                      <div className="text-xs text-gray-600">{fmtDateShort(r.lastOrder)}</div>
                      <span className={`inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${daysColor(r.daysInactive)}`}>
                        <Clock className="w-2.5 h-2.5" />
                        {r.daysInactive === 0 ? "hoje" : `${r.daysInactive}d atrás`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50">
          {filtered.length} de {allClients.length} clientes · Faturamento total: {fmtBRL(kpis.fat)} — Pedidos de Venda SAP B1
        </div>
      </div>
    </div>
  );
}
