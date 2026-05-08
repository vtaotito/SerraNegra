"use client";

import { useState, useMemo } from "react";
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Search, CalendarDays,
  Crown, Clock, X, MapPin, ChevronRight,
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { DateRangePicker } from "@/components/cockpit/DateRangePicker";
import { ClientRdInsights } from "./ClientRdInsights";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import { CHART_AXIS_LINE, CHART_MUTED, chartAxisTick, formatYAxisCompact } from "@/lib/chart-theme";
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
  /** E-mail SAP — usado pelo Cliente 360 RD (Marketing). */
  email: string | null;
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
    vendor: number | null; uf: string | null; city: string | null; name: string | null;
  }>();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const cur = agg.get(o.card_code) ?? {
      fat: 0, pedidos: 0, qtd: 0, first: o.doc_date, last: o.doc_date,
      vendor: null, uf: null, city: null, name: null,
    };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    cur.qtd += Number(o.total_quantity) || 0;
    if (o.doc_date < cur.first) cur.first = o.doc_date;
    if (o.doc_date > cur.last) cur.last = o.doc_date;
    if (o.sales_person_code) cur.vendor = o.sales_person_code;
    if (!cur.name && o.card_name) cur.name = o.card_name;
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
        cardName: cust?.card_name || a.name || code,
        email: cust?.email?.trim() || null,
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

function formatClientesTooltip(name: string | undefined, v: number): string {
  if (name === "% Acumulado") return `${v.toFixed(1)}%`;
  if (name === "Pedidos") return fmtNum(v);
  return fmtBRL(v);
}

function ClientModal({
  client,
  orders,
  persons,
  onClose,
}: {
  client: ClientAgg;
  orders: SalesOrderRow[];
  persons: SapSalesPerson[];
  onClose: () => void;
}) {
  const pMap = new Map(persons.map((p) => [p.SalesEmployeeCode, p.SalesEmployeeName]));

  const clientOrders = useMemo(
    () =>
      orders
        .filter((o) => o.card_code === client.cardCode)
        .sort((a, b) => (b.doc_date > a.doc_date ? 1 : -1)),
    [orders, client.cardCode]
  );

  const activeOrders = useMemo(
    () => clientOrders.filter((o) => o.cancelled !== "Y"),
    [clientOrders]
  );

  const cancelledCount = clientOrders.length - activeOrders.length;

  const topProducts = useMemo(() => {
    const map = new Map<string, { desc: string; qty: number; total: number }>();
    for (const o of activeOrders) {
      if (!o.lines) continue;
      for (const l of o.lines) {
        const code = l.ItemCode ?? "?";
        const cur = map.get(code) ?? { desc: l.ItemDescription ?? code, qty: 0, total: 0 };
        cur.qty += Number(l.Quantity) || 0;
        cur.total += Number(l.LineTotal) || 0;
        map.set(code, cur);
      }
    }
    return Array.from(map.entries())
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [activeOrders]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { fat: number; pedidos: number }>();
    for (const o of activeOrders) {
      const key = o.doc_date.substring(0, 7);
      const cur = map.get(key) ?? { fat: 0, pedidos: 0 };
      cur.fat += Number(o.doc_total) || 0;
      cur.pedidos += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([month, v]) => ({
        month: month.substring(2).replace("-", "/"),
        fat: v.fat,
        pedidos: v.pedidos,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [activeOrders]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-cockpit-border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-cockpit-border bg-cockpit-bg/50">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{client.cardName}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-xs text-cockpit-accent bg-cockpit-accent/10 px-2 py-0.5 rounded-md font-semibold">{client.cardCode}</span>
              {client.state !== "—" && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{client.city !== "—" ? `${client.city} — ` : ""}{client.state}</span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                client.classe === "A" ? "bg-cockpit-accent/15 text-cockpit-accent" :
                client.classe === "B" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
              }`}>Classe {client.classe}</span>
              <span className="text-xs text-cockpit-muted">{client.vendorName}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 motion-safe:transition-colors shrink-0">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Faturamento", value: fmtBRL(client.fat), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Pedidos", value: String(activeOrders.length), sub: cancelledCount > 0 ? `(${cancelledCount} canc.)` : undefined, icon: ShoppingCart, color: "text-sky-600", bg: "bg-sky-50" },
              { label: "Ticket Médio", value: fmtBRL(client.ticket, 2), icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Recência", value: client.daysInactive === 0 ? "Hoje" : `${client.daysInactive}d`, icon: Clock, color: client.daysInactive <= 7 ? "text-emerald-600" : client.daysInactive <= 30 ? "text-amber-600" : "text-red-600", bg: client.daysInactive <= 7 ? "bg-emerald-50" : client.daysInactive <= 30 ? "bg-amber-50" : "bg-red-50" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-cockpit-border p-3">
                <div className="flex items-center gap-1.5">
                  <div className={`p-1 rounded-md ${k.bg}`}><k.icon className={`w-3.5 h-3.5 ${k.color}`} /></div>
                  <span className="text-[10px] font-semibold text-cockpit-muted uppercase">{k.label}</span>
                </div>
                <span className={`text-lg font-bold ${k.color} block mt-1`}>{k.value}</span>
                {k.sub && <span className="text-[10px] text-cockpit-muted">{k.sub}</span>}
              </div>
            ))}
          </div>

          <ClientRdInsights email={client.email} />

          {/* Período */}
          <div className="flex items-center gap-4 text-xs text-cockpit-muted">
            <span>Primeiro pedido: <strong className="text-gray-700">{fmtDateShort(client.firstOrder)}</strong></span>
            <span className="text-cockpit-border">·</span>
            <span>Último pedido: <strong className="text-gray-700">{fmtDateShort(client.lastOrder)}</strong></span>
            <span className="text-cockpit-border">·</span>
            <span>Qtd total: <strong className="text-gray-700">{fmtNum(client.qtd)} un</strong></span>
          </div>

          {/* Faturamento mensal */}
          {monthlyData.length > 1 && (
            <div>
              <h4 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mb-2">Faturamento Mensal</h4>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                    <XAxis dataKey="month" tick={{ ...chartAxisTick("sm"), fontSize: 10 }} axisLine={{ stroke: CHART_AXIS_LINE }} />
                    <YAxis tick={{ ...chartAxisTick("sm"), fontSize: 10 }} tickFormatter={(v) => formatYAxisCompact(Number(v))} width={50} />
                    <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={formatClientesTooltip} />} />
                    <Bar dataKey="fat" name="Faturamento" fill="#A81C2C" radius={[3, 3, 0, 0]} barSize={20} />
                    <Line dataKey="pedidos" name="Pedidos" type="monotone" stroke="#2563eb" strokeWidth={2} dot={{ r: 2.5 }} yAxisId={0} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top produtos */}
          {topProducts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mb-2">Top Produtos</h4>
              <div className="space-y-1.5">
                {topProducts.map((p, i) => (
                  <div key={p.code} className="flex items-center gap-3 text-xs bg-cockpit-bg/50 rounded-lg px-3 py-2 border border-cockpit-border/50">
                    <span className="w-5 h-5 rounded-full bg-cockpit-accent/10 text-cockpit-accent font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 truncate">{p.desc}</p>
                      <p className="text-cockpit-muted font-mono text-[10px]">{p.code}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-cockpit-accent">{fmtBRL(p.total)}</p>
                      <p className="text-cockpit-muted">{fmtNum(p.qty)} un</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de pedidos */}
          <div>
            <h4 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mb-2">
              Histórico de Pedidos ({clientOrders.length})
            </h4>
            <div className="rounded-lg border border-cockpit-border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-cockpit-bg text-cockpit-muted uppercase text-[10px] border-b border-cockpit-border">
                    <th className="py-2 px-3">Nº Doc</th>
                    <th className="py-2 px-3">Data</th>
                    <th className="py-2 px-3 text-right">Valor</th>
                    <th className="py-2 px-3 text-right">Qtd</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3">Vendedor</th>
                    <th className="py-2 px-3">Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cockpit-border/50">
                  {clientOrders.map((o) => {
                    const isCancelled = o.cancelled === "Y";
                    return (
                      <tr key={o.doc_entry} className={`${isCancelled ? "opacity-50" : "hover:bg-cockpit-accent/[0.03]"} motion-safe:transition-colors`}>
                        <td className="py-2 px-3 font-mono font-medium text-gray-700">{o.doc_num}</td>
                        <td className="py-2 px-3 text-gray-600">{fmtDateShort(o.doc_date)}</td>
                        <td className="py-2 px-3 text-right font-medium text-cockpit-accent">{fmtBRL(Number(o.doc_total))}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{fmtNum(Number(o.total_quantity))}</td>
                        <td className="py-2 px-3 text-center">
                          {isCancelled ? (
                            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold text-[10px]">Cancelado</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-semibold text-[10px]">
                              {o.doc_status === "O" ? "Aberto" : "Fechado"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-500">{o.sales_person_code ? (pMap.get(o.sales_person_code) ?? `Vend. ${o.sales_person_code}`) : "—"}</td>
                        <td className="py-2 px-3 max-w-[180px]">
                          {o.comments ? (
                            <span className="text-gray-400 truncate block" title={o.comments}>{o.comments.substring(0, 60)}{o.comments.length > 60 ? "…" : ""}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-cockpit-border bg-cockpit-bg/50 text-xs text-cockpit-muted flex items-center justify-between">
          <span>{clientOrders.length} pedidos · {fmtBRL(client.fat)} faturados · % do total: {client.pctFat.toFixed(2)}%</span>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-cockpit-accent text-white text-xs font-medium hover:bg-cockpit-accent/90 motion-safe:transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchSalesOrders({ limit: 50000, dateFrom, dateTo, salesPerson: salesPersonCode }), [dateFrom, dateTo, salesPersonCode]);
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
  const debouncedSearch = useDebouncedValue(search, 300);
  const [classeFilter, setClasseFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [estadoFilter, setEstadoFilter] = useState("ALL");
  const [tab, setTab] = useState<"carteira" | "geo" | "pareto">("carteira");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [geoMetric, setGeoMetric] = useState<"fat" | "count">("fat");
  const [modalClient, setModalClient] = useState<ClientAgg | null>(null);

  const uniqueEstados = useMemo(
    () => [...new Set(allClients.map((c) => c.state).filter((e) => e !== "—"))].sort(),
    [allClients]
  );

  const filtered = useMemo(() => {
    return allClients.filter((c) => {
      const q = debouncedSearch.toLowerCase();
      const mail = c.email?.toLowerCase();
      const matchSearch =
        c.cardName.toLowerCase().includes(q) ||
        c.cardCode.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.vendorName.toLowerCase().includes(q) ||
        (mail ? mail.includes(q) : false);
      const matchClasse = classeFilter === "ALL" || c.classe === classeFilter;
      const matchEstado = estadoFilter === "ALL" || c.state === estadoFilter;
      return matchSearch && matchClasse && matchEstado;
    });
  }, [allClients, debouncedSearch, classeFilter, estadoFilter]);

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cockpit-accent/10"><Users className="w-5 h-5 text-cockpit-accent" /></div>
            Clientes
          </h1>
          <p className="text-cockpit-muted mt-1 flex items-center gap-2 text-sm flex-wrap">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{periodoLabel}</span>
            <span className="text-cockpit-border">·</span>
            <span>{allClients.length} clientes com pedidos</span>
            <span className="text-cockpit-border">·</span>
            <span>{uniqueEstados.length} UFs</span>
          </p>
        </div>
        <div className="shrink-0">
          <DateRangePicker variant="compact" idPrefix="clientes-date-picker" />
        </div>
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
          <div key={k.label} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 hover:border-cockpit-accent/30 motion-safe:transition-all duration-200 shadow-sm">
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
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 focus:border-cockpit-accent/50 motion-safe:transition-all" />
        </div>
        <div className="flex gap-0.5 rounded-xl border border-cockpit-border bg-cockpit-bg p-0.5">
          {(["ALL", "A", "B", "C"] as const).map((opt) => (
            <button key={opt} onClick={() => setClasseFilter(opt)}
              className={`px-3 py-2 rounded-lg text-xs font-medium motion-safe:transition-all ${
                classeFilter === opt ? "bg-cockpit-accent/20 text-cockpit-accent shadow-sm" : "text-cockpit-muted hover:text-gray-900 hover:bg-black/5"
              }`}>{opt === "ALL" ? "Todas" : `Classe ${opt}`}</button>
          ))}
        </div>
        {uniqueEstados.length > 1 && (
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-cockpit-bg border border-cockpit-border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30 motion-safe:transition-all">
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
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold motion-safe:transition-all ${
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
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} horizontal={false} />
                    <XAxis type="number" tick={chartAxisTick("md")} axisLine={{ stroke: CHART_AXIS_LINE }}
                      tickFormatter={(v) => formatYAxisCompact(Number(v))} />
                    <YAxis dataKey="name" type="category" tick={chartAxisTick("md")} width={130} />
                    <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={formatClientesTooltip} />} />
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
                  className={`px-3 py-1.5 rounded-md text-xs font-medium motion-safe:transition-all ${
                    geoMetric === "fat" ? "bg-white text-cockpit-accent shadow-sm" : "text-cockpit-muted"
                  }`}>Faturamento</button>
                <button onClick={() => setGeoMetric("count")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium motion-safe:transition-all ${
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
                        className={`rounded-lg flex flex-col items-center justify-center motion-safe:transition-all text-center
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
                            <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {geoData.slice(0, 8).map((g, i) => (
                        <button key={g.state} onClick={() => setSelectedState(g.state)}
                          className="w-full flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg hover:bg-cockpit-accent/5 motion-safe:transition-colors group">
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
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                  <XAxis dataKey="name" tick={{ ...chartAxisTick("sm"), fontSize: 10 }} axisLine={{ stroke: CHART_AXIS_LINE }} angle={-30} textAnchor="end" height={50} />
                  <YAxis yAxisId="left" tick={chartAxisTick("md")} tickFormatter={(v) => formatYAxisCompact(Number(v))} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: CHART_MUTED, fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} domain={[0, 100]} />
                  <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={formatClientesTooltip} />} />
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
                  <tr key={r.cardCode} onClick={() => setModalClient(r)}
                    className="hover:bg-cockpit-accent/[0.04] motion-safe:transition-colors cursor-pointer group">
                    <td className="py-2.5 px-4 text-cockpit-muted text-xs">{i + 1}</td>
                    <td className="py-2.5 px-4 max-w-[260px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 truncate group-hover:text-cockpit-accent motion-safe:transition-colors" title={r.cardName}>{r.cardName}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-cockpit-muted opacity-0 group-hover:opacity-100 motion-safe:transition-opacity shrink-0" />
                      </div>
                      <div className="text-[10px] text-cockpit-muted font-mono mt-0.5">{r.cardCode}{r.city !== "—" ? ` · ${r.city}` : ""}</div>
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
        <div
          className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted bg-cockpit-bg/50"
          aria-live="polite"
          aria-atomic="true"
        >
          {filtered.length} de {allClients.length} clientes · Faturamento total: {fmtBRL(kpis.fat)} — Pedidos de Venda SAP B1
          <span className="ml-2 text-cockpit-accent/60">· Clique em um cliente para ver detalhes</span>
        </div>
      </div>

      {/* Client Detail Modal */}
      {modalClient && (
        <ClientModal
          client={modalClient}
          orders={orders}
          persons={persons}
          onClose={() => setModalClient(null)}
        />
      )}
    </div>
  );
}
