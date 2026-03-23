"use client";

import { useState, useMemo, Suspense } from "react";
import {
  Tag, Search, X, Download, Package, DollarSign,
  TrendingUp, Hash, BarChart3, Users, Layers,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, ComposedChart, Line,
} from "recharts";
import { format } from "date-fns";
import { fmtBRL, fmtNum, exportCSV, getProductGroup } from "@/lib/format";
import { fetchSalesOrders, type SalesOrderRow, type SalesOrderLine } from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { useDateRange } from "@/contexts/DateRangeContext";

const COD_NAMES: Record<string, string> = {
  GN: "Garrafa Normal",
  GI: "Garrafa Importada",
  PO: "Pote",
  TM: "Tampa Metálica",
  TA: "Tampa Alumínio",
  TP: "Tampa Plástica",
  RO: "Rolha",
  LA: "Lacre",
  CH: "Chapa",
  PA: "Palete",
  MO: "Moldura",
};

const COD_COLORS: Record<string, string> = {
  GN: "#A81C2C", GI: "#c42538", PO: "#0ea5e9", TM: "#f59e0b",
  TA: "#8b5cf6", TP: "#10b981", RO: "#ec4899", LA: "#78696c",
  CH: "#6366f1", PA: "#14b8a6", MO: "#f97316",
};

const PIE_COLORS = ["#A81C2C", "#0ea5e9", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899", "#6366f1", "#14b8a6"];

const n = (v: unknown) => Number(v) || 0;

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

// ─── Item parser (same logic as pedidos) ──────────────────────

interface ParsedItem {
  cod: string;
  subNome: string;
  embala: string;
  embalaQty: number;
  unit: string;
  capacidade: string;
  cor: string;
  fechamento: string;
}

function parseItemInfo(itemCode?: string | null, desc?: string | null): ParsedItem {
  const cod = getProductGroup(itemCode);
  const d = (desc ?? "").trim();
  const empty: ParsedItem = { cod, subNome: "—", embala: "—", embalaQty: 1, unit: "UND", capacidade: "—", cor: "—", fechamento: "—" };
  if (!d) return empty;

  let subNome = d;
  let embala = "—";
  let embalaQty = 1;
  const unit = "UND";

  const dashIdx = d.lastIndexOf(" - ");
  if (dashIdx > 0) {
    subNome = d.slice(0, dashIdx).trim();
    const packPart = d.slice(dashIdx + 3).trim();
    const packRx = /^(CAIXA|FARDO|PALETE)\s+C\s*\/\s*([\d.,]+)\s*UND$/i;
    const m = packPart.match(packRx);
    if (m) { embalaQty = parseInt(m[2].replace(/\./g, "").replace(",", "."), 10) || 1; embala = `${m[1].toUpperCase()} C/${embalaQty}`; }
    else if (/^UND$/i.test(packPart.replace(/-/g, "").trim())) { embala = "UND"; embalaQty = 1; }
    else embala = packPart || "—";
  } else if (/[-–]\s*UND\s*$/i.test(d)) {
    subNome = d.slice(0, d.search(/[-–]\s*UND\s*$/i)).trim();
    embala = "UND"; embalaQty = 1;
  } else {
    const inRx = /\s+(CAIXA|FARDO|PALETE)\s+C\s*\/\s*([\d.,]+)\s*UND\s*$/i;
    const m2 = d.match(inRx);
    if (m2) { subNome = d.slice(0, m2.index!).trim(); embalaQty = parseInt(m2[2].replace(/\./g, "").replace(",", "."), 10) || 1; embala = `${m2[1].toUpperCase()} C/${embalaQty}`; }
    else if (/\bUND\s*$/i.test(d)) { const ui = d.search(/\s+UND\s*$/i); if (ui > 0) { subNome = d.slice(0, ui).trim(); embala = "UND"; embalaQty = 1; } }
  }

  const capM = subNome.match(/\b(\d[\d.,]*)\s*(ML|L)\b/i);
  const capacidade = capM ? `${capM[1]} ${capM[2].toUpperCase()}` : "—";

  const COR_MAP: Record<string, string> = { TRA: "Transparente", AMB: "Âmbar", BRANCA: "Branca", PRETA: "Preta", DOURADA: "Dourada", PRATA: "Prata", CREME: "Creme", MARROM: "Marrom", VERMELHA: "Vermelha" };
  const corM = subNome.match(/\b(TRA|AMB|BRANCA|PRETA|DOURADA|PRATA|CREME|MARROM|VERMELHA|TRANSPARENTE)\b/i);
  const cor = corM ? (COR_MAP[corM[1].toUpperCase()] ?? corM[1]) : "—";

  const fM = subNome.match(/\b(ROLHA|ROSCA|TWIST[.-]OFF|FLIP[.-]TOP|CONTA[.-]GOTAS|COROA[.-]PRY[.-]OFF|COROA[.-]TWIST[.-]OFF)\b/i);
  const fechamento = fM ? fM[1].replace(/\./g, "-").toUpperCase() : "—";

  return { cod, subNome, embala, embalaQty, unit, capacidade, cor, fechamento };
}

// ─── Product aggregation ──────────────────────────────────────

interface ProductRow {
  itemCode: string;
  cod: string;
  codName: string;
  subNome: string;
  capacidade: string;
  cor: string;
  fechamento: string;
  embala: string;
  embalaQty: number;
  qtdEmb: number;
  qtdUnd: number;
  faturamento: number;
  precoEmbMedio: number;
  precoUndMedio: number;
  descMedio: number;
  vendas: number;
  clientes: number;
}

interface CodGroup {
  cod: string;
  name: string;
  skus: number;
  qtdEmb: number;
  qtdUnd: number;
  faturamento: number;
  vendas: number;
  precoUndMedio: number;
  mediana: number;
}

function buildProductData(orders: SalesOrderRow[]): { products: ProductRow[]; codGroups: CodGroup[] } {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byItem = new Map<string, { info: ParsedItem; qtdEmb: number; totals: number[]; descs: number[]; clients: Set<string> }>();

  for (const o of active) {
    for (const l of (o.lines ?? [])) {
      const code = l.ItemCode ?? "";
      if (!code) continue;
      const info = parseItemInfo(l.ItemCode, l.ItemDescription);
      const qty = n(l.Quantity);
      const total = n(l.LineTotal);
      const disc = n(l.DiscountPercent);

      let entry = byItem.get(code);
      if (!entry) {
        entry = { info, qtdEmb: 0, totals: [], descs: [], clients: new Set() };
        byItem.set(code, entry);
      }
      entry.qtdEmb += qty;
      entry.totals.push(total);
      entry.descs.push(disc);
      entry.clients.add(o.card_code ?? "");
    }
  }

  const products: ProductRow[] = Array.from(byItem.entries()).map(([itemCode, e]) => {
    const fat = e.totals.reduce((s, v) => s + v, 0);
    const vendas = e.totals.length;
    const qtdUnd = e.qtdEmb * e.info.embalaQty;
    return {
      itemCode,
      cod: e.info.cod,
      codName: COD_NAMES[e.info.cod] ?? e.info.cod,
      subNome: e.info.subNome,
      capacidade: e.info.capacidade,
      cor: e.info.cor,
      fechamento: e.info.fechamento,
      embala: e.info.embala,
      embalaQty: e.info.embalaQty,
      qtdEmb: e.qtdEmb,
      qtdUnd,
      faturamento: fat,
      precoEmbMedio: e.qtdEmb > 0 ? fat / e.qtdEmb : 0,
      precoUndMedio: qtdUnd > 0 ? fat / qtdUnd : 0,
      descMedio: e.descs.length > 0 ? e.descs.reduce((s, v) => s + v, 0) / e.descs.length : 0,
      vendas,
      clientes: e.clients.size,
    };
  }).sort((a, b) => b.faturamento - a.faturamento);

  const byCod = new Map<string, { skus: Set<string>; qtdEmb: number; qtdUnd: number; fat: number; vendas: number; unitPrices: number[] }>();
  for (const p of products) {
    let g = byCod.get(p.cod);
    if (!g) { g = { skus: new Set(), qtdEmb: 0, qtdUnd: 0, fat: 0, vendas: 0, unitPrices: [] }; byCod.set(p.cod, g); }
    g.skus.add(p.itemCode);
    g.qtdEmb += p.qtdEmb;
    g.qtdUnd += p.qtdUnd;
    g.fat += p.faturamento;
    g.vendas += p.vendas;
    if (p.precoUndMedio > 0) g.unitPrices.push(p.precoUndMedio);
  }

  const codGroups: CodGroup[] = Array.from(byCod.entries()).map(([cod, g]) => ({
    cod,
    name: COD_NAMES[cod] ?? cod,
    skus: g.skus.size,
    qtdEmb: g.qtdEmb,
    qtdUnd: g.qtdUnd,
    faturamento: g.fat,
    vendas: g.vendas,
    precoUndMedio: g.qtdUnd > 0 ? g.fat / g.qtdUnd : 0,
    mediana: median(g.unitPrices),
  })).sort((a, b) => b.faturamento - a.faturamento);

  return { products, codGroups };
}

// ─── Embala distribution ──────────────────────────────────────

function embalaDistribution(products: ProductRow[]): { name: string; value: number; qty: number }[] {
  const m = new Map<string, { value: number; qty: number }>();
  for (const p of products) {
    const key = p.embalaQty > 1 ? p.embala.split(" ")[0] : "UND";
    const e = m.get(key) ?? { value: 0, qty: 0 };
    e.value += p.faturamento;
    e.qty += p.qtdUnd;
    m.set(key, e);
  }
  return Array.from(m.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value);
}

// ─── Sort ─────────────────────────────────────────────────────

type SortField = "itemCode" | "cod" | "subNome" | "faturamento" | "qtdUnd" | "qtdEmb" | "precoUndMedio" | "vendas" | "clientes";
type SortDir = "asc" | "desc";

function ChartTooltip({ children }: { children: React.ReactNode }) {
  return <div className="bg-white/95 backdrop-blur-sm border border-cockpit-border rounded-lg shadow-lg px-3 py-2.5 text-xs">{children}</div>;
}

// ─── Main ─────────────────────────────────────────────────────

export default function ProdutosPage() {
  return <Suspense fallback={<LoadingSkeleton rows={8} />}><ProdutosContent /></Suspense>;
}

function ProdutosContent() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data, loading, error, refetch } = useFetch(
    () => fetchSalesOrders({ limit: 50000, dateFrom, dateTo }),
    [dateFrom, dateTo]
  );

  const [search, setSearch] = useState("");
  const [codFilter, setCodFilter] = useState("");
  const [embalaFilter, setEmbalaFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("faturamento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const orders = useMemo(() => data?.items ?? [], [data]);
  const { products, codGroups } = useMemo(() => buildProductData(orders), [orders]);

  const totalFat = useMemo(() => products.reduce((s, p) => s + p.faturamento, 0), [products]);
  const totalUnd = useMemo(() => products.reduce((s, p) => s + p.qtdUnd, 0), [products]);
  const totalEmb = useMemo(() => products.reduce((s, p) => s + p.qtdEmb, 0), [products]);
  const ticketMedioSku = products.length > 0 ? totalFat / products.length : 0;
  const medianUndPrice = median(products.filter((p) => p.precoUndMedio > 0).map((p) => p.precoUndMedio));

  const embalaDist = useMemo(() => embalaDistribution(products), [products]);
  const top10 = useMemo(() => products.slice(0, 10), [products]);
  const codMedianAll = useMemo(() => median(codGroups.map((g) => g.faturamento)), [codGroups]);

  const codList = useMemo(() => Array.from(new Set(products.map((p) => p.cod))).sort(), [products]);
  const embalaTypes = useMemo(() => {
    const s = new Set<string>();
    for (const p of products) s.add(p.embalaQty > 1 ? p.embala.split(" ")[0] : "UND");
    return Array.from(s).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let res = products;
    if (codFilter) res = res.filter((p) => p.cod === codFilter);
    if (embalaFilter) {
      res = res.filter((p) => {
        const type = p.embalaQty > 1 ? p.embala.split(" ")[0] : "UND";
        return type === embalaFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((p) =>
        p.itemCode.toLowerCase().includes(q) || p.subNome.toLowerCase().includes(q) ||
        p.cod.toLowerCase().includes(q) || p.codName.toLowerCase().includes(q)
      );
    }
    res = [...res].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "itemCode": cmp = a.itemCode.localeCompare(b.itemCode); break;
        case "cod": cmp = a.cod.localeCompare(b.cod); break;
        case "subNome": cmp = a.subNome.localeCompare(b.subNome); break;
        case "faturamento": cmp = a.faturamento - b.faturamento; break;
        case "qtdUnd": cmp = a.qtdUnd - b.qtdUnd; break;
        case "qtdEmb": cmp = a.qtdEmb - b.qtdEmb; break;
        case "precoUndMedio": cmp = a.precoUndMedio - b.precoUndMedio; break;
        case "vendas": cmp = a.vendas - b.vendas; break;
        case "clientes": cmp = a.clientes - b.clientes; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return res;
  }, [products, codFilter, embalaFilter, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cockpit-accent" /> : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  const handleExport = () => {
    const rows = filtered.map((p) => ({
      "COD": p.cod, "Grupo": p.codName, "Código": p.itemCode, "Sub-Nome": p.subNome,
      "Capacidade": p.capacidade, "Cor": p.cor, "Fechamento": p.fechamento,
      "Embalagem": p.embala, "Qtd/Emb": p.embalaQty,
      "Emb. Vendidas": p.qtdEmb, "UND Vendidas": p.qtdUnd,
      "R$/Emb Médio": p.precoEmbMedio.toFixed(2), "R$/UND Médio": p.precoUndMedio.toFixed(2),
      "Faturamento": p.faturamento.toFixed(2), "Desc% Médio": p.descMedio.toFixed(1),
      "Nº Vendas": p.vendas, "Clientes": p.clientes,
    }));
    exportCSV(rows, `catalogo-produtos-${dateFrom}-${dateTo}`);
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-cockpit-accent/10"><Tag className="w-5 h-5 text-cockpit-accent" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900">Catálogo de Produtos</h1><p className="text-sm text-cockpit-muted mt-0.5">Carregando...</p></div>
      </div>
      <LoadingSkeleton rows={6} />
    </div>
  );
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-5">

      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Tag className="w-5 h-5 text-cockpit-accent" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catálogo de Produtos</h1>
            <p className="text-sm text-cockpit-muted mt-0.5">
              <strong className="text-gray-700">{products.length}</strong> SKUs em <strong className="text-gray-700">{codGroups.length}</strong> grupos · {periodoLabel}
            </p>
          </div>
        </div>
        <button type="button" onClick={handleExport}
          className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 transition-colors">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "SKUs", value: fmtNum(products.length), sub: `${codGroups.length} grupos`, icon: Tag, color: "text-cockpit-accent" },
          { label: "Faturamento", value: fmtBRL(totalFat), icon: DollarSign, color: "text-emerald-600" },
          { label: "Qtd UND", value: fmtNum(totalUnd), sub: `${fmtNum(totalEmb)} embalagens`, icon: Package, color: "text-blue-600" },
          { label: "Ticket/SKU", value: fmtBRL(ticketMedioSku), icon: TrendingUp, color: "text-violet-600" },
          { label: "R$/UND Mediana", value: fmtBRL(medianUndPrice, 2), icon: Hash, color: "text-teal-600" },
          { label: "Tipo Embala", value: String(embalaTypes.length), sub: embalaTypes.join(", "), icon: Layers, color: "text-amber-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-cockpit-border bg-white p-3.5 shadow-sm hover:border-cockpit-accent/30 transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-1.5">
              <kpi.icon className={`w-4 h-4 ${kpi.color} transition-transform duration-200 group-hover:scale-110`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-cockpit-muted mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* ═══ Charts ═══ */}
      {codGroups.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Faturamento por COD */}
          <div className="xl:col-span-2 rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cockpit-accent" />
                <h2 className="text-sm font-semibold text-gray-900">Faturamento por Grupo</h2>
              </div>
              {codMedianAll > 0 && (
                <span className="text-[10px] text-cockpit-muted">
                  Mediana: <strong className="text-blue-600">{fmtBRL(codMedianAll)}</strong>
                </span>
              )}
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={codGroups} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                  <XAxis dataKey="cod" tick={{ fill: "#78696c", fontSize: 11, fontWeight: 600 }} />
                  <YAxis yAxisId="fat" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={fmtK} width={50} />
                  <YAxis yAxisId="skus" orientation="right" tick={{ fill: "#78696c", fontSize: 10 }} width={30} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as CodGroup;
                    return (
                      <ChartTooltip>
                        <p className="font-semibold text-gray-800">{d.cod} — {d.name}</p>
                        <p className="text-cockpit-accent font-bold">{fmtBRL(d.faturamento)}</p>
                        <p className="text-gray-500">{fmtNum(d.skus)} SKUs · {fmtNum(d.vendas)} vendas</p>
                        <p className="text-gray-500">{fmtNum(d.qtdUnd)} UND · R$/UND: {fmtBRL(d.precoUndMedio, 2)}</p>
                      </ChartTooltip>
                    );
                  }} />
                  <Bar yAxisId="fat" dataKey="faturamento" radius={[4, 4, 0, 0]}>
                    {codGroups.map((g) => <Cell key={g.cod} fill={COD_COLORS[g.cod] ?? "#A81C2C"} fillOpacity={0.85} />)}
                  </Bar>
                  <Line yAxisId="skus" type="monotone" dataKey="skus" stroke="#78696c" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: "#78696c" }} />
                  {codMedianAll > 0 && <ReferenceLine yAxisId="fat" y={codMedianAll} stroke="#3b82f6" strokeDasharray="6 4" strokeWidth={1} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mix de Embalagens */}
          <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-cockpit-accent" />
              <h2 className="text-sm font-semibold text-gray-900">Mix de Embalagens</h2>
            </div>
            {embalaDist.length > 0 ? (
              <>
                <div className="h-32 flex items-center">
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie data={embalaDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={3}>
                        {embalaDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        const pct = totalFat > 0 ? ((d.value / totalFat) * 100).toFixed(1) : "0";
                        return (
                          <ChartTooltip>
                            <p className="font-semibold text-gray-800">{d.name}</p>
                            <p className="text-cockpit-accent font-bold">{fmtBRL(d.value)} ({pct}%)</p>
                            <p className="text-gray-500">{fmtNum(d.qty)} UND</p>
                          </ChartTooltip>
                        );
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 pl-2">
                    {embalaDist.map((e, i) => {
                      const pct = totalFat > 0 ? (e.value / totalFat * 100).toFixed(1) : "0";
                      return (
                        <div key={e.name} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-gray-600">{e.name}</span>
                          <span className="ml-auto font-semibold text-gray-900 tabular-nums">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* COD Cards mini */}
                <div className="mt-4 pt-3 border-t border-cockpit-border/50 space-y-2">
                  <p className="text-[10px] text-cockpit-muted uppercase tracking-wider font-semibold mb-2">Grupos de Produto</p>
                  {codGroups.slice(0, 5).map((g) => {
                    const pct = totalFat > 0 ? (g.faturamento / totalFat * 100) : 0;
                    return (
                      <div key={g.cod} className="flex items-center gap-2">
                        <span className="w-6 text-[10px] font-bold text-center rounded py-0.5" style={{ background: (COD_COLORS[g.cod] ?? "#A81C2C") + "20", color: COD_COLORS[g.cod] ?? "#A81C2C" }}>{g.cod}</span>
                        <div className="flex-1">
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: COD_COLORS[g.cod] ?? "#A81C2C" }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-600 tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                        <span className="text-[10px] text-cockpit-accent font-semibold tabular-nums w-16 text-right">{fmtBRL(g.faturamento)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : <p className="text-xs text-cockpit-muted text-center py-6">Sem dados</p>}
          </div>
        </div>
      )}

      {/* Top 10 SKUs */}
      {top10.length > 0 && (
        <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-sm font-semibold text-gray-900">Top 10 SKUs por Faturamento</h2>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" barCategoryGap="12%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5dfe1" />
                <XAxis type="number" tick={{ fill: "#78696c", fontSize: 10 }} tickFormatter={fmtK} />
                <YAxis dataKey="itemCode" type="category" tick={{ fill: "#78696c", fontSize: 9 }} width={90} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as ProductRow;
                  return (
                    <ChartTooltip>
                      <p className="font-semibold text-gray-800">{d.itemCode}</p>
                      <p className="text-gray-600 text-[11px] mb-1">{d.subNome}</p>
                      <p className="text-cockpit-accent font-bold">{fmtBRL(d.faturamento)}</p>
                      <p className="text-gray-500">{fmtNum(d.qtdUnd)} UND · {d.embala} · {fmtNum(d.vendas)} vendas</p>
                      <p className="text-teal-700">R$/UND: {fmtBRL(d.precoUndMedio, 2)}</p>
                    </ChartTooltip>
                  );
                }} />
                <Bar dataKey="faturamento" radius={[0, 4, 4, 0]}>
                  {top10.map((p) => <Cell key={p.itemCode} fill={COD_COLORS[p.cod] ?? "#A81C2C"} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══ Filtros ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="relative sm:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código, nome, grupo..."
              className="w-full pl-10 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent" />
            {search && <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-black/5 rounded"><X className="w-3.5 h-3.5 text-cockpit-muted" /></button>}
          </div>
          <div className="sm:col-span-4">
            <select value={codFilter} onChange={(e) => setCodFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
              <option value="">Todos os grupos ({codList.length})</option>
              {codList.map((c) => <option key={c} value={c}>{c} — {COD_NAMES[c] ?? c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-4">
            <select value={embalaFilter} onChange={(e) => setEmbalaFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
              <option value="">Todas embalagens</option>
              {embalaTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ═══ Tabela ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-cockpit-border bg-gray-50/80">
          <p className="text-xs text-cockpit-muted">
            <strong className="text-gray-800">{filtered.length}</strong> de <strong className="text-gray-800">{products.length}</strong> produtos
          </p>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50 text-[10px] uppercase tracking-wider text-cockpit-muted sticky top-0 z-10">
                <th className="text-left py-2.5 px-2 font-semibold w-[44px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("cod")}>
                  <span className="inline-flex items-center gap-1">COD <SortIcon field="cod" /></span></th>
                <th className="text-left py-2.5 px-2 font-semibold cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("subNome")}>
                  <span className="inline-flex items-center gap-1">Produto <SortIcon field="subNome" /></span></th>
                <th className="text-center py-2.5 px-2 font-semibold w-[72px] bg-gray-50">Embala</th>
                <th className="text-right py-2.5 px-2 font-semibold w-[70px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("qtdUnd")}>
                  <span className="inline-flex items-center gap-1 justify-end">Qtd <SortIcon field="qtdUnd" /></span></th>
                <th className="text-right py-2.5 px-2 font-semibold w-[68px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("precoUndMedio")}>
                  <span className="inline-flex items-center gap-1 justify-end">R$/UND <SortIcon field="precoUndMedio" /></span></th>
                <th className="text-right py-2.5 px-2 font-semibold w-[90px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("faturamento")}>
                  <span className="inline-flex items-center gap-1 justify-end">Faturamento <SortIcon field="faturamento" /></span></th>
                <th className="text-center py-2.5 px-2 font-semibold w-[40px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("vendas")}>
                  <span className="inline-flex items-center gap-1">Vnd <SortIcon field="vendas" /></span></th>
                <th className="text-center py-2.5 px-2 font-semibold w-[36px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("clientes")}>
                  <span className="inline-flex items-center gap-1">Cli <SortIcon field="clientes" /></span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const pctFat = totalFat > 0 ? (p.faturamento / totalFat * 100) : 0;
                return (
                  <tr key={p.itemCode} className={`border-b border-cockpit-border/10 hover:bg-cockpit-accent/[0.03] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="py-2 px-2 align-top">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: (COD_COLORS[p.cod] ?? "#A81C2C") + "18", color: COD_COLORS[p.cod] ?? "#A81C2C" }}>
                        {p.cod}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-700 max-w-[260px] align-top">
                      <span className="line-clamp-1 font-medium text-[11px]" title={`${p.itemCode} · ${p.subNome}`}>{p.subNome}</span>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                        <span className="font-mono text-[9px] text-blue-600">{p.itemCode}</span>
                        {p.capacidade !== "—" && <span className="text-[9px] font-semibold text-sky-700">{p.capacidade}</span>}
                        {p.cor !== "—" && <span className="text-[9px] text-gray-400">{p.cor}</span>}
                        {p.fechamento !== "—" && <span className="text-[9px] text-violet-500">{p.fechamento}</span>}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center align-top">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.embala === "UND" ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"}`}>{p.embala}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      <span className="font-semibold text-gray-900">{fmtNum(p.qtdUnd)}</span>
                      {p.embalaQty > 1 && (
                        <span className="block text-[9px] text-gray-400 font-normal">{fmtNum(p.qtdEmb)} emb ×{p.embalaQty}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      <span className={`text-[11px] ${p.embalaQty > 1 ? "text-teal-700 font-semibold" : "text-gray-600"}`}>{p.precoUndMedio > 0 ? fmtBRL(p.precoUndMedio, 2) : "—"}</span>
                      {p.embalaQty > 1 && p.precoEmbMedio > 0 && (
                        <span className="block text-[9px] text-gray-400">{fmtBRL(p.precoEmbMedio, 2)}/emb</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      <span className="font-semibold text-cockpit-accent">{fmtBRL(p.faturamento)}</span>
                      <span className={`block text-[9px] ${pctFat >= 10 ? "text-cockpit-accent font-bold" : pctFat >= 3 ? "text-gray-600" : "text-gray-400"}`}>{pctFat.toFixed(1)}%</span>
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-gray-600 align-top">{p.vendas}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-gray-600 align-top">{p.clientes}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-cockpit-muted">
                  <Tag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500">Nenhum produto encontrado</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-cockpit-border bg-cockpit-accent/[0.03] text-xs">
            <span className="text-cockpit-muted">Total ({filtered.length} produtos)</span>
            <div className="flex items-center gap-5 tabular-nums">
              <span className="text-gray-600">UND: <strong className="text-gray-800">{fmtNum(filtered.reduce((s, p) => s + p.qtdUnd, 0))}</strong></span>
              <span className="text-gray-600">Emb: <strong className="text-gray-800">{fmtNum(filtered.reduce((s, p) => s + p.qtdEmb, 0))}</strong></span>
              <span className="text-cockpit-accent font-bold">{fmtBRL(filtered.reduce((s, p) => s + p.faturamento, 0))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
