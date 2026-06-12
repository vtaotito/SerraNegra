"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import {
  Tag, Search, X, Download, Package, DollarSign,
  TrendingUp, Hash, BarChart3, Layers,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronRight,
  Users, Boxes, MapPin, Briefcase, Loader2, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, ComposedChart, Line,
} from "recharts";
import { format, subMonths, startOfMonth, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

/** "yyyy-MM-dd" — usado em parâmetros de query (API) */
function formatDateOnly(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** "yyyy-MM" — chave do mês para agrupamento */
function formatYearMonth(d: Date): string {
  return format(d, "yyyy-MM");
}
import {
  fmtBRL,
  fmtNum,
  fmtDateShort,
  exportCSV,
  getProductGroup,
  STATE_TO_REGION,
  PRODUCT_GROUP_NAMES,
  PRODUCT_GROUP_COLORS,
  PRODUCT_GROUP_HIDDEN,
} from "@/lib/format";
import {
  fetchProductAnalytics, fetchProductOrders, fetchSalesPersons,
  type ProductAnalyticsRow, type ProductOrderLine, type SapSalesPerson,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { classifyCompras, getComprasGroup, type CurvaABCD } from "@/lib/compras-engine";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { BiChartTooltip, CockpitTooltipFrame } from "@/components/cockpit/ChartTooltip";
import { CHART_AXIS_LINE, CHART_MUTED, chartAxisTick, formatYAxisCompact } from "@/lib/chart-theme";

/**
 * Aliases locais para legibilidade — apontam para a fonte unica em
 * `lib/format.ts` (PRODUCT_GROUP_*).  Toda a app usa o mesmo dicionario
 * para evitar drift entre paginas.
 */
const COD_NAMES = PRODUCT_GROUP_NAMES;
const COD_COLORS = PRODUCT_GROUP_COLORS;
const HIDDEN_GROUPS = PRODUCT_GROUP_HIDDEN;

const PIE_COLORS = ["#A81C2C", "#0ea5e9", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899", "#6366f1", "#14b8a6"];

const UF_NAME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ═══════════════════ Item parsing ═══════════════════ */

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

  const U = "(?:UND|UNID)";

  const dashIdx = d.lastIndexOf(" - ");
  if (dashIdx > 0) {
    subNome = d.slice(0, dashIdx).trim();
    const packPart = d.slice(dashIdx + 3).trim();
    const rxCSlash = new RegExp(`^(CAIXA|FARDO|PALETE)\\s+C\\s*/\\s*([\\d.,]+)\\s*${U}?\\s*$`, "i");
    const rxPlain  = new RegExp(`^(CAIXA|FARDO|PALETE)\\s+(\\d+)\\s*${U}\\s*$`, "i");
    const m = packPart.match(rxCSlash) ?? packPart.match(rxPlain);
    if (m) { embalaQty = parseInt(m[2].replace(/\./g, "").replace(",", "."), 10) || 1; embala = `${m[1].toUpperCase()} C/${embalaQty}`; }
    else if (new RegExp(`^${U}$`, "i").test(packPart.replace(/-/g, "").trim())) { embala = "UND"; embalaQty = 1; }
    else embala = packPart || "—";
  } else if (new RegExp(`[-–]\\s*${U}\\s*$`, "i").test(d)) {
    subNome = d.slice(0, d.search(new RegExp(`[-–]\\s*${U}\\s*$`, "i"))).trim();
    embala = "UND"; embalaQty = 1;
  } else {
    const rxCSlash = new RegExp(`\\s+(CAIXA|FARDO|PALETE)\\s+C\\s*/\\s*([\\d.,]+)\\s*${U}?\\s*$`, "i");
    const rxPlain  = new RegExp(`\\s+(CAIXA|FARDO|PALETE)\\s+(\\d+)\\s*${U}\\s*$`, "i");
    const m2 = d.match(rxCSlash) ?? d.match(rxPlain);
    if (m2) { subNome = d.slice(0, m2.index!).trim(); embalaQty = parseInt(m2[2].replace(/\./g, "").replace(",", "."), 10) || 1; embala = `${m2[1].toUpperCase()} C/${embalaQty}`; }
    else if (new RegExp(`\\b${U}\\s*$`, "i").test(d)) {
      const ui = d.search(new RegExp(`\\s+${U}\\s*$`, "i"));
      if (ui > 0) { subNome = d.slice(0, ui).trim(); embala = "UND"; embalaQty = 1; }
    }
  }

  subNome = subNome.replace(/\s{2,}/g, " ").trim();

  const capM = subNome.match(/\b(\d[\d.,]*)\s*(ML|L)\b/i);
  const capacidade = capM ? `${capM[1]} ${capM[2].toUpperCase()}` : "—";

  const COR_MAP: Record<string, string> = { TRA: "Transparente", AMB: "Âmbar", BRANCA: "Branca", PRETA: "Preta", DOURADA: "Dourada", PRATA: "Prata", CREME: "Creme", MARROM: "Marrom", VERMELHA: "Vermelha" };
  const corM = subNome.match(/\b(TRA|AMB|BRANCA|PRETA|DOURADA|PRATA|CREME|MARROM|VERMELHA|TRANSPARENTE)\b/i);
  const cor = corM ? (COR_MAP[corM[1].toUpperCase()] ?? corM[1]) : "—";

  const fM = subNome.match(/\b(ROLHA|ROSCA|TWIST[.-]OFF|FLIP[.-]TOP|CONTA[.-]GOTAS|COROA[.-]PRY[.-]OFF|COROA[.-]TWIST[.-]OFF)\b/i);
  const fechamento = fM ? fM[1].replace(/\./g, "-").toUpperCase() : "—";

  return { cod, subNome, embala, embalaQty, unit, capacidade, cor, fechamento };
}

/* ═══════════════════ Data types ═══════════════════ */

interface CatalogSummary {
  totalOrders: number;
  ordersWithLines: number;
  totalRevenueHeader: number;
  totalRevenueHeader3m: number;
  totalClients: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

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
  vendas: number;
  clientes: number;
  maxSaleValue: number;
  minSaleValue: number;
  qty3mUnd: number;
  /** Faturamento dos últimos 3 meses (R$) */
  fat3m: number;
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

interface UnifiedProductRow {
  itemCode: string;
  cod: string;
  codName: string;
  subNome: string;
  capacidade: string;
  cor: string;
  fechamento: string;
  qtdUnd: number;
  faturamento: number;
  precoUndMedio: number;
  vendas: number;
  clientes: number;
  avgQtd3m: number;
  maxSale12m: number;
  minSale12m: number;
  /** Faturamento dos últimos 3 meses (R$) — soma das variantes */
  fat3m: number;
  /** Média mensal de faturamento dos últimos 3 meses (R$/mês) */
  avgFat3m: number;
  variants: ProductRow[];
}

/* ═══════════════════ Build from server-aggregated rows ═══════════════════ */

function buildFromAnalytics(rows: ProductAnalyticsRow[]): {
  products: ProductRow[];
  codGroups: CodGroup[];
  clientsByItem: Map<string, number>;
  hiddenSkuCount: number;
  hiddenRevenue: number;
} {
  let hiddenSkuCount = 0;
  let hiddenRevenue = 0;

  const products: ProductRow[] = rows
    .map((r) => {
      const info = parseItemInfo(r.item_code, r.item_description);
      if (HIDDEN_GROUPS.has(info.cod)) {
        hiddenSkuCount += 1;
        hiddenRevenue += r.total_revenue;
        return null;
      }
      const qtdEmb = r.total_qty;
      const qtdUnd = qtdEmb * info.embalaQty;
      const fat = r.total_revenue;
      const fat3m = Number(r.revenue_3m ?? 0);
      return {
        itemCode: r.item_code,
        cod: info.cod,
        codName: COD_NAMES[info.cod] ?? info.cod,
        subNome: info.subNome,
        capacidade: info.capacidade,
        cor: info.cor,
        fechamento: info.fechamento,
        embala: info.embala,
        embalaQty: info.embalaQty,
        qtdEmb,
        fat3m,
        qtdUnd,
        faturamento: fat,
        precoEmbMedio: qtdEmb > 0 ? fat / qtdEmb : 0,
        precoUndMedio: qtdUnd > 0 ? fat / qtdUnd : 0,
        vendas: r.sale_count,
        clientes: r.unique_clients,
        maxSaleValue: r.max_sale ?? 0,
        minSaleValue: r.min_sale ?? 0,
        qty3mUnd: (r.qty_3m ?? 0) * info.embalaQty,
      } satisfies ProductRow;
    })
    .filter((p): p is ProductRow => p !== null)
    .sort((a, b) => b.faturamento - a.faturamento);

  const clientsByItem = new Map<string, number>();
  for (const p of products) clientsByItem.set(p.itemCode, p.clientes);

  const byCod = new Map<string, { skus: Set<string>; qtdEmb: number; qtdUnd: number; fat: number; vendas: number; unitPrices: number[] }>();
  for (const p of products) {
    let g = byCod.get(p.cod);
    if (!g) { g = { skus: new Set(), qtdEmb: 0, qtdUnd: 0, fat: 0, vendas: 0, unitPrices: [] }; byCod.set(p.cod, g); }
    g.skus.add(p.itemCode); g.qtdEmb += p.qtdEmb; g.qtdUnd += p.qtdUnd;
    g.fat += p.faturamento; g.vendas += p.vendas;
    if (p.precoUndMedio > 0) g.unitPrices.push(p.precoUndMedio);
  }

  const codGroups: CodGroup[] = Array.from(byCod.entries()).map(([cod, g]) => ({
    cod, name: COD_NAMES[cod] ?? cod, skus: g.skus.size, qtdEmb: g.qtdEmb, qtdUnd: g.qtdUnd,
    faturamento: g.fat, vendas: g.vendas,
    precoUndMedio: g.qtdUnd > 0 ? g.fat / g.qtdUnd : 0,
    mediana: median(g.unitPrices),
  })).sort((a, b) => b.faturamento - a.faturamento);

  return { products, codGroups, clientsByItem, hiddenSkuCount, hiddenRevenue };
}

function unifyProducts(products: ProductRow[], clientsByItem: Map<string, number>): UnifiedProductRow[] {
  const groups = new Map<string, ProductRow[]>();
  for (const p of products) {
    const key = `${p.cod}::${p.subNome}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  return Array.from(groups.entries()).map(([, variants]) => {
    const undVariant = variants.find((v) => v.embala === "UND");
    const primary = undVariant ?? variants.reduce((best, v) => (v.faturamento > best.faturamento ? v : best));

    const totalQtdUnd = variants.reduce((s, v) => s + v.qtdUnd, 0);
    const totalFat = variants.reduce((s, v) => s + v.faturamento, 0);
    const totalFat3m = variants.reduce((s, v) => s + v.fat3m, 0);
    const totalVendas = variants.reduce((s, v) => s + v.vendas, 0);

    const totalClients = Math.max(...variants.map((v) => clientsByItem.get(v.itemCode) ?? 0), 0);

    const maxVals = variants.map((v) => v.maxSaleValue).filter((v) => v > 0);
    const minVals = variants.map((v) => v.minSaleValue).filter((v) => v > 0);
    const totalQty3m = variants.reduce((s, v) => s + v.qty3mUnd, 0);

    const sortedVariants = [...variants].sort((a, b) =>
      a.embala === "UND" ? -1 : b.embala === "UND" ? 1 : b.faturamento - a.faturamento
    );

    return {
      itemCode: primary.itemCode,
      cod: primary.cod,
      codName: primary.codName,
      subNome: primary.subNome,
      capacidade: primary.capacidade,
      cor: primary.cor,
      fechamento: primary.fechamento,
      qtdUnd: totalQtdUnd,
      faturamento: totalFat,
      precoUndMedio: totalQtdUnd > 0 ? totalFat / totalQtdUnd : 0,
      vendas: totalVendas,
      clientes: totalClients,
      avgQtd3m: totalQty3m / 3,
      maxSale12m: maxVals.length > 0 ? Math.max(...maxVals) : 0,
      minSale12m: minVals.length > 0 ? Math.min(...minVals) : 0,
      fat3m: totalFat3m,
      avgFat3m: totalFat3m / 3,
      variants: sortedVariants,
    };
  }).sort((a, b) => b.faturamento - a.faturamento);
}

function embalaDistribution(products: ProductRow[]): { name: string; value: number; qty: number }[] {
  const m = new Map<string, { value: number; qty: number }>();
  for (const p of products) {
    const key = p.embalaQty > 1 ? p.embala.split(" ")[0] : "UND";
    const e = m.get(key) ?? { value: 0, qty: 0 };
    e.value += p.faturamento; e.qty += p.qtdUnd;
    m.set(key, e);
  }
  return Array.from(m.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value);
}

type SortField =
  | "cod" | "subNome" | "faturamento" | "qtdUnd"
  | "fat3m" | "avgFat3m" | "avgQtd3m"
  | "maxSale12m" | "minSale12m" | "precoUndMedio" | "vendas" | "clientes";
type SortDir = "asc" | "desc";

/* ═══════════════════ Lazy-loaded Product Detail Modal ═══════════════════ */

function UnifiedProductModal({
  product, totalFat, onClose,
}: {
  product: UnifiedProductRow;
  /** Soma do faturamento do range global — usado apenas para o badge "% do total" (referência). */
  totalFat: number;
  onClose: () => void;
}) {
  const itemCodes = useMemo(() => product.variants.map((v) => v.itemCode), [product.variants]);

  // ─── Detalhe do produto SEMPRE em janela fixa de 12 meses ───
  // Independe do range global. Permite ver evolução completa do produto.
  const today = useMemo(() => new Date(), []);
  const detailFrom = useMemo(
    () => formatDateOnly(startOfMonth(subMonths(today, 11))),
    [today],
  );
  const detailTo = useMemo(() => formatDateOnly(today), [today]);

  const { data: ordersData, loading: ordersLoading } = useFetch(
    () => fetchProductOrders({ itemCodes, dateFrom: detailFrom, dateTo: detailTo }),
    [itemCodes.join(","), detailFrom, detailTo],
  );

  const productOrders = useMemo(() => {
    if (!ordersData?.orders) return [];
    const variantMap = new Map(product.variants.map((v) => [v.itemCode, v]));
    return ordersData.orders.map((o) => ({
      docNum: o.doc_num,
      docDate: o.doc_date,
      cardCode: o.card_code,
      cardName: o.card_name,
      qty: Number(o.quantity) || 0,
      lineTotal: Number(o.line_total) || 0,
      unitPrice: Number(o.unit_price) || 0,
      disc: Number(o.discount_percent) || 0,
      itemCode: o.item_code,
      embala: variantMap.get(o.item_code)?.embala ?? "—",
      embalaQty: variantMap.get(o.item_code)?.embalaQty ?? 1,
    }));
  }, [ordersData, product.variants]);

  // ─── KPIs do produto na janela de 12 meses ───
  const productKpis = useMemo(() => {
    let fat = 0;
    let qtdEmb = 0;
    let qtdUnd = 0;
    const clientes = new Set<string>();
    const docs = new Set<number>();
    for (const r of productOrders) {
      fat += r.lineTotal;
      qtdEmb += r.qty;
      qtdUnd += r.qty * r.embalaQty;
      if (r.cardCode) clientes.add(r.cardCode);
      docs.add(r.docNum);
    }
    return {
      fat,
      qtdEmb,
      qtdUnd,
      clientes: clientes.size,
      pedidos: docs.size,
      precoUndMedio: qtdUnd > 0 ? fat / qtdUnd : 0,
    };
  }, [productOrders]);

  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; fat: number; qty: number; orders: number }>();
    for (const r of productOrders) {
      const cur = map.get(r.cardCode) ?? { name: r.cardName, fat: 0, qty: 0, orders: 0 };
      cur.fat += r.lineTotal; cur.qty += r.qty; cur.orders += 1;
      map.set(r.cardCode, cur);
    }
    return Array.from(map.entries())
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 8);
  }, [productOrders]);

  // Evolução mensal: 12 meses fixos (do mais antigo ao corrente), com slots zerados quando sem vendas.
  const monthlyData = useMemo(() => {
    const slots = new Map<string, { fat: number; qty: number; isCurrent: boolean }>();
    for (let i = 11; i >= 0; i--) {
      const m = startOfMonth(subMonths(today, i));
      slots.set(formatYearMonth(m), { fat: 0, qty: 0, isCurrent: isSameMonth(m, today) });
    }
    for (const r of productOrders) {
      const key = r.docDate.substring(0, 7);
      const slot = slots.get(key);
      if (!slot) continue;
      slot.fat += r.lineTotal;
      slot.qty += r.qty * r.embalaQty;
    }
    return Array.from(slots.entries()).map(([yyyymm, v]) => {
      const d = startOfMonth(new Date(`${yyyymm}-01T12:00:00`));
      return {
        month: format(d, "MMM/yy", { locale: ptBR }),
        yyyymm,
        fat: v.fat,
        qty: v.qty,
        isCurrent: v.isCurrent,
      };
    });
  }, [productOrders, today]);

  const monthlyMedian = useMemo(() => {
    const values = monthlyData.filter((m) => !m.isCurrent && m.fat > 0).map((m) => m.fat).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  }, [monthlyData]);

  const pctTotal = totalFat > 0 ? (productKpis.fat / totalFat * 100) : 0;
  const codColor = COD_COLORS[product.cod] ?? "#A81C2C";
  const hasMultipleVariants = product.variants.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-cockpit-border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-cockpit-border bg-cockpit-bg/50">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{product.subNome}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="font-mono text-xs px-2 py-0.5 rounded-md font-semibold" style={{ background: codColor + "15", color: codColor }}>{product.cod}</span>
              <span className="font-mono text-xs text-cockpit-accent bg-cockpit-accent/10 px-2 py-0.5 rounded-md font-semibold">{product.itemCode}</span>
              {product.capacidade !== "—" && <span className="text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md font-medium">{product.capacidade}</span>}
              {product.cor !== "—" && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{product.cor}</span>}
              {product.fechamento !== "—" && <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md font-medium">{product.fechamento}</span>}
              {hasMultipleVariants && (
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
                  {product.variants.length} embalagens
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 motion-safe:transition-colors shrink-0">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* KPIs — sempre últimos 12 meses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">
                Indicadores · Últimos 12 meses
              </h4>
              <span className="text-[10px] text-cockpit-muted">
                {format(subMonths(today, 11), "MMM/yy", { locale: ptBR })} – {format(today, "MMM/yy", { locale: ptBR })}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Faturamento", value: fmtBRL(productKpis.fat), sub: totalFat > 0 ? `${pctTotal.toFixed(1)}% do catálogo no período` : `${productKpis.pedidos} pedidos`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Qtd Total Embalagens", value: `${fmtNum(productKpis.qtdEmb)} emb`, sub: `${fmtNum(productKpis.qtdUnd)} un (× embalagem)`, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "R$/UND médio", value: productKpis.precoUndMedio > 0 ? fmtBRL(productKpis.precoUndMedio, 2) : "—", sub: product.maxSale12m > 0 ? `Max: ${fmtBRL(product.maxSale12m)} · Min: ${fmtBRL(product.minSale12m)}` : undefined, icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Clientes", value: String(productKpis.clientes), sub: `${productKpis.pedidos} pedidos`, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-cockpit-border p-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`p-1 rounded-md ${k.bg}`}><k.icon className={`w-3.5 h-3.5 ${k.color}`} /></div>
                    <span className="text-[10px] font-semibold text-cockpit-muted uppercase truncate">{k.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${k.color} block mt-1 tabular-nums`}>{k.value}</span>
                  {k.sub && <span className="text-[10px] text-cockpit-muted">{k.sub}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Visão por Embalagem */}
          <div>
            <h4 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" /> Visão por Embalagem
            </h4>
            <div className="rounded-lg border border-cockpit-border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-cockpit-bg text-cockpit-muted uppercase text-[10px] border-b border-cockpit-border">
                    <th className="py-2 px-3 bg-cockpit-bg">Embalagem</th>
                    <th className="py-2 px-3 bg-cockpit-bg font-mono">SKU</th>
                    <th className="py-2 px-3 text-right bg-cockpit-bg">Qtd Emb</th>
                    <th className="py-2 px-3 text-right bg-cockpit-bg">Qtd UND</th>
                    <th className="py-2 px-3 text-right bg-cockpit-bg">R$/UND</th>
                    <th className="py-2 px-3 text-right bg-cockpit-bg">Faturamento</th>
                    <th className="py-2 px-3 text-right bg-cockpit-bg">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cockpit-border/50">
                  {(() => {
                    // Recalcula totais por variante a partir dos pedidos das últimas 12 meses
                    const byVariant = new Map<string, { qtdEmb: number; qtdUnd: number; fat: number }>();
                    for (const r of productOrders) {
                      const cur = byVariant.get(r.itemCode) ?? { qtdEmb: 0, qtdUnd: 0, fat: 0 };
                      cur.qtdEmb += r.qty;
                      cur.qtdUnd += r.qty * r.embalaQty;
                      cur.fat += r.lineTotal;
                      byVariant.set(r.itemCode, cur);
                    }
                    return product.variants.map((v, vi) => {
                      const calc = byVariant.get(v.itemCode) ?? { qtdEmb: 0, qtdUnd: 0, fat: 0 };
                      const pctVar = productKpis.fat > 0 ? (calc.fat / productKpis.fat * 100) : 0;
                      const precoUndMedio = calc.qtdUnd > 0 ? calc.fat / calc.qtdUnd : 0;
                      return (
                      <tr key={`${v.itemCode}-${v.embala}-${vi}`} className="hover:bg-cockpit-accent/[0.03] motion-safe:transition-colors">
                        <td className="py-1.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${v.embala === "UND" ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-700"}`}>
                            {v.embala}
                          </span>
                          {v.embalaQty > 1 && <span className="ml-1 text-[9px] text-gray-400">×{v.embalaQty}</span>}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-blue-600 text-[10px]">{v.itemCode}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-600">{fmtNum(calc.qtdEmb)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-medium text-gray-900">{fmtNum(calc.qtdUnd)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-teal-700">{precoUndMedio > 0 ? fmtBRL(precoUndMedio, 2) : "—"}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-medium text-cockpit-accent">{fmtBRL(calc.fat)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-500">{pctVar.toFixed(1)}%</td>
                      </tr>
                    );
                    });
                  })()}
                </tbody>
                {product.variants.length > 1 && (
                  <tfoot>
                    <tr className="bg-cockpit-bg/70 border-t border-cockpit-border font-semibold">
                      <td className="py-2 px-3 text-gray-700" colSpan={2}>Total Consolidado</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                        {fmtNum(productKpis.qtdEmb)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-900">{fmtNum(productKpis.qtdUnd)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-teal-700">{productKpis.precoUndMedio > 0 ? fmtBRL(productKpis.precoUndMedio, 2) : "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-cockpit-accent">{fmtBRL(productKpis.fat)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Loading indicator for lazy-loaded data */}
          {ordersLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-cockpit-muted" role="status" aria-live="polite">
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
              <span className="text-xs">Carregando histórico...</span>
            </div>
          )}

          {/* Evolução mensal — 12 meses fixos */}
          {!ordersLoading && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h4 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider">Evolução Mensal · 12 meses</h4>
                {monthlyMedian > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-700 font-semibold">
                    <span className="inline-block w-2 h-px bg-violet-600 align-middle" />
                    Mediana {fmtBRL(monthlyMedian, 0)}
                  </span>
                )}
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} />
                    <XAxis dataKey="month" tick={{ ...chartAxisTick("sm"), fontSize: 10 }} axisLine={{ stroke: CHART_AXIS_LINE }} />
                    <YAxis yAxisId="left" tick={{ ...chartAxisTick("sm"), fontSize: 10 }} tickFormatter={(v) => formatYAxisCompact(Number(v))} width={50} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#2563eb", fontSize: 10 }} width={40} tickFormatter={(v) => fmtNum(Math.round(Number(v)))} />
                    <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={(name, v) => (name === "Quantidade (un)" ? `${fmtNum(Math.round(v))} un` : fmtBRL(v))} />} />
                    {monthlyMedian > 0 && (
                      <ReferenceLine
                        yAxisId="left"
                        y={monthlyMedian}
                        stroke="#7c3aed"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        ifOverflow="extendDomain"
                      />
                    )}
                    <Bar yAxisId="left" dataKey="fat" name="Faturamento" radius={[3, 3, 0, 0]} barSize={22}>
                      {monthlyData.map((m) => {
                        let fill: string = codColor;
                        if (m.fat === 0) fill = "#e5e7eb";
                        else if (m.isCurrent) fill = "#f59e0b";
                        else fill = m.fat >= monthlyMedian ? codColor : codColor + "80";
                        return <Cell key={m.yyyymm} fill={fill} />;
                      })}
                    </Bar>
                    <Line yAxisId="right" dataKey="qty" name="Quantidade (un)" type="monotone" stroke="#2563eb" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-cockpit-muted flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: codColor }} />
                  Mês fechado
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  Mês corrente (parcial)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-200" />
                  Sem vendas
                </span>
                {monthlyMedian > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-3 h-px border-t border-dashed border-violet-600" />
                    Mediana
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Top clientes */}
          {!ordersLoading && topClients.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mb-2">Top Clientes</h4>
              <div className="space-y-1.5">
                {topClients.map((c, i) => {
                  const pctClient = productKpis.fat > 0 ? (c.fat / productKpis.fat * 100) : 0;
                  return (
                    <div key={c.code} className="flex items-center gap-3 text-xs bg-cockpit-bg/50 rounded-lg px-3 py-2 border border-cockpit-border/50">
                      <span className="w-5 h-5 rounded-full bg-cockpit-accent/10 text-cockpit-accent font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 truncate">{c.name}</p>
                        <p className="text-cockpit-muted font-mono text-[10px]">{c.code} · {c.orders} pedidos · {fmtNum(c.qty)} un</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-cockpit-accent">{fmtBRL(c.fat)}</p>
                        <p className="text-cockpit-muted text-[10px]">{pctClient.toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Histórico de vendas */}
          {!ordersLoading && productOrders.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wider mb-2">
                Histórico de Vendas ({productOrders.length})
              </h4>
              <div className="rounded-lg border border-cockpit-border overflow-hidden">
                <div className="overflow-y-auto max-h-52">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-cockpit-bg text-cockpit-muted uppercase text-[10px] border-b border-cockpit-border sticky top-0">
                        <th className="py-2 px-3 bg-cockpit-bg">Doc</th>
                        <th className="py-2 px-3 bg-cockpit-bg">Data</th>
                        <th className="py-2 px-3 bg-cockpit-bg">Cliente</th>
                        {hasMultipleVariants && <th className="py-2 px-3 bg-cockpit-bg">Emb</th>}
                        <th className="py-2 px-3 text-right bg-cockpit-bg">Qtd</th>
                        <th className="py-2 px-3 text-right bg-cockpit-bg">R$/Un</th>
                        <th className="py-2 px-3 text-right bg-cockpit-bg">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cockpit-border/50">
                      {productOrders.map((r, i) => (
                        <tr key={`${r.docNum}-${i}`} className="hover:bg-cockpit-accent/[0.03] motion-safe:transition-colors">
                          <td className="py-1.5 px-3 font-mono font-medium text-gray-700">{r.docNum}</td>
                          <td className="py-1.5 px-3 text-gray-600">{fmtDateShort(r.docDate)}</td>
                          <td className="py-1.5 px-3 text-gray-700 max-w-[140px] truncate" title={r.cardName}>{r.cardName}</td>
                          {hasMultipleVariants && (
                            <td className="py-1.5 px-3">
                              <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-semibold ${r.embala === "UND" ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"}`}>
                                {r.embala}
                              </span>
                            </td>
                          )}
                          <td className="py-1.5 px-3 text-right text-gray-600">{fmtNum(r.qty)}</td>
                          <td className="py-1.5 px-3 text-right text-gray-500">{fmtBRL(r.unitPrice, 2)}</td>
                          <td className="py-1.5 px-3 text-right font-medium text-cockpit-accent">{fmtBRL(r.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-cockpit-border bg-cockpit-bg/50 text-xs text-cockpit-muted flex items-center justify-between">
          <span>
            {product.codName} · {product.vendas} vendas · {product.clientes} clientes · {pctTotal.toFixed(2)}% do total
            {hasMultipleVariants && ` · ${product.variants.length} embalagens`}
          </span>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-cockpit-accent text-white text-xs font-medium hover:bg-cockpit-accent/90 motion-safe:transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Main Page ═══════════════════ */

export default function ProdutosPage() {
  return <Suspense fallback={<LoadingSkeleton rows={8} />}><ProdutosContent /></Suspense>;
}

function ProdutosContent() {
  const date12mAgo = useMemo(() => format(subMonths(new Date(), 12), "yyyy-MM-dd"), []);
  const date3mCutoff = useMemo(() => format(subMonths(new Date(), 3), "yyyy-MM-dd"), []);
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const { salesPersonCode, isComercial } = useSalesPersonFilter();

  const [estadoFilter, setEstadoFilter] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState("");

  const effectiveSalesPerson = isComercial && salesPersonCode != null
    ? salesPersonCode
    : vendedorFilter ? Number(vendedorFilter) : undefined;

  const { data: analyticsData, loading, error, refetch } = useFetch(
    () => fetchProductAnalytics({
      dateFrom: date12mAgo,
      dateTo: todayStr,
      date3mCutoff,
      estado: estadoFilter || undefined,
      salesPerson: effectiveSalesPerson,
    }),
    [date12mAgo, todayStr, date3mCutoff, estadoFilter, effectiveSalesPerson],
  );

  const { data: spData } = useFetch(() => fetchSalesPersons(), []);

  const spMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of spData?.items ?? []) map.set(p.SalesEmployeeCode, p.SalesEmployeeName);
    return map;
  }, [spData]);

  const estadoOptions = useMemo(() => analyticsData?.estados ?? [], [analyticsData]);
  const vendedorOptions = useMemo(() =>
    (analyticsData?.vendedorCodes ?? []).map((code) => ({
      code, name: spMap.get(code) ?? `Vendedor ${code}`,
    })).sort((a, b) => a.name.localeCompare(b.name)),
    [analyticsData, spMap],
  );

  const { products, codGroups, clientsByItem, hiddenSkuCount, hiddenRevenue } = useMemo(
    () => buildFromAnalytics(analyticsData?.products ?? []),
    [analyticsData],
  );
  const unifiedProducts = useMemo(() => unifyProducts(products, clientsByItem), [products, clientsByItem]);

  /** Curva ABCD+123 (Gestão de Compras) — calculada sobre os 12m da visão unificada */
  const comprasClasses = useMemo(() => {
    const inputs = unifiedProducts.flatMap((p) => {
      const group = getComprasGroup(p.itemCode);
      if (!group) return [];
      return [{ key: `${p.cod}::${p.subNome}`, group, revenue12m: p.faturamento, volume12m: p.qtdUnd }];
    });
    return classifyCompras(inputs);
  }, [unifiedProducts]);

  // Summary global vindo do gateway — cobre 12m completos via header dos pedidos
  // (independente da cobertura das linhas detalhadas).
  const summary: CatalogSummary = useMemo(() => {
    const s = analyticsData?.summary;
    return {
      totalOrders: s?.totalOrders ?? 0,
      ordersWithLines: s?.ordersWithLines ?? 0,
      totalRevenueHeader: s?.totalRevenueHeader ?? 0,
      totalRevenueHeader3m: s?.totalRevenueHeader3m ?? 0,
      totalClients: s?.totalClients ?? 0,
      firstOrderDate: s?.firstOrderDate ?? null,
      lastOrderDate: s?.lastOrderDate ?? null,
    };
  }, [analyticsData]);

  // totalFat (via linhas) — usado para % por produto na tabela. Reflete os meses com linhas sincronizadas.
  const totalFat = useMemo(() => unifiedProducts.reduce((s, p) => s + p.faturamento, 0), [unifiedProducts]);
  const totalUnd = useMemo(() => unifiedProducts.reduce((s, p) => s + p.qtdUnd, 0), [unifiedProducts]);
  const totalFat3m = useMemo(() => unifiedProducts.reduce((s, p) => s + p.fat3m, 0), [unifiedProducts]);
  const totalSkus = products.length;

  // KPIs globais usam HEADER (12m reais), independente da cobertura de linhas detalhadas.
  const totalFat12mHeader = summary.totalRevenueHeader;
  const avgMonthlyFat12m = totalFat12mHeader / 12;
  const avgMonthlyFat3m = summary.totalRevenueHeader3m / 3;

  const coveragePct = summary.totalOrders > 0
    ? (summary.ordersWithLines / summary.totalOrders) * 100
    : 0;

  const medianUndPrice = median(unifiedProducts.filter((p) => p.precoUndMedio > 0).map((p) => p.precoUndMedio));

  const embalaDist = useMemo(() => embalaDistribution(products), [products]);
  const top10 = useMemo(() => unifiedProducts.slice(0, 10), [unifiedProducts]);
  const top10Mean = useMemo(
    () => (top10.length > 0 ? top10.reduce((s, p) => s + p.faturamento, 0) / top10.length : 0),
    [top10],
  );
  const codMedianAll = useMemo(() => median(codGroups.map((g) => g.faturamento)), [codGroups]);

  const [search, setSearch] = useState("");
  const [codFilter, setCodFilter] = useState("");
  const [embalaFilter, setEmbalaFilter] = useState("");
  const [capFilter, setCapFilter] = useState("");
  const [fechFilter, setFechFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("faturamento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [modalProduct, setModalProduct] = useState<UnifiedProductRow | null>(null);

  const codList = useMemo(() => Array.from(new Set(unifiedProducts.map((p) => p.cod))).sort(), [unifiedProducts]);
  const embalaTypes = useMemo(() => {
    const s = new Set<string>();
    for (const p of products) s.add(p.embalaQty > 1 ? p.embala.split(" ")[0] : "UND");
    return Array.from(s).sort();
  }, [products]);
  const capacidades = useMemo(() => [...new Set(unifiedProducts.map((p) => p.capacidade).filter((c) => c !== "—"))].sort(), [unifiedProducts]);
  const fechamentos = useMemo(() => [...new Set(unifiedProducts.map((p) => p.fechamento).filter((f) => f !== "—"))].sort(), [unifiedProducts]);

  const filtered = useMemo(() => {
    let res = unifiedProducts;
    if (codFilter) res = res.filter((p) => p.cod === codFilter);
    if (embalaFilter) res = res.filter((p) => p.variants.some((v) => (v.embalaQty > 1 ? v.embala.split(" ")[0] : "UND") === embalaFilter));
    if (capFilter) res = res.filter((p) => p.capacidade === capFilter);
    if (fechFilter) res = res.filter((p) => p.fechamento === fechFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((p) =>
        p.itemCode.toLowerCase().includes(q) || p.subNome.toLowerCase().includes(q) ||
        p.cod.toLowerCase().includes(q) || p.codName.toLowerCase().includes(q) ||
        p.variants.some((v) => v.itemCode.toLowerCase().includes(q))
      );
    }
    res = [...res].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "cod": cmp = a.cod.localeCompare(b.cod); break;
        case "subNome": cmp = a.subNome.localeCompare(b.subNome); break;
        case "faturamento": cmp = a.faturamento - b.faturamento; break;
        case "qtdUnd": cmp = a.qtdUnd - b.qtdUnd; break;
        case "fat3m": cmp = a.fat3m - b.fat3m; break;
        case "avgFat3m": cmp = a.avgFat3m - b.avgFat3m; break;
        case "avgQtd3m": cmp = a.avgQtd3m - b.avgQtd3m; break;
        case "maxSale12m": cmp = a.maxSale12m - b.maxSale12m; break;
        case "minSale12m": cmp = a.minSale12m - b.minSale12m; break;
        case "precoUndMedio": cmp = a.precoUndMedio - b.precoUndMedio; break;
        case "vendas": cmp = a.vendas - b.vendas; break;
        case "clientes": cmp = a.clientes - b.clientes; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return res;
  }, [unifiedProducts, codFilter, embalaFilter, capFilter, fechFilter, search, sortField, sortDir]);

  const hasActiveFilters = codFilter || embalaFilter || capFilter || fechFilter || search || estadoFilter || vendedorFilter;

  const clearAllFilters = () => {
    setCodFilter(""); setEmbalaFilter(""); setCapFilter(""); setFechFilter("");
    setSearch(""); setEstadoFilter(""); setVendedorFilter("");
  };

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
      "COD": p.cod, "Grupo": p.codName, "SKU (UND)": p.itemCode, "Produto": p.subNome,
      "Capacidade": p.capacidade, "Cor": p.cor, "Fechamento": p.fechamento,
      "Embalagens": p.variants.map((v) => v.embala).join(", "),
      "Fat. 12m": p.faturamento.toFixed(2),
      "Fat. 3m": p.fat3m.toFixed(2),
      "Méd R$/mês (3m)": p.avgFat3m.toFixed(2),
      "Qtd UND 12m": p.qtdUnd,
      "Méd UN/mês (3m)": p.avgQtd3m.toFixed(0),
      "Maior Venda 12m": p.maxSale12m.toFixed(2),
      "Menor Venda 12m": p.minSale12m.toFixed(2),
      "R$/UND Consolidado": p.precoUndMedio.toFixed(2),
      "Nº Vendas": p.vendas, "Clientes": p.clientes,
    }));
    exportCSV(rows, `catalogo-produtos-12m-${todayStr}`);
  };

  const isFirstLoad = loading && !analyticsData;
  const isRefreshing = loading && !!analyticsData;

  if (isFirstLoad) return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-cockpit-accent/10"><Tag className="w-5 h-5 text-cockpit-accent" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900">Catálogo de Produtos</h1><p className="text-sm text-cockpit-muted mt-0.5">Carregando...</p></div>
      </div>
      <LoadingSkeleton rows={6} />
    </div>
  );
  if (error && !analyticsData) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-5">

      {/* Refresh indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-cockpit-accent/20">
          <div className="h-full bg-cockpit-accent animate-pulse motion-reduce:animate-none rounded-full" style={{ width: "60%" }} />
        </div>
      )}

      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cockpit-accent/10"><Tag className="w-5 h-5 text-cockpit-accent" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catálogo de Produtos</h1>
            <p className="text-sm text-cockpit-muted mt-0.5">
              <strong className="text-gray-700">{unifiedProducts.length}</strong> produtos · <strong className="text-gray-700">{totalSkus}</strong> SKUs · <strong className="text-gray-700">{codGroups.length}</strong> grupos
              <span className="hidden sm:inline"> · 12 meses · {fmtNum(summary.totalOrders)} pedidos no período</span>
              {(estadoFilter || vendedorFilter) && (
                <span className="text-cockpit-accent font-semibold">
                  {estadoFilter && ` · ${UF_NAME[estadoFilter] ?? estadoFilter}`}
                  {vendedorFilter && ` · ${spMap.get(Number(vendedorFilter)) ?? `Vend. ${vendedorFilter}`}`}
                </span>
              )}
            </p>
            {hiddenSkuCount > 0 && (
              <p
                className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-gray-400 italic"
                title="Grupos auxiliares (logística/insumo) — escondidos das visualizações comerciais."
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden />
                {hiddenSkuCount} SKUs auxiliares ocultos (CH · EM · MO · PA)
                {hiddenRevenue > 0 && (
                  <span className="text-gray-400"> · {fmtBRL(hiddenRevenue, 0)}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={handleExport}
          className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 motion-safe:transition-colors">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* ═══ KPIs — 12 meses completos via header dos pedidos ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Produtos", value: fmtNum(unifiedProducts.length), sub: `${totalSkus} SKUs · ${codGroups.length} grupos`, icon: Tag, color: "text-cockpit-accent" },
          {
            label: "Faturamento 12m",
            value: fmtBRL(totalFat12mHeader),
            sub: `${fmtBRL(avgMonthlyFat12m, 0)} médio/mês`,
            icon: DollarSign, color: "text-emerald-600",
          },
          {
            label: "Faturamento 3m",
            value: fmtBRL(summary.totalRevenueHeader3m),
            sub: `${fmtBRL(avgMonthlyFat3m, 0)} médio/mês`,
            icon: TrendingUp, color: "text-blue-600",
          },
          {
            label: "Pedidos 12m",
            value: fmtNum(summary.totalOrders),
            sub: `${fmtNum(summary.totalClients)} clientes distintos`,
            icon: Package, color: "text-violet-600",
          },
          {
            label: "Qtd UND (linhas)",
            value: fmtNum(totalUnd),
            sub: `cobertura ${coveragePct.toFixed(0)}% dos pedidos`,
            icon: Hash, color: "text-teal-600",
          },
          {
            label: "R$/UND Mediana",
            value: fmtBRL(medianUndPrice, 2),
            sub: `${embalaTypes.length} embalagens`,
            icon: Layers, color: "text-amber-600",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-cockpit-border bg-white p-3.5 shadow-sm hover:border-cockpit-accent/30 motion-safe:transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-1.5">
              <kpi.icon className={`w-4 h-4 ${kpi.color} motion-safe:transition-transform duration-200 group-hover:scale-110`} />
              <span className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider truncate">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-cockpit-muted mt-0.5 truncate">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Banner de cobertura — sincero sobre dados parciais */}
      {summary.totalOrders > 0 && coveragePct < 95 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-amber-800 flex-1">
            <p className="font-semibold mb-0.5">Detalhamento por produto parcial</p>
            <p className="text-amber-700">
              Apenas <strong>{fmtNum(summary.ordersWithLines)}</strong> de <strong>{fmtNum(summary.totalOrders)}</strong> pedidos têm linhas detalhadas sincronizadas
              ({coveragePct.toFixed(0)}% de cobertura).
              Os KPIs globais <strong>Faturamento 12m</strong> e <strong>Pedidos 12m</strong> usam o cabeçalho dos pedidos
              e refletem o total real. Já a tabela de produtos abaixo (e &quot;Qtd UND&quot;) só inclui os itens com linhas sincronizadas
              — valores menores até o sync histórico completar.
            </p>
          </div>
        </div>
      )}

      {/* ═══ Charts ═══ */}
      {codGroups.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <section
            aria-label="Faturamento por grupo de produto"
            className="xl:col-span-2 rounded-xl border border-cockpit-border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cockpit-accent" />
                <h2 className="text-sm font-semibold text-gray-900">Faturamento por Grupo</h2>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-cockpit-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm bg-cockpit-accent"
                    aria-hidden
                  />
                  Faturamento
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-[2px] bg-gray-400"
                    style={{ borderTop: "1px dashed #94a3b8", height: 0 }}
                    aria-hidden
                  />
                  Nº SKUs
                </span>
                {codMedianAll > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-3 h-[2px]"
                      style={{ borderTop: "1.5px dashed #3b82f6", height: 0 }}
                      aria-hidden
                    />
                    Mediana
                  </span>
                )}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={codGroups}
                  barCategoryGap="18%"
                  margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} vertical={false} />
                  <XAxis
                    dataKey="cod"
                    tick={{ ...chartAxisTick("md"), fontWeight: 700 }}
                    axisLine={{ stroke: CHART_AXIS_LINE }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="fat"
                    tick={chartAxisTick("sm")}
                    tickFormatter={(v) => formatYAxisCompact(Number(v))}
                    width={50}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="skus"
                    orientation="right"
                    tick={{ ...chartAxisTick("sm"), fill: CHART_MUTED }}
                    width={30}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(168,28,44,0.06)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as CodGroup;
                      const pctTotal = totalFat > 0 ? (d.faturamento / totalFat) * 100 : 0;
                      return (
                        <CockpitTooltipFrame>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="inline-block w-3 h-3 rounded"
                              style={{ background: COD_COLORS[d.cod] ?? "#A81C2C" }}
                            />
                            <p className="font-semibold text-gray-800">
                              {d.cod} — {d.name}
                            </p>
                          </div>
                          <p className="text-cockpit-accent font-bold tabular-nums">
                            {fmtBRL(d.faturamento)}{" "}
                            <span className="text-[10px] font-medium text-gray-500">
                              ({pctTotal.toFixed(1)}% do total)
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-600 tabular-nums">
                            <span className="text-gray-400">SKUs</span>
                            <span className="text-right">{fmtNum(d.skus)}</span>
                            <span className="text-gray-400">Vendas</span>
                            <span className="text-right">{fmtNum(d.vendas)}</span>
                            <span className="text-gray-400">UND</span>
                            <span className="text-right">{fmtNum(d.qtdUnd)}</span>
                            <span className="text-gray-400">R$/UND</span>
                            <span className="text-right text-teal-700">
                              {fmtBRL(d.precoUndMedio, 2)}
                            </span>
                          </div>
                        </CockpitTooltipFrame>
                      );
                    }}
                  />
                  {codMedianAll > 0 && (
                    <ReferenceLine
                      yAxisId="fat"
                      y={codMedianAll}
                      stroke="#3b82f6"
                      strokeDasharray="5 4"
                      strokeWidth={1.4}
                      ifOverflow="extendDomain"
                      label={{
                        value: `Mediana ${fmtBRL(codMedianAll, 0)}`,
                        position: "insideTopRight",
                        fill: "#3b82f6",
                        fontSize: 9.5,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Bar
                    yAxisId="fat"
                    dataKey="faturamento"
                    radius={[6, 6, 0, 0]}
                    animationDuration={650}
                    animationEasing="ease-out"
                    label={{
                      position: "top",
                      formatter: (v) => formatYAxisCompact(Number(v)),
                      fontSize: 10,
                      fill: "#374151",
                      fontWeight: 600,
                    }}
                  >
                    {codGroups.map((g) => (
                      <Cell
                        key={g.cod}
                        fill={COD_COLORS[g.cod] ?? "#A81C2C"}
                        fillOpacity={0.92}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="skus"
                    type="monotone"
                    dataKey="skus"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={{ r: 3.5, fill: "#fff", stroke: "#94a3b8", strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: "#94a3b8" }}
                    animationDuration={900}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section
            aria-label="Mix de embalagens e ranking de grupos"
            className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-cockpit-accent" />
              <h2 className="text-sm font-semibold text-gray-900">Mix de Embalagens</h2>
            </div>
            {embalaDist.length > 0 ? (
              <>
                <div className="h-40 flex items-center gap-1">
                  <div className="relative w-1/2 h-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={embalaDist}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={62}
                          paddingAngle={3}
                          stroke="#fff"
                          strokeWidth={2}
                          animationDuration={700}
                        >
                          {embalaDist.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            const pct = totalFat > 0
                              ? ((d.value / totalFat) * 100).toFixed(1)
                              : "0";
                            return (
                              <CockpitTooltipFrame>
                                <p className="font-semibold text-gray-800">{d.name}</p>
                                <p className="text-cockpit-accent font-bold tabular-nums">
                                  {fmtBRL(d.value)}{" "}
                                  <span className="text-[10px] font-medium text-gray-500">
                                    ({pct}%)
                                  </span>
                                </p>
                                <p className="text-gray-500 text-[11px] tabular-nums">
                                  {fmtNum(d.qty)} UND
                                </p>
                              </CockpitTooltipFrame>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Label central — total de tipos de embalagem */}
                    <div
                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                      aria-hidden
                    >
                      <span className="text-base font-bold text-gray-900 tabular-nums leading-none">
                        {embalaDist.length}
                      </span>
                      <span className="text-[9px] text-cockpit-muted uppercase tracking-wider mt-0.5">
                        tipos
                      </span>
                    </div>
                  </div>
                  <ul className="flex-1 space-y-1.5 pl-2 max-h-36 overflow-y-auto pr-1">
                    {embalaDist.map((e, i) => {
                      const pct = totalFat > 0
                        ? (e.value / totalFat * 100).toFixed(1)
                        : "0";
                      return (
                        <li
                          key={e.name}
                          className="flex items-center gap-2 text-xs hover:bg-gray-50 rounded px-1 py-0.5 motion-safe:transition-colors"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                            aria-hidden
                          />
                          <span className="text-gray-700 font-medium">{e.name}</span>
                          <span className="ml-auto font-semibold text-gray-900 tabular-nums">
                            {pct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="mt-4 pt-3 border-t border-cockpit-border/50 space-y-2">
                  <p className="text-[10px] text-cockpit-muted uppercase tracking-wider font-semibold mb-2">
                    Top grupos por faturamento
                  </p>
                  {codGroups.slice(0, 5).map((g) => {
                    const pct = totalFat > 0 ? (g.faturamento / totalFat * 100) : 0;
                    const color = COD_COLORS[g.cod] ?? "#A81C2C";
                    return (
                      <div
                        key={g.cod}
                        className="flex items-center gap-2 group"
                        title={`${g.name} · ${fmtNum(g.skus)} SKU(s)`}
                      >
                        <span
                          className="w-7 text-[10px] font-bold text-center rounded py-0.5 motion-safe:transition-colors"
                          style={{ background: `${color}1f`, color }}
                        >
                          {g.cod}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden relative">
                            <div
                              className="h-full rounded-full motion-safe:transition-all duration-700 ease-out"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500 tabular-nums w-9 text-right">
                          {pct.toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-cockpit-accent font-semibold tabular-nums w-16 text-right">
                          {fmtBRL(g.faturamento, 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-cockpit-muted text-center py-6">Sem dados</p>
            )}
          </section>
        </div>
      )}

      {/* Top 10 Produtos */}
      {top10.length > 0 && (
        <section
          aria-label="Top 10 produtos por faturamento"
          className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cockpit-accent" />
              <h2 className="text-sm font-semibold text-gray-900">
                Top 10 Produtos por Faturamento
              </h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-cockpit-muted">
              {top10Mean > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-[2px]"
                    style={{ borderTop: "1.5px dashed #3b82f6", height: 0 }}
                    aria-hidden
                  />
                  Média {fmtBRL(top10Mean, 0)}
                </span>
              )}
              <span className="hidden sm:inline italic">
                clique em uma barra para detalhar
              </span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10}
                layout="vertical"
                barCategoryGap="14%"
                margin={{ top: 4, right: 56, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_AXIS_LINE}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={chartAxisTick("sm")}
                  tickFormatter={(v) => formatYAxisCompact(Number(v))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="subNome"
                  type="category"
                  tick={{ ...chartAxisTick("sm"), fontSize: 10 }}
                  width={184}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string, i: number) => {
                    const rank = `#${i + 1}`.padStart(3, " ");
                    const trimmed = v.length > 28 ? v.substring(0, 28) + "…" : v;
                    return `${rank}  ${trimmed}`;
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(168,28,44,0.06)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as UnifiedProductRow;
                    const idx = top10.findIndex((p) => p.itemCode === d.itemCode);
                    return (
                      <CockpitTooltipFrame>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white"
                            style={{ background: COD_COLORS[d.cod] ?? "#A81C2C" }}
                          >
                            {idx >= 0 ? idx + 1 : "?"}
                          </span>
                          <p className="font-semibold text-gray-800 text-[12px]">
                            {d.subNome}
                          </p>
                        </div>
                        <p className="text-gray-500 text-[10px] font-mono mb-1">
                          {d.itemCode} · {d.cod}
                        </p>
                        <p className="text-cockpit-accent font-bold tabular-nums">
                          {fmtBRL(d.faturamento)}
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-600 tabular-nums">
                          <span className="text-gray-400">UND</span>
                          <span className="text-right">{fmtNum(d.qtdUnd)}</span>
                          <span className="text-gray-400">Vendas</span>
                          <span className="text-right">{fmtNum(d.vendas)}</span>
                          <span className="text-gray-400">Embalagens</span>
                          <span className="text-right">{d.variants.length}</span>
                          <span className="text-gray-400">R$/UND</span>
                          <span className="text-right text-teal-700">
                            {fmtBRL(d.precoUndMedio, 2)}
                          </span>
                        </div>
                      </CockpitTooltipFrame>
                    );
                  }}
                />
                {top10Mean > 0 && (
                  <ReferenceLine
                    x={top10Mean}
                    stroke="#3b82f6"
                    strokeDasharray="5 4"
                    strokeWidth={1.4}
                  />
                )}
                <Bar
                  dataKey="faturamento"
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                  cursor="pointer"
                  animationDuration={700}
                  animationEasing="ease-out"
                  onClick={(d) => {
                    if (d) setModalProduct(d as unknown as UnifiedProductRow);
                  }}
                  label={{
                    position: "right",
                    formatter: (v) => fmtBRL(Number(v), 0),
                    fontSize: 10,
                    fill: "#374151",
                    fontWeight: 600,
                  }}
                >
                  {top10.map((p) => (
                    <Cell
                      key={p.itemCode}
                      fill={COD_COLORS[p.cod] ?? "#A81C2C"}
                      fillOpacity={0.88}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ═══ Filtros ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Row 1: Search + Estado + Vendedor + Grupo */}
          <div className="relative sm:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código, nome, grupo..."
              className="w-full pl-10 pr-8 py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent" />
            {search && <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-black/5 rounded"><X className="w-3.5 h-3.5 text-cockpit-muted" /></button>}
          </div>
          <div className="sm:col-span-2">
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cockpit-muted pointer-events-none" />
              <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
                className="w-full py-2 pl-8 pr-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
                <option value="">Estado</option>
                {estadoOptions.map((uf) => <option key={uf} value={uf}>{uf} — {UF_NAME[uf] ?? uf}</option>)}
              </select>
            </div>
          </div>
          <div className="sm:col-span-3">
            {!isComercial && (
            <div className="relative">
              <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cockpit-muted pointer-events-none" />
              <select value={vendedorFilter} onChange={(e) => setVendedorFilter(e.target.value)}
                className="w-full py-2 pl-8 pr-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
                <option value="">Vendedor</option>
                {vendedorOptions.map((v) => <option key={v.code} value={String(v.code)}>{v.name}</option>)}
              </select>
            </div>
            )}
          </div>
          <div className="sm:col-span-3">
            <select value={codFilter} onChange={(e) => setCodFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
              <option value="">Todos grupos</option>
              {codList.map((c) => <option key={c} value={c}>{c} — {COD_NAMES[c] ?? c}</option>)}
            </select>
          </div>

          {/* Row 2: Embalagem + Capacidade + Fechamento */}
          <div className="sm:col-span-4">
            <select value={embalaFilter} onChange={(e) => setEmbalaFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
              <option value="">Embalagem</option>
              {embalaTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-4">
            <select value={capFilter} onChange={(e) => setCapFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
              <option value="">Capacidade</option>
              {capacidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-4">
            <select value={fechFilter} onChange={(e) => setFechFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent">
              <option value="">Fechamento</option>
              {fechamentos.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-cockpit-muted uppercase font-semibold">Filtros:</span>
            {estadoFilter && (
              <button onClick={() => setEstadoFilter("")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 motion-safe:transition-colors">
                <MapPin className="w-2.5 h-2.5" /> {UF_NAME[estadoFilter] ?? estadoFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {vendedorFilter && (
              <button onClick={() => setVendedorFilter("")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 motion-safe:transition-colors">
                <Briefcase className="w-2.5 h-2.5" /> {spMap.get(Number(vendedorFilter)) ?? vendedorFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {codFilter && (
              <button onClick={() => setCodFilter("")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cockpit-accent/10 text-cockpit-accent hover:bg-cockpit-accent/20 motion-safe:transition-colors">
                {codFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {embalaFilter && (
              <button onClick={() => setEmbalaFilter("")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 motion-safe:transition-colors">
                {embalaFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {capFilter && (
              <button onClick={() => setCapFilter("")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 text-sky-700 hover:bg-sky-200 motion-safe:transition-colors">
                {capFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {fechFilter && (
              <button onClick={() => setFechFilter("")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 motion-safe:transition-colors">
                {fechFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {search && (
              <button onClick={() => setSearch("")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 motion-safe:transition-colors">
                &ldquo;{search}&rdquo; <X className="w-2.5 h-2.5" />
              </button>
            )}
            <button onClick={clearAllFilters}
              className="text-[10px] text-cockpit-muted hover:text-cockpit-accent motion-safe:transition-colors underline">
              Limpar todos
            </button>
          </div>
        )}
      </div>

      {/* ═══ Tabela ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-cockpit-border bg-gray-50/80 flex items-center justify-between">
          <p className="text-xs text-cockpit-muted">
            <strong className="text-gray-800">{filtered.length}</strong> de <strong className="text-gray-800">{unifiedProducts.length}</strong> produtos
          </p>
          <span className="text-[10px] text-cockpit-accent/60">Clique em um produto para ver detalhes por embalagem</span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50 text-[10px] uppercase tracking-wider text-cockpit-muted sticky top-0 z-10">
                <th className="text-left py-2.5 px-2 font-semibold w-[44px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("cod")}>
                  <span className="inline-flex items-center gap-1">COD <SortIcon field="cod" /></span></th>
                <th className="text-left py-2.5 px-2 font-semibold cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("subNome")}>
                  <span className="inline-flex items-center gap-1">Produto <SortIcon field="subNome" /></span></th>
                <th className="text-center py-2.5 px-2 font-semibold w-[68px] bg-gray-50">Emb.</th>
                <th className="text-center py-2.5 px-2 font-semibold w-[52px] bg-gray-50"
                  title="Classe Grupo da Gestão de Compras: curva ABCD (faturamento 12m) + 123 (volume 12m), calculada dentro do grupo">
                  Classe</th>
                <th className="text-right py-2.5 px-2 font-semibold w-[110px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("faturamento")}
                  title="Faturamento total nos últimos 12 meses (somente pedidos com linhas sincronizadas)">
                  <span className="inline-flex items-center gap-1 justify-end">Fat. 12m <SortIcon field="faturamento" /></span></th>
                <th className="text-right py-2.5 px-2 font-semibold w-[100px] cursor-pointer select-none hover:text-gray-700 bg-blue-50/30" onClick={() => toggleSort("fat3m")}
                  title="Faturamento total nos últimos 3 meses">
                  <span className="inline-flex items-center gap-1 justify-end text-blue-700">Fat. 3m <SortIcon field="fat3m" /></span></th>
                <th className="text-right py-2.5 px-2 font-semibold w-[100px] cursor-pointer select-none hover:text-gray-700 bg-blue-50/30" onClick={() => toggleSort("avgFat3m")}
                  title="Média mensal de faturamento nos últimos 3 meses (Fat. 3m ÷ 3)">
                  <span className="inline-flex items-center gap-1 justify-end text-blue-700">Méd R$/mês <SortIcon field="avgFat3m" /></span></th>
                <th className="text-right py-2.5 px-2 font-semibold w-[72px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("qtdUnd")}
                  title="Quantidade total em unidades (12 meses)">
                  <span className="inline-flex items-center gap-1 justify-end">Qtd 12m <SortIcon field="qtdUnd" /></span></th>
                <th className="text-right py-2.5 px-2 font-semibold w-[80px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("avgQtd3m")}
                  title="Média mensal de unidades vendidas nos últimos 3 meses">
                  <span className="inline-flex items-center gap-1 justify-end">Méd UN/mês <SortIcon field="avgQtd3m" /></span></th>
                <th className="text-right py-2.5 px-2 font-semibold w-[68px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("precoUndMedio")}>
                  <span className="inline-flex items-center gap-1 justify-end">R$/UND <SortIcon field="precoUndMedio" /></span></th>
                <th className="text-center py-2.5 px-2 font-semibold w-[40px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("vendas")}>
                  <span className="inline-flex items-center gap-1">Vnd <SortIcon field="vendas" /></span></th>
                <th className="text-center py-2.5 px-2 font-semibold w-[36px] cursor-pointer select-none hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("clientes")}>
                  <span className="inline-flex items-center gap-1">Cli <SortIcon field="clientes" /></span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const pctFat = totalFat > 0 ? (p.faturamento / totalFat * 100) : 0;
                const hasMulti = p.variants.length > 1;
                return (
                  <tr key={`${p.cod}-${p.subNome}`} onClick={() => setModalProduct(p)}
                    className={`border-b border-cockpit-border/10 hover:bg-cockpit-accent/[0.04] motion-safe:transition-colors cursor-pointer group ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="py-2 px-2 align-top">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: (COD_COLORS[p.cod] ?? "#A81C2C") + "18", color: COD_COLORS[p.cod] ?? "#A81C2C" }}>
                        {p.cod}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-700 max-w-[220px] align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="line-clamp-1 font-bold text-[11px] text-gray-900 group-hover:text-cockpit-accent motion-safe:transition-colors" title={`${p.itemCode} · ${p.subNome}`}>{p.subNome}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-cockpit-muted opacity-0 group-hover:opacity-100 motion-safe:transition-opacity shrink-0" />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                        <span className="font-mono text-[9px] text-blue-600">{p.itemCode}</span>
                        {p.capacidade !== "—" && <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 px-1 rounded">{p.capacidade}</span>}
                        {p.cor !== "—" && <span className="text-[9px] text-gray-500 bg-gray-50 px-1 rounded">{p.cor}</span>}
                        {p.fechamento !== "—" && <span className="text-[9px] text-violet-600 bg-violet-50 px-1 rounded">{p.fechamento}</span>}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center align-top">
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {p.variants.map((v) => (
                          <span key={v.itemCode}
                            className={`inline-block px-1 py-0.5 rounded text-[9px] font-semibold ${v.embala === "UND" ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"}`}>
                            {v.embala === "UND" ? "UND" : v.embala.split(" ")[0]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center align-top">
                      {(() => {
                        const cls = comprasClasses.get(`${p.cod}::${p.subNome}`);
                        if (!cls) return <span className="text-[9px] text-gray-300">—</span>;
                        const abcd = cls.classeGrupo.charAt(0) as CurvaABCD;
                        const colors: Record<CurvaABCD, string> = {
                          A: "bg-emerald-100 text-emerald-700",
                          B: "bg-blue-100 text-blue-700",
                          C: "bg-amber-100 text-amber-700",
                          D: "bg-rose-100 text-rose-700",
                        };
                        return (
                          <span
                            className={`inline-block min-w-[28px] px-1 py-0.5 rounded text-[10px] font-bold ${colors[abcd]}`}
                            title={`Classe Grupo: ${cls.classeGrupo} · Classe Geral: ${cls.classeGeral} (curva ABCD por faturamento + 123 por volume, 12 meses)`}
                          >
                            {cls.classeGrupo}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden hidden sm:block">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pctFat * 3, 100)}%`, background: COD_COLORS[p.cod] ?? "#A81C2C", opacity: 0.6 }} />
                        </div>
                        <span className="font-semibold text-cockpit-accent">{fmtBRL(p.faturamento)}</span>
                      </div>
                      <span className={`block text-[9px] text-right ${pctFat >= 10 ? "text-cockpit-accent font-bold" : pctFat >= 3 ? "text-gray-600" : "text-gray-400"}`}>{pctFat.toFixed(1)}%</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top bg-blue-50/20">
                      <span className="text-blue-700 font-semibold">{p.fat3m > 0 ? fmtBRL(p.fat3m) : "—"}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top bg-blue-50/20">
                      <span className="text-blue-700 font-semibold">{p.avgFat3m > 0 ? fmtBRL(p.avgFat3m) : "—"}</span>
                      <span className="block text-[9px] text-gray-400">/mês</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      <span className="font-semibold text-gray-900">{fmtNum(p.qtdUnd)}</span>
                      {hasMulti && <span className="block text-[9px] text-gray-400">{p.variants.length} var.</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      <span className="text-gray-700 font-semibold">{fmtNum(Math.round(p.avgQtd3m))}</span>
                      <span className="block text-[9px] text-gray-400">/mês</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      <span className="text-[11px] text-teal-700 font-semibold">{p.precoUndMedio > 0 ? fmtBRL(p.precoUndMedio, 2) : "—"}</span>
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-gray-600 align-top">{p.vendas}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-gray-600 align-top">{p.clientes}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center py-12 text-cockpit-muted">
                  <Tag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500">Nenhum produto encontrado</p>
                  {hasActiveFilters && (
                    <button onClick={clearAllFilters}
                      className="mt-2 text-xs text-cockpit-accent hover:underline">
                      Limpar filtros
                    </button>
                  )}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-cockpit-border bg-cockpit-accent/[0.03] text-xs flex-wrap gap-2">
            <span className="text-cockpit-muted">Total ({filtered.length} produtos)</span>
            <div className="flex items-center gap-4 tabular-nums flex-wrap">
              <span className="text-gray-600">Fat 12m: <strong className="text-cockpit-accent">{fmtBRL(filtered.reduce((s, p) => s + p.faturamento, 0))}</strong></span>
              <span className="text-gray-300">|</span>
              <span className="text-blue-700">Fat 3m: <strong>{fmtBRL(filtered.reduce((s, p) => s + p.fat3m, 0))}</strong></span>
              <span className="text-blue-700">Méd R$/mês: <strong>{fmtBRL(filtered.reduce((s, p) => s + p.avgFat3m, 0))}</strong></span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">UND 12m: <strong>{fmtNum(filtered.reduce((s, p) => s + p.qtdUnd, 0))}</strong></span>
              <span className="text-gray-600">Méd UN/mês: <strong>{fmtNum(Math.round(filtered.reduce((s, p) => s + p.avgQtd3m, 0)))}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Product Detail Modal — janela fixa de 12 meses (gerenciada dentro do modal) */}
      {modalProduct && (
        <UnifiedProductModal
          product={modalProduct}
          totalFat={totalFat}
          onClose={() => setModalProduct(null)}
        />
      )}
    </div>
  );
}
