"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Package, Boxes, AlertTriangle, Search, CalendarDays,
  TrendingUp, TrendingDown, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Gauge, BarChart3, Layers, Flame, Snowflake, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Tag,
  Wallet, Clock, Weight, Truck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie,
} from "recharts";
import { fmtNum, fmtBRL, exportCSV, getProductGroup } from "@/lib/format";
import {
  fetchCatalog, fetchInventory, fetchSalesOrders,
  type CatalogItem, type InventoryRow,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { BiChartTooltip, CockpitTooltipFrame } from "@/components/cockpit/ChartTooltip";
import { CHART_GRID, chartAxisTick } from "@/lib/chart-theme";
import { format, differenceInDays } from "date-fns";

/* ── SKU prefix exclusion & category mapping ── */
const EXCLUDED_PREFIXES = new Set(["AT", "DA", "DD", "DF", "DT", "DV"]);

function getSkuPrefix(sku: string): string {
  let p = "";
  for (const c of sku) { if (/[A-Za-z]/.test(c)) p += c; else break; }
  return p.toUpperCase().slice(0, 2);
}

type ProductCategory = "garrafas" | "tampas" | "lacres" | "rolhas" | "potes" | "embalagens" | "equipamentos" | "insumos" | "outros";

const CATEGORY_MAP: Record<string, ProductCategory> = {
  GN: "garrafas", GI: "garrafas", GF: "garrafas", AR: "garrafas",
  TM: "tampas", TA: "tampas", TP: "tampas",
  LA: "lacres",
  RO: "rolhas",
  PO: "potes",
  EM: "embalagens", PA: "embalagens", MO: "embalagens", CH: "embalagens",
  IS: "insumos",
  EQ: "equipamentos", ME: "equipamentos",
};

const CATEGORY_CFG: Record<ProductCategory, { label: string; color: string; bg: string }> = {
  garrafas:     { label: "Garrafas",     color: "text-cockpit-accent", bg: "bg-red-50" },
  tampas:       { label: "Tampas",       color: "text-amber-700",      bg: "bg-amber-50" },
  lacres:       { label: "Lacres",       color: "text-orange-700",     bg: "bg-orange-50" },
  rolhas:       { label: "Rolhas",       color: "text-yellow-700",     bg: "bg-yellow-50" },
  potes:        { label: "Potes",        color: "text-emerald-700",    bg: "bg-emerald-50" },
  embalagens:   { label: "Embalagens",   color: "text-sky-700",        bg: "bg-sky-50" },
  equipamentos: { label: "Equipamentos", color: "text-indigo-700",     bg: "bg-indigo-50" },
  insumos:      { label: "Insumos",      color: "text-purple-700",     bg: "bg-purple-50" },
  outros:       { label: "Outros",       color: "text-gray-600",       bg: "bg-gray-100" },
};

function categorize(sku: string): ProductCategory {
  return CATEGORY_MAP[getSkuPrefix(sku)] ?? "outros";
}

/* ── Types ── */
type CurvaABC = "A" | "B" | "C";
type Giro = "alto" | "medio" | "baixo" | "parado";
type Cobertura = "critico" | "atencao" | "ok" | "excesso";

interface StockItem {
  sku: string;
  cod: string;
  descricao: string;
  und: string;
  embala: string;
  embalaQty: number;
  estoqueTotal: number;
  confirmado: number;
  disponivel: number;
  reservado: number;
  emPedido: number;
  minStock: number;
  maxStock: number;
  qtdEmb: number;
  qtdVendida: number;
  fatVendido: number;
  mediaDiaria: number;
  coberturaDias: number;
  giro: Giro;
  curva: CurvaABC;
  coberturaClass: Cobertura;
  numPedidos: number;
  numClientes: number;
  skuCount: number;
  allSkus: string[];
  embalas: string[];
  belowMinStock: boolean;
  categoria: ProductCategory;
  avgPrice: number;
  lastPurchasePrice: number;
  lastPurchaseDate: string | null;
  lastSaleDate: string | null;
  grossWeight: number;
  leadTime: number;
  itemGroupName: string | null;
  lastCountDate: string | null;
  valorEstoque: number;
}

/* ── Helpers ── */
function parseEmbalaQty(desc: string): { embalaQty: number; embala: string } {
  const d = (desc ?? "").trim();
  if (!d) return { embalaQty: 1, embala: "UND" };
  const packRx = /(CAIXA|FARDO|PALETE)\s+C\s*\/\s*([\d.,]+)\s*UND/i;
  const m = d.match(packRx);
  if (m) {
    const qty = parseInt(m[2].replace(/\./g, "").replace(",", "."), 10) || 1;
    return { embalaQty: qty, embala: `${m[1].toUpperCase()} C/${qty}` };
  }
  if (/[-–]\s*UND\s*$/i.test(d) || /\bUND\s*$/i.test(d)) return { embalaQty: 1, embala: "UND" };
  return { embalaQty: 1, embala: "UND" };
}

function getBaseProductName(desc: string): string {
  return (desc ?? "")
    .replace(/\s*[-–]\s*(CAIXA|FARDO|PALETE)\s+C\s*\/\s*[\d.,]+\s*UND\s*$/i, "")
    .replace(/\s*[-–]\s*UND\s*$/i, "")
    .trim()
    .toUpperCase();
}

const CURVA_COLORS: Record<CurvaABC, string> = { A: "#AA1A1B", B: "#f59e0b", C: "#9ca3af" };

const GIRO_CFG: Record<Giro, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  alto:   { bg: "bg-emerald-50", text: "text-emerald-700", icon: Flame,        label: "Alto" },
  medio:  { bg: "bg-sky-50",     text: "text-sky-700",     icon: TrendingUp,   label: "Médio" },
  baixo:  { bg: "bg-amber-50",   text: "text-amber-700",   icon: TrendingDown, label: "Baixo" },
  parado: { bg: "bg-gray-100",   text: "text-gray-500",    icon: Snowflake,    label: "Parado" },
};

const COB_CFG: Record<Cobertura, { bg: string; text: string; label: string }> = {
  critico: { bg: "bg-red-50",      text: "text-red-700",    label: "Crítico" },
  atencao: { bg: "bg-amber-50",    text: "text-amber-700",  label: "Atenção" },
  ok:      { bg: "bg-emerald-50",  text: "text-emerald-700",label: "OK" },
  excesso: { bg: "bg-violet-50",   text: "text-violet-600", label: "Excesso" },
};

function classifyGiro(mediaDiaria: number, maxMedia: number): Giro {
  if (mediaDiaria <= 0) return "parado";
  const pct = maxMedia > 0 ? mediaDiaria / maxMedia : 0;
  if (pct >= 0.3) return "alto";
  if (pct >= 0.1) return "medio";
  return "baixo";
}

function classifyCobertura(dias: number, temVenda: boolean): Cobertura {
  if (!temVenda) return dias > 0 ? "excesso" : "ok";
  if (dias <= 7) return "critico";
  if (dias <= 21) return "atencao";
  if (dias <= 90) return "ok";
  return "excesso";
}

function classifyCurvaABC(items: { sku: string; fat: number }[]): Map<string, CurvaABC> {
  const sorted = [...items].sort((a, b) => b.fat - a.fat);
  const total = sorted.reduce((s, i) => s + i.fat, 0);
  const map = new Map<string, CurvaABC>();
  let cum = 0;
  for (const i of sorted) {
    cum += i.fat;
    map.set(i.sku, total > 0 ? (cum / total <= 0.8 ? "A" : cum / total <= 0.95 ? "B" : "C") : "C");
  }
  return map;
}

type SortField = "descricao" | "estoqueTotal" | "disponivel" | "qtdVendida" | "mediaDiaria" | "coberturaDias" | "fatVendido" | "curva" | "giro" | "numPedidos";

/* ── Small components ── */
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s|[./>_-])\S/g, (c) => c.toUpperCase());
}

function StockBar({ total, available, minStock }: { total: number; available: number; minStock: number }) {
  if (total <= 0) return <span className="text-gray-300 text-[10px]">—</span>;
  const pct = Math.min((available / total) * 100, 100);
  const minPct = minStock > 0 && total > 0 ? Math.min((minStock / total) * 100, 100) : 0;
  const color = available <= 0 ? "#ef4444" : minStock > 0 && available < minStock ? "#f59e0b" : pct < 30 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]" title={`${fmtNum(available)} de ${fmtNum(total)} disponível (${pct.toFixed(0)}%)`}>
      <div className="flex-1 h-2 bg-gray-100 rounded-full relative overflow-hidden">
        <div className="h-full rounded-full motion-safe:transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
        {minPct > 0 && <div className="absolute top-0 h-full w-0.5 bg-red-400/70" style={{ left: `${minPct}%` }} />}
      </div>
      <span className={`text-[10px] tabular-nums font-medium w-9 text-right ${pct < 30 ? "text-amber-600" : "text-gray-500"}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

const PAGE_SIZES = [25, 50, 100] as const;

/* ── Main page ── */
export default function EstoquePage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");
  const totalDays = Math.max(1, differenceInDays(range.to, range.from) + 1);

  const { data: catalogData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchCatalog({ limit: 5000 }), []);
  const { data: invData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchInventory({ limit: 5000 }), []);
  const { salesPersonCode } = useSalesPersonFilter();
  const { data: ordData, loading: l3, error: e3, refetch: r3 } =
    useFetch(() => fetchSalesOrders({ dateFrom, dateTo, limit: 50000, salesPerson: salesPersonCode }), [dateFrom, dateTo, salesPersonCode]);

  const loading = l1 || l2 || l3;
  const error = e1 || e2 || e3;

  /* ── Build items (with exclusion filter) ── */
  const allItems = useMemo<StockItem[]>(() => {
    if (!catalogData || !invData || !ordData) return [];

    type InvAgg = {
      avail: number; free: number; reserved: number; onOrder: number;
      minStock: number; maxStock: number; itemName: string | null;
      avgPrice: number; lastPurchasePrice: number; lastPurchaseDate: string | null;
      lastSaleDate: string | null; grossWeight: number; leadTime: number;
      itemGroupName: string | null; lastCountDate: string | null;
    };
    const invMap = new Map<string, InvAgg>();
    for (const inv of invData.data) {
      if (EXCLUDED_PREFIXES.has(getSkuPrefix(inv.product_id))) continue;
      const cur = invMap.get(inv.product_id) ?? {
        avail: 0, free: 0, reserved: 0, onOrder: 0, minStock: 0, maxStock: 0,
        itemName: null, avgPrice: 0, lastPurchasePrice: 0,
        lastPurchaseDate: null, lastSaleDate: null, grossWeight: 0,
        leadTime: 0, itemGroupName: null, lastCountDate: null,
      };
      cur.avail += inv.quantity_available;
      cur.free += inv.quantity_free;
      cur.reserved += inv.quantity_reserved;
      cur.onOrder += inv.quantity_on_order;
      cur.minStock = Math.max(cur.minStock, inv.min_stock ?? 0);
      cur.maxStock = Math.max(cur.maxStock, inv.max_stock ?? 0);
      if (inv.item_name && !cur.itemName) cur.itemName = inv.item_name;
      if (inv.avg_price && !cur.avgPrice) cur.avgPrice = inv.avg_price;
      if (inv.last_purchase_price && !cur.lastPurchasePrice) cur.lastPurchasePrice = inv.last_purchase_price;
      if (inv.last_purchase_date && !cur.lastPurchaseDate) cur.lastPurchaseDate = inv.last_purchase_date;
      if (inv.last_sale_date && !cur.lastSaleDate) cur.lastSaleDate = inv.last_sale_date;
      if (inv.gross_weight && !cur.grossWeight) cur.grossWeight = inv.gross_weight;
      if (inv.lead_time && !cur.leadTime) cur.leadTime = inv.lead_time;
      if (inv.item_group_name && !cur.itemGroupName) cur.itemGroupName = inv.item_group_name;
      if (inv.last_count_date && !cur.lastCountDate) cur.lastCountDate = inv.last_count_date;
      invMap.set(inv.product_id, cur);
    }

    const salesMap = new Map<string, { qty: number; fat: number; pedidos: Set<number>; clientes: Set<string> }>();
    for (const o of ordData.items) {
      if (o.cancelled === "Y") continue;
      for (const l of (o.lines ?? [])) {
        const code = l.ItemCode ?? "";
        if (!code || EXCLUDED_PREFIXES.has(getSkuPrefix(code))) continue;
        const cur = salesMap.get(code) ?? { qty: 0, fat: 0, pedidos: new Set(), clientes: new Set() };
        cur.qty += Number(l.Quantity) || 0;
        cur.fat += Number(l.LineTotal) || 0;
        cur.pedidos.add(o.doc_num);
        cur.clientes.add(o.card_code);
        salesMap.set(code, cur);
      }
    }

    type RawItem = {
      sku: string; description: string; unitOfMeasure: string; embala: string;
      embalaQty: number; baseName: string; estoqueTotal: number; confirmado: number;
      disponivel: number; reservado: number; emPedido: number; minStock: number; maxStock: number;
      qtdEmb: number; qtdVendida: number; fatVendido: number;
      pedidos: Set<number>; clientes: Set<string>;
      avgPrice: number; lastPurchasePrice: number; lastPurchaseDate: string | null;
      lastSaleDate: string | null; grossWeight: number; leadTime: number;
      itemGroupName: string | null; lastCountDate: string | null;
    };

    const rawItems: RawItem[] = catalogData.data
      .filter((cat) => !EXCLUDED_PREFIXES.has(getSkuPrefix(cat.sku)))
      .map((cat) => {
        const inv = invMap.get(cat.sku);
        const sales = salesMap.get(cat.sku);
        const { embalaQty, embala } = parseEmbalaQty(cat.description);
        const qtdEmb = sales?.qty ?? 0;
        return {
          sku: cat.sku, description: inv?.itemName || cat.description,
          unitOfMeasure: cat.unit_of_measure || "UN", embala, embalaQty,
          baseName: getBaseProductName(inv?.itemName || cat.description),
          estoqueTotal: inv?.avail ?? 0, confirmado: inv?.reserved ?? 0,
          disponivel: inv?.free ?? 0, reservado: inv?.reserved ?? 0,
          emPedido: inv?.onOrder ?? 0, minStock: inv?.minStock ?? 0, maxStock: inv?.maxStock ?? 0,
          qtdEmb, qtdVendida: qtdEmb * embalaQty, fatVendido: sales?.fat ?? 0,
          pedidos: sales?.pedidos ?? new Set<number>(),
          clientes: sales?.clientes ?? new Set<string>(),
          avgPrice: inv?.avgPrice ?? 0,
          lastPurchasePrice: inv?.lastPurchasePrice ?? 0,
          lastPurchaseDate: inv?.lastPurchaseDate ?? null,
          lastSaleDate: inv?.lastSaleDate ?? null,
          grossWeight: inv?.grossWeight ?? 0,
          leadTime: inv?.leadTime ?? 0,
          itemGroupName: inv?.itemGroupName ?? null,
          lastCountDate: inv?.lastCountDate ?? null,
        };
      });

    const groups = new Map<string, RawItem[]>();
    for (const item of rawItems) {
      const key = item.baseName || item.sku;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const mergedItems: StockItem[] = [];
    for (const [baseName, group] of groups) {
      const undItem = group.find((i) => i.embala === "UND") ?? group[0];
      const estoqueTotal = group.reduce((s, i) => s + i.estoqueTotal, 0);
      const confirmado = group.reduce((s, i) => s + i.confirmado, 0);
      const disponivel = group.reduce((s, i) => s + i.disponivel, 0);
      const reservado = group.reduce((s, i) => s + i.reservado, 0);
      const emPedido = group.reduce((s, i) => s + i.emPedido, 0);
      const minStock = Math.max(...group.map((i) => i.minStock), 0);
      const maxStock = Math.max(...group.map((i) => i.maxStock), 0);
      const qtdVendida = group.reduce((s, i) => s + i.qtdVendida, 0);
      const qtdEmb = group.reduce((s, i) => s + i.qtdEmb, 0);
      const fatVendido = group.reduce((s, i) => s + i.fatVendido, 0);
      const allPedidos = new Set<number>();
      const allClientes = new Set<string>();
      for (const i of group) { for (const p of i.pedidos) allPedidos.add(p); for (const c of i.clientes) allClientes.add(c); }
      const mediaDiaria = qtdVendida / totalDays;
      const coberturaDias = mediaDiaria > 0 ? disponivel / mediaDiaria : disponivel > 0 ? 999 : 0;
      const avgPrice = undItem.avgPrice;
      const valorEstoque = avgPrice > 0 ? avgPrice * estoqueTotal : 0;

      mergedItems.push({
        sku: undItem.sku, cod: getProductGroup(undItem.sku),
        descricao: baseName || undItem.description, und: undItem.unitOfMeasure,
        embala: [...new Set(group.map((i) => i.embala))].join(", "),
        embalaQty: undItem.embalaQty, estoqueTotal, confirmado, disponivel, reservado,
        emPedido, minStock, maxStock, qtdEmb, qtdVendida, fatVendido, mediaDiaria,
        coberturaDias: Math.min(coberturaDias, 999),
        giro: "parado" as Giro, curva: "C" as CurvaABC,
        coberturaClass: classifyCobertura(coberturaDias, qtdVendida > 0),
        numPedidos: allPedidos.size, numClientes: allClientes.size,
        skuCount: group.length, allSkus: group.map((i) => i.sku),
        embalas: [...new Set(group.map((i) => i.embala))],
        belowMinStock: minStock > 0 && disponivel < minStock,
        categoria: categorize(undItem.sku),
        avgPrice, lastPurchasePrice: undItem.lastPurchasePrice,
        lastPurchaseDate: undItem.lastPurchaseDate,
        lastSaleDate: undItem.lastSaleDate,
        grossWeight: undItem.grossWeight,
        leadTime: undItem.leadTime,
        itemGroupName: undItem.itemGroupName,
        lastCountDate: undItem.lastCountDate,
        valorEstoque,
      });
    }

    const curvaMap = classifyCurvaABC(mergedItems.map((i) => ({ sku: i.sku, fat: i.fatVendido })));
    const maxMedia = Math.max(...mergedItems.map((i) => i.mediaDiaria), 0);
    for (const item of mergedItems) {
      item.curva = curvaMap.get(item.sku) ?? "C";
      item.giro = classifyGiro(item.mediaDiaria, maxMedia);
    }
    return mergedItems;
  }, [catalogData, invData, ordData, totalDays]);

  /* ── Category distribution (for filter badges) ── */
  const categoryDistrib = useMemo(() => {
    const counts = new Map<ProductCategory, number>();
    for (const item of allItems) {
      counts.set(item.categoria, (counts.get(item.categoria) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([cat, count]) => ({ cat, count, ...CATEGORY_CFG[cat] }))
      .sort((a, b) => b.count - a.count);
  }, [allItems]);

  /* ── SAP Group distribution ── */
  const sapGroupDistrib = useMemo(() => {
    const counts = new Map<string, { count: number; stock: number; value: number }>();
    for (const item of allItems) {
      const grp = item.itemGroupName ?? "Sem Grupo";
      const cur = counts.get(grp) ?? { count: 0, stock: 0, value: 0 };
      cur.count++;
      cur.stock += item.estoqueTotal;
      cur.value += item.valorEstoque;
      counts.set(grp, cur);
    }
    return Array.from(counts.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [allItems]);

  /* ── Stock health overview ── */
  const stockHealthDistrib = useMemo(() => {
    const h = { critico: 0, atencao: 0, ok: 0, excesso: 0, parado: 0 };
    for (const item of allItems) {
      if (item.giro === "parado" && item.estoqueTotal > 0) h.parado++;
      else h[item.coberturaClass]++;
    }
    return [
      { name: "Crítico", value: h.critico, fill: "#ef4444" },
      { name: "Atenção", value: h.atencao, fill: "#f59e0b" },
      { name: "OK", value: h.ok, fill: "#10b981" },
      { name: "Excesso", value: h.excesso, fill: "#8b5cf6" },
      { name: "Parado", value: h.parado, fill: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [allItems]);

  /* ── Giro distribution ── */
  const giroDistrib = useMemo(() => {
    const g = { alto: 0, medio: 0, baixo: 0, parado: 0 };
    for (const item of allItems) g[item.giro]++;
    return [
      { name: "Alto", value: g.alto, fill: "#10b981" },
      { name: "Médio", value: g.medio, fill: "#0ea5e9" },
      { name: "Baixo", value: g.baixo, fill: "#f59e0b" },
      { name: "Parado", value: g.parado, fill: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [allItems]);

  /* ── Top 10 by stock value ── */
  const topByValue = useMemo(() => {
    return [...allItems]
      .filter((i) => i.valorEstoque > 0)
      .sort((a, b) => b.valorEstoque - a.valorEstoque)
      .slice(0, 10)
      .map((i) => ({
        name: toTitleCase(i.descricao).slice(0, 28),
        valor: i.valorEstoque,
        sku: i.sku,
      }));
  }, [allItems]);

  /* ── State ── */
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<ProductCategory | "ALL">("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [curvaFilter, setCurvaFilter] = useState<CurvaABC | "ALL">("ALL");
  const [giroFilter, setGiroFilter] = useState<Giro | "ALL">("ALL");
  const [cobFilter, setCobFilter] = useState<Cobertura | "ALL">("ALL");
  const [quickFilter, setQuickFilter] = useState<"all" | "atencao" | "comVenda" | "semVenda">("all");
  const [sortField, setSortField] = useState<SortField>("fatVendido");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);

  /* ── Filtered + sorted ── */
  const filtered = useMemo(() => {
    let res = allItems;
    if (catFilter !== "ALL") res = res.filter((i) => i.categoria === catFilter);
    if (groupFilter !== "ALL") res = res.filter((i) => (i.itemGroupName ?? "Sem Grupo") === groupFilter);
    if (curvaFilter !== "ALL") res = res.filter((i) => i.curva === curvaFilter);
    if (giroFilter !== "ALL") res = res.filter((i) => i.giro === giroFilter);
    if (cobFilter !== "ALL") res = res.filter((i) => i.coberturaClass === cobFilter);
    if (quickFilter === "atencao") res = res.filter((i) => i.coberturaClass === "critico" || i.coberturaClass === "atencao" || i.belowMinStock);
    else if (quickFilter === "comVenda") res = res.filter((i) => i.qtdVendida > 0);
    else if (quickFilter === "semVenda") res = res.filter((i) => i.qtdVendida === 0 && i.estoqueTotal > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((i) => i.sku.toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q) || i.cod.toLowerCase().includes(q));
    }
    return [...res].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "descricao": cmp = a.descricao.localeCompare(b.descricao); break;
        case "estoqueTotal": cmp = a.estoqueTotal - b.estoqueTotal; break;
        case "disponivel": cmp = a.disponivel - b.disponivel; break;
        case "qtdVendida": cmp = a.qtdVendida - b.qtdVendida; break;
        case "mediaDiaria": cmp = a.mediaDiaria - b.mediaDiaria; break;
        case "coberturaDias": cmp = a.coberturaDias - b.coberturaDias; break;
        case "fatVendido": cmp = a.fatVendido - b.fatVendido; break;
        case "curva": cmp = a.curva.localeCompare(b.curva); break;
        case "giro": cmp = a.giro.localeCompare(b.giro); break;
        case "numPedidos": cmp = a.numPedidos - b.numPedidos; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allItems, catFilter, groupFilter, curvaFilter, giroFilter, cobFilter, quickFilter, search, sortField, sortDir]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
    setExpandedSku(null);
  }, [totalPages]);

  const resetPage = useCallback(() => setPage(1), []);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total = allItems.length;
    const totalSkus = allItems.reduce((s, i) => s + i.skuCount, 0);
    const estoqueTotal = allItems.reduce((s, i) => s + Math.max(i.estoqueTotal, 0), 0);
    const dispTotal = allItems.reduce((s, i) => s + Math.max(i.disponivel, 0), 0);
    const fatTotal = allItems.reduce((s, i) => s + i.fatVendido, 0);
    const saidaTotal = allItems.reduce((s, i) => s + i.qtdVendida, 0);
    const valorEstoqueTotal = allItems.reduce((s, i) => s + i.valorEstoque, 0);
    const criticos = allItems.filter((i) => i.coberturaClass === "critico").length;
    const parados = allItems.filter((i) => i.giro === "parado" && i.estoqueTotal > 0).length;
    const belowMin = allItems.filter((i) => i.belowMinStock).length;
    const orderNums = new Set<number>();
    const cardCodes = new Set<string>();
    if (ordData) { for (const o of ordData.items) { if (o.cancelled !== "Y") { orderNums.add(o.doc_num); cardCodes.add(o.card_code); } } }
    return { total, totalSkus, estoqueTotal, dispTotal, fatTotal, saidaTotal, valorEstoqueTotal, criticos, parados, belowMin, totalPedidos: orderNums.size, totalClientes: cardCodes.size };
  }, [allItems, ordData]);

  const curvaDistrib = useMemo(() => {
    const a = allItems.filter((i) => i.curva === "A");
    const b = allItems.filter((i) => i.curva === "B");
    const c = allItems.filter((i) => i.curva === "C");
    return [
      { name: "A", skus: a.length, fat: a.reduce((s, i) => s + i.fatVendido, 0), fill: "#AA1A1B" },
      { name: "B", skus: b.length, fat: b.reduce((s, i) => s + i.fatVendido, 0), fill: "#f59e0b" },
      { name: "C", skus: c.length, fat: c.reduce((s, i) => s + i.fatVendido, 0), fill: "#d1d5db" },
    ].filter((d) => d.skus > 0);
  }, [allItems]);

  const cobDistrib = useMemo(() => {
    const g: Record<string, number> = { "0-7d": 0, "8-21d": 0, "22-60d": 0, "61-90d": 0, "90d+": 0 };
    for (const i of allItems.filter((x) => x.qtdVendida > 0)) {
      if (i.coberturaDias <= 7) g["0-7d"]++; else if (i.coberturaDias <= 21) g["8-21d"]++; else if (i.coberturaDias <= 60) g["22-60d"]++; else if (i.coberturaDias <= 90) g["61-90d"]++; else g["90d+"]++;
    }
    return Object.entries(g).map(([name, value]) => ({ name, value }));
  }, [allItems]);

  const alertas = useMemo(() =>
    allItems.filter((i) => i.curva === "A" && i.coberturaClass === "critico").sort((a, b) => a.coberturaDias - b.coberturaDias).slice(0, 6),
  [allItems]);

  /* ── Sort ── */
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    resetPage();
  };

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cockpit-accent" /> : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  /* ── Export ── */
  const handleExport = () => {
    exportCSV(filtered.map((i) => ({
      SKU: i.sku, COD: i.cod, Produto: i.descricao, Categoria: CATEGORY_CFG[i.categoria].label,
      "Grupo SAP": i.itemGroupName ?? "",
      Curva: i.curva, "SKUs Agrup.": i.skuCount, Embalagens: i.embalas.join(", "),
      Estoque: i.estoqueTotal, Confirmado: i.confirmado, Disponivel: i.disponivel,
      "Em Pedido": i.emPedido, "Est. Minimo": i.minStock, "Est. Maximo": i.maxStock,
      "Abaixo Min.": i.belowMinStock ? "Sim" : "Nao",
      "Custo Medio": i.avgPrice.toFixed(2), "Valor Estoque": i.valorEstoque.toFixed(2),
      "Ult. Preco Compra": i.lastPurchasePrice.toFixed(2),
      "Lead Time (dias)": i.leadTime, "Peso Bruto": i.grossWeight.toFixed(3),
      "Ult. Compra": i.lastPurchaseDate ?? "", "Ult. Venda": i.lastSaleDate ?? "",
      "Saida (un)": i.qtdVendida, Pedidos: i.numPedidos, Clientes: i.numClientes,
      Faturamento: i.fatVendido.toFixed(2), "Media/Dia": i.mediaDiaria.toFixed(2),
      "Cobertura Dias": i.coberturaDias.toFixed(0), Giro: i.giro,
    })), `estoque-${dateFrom}-${dateTo}`);
  };

  if (loading) return (
    <div className="space-y-6">
      <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900">Gestão de Estoque</h1><p className="text-cockpit-muted mt-1 text-sm">Carregando dados...</p></div>
      <LoadingSkeleton rows={6} />
    </div>
  );

  if (error) return <ErrorState message={error} onRetry={() => { r1(); r2(); r3(); }} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Gestão de Estoque</h1>
          <p className="text-cockpit-muted mt-0.5 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span className="text-gray-600 font-medium">{periodoLabel}</span>
            <span className="text-gray-300">·</span>
            <span>{fmtNum(kpis.total)} produtos</span>
            <span className="text-gray-300">·</span>
            <span>{totalDays} dias</span>
          </p>
        </div>
        <button onClick={handleExport} className="flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition min-h-[44px] sm:min-h-0 w-full sm:w-auto">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { title: "Estoque Total", value: `${fmtNum(kpis.estoqueTotal)}`, sub: `${fmtNum(kpis.dispTotal)} disponível`, icon: Boxes, color: "text-sky-600", accent: "bg-sky-50" },
          { title: "Valor em Estoque", value: fmtBRL(kpis.valorEstoqueTotal), sub: `${sapGroupDistrib.length} grupos SAP`, icon: Wallet, color: "text-violet-600", accent: "bg-violet-50" },
          { title: "Faturamento", value: fmtBRL(kpis.fatTotal), sub: `${fmtNum(kpis.saidaTotal)} un saída`, icon: TrendingUp, color: "text-emerald-600", accent: "bg-emerald-50" },
          { title: "Pedidos", value: fmtNum(kpis.totalPedidos), sub: `${fmtNum(kpis.totalClientes)} clientes`, icon: Layers, color: "text-indigo-600", accent: "bg-indigo-50" },
          { title: "Itens Parados", value: String(kpis.parados), sub: `com estoque sem venda`, icon: Snowflake, color: kpis.parados > 0 ? "text-blue-600" : "text-emerald-600", accent: kpis.parados > 0 ? "bg-blue-50" : "bg-emerald-50" },
          { title: "Precisa Atenção", value: String(kpis.criticos + kpis.belowMin), sub: `${kpis.criticos} críticos · ${kpis.belowMin} abaixo mín.`, icon: ShieldAlert, color: (kpis.criticos + kpis.belowMin) > 0 ? "text-red-600" : "text-emerald-600", accent: (kpis.criticos + kpis.belowMin) > 0 ? "bg-red-50" : "bg-emerald-50" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.title} className="rounded-xl border border-cockpit-border bg-white p-3.5 hover:border-gray-300 motion-safe:transition-all group">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg ${k.accent} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4.5 h-4.5 ${k.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-cockpit-muted">{k.title}</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{k.value}</p>
                  <p className="text-[9px] text-cockpit-muted mt-0.5 truncate">{k.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Category filter */}
      <section className="flex flex-wrap items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-cockpit-muted mr-0.5" />
        <button onClick={() => { setCatFilter("ALL"); resetPage(); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium motion-safe:transition-all ${catFilter === "ALL" ? "border-gray-900 bg-gray-900 text-white shadow-sm" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
          Todas <span className="tabular-nums opacity-60">{allItems.length}</span>
        </button>
        {categoryDistrib.map(({ cat, count, label, color, bg }) => (
          <button key={cat} onClick={() => { setCatFilter(catFilter === cat ? "ALL" : cat); resetPage(); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium motion-safe:transition-all ${catFilter === cat ? `border-gray-400 ${bg} ${color} shadow-sm` : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
            {label} <span className="tabular-nums opacity-60">{count}</span>
          </button>
        ))}
      </section>

      {/* Alertas */}
      {alertas.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50/80 to-white p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <h2 className="text-xs font-semibold text-red-800">Curva A com cobertura crítica</h2>
            <span className="ml-auto text-[10px] text-red-400">{alertas.length} itens</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none touch-scroll pb-0.5 -mx-1 px-1">
            {alertas.map((a) => (
              <div key={a.sku} className="shrink-0 w-52 bg-white rounded-lg border border-red-100 p-2.5">
                <p className="text-[11px] font-semibold text-gray-900 truncate" title={a.descricao}>{toTitleCase(a.descricao)}</p>
                <p className="text-[9px] text-gray-400 font-mono mt-0.5">{a.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-red-600 font-bold text-xs">{a.coberturaDias.toFixed(0)}d</span>
                  <span className="text-[10px] text-gray-400">disp {fmtNum(a.disponivel)} · {a.mediaDiaria.toFixed(1)}/dia</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dashboard de Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Saúde do Estoque */}
        <section className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-xs font-semibold text-gray-900">Saúde do Estoque</h2>
          </div>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stockHealthDistrib} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2}>
                  {stockHealthDistrib.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={(_, v) => `${fmtNum(v)} itens`} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-1">
            {stockHealthDistrib.map((d) => (
              <span key={d.name} className="flex items-center gap-1 text-[9px] text-gray-600">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                {d.name} <strong className="text-gray-800">{d.value}</strong>
              </span>
            ))}
          </div>
        </section>

        {/* Curva ABC */}
        <section className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-xs font-semibold text-gray-900">Curva ABC</h2>
          </div>
          {curvaDistrib.length === 0 ? (
            <p className="text-center text-cockpit-muted py-8 text-xs">Sem dados</p>
          ) : (
            <>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={curvaDistrib} dataKey="fat" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={3}>
                      {curvaDistrib.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-1">
                {curvaDistrib.map((d) => {
                  const totalFat = curvaDistrib.reduce((s, x) => s + x.fat, 0);
                  const pct = totalFat > 0 ? (d.fat / totalFat) * 100 : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center shrink-0" style={{ background: d.fill + "20", color: d.fill }}>{d.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full motion-safe:transition-all" style={{ width: `${pct}%`, background: d.fill }} /></div>
                      <span className="text-[10px] tabular-nums text-gray-600 w-16 text-right"><strong>{d.skus}</strong> · {pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Cobertura */}
        <section className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-xs font-semibold text-gray-900">Cobertura (dias)</h2>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cobDistrib} barCategoryGap="16%">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="name" tick={{ ...chartAxisTick("sm"), fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ ...chartAxisTick("sm"), fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={(name, v) => (name === "Faturamento" ? fmtBRL(v) : fmtNum(v))} />} />
                <Bar dataKey="value" name="SKUs" radius={[4, 4, 0, 0]}>
                  {cobDistrib.map((_, i) => <Cell key={i} fill={["#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6"][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-1.5 mt-1 text-[8px] flex-wrap">
            {[["bg-red-500", "≤7d"], ["bg-amber-500", "8-21d"], ["bg-emerald-500", "22-60d"], ["bg-sky-500", "61-90d"], ["bg-violet-500", "90d+"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-0.5"><span className={`w-1.5 h-1.5 rounded-full ${c}`} />{l}</span>
            ))}
          </div>
        </section>

        {/* Giro de Estoque */}
        <section className="rounded-xl border border-cockpit-border bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-xs font-semibold text-gray-900">Giro de Estoque</h2>
          </div>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={giroDistrib} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2}>
                  {giroDistrib.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={(_, v) => `${fmtNum(v)} itens`} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-1">
            {giroDistrib.map((d) => (
              <span key={d.name} className="flex items-center gap-1 text-[9px] text-gray-600">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                {d.name} <strong className="text-gray-800">{d.value}</strong>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Concentração de Valor + Distribuição por Grupo SAP */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Top 10 por Valor em Estoque */}
        {topByValue.length > 0 && (
          <section className="rounded-xl border border-cockpit-border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-violet-600" />
              <h2 className="text-xs font-semibold text-gray-900">Top 10 — Concentração de Valor</h2>
              <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{fmtBRL(topByValue.reduce((s, i) => s + i.valor, 0))}</span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByValue} layout="vertical" barCategoryGap="12%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis type="number" tick={{ ...chartAxisTick("sm"), fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtBRL(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#374151", fontSize: 9 }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip content={<BiChartTooltip variant="cockpit" />} />
                  <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]} fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Distribuição por Grupo SAP */}
        {sapGroupDistrib.length > 0 && (
          <section className="rounded-xl border border-cockpit-border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-semibold text-gray-900">Distribuição por Grupo SAP</h2>
              <span className="ml-auto text-[10px] text-gray-400">{sapGroupDistrib.length} grupos</span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sapGroupDistrib.slice(0, 12)} layout="vertical" barCategoryGap="10%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis type="number" tick={{ ...chartAxisTick("sm"), fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#374151", fontSize: 9 }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <CockpitTooltipFrame>
                        <p className="font-semibold text-gray-900 mb-1">{label}</p>
                        <p className="text-gray-600">Itens: <strong>{fmtNum(Number(payload[0]?.value))}</strong></p>
                      </CockpitTooltipFrame>
                    );
                  }} />
                  <Bar dataKey="count" name="Itens" radius={[0, 4, 4, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>

      {/* Search + Filters */}
      <div className="rounded-xl border border-cockpit-border bg-white p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="Buscar SKU, produto, código..."
              className="w-full pl-9 pr-4 py-2.5 sm:py-2 rounded-lg bg-gray-50 border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 min-h-[44px] sm:min-h-0" />
          </div>
          <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); resetPage(); }}
            className={`border rounded-lg px-2.5 py-2 sm:py-1.5 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 min-h-[44px] sm:min-h-0 max-w-[200px] ${groupFilter !== "ALL" ? "border-indigo-300 text-indigo-700 bg-indigo-50" : "border-gray-200 text-gray-600"}`}>
            <option value="ALL">Todos os Grupos SAP</option>
            {sapGroupDistrib.map((g) => (
              <option key={g.name} value={g.name}>{g.name} ({g.count})</option>
            ))}
          </select>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 shrink-0">
            {([
              { key: "all", label: "Todos" },
              { key: "atencao", label: "Atenção" },
              { key: "comVenda", label: "Com Venda" },
              { key: "semVenda", label: "Sem Venda" },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => { setQuickFilter(key); resetPage(); }}
                className={`px-2.5 py-2 sm:py-1.5 rounded-md text-xs font-medium motion-safe:transition-colors whitespace-nowrap ${
                  quickFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"
                }`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none touch-scroll">
          <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 shrink-0">
            {(["ALL", "A", "B", "C"] as const).map((opt) => (
              <button key={opt} onClick={() => { setCurvaFilter(opt); resetPage(); }}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold motion-safe:transition-colors min-w-[32px] ${
                  curvaFilter === opt ? opt === "ALL" ? "bg-white text-gray-900 shadow-sm" : "text-white shadow-sm" : "text-gray-400 hover:text-gray-700"
                }`} style={curvaFilter === opt && opt !== "ALL" ? { backgroundColor: CURVA_COLORS[opt] } : {}}>{opt === "ALL" ? "ABC" : opt}</button>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 shrink-0">
            {(["ALL", "alto", "medio", "baixo", "parado"] as const).map((opt) => (
              <button key={opt} onClick={() => { setGiroFilter(opt); resetPage(); }}
                className={`px-2 py-1.5 rounded-md text-xs font-medium motion-safe:transition-colors ${
                  giroFilter === opt ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"
                }`}>{opt === "ALL" ? "Giro" : GIRO_CFG[opt].label}</button>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 shrink-0">
            {(["ALL", "critico", "atencao", "ok", "excesso"] as const).map((opt) => (
              <button key={opt} onClick={() => { setCobFilter(opt); resetPage(); }}
                className={`px-2 py-1.5 rounded-md text-xs font-medium motion-safe:transition-colors ${
                  cobFilter === opt ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"
                }`}>{opt === "ALL" ? "Cobert." : COB_CFG[opt].label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        {/* Table header bar */}
        <div className="px-4 py-2.5 border-b border-cockpit-border bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 text-xs text-cockpit-muted flex-wrap">
            <span><strong className="text-gray-800">{filtered.length}</strong> produtos</span>
            {filtered.length !== allItems.length && <span className="text-gray-300">de {allItems.length}</span>}
            {catFilter !== "ALL" && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${CATEGORY_CFG[catFilter].color}`} style={{ borderColor: "currentColor" }}>{CATEGORY_CFG[catFilter].label}</span>}
            {curvaFilter !== "ALL" && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: CURVA_COLORS[curvaFilter] }}>Curva {curvaFilter}</span>}
            {groupFilter !== "ALL" && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200">{groupFilter}</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) as any); resetPage(); }}
                className="border border-gray-200 rounded-md px-1.5 py-1 text-[11px] text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-cockpit-accent/30">
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>por pág.</span>
            </div>
            <p className="text-[10px] text-gray-400 hidden sm:block">Clique para detalhes</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col />
              <col className="hidden lg:table-column" style={{ width: 84 }} />
              <col className="hidden xl:table-column" style={{ width: 100 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 72 }} />
              <col className="hidden sm:table-column" style={{ width: 112 }} />
              <col style={{ width: 56 }} />
              <col className="hidden md:table-column" style={{ width: 64 }} />
              <col className="hidden lg:table-column" style={{ width: 68 }} />
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50 text-[10px] uppercase tracking-wider text-cockpit-muted whitespace-nowrap">
                <th className="text-center py-2.5 px-1 font-semibold bg-gray-50"></th>
                <th className="text-left py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("descricao")}>
                  <span className="inline-flex items-center gap-1">Produto <SortIcon field="descricao" /></span>
                </th>
                <th className="text-center py-2.5 px-1 font-semibold bg-gray-50 hidden lg:table-cell">Cat.</th>
                <th className="text-left py-2.5 px-1 font-semibold bg-gray-50 hidden xl:table-cell">Grupo SAP</th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("estoqueTotal")}>
                  <span className="inline-flex items-center gap-1 justify-end">Estoque <SortIcon field="estoqueTotal" /></span>
                </th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("disponivel")}>
                  <span className="inline-flex items-center gap-1 justify-end">Disp. <SortIcon field="disponivel" /></span>
                </th>
                <th className="text-center py-2.5 px-1 font-semibold bg-gray-50 hidden sm:table-cell">Saúde</th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("qtdVendida")}>
                  <span className="inline-flex items-center gap-1 justify-end">Saída <SortIcon field="qtdVendida" /></span>
                </th>
                <th className="text-right py-2.5 px-1 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50 hidden md:table-cell" onClick={() => toggleSort("coberturaDias")}>
                  <span className="inline-flex items-center gap-1 justify-end">Cobert. <SortIcon field="coberturaDias" /></span>
                </th>
                <th className="text-center py-2.5 px-1 font-semibold bg-gray-50 hidden lg:table-cell">Giro</th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("fatVendido")}>
                  <span className="inline-flex items-center gap-1 justify-end">Fat. <SortIcon field="fatVendido" /></span>
                </th>
              </tr>
            </thead>
            {paginatedItems.length === 0 ? (
              <tbody><tr><td colSpan={11} className="py-12 text-center text-cockpit-muted">
                <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">Nenhum item encontrado</p>
              </td></tr></tbody>
            ) : paginatedItems.map((item, idx) => {
                const gs = GIRO_CFG[item.giro];
                const cobS = COB_CFG[item.coberturaClass];
                const catCfg = CATEGORY_CFG[item.categoria];
                const isExpanded = expandedSku === item.sku;
                const GiroIcon = gs.icon;
                const rowBg = item.belowMinStock ? "bg-red-50/40" : item.curva === "A" && item.coberturaClass === "critico" ? "bg-red-50/20" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30";

                return (
                  <tbody key={item.sku}>
                    <tr
                      className={`group border-b border-cockpit-border/10 hover:bg-cockpit-accent/[0.03] motion-safe:transition-colors cursor-pointer ${rowBg}`}
                      onClick={() => setExpandedSku(isExpanded ? null : item.sku)}>
                      <td className="py-2.5 px-1 text-center">
                        <span className="inline-block w-6 text-center py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: CURVA_COLORS[item.curva] }}>{item.curva}</span>
                      </td>
                      <td className="py-2.5 px-2 overflow-hidden">
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-gray-900 truncate leading-tight" title={item.descricao}>{toTitleCase(item.descricao)}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                              {item.sku}
                              {item.skuCount > 1 && <span className="ml-1 px-1 py-0 rounded bg-blue-50 text-blue-600 font-bold text-[9px]">{item.skuCount} SKUs</span>}
                            </p>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 motion-safe:transition-transform group-hover:text-gray-600 ${isExpanded ? "rotate-180 text-cockpit-accent" : ""}`} />
                        </div>
                      </td>
                      <td className="py-2.5 px-1 text-center hidden lg:table-cell">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border ${catCfg.color} truncate`} style={{ borderColor: "currentColor", opacity: 0.8 }}>{catCfg.label}</span>
                      </td>
                      <td className="py-2.5 px-1 hidden xl:table-cell">
                        {item.itemGroupName ? (
                          <span className="text-[10px] text-indigo-600 font-medium truncate block max-w-[96px]" title={item.itemGroupName}>{item.itemGroupName}</span>
                        ) : <span className="text-[10px] text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-600 font-medium">{fmtNum(item.estoqueTotal)}</td>
                      <td className={`py-2.5 px-2 text-right tabular-nums font-semibold ${item.belowMinStock || item.disponivel <= 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {fmtNum(item.disponivel)}
                        {item.belowMinStock && <AlertTriangle className="inline w-3 h-3 ml-0.5 text-red-500 -mt-0.5" />}
                      </td>
                      <td className="py-2.5 px-1 hidden sm:table-cell">
                        <StockBar total={item.estoqueTotal} available={item.disponivel} minStock={item.minStock} />
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {item.qtdVendida > 0 ? (
                          <div>
                            <span className="text-gray-900 font-bold">{fmtNum(item.qtdVendida)}</span>
                            {item.numPedidos > 0 && <span className="block text-[9px] text-gray-400">{fmtNum(item.numPedidos)} ped.</span>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-1 text-right hidden md:table-cell">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cobS.bg} ${cobS.text}`}>
                          {item.coberturaDias >= 999 ? "∞" : `${item.coberturaDias.toFixed(0)}d`}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-center hidden lg:table-cell">
                        <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium ${gs.bg} ${gs.text}`}>
                          <GiroIcon className="w-2.5 h-2.5" />{gs.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        <span className={item.fatVendido > 0 ? "text-cockpit-accent font-semibold" : "text-gray-300"}>
                          {item.fatVendido > 0 ? fmtBRL(item.fatVendido) : "—"}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={11} className="px-4 py-3 border-b border-cockpit-border/20">
                          {/* Quantidades */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px]">
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Estoque (SAP)</p>
                              <p className="font-bold text-gray-800 tabular-nums">{fmtNum(item.estoqueTotal)} un</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Confirmado</p>
                              <p className="font-bold text-amber-600 tabular-nums">{item.confirmado > 0 ? fmtNum(item.confirmado) : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Disponível</p>
                              <p className={`font-bold tabular-nums ${item.disponivel <= 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtNum(item.disponivel)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Em Pedido (Fornec.)</p>
                              <p className="font-bold text-sky-600 tabular-nums">{item.emPedido > 0 ? fmtNum(item.emPedido) : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Est. Mínimo / Máximo</p>
                              <p className={`font-bold tabular-nums ${item.belowMinStock ? "text-red-600" : "text-gray-600"}`}>
                                {item.minStock > 0 ? fmtNum(item.minStock) : "—"} / {item.maxStock > 0 ? fmtNum(item.maxStock) : "—"}
                                {item.belowMinStock && <span className="text-red-500 text-[9px] ml-1">Abaixo</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Média Diária</p>
                              <p className="font-bold text-gray-800 tabular-nums">{item.mediaDiaria > 0 ? `${item.mediaDiaria.toFixed(1)} un/dia` : "Sem saída"}</p>
                            </div>
                          </div>

                          {/* Dados financeiros e logísticos (SAP enriquecido) */}
                          {(item.avgPrice > 0 || item.lastPurchasePrice > 0 || item.leadTime > 0 || item.grossWeight > 0) && (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-200/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px]">
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5 flex items-center gap-1"><Wallet className="w-2.5 h-2.5" />Custo Médio</p>
                                <p className="font-bold text-violet-700 tabular-nums">{item.avgPrice > 0 ? fmtBRL(item.avgPrice) : "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Valor em Estoque</p>
                                <p className="font-bold text-violet-700 tabular-nums">{item.valorEstoque > 0 ? fmtBRL(item.valorEstoque) : "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Últ. Preço Compra</p>
                                <p className="font-bold text-gray-700 tabular-nums">{item.lastPurchasePrice > 0 ? fmtBRL(item.lastPurchasePrice) : "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5 flex items-center gap-1"><Truck className="w-2.5 h-2.5" />Lead Time</p>
                                <p className="font-bold text-gray-700 tabular-nums">{item.leadTime > 0 ? `${item.leadTime} dias` : "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5 flex items-center gap-1"><Weight className="w-2.5 h-2.5" />Peso Bruto</p>
                                <p className="font-bold text-gray-700 tabular-nums">{item.grossWeight > 0 ? `${item.grossWeight.toFixed(3)} kg` : "—"}</p>
                              </div>
                              {item.itemGroupName && (
                                <div>
                                  <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Grupo SAP</p>
                                  <p className="font-bold text-gray-700">{item.itemGroupName}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Datas */}
                          {(item.lastPurchaseDate || item.lastSaleDate || item.lastCountDate) && (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-200/60 flex flex-wrap gap-4 text-[11px]">
                              {item.lastPurchaseDate && (
                                <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />Últ. Compra: <strong className="text-gray-700">{item.lastPurchaseDate}</strong></span>
                              )}
                              {item.lastSaleDate && (
                                <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />Últ. Venda: <strong className="text-gray-700">{item.lastSaleDate}</strong></span>
                              )}
                              {item.lastCountDate && (
                                <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />Últ. Contagem: <strong className="text-gray-700">{item.lastCountDate}</strong></span>
                              )}
                            </div>
                          )}

                          {item.skuCount > 1 && (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-200/60">
                              <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-1">Embalagens Agrupadas ({item.skuCount} SKUs)</p>
                              <div className="flex flex-wrap gap-1.5">
                                {item.embalas.map((e) => (
                                  <span key={e} className="px-2 py-0.5 rounded bg-white border border-gray-200 text-[10px] text-gray-600 font-medium">{e}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(item.numPedidos > 0 || item.numClientes > 0) && (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-200/60 flex flex-wrap gap-4 text-[11px]">
                              <span className="text-gray-500">Pedidos: <strong className="text-indigo-700">{fmtNum(item.numPedidos)}</strong></span>
                              <span className="text-gray-500">Clientes: <strong className="text-indigo-700">{fmtNum(item.numClientes)}</strong></span>
                              <span className="text-gray-500">Cobertura: <strong className={cobS.text}>{item.coberturaDias >= 999 ? "∞" : `${item.coberturaDias.toFixed(0)} dias`}</strong></span>
                              <span className={`text-gray-500`}>Categoria: <strong className={catCfg.color}>{catCfg.label}</strong></span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
          </table>
        </div>

        {/* Pagination + footer totals */}
        {filtered.length > 0 && (
          <div className="border-t border-cockpit-border bg-gray-50/80">
            {/* Pagination controls */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-cockpit-border/50">
              <p className="text-[11px] text-cockpit-muted tabular-nums">
                {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={safePage <= 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors">
                  <ChevronsLeft className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button onClick={() => goToPage(safePage - 1)} disabled={safePage <= 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) { pageNum = i + 1; }
                  else if (safePage <= 4) { pageNum = i + 1; }
                  else if (safePage >= totalPages - 3) { pageNum = totalPages - 6 + i; }
                  else { pageNum = safePage - 3 + i; }
                  return (
                    <button key={pageNum} onClick={() => goToPage(pageNum)}
                      className={`min-w-[28px] h-7 rounded text-[11px] font-medium motion-safe:transition-colors ${
                        pageNum === safePage ? "bg-cockpit-accent text-white" : "text-gray-500 hover:bg-gray-200"
                      }`}>{pageNum}</button>
                  );
                })}
                <button onClick={() => goToPage(safePage + 1)} disabled={safePage >= totalPages}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button onClick={() => goToPage(totalPages)} disabled={safePage >= totalPages}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors">
                  <ChevronsRight className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            </div>
            {/* Footer totals */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 text-xs gap-1">
              <span className="text-cockpit-muted">{filtered.length} produtos · {filtered.reduce((s, i) => s + i.skuCount, 0)} SKUs</span>
              <div className="flex items-center gap-3 tabular-nums flex-wrap">
                <span className="text-gray-500">Est: <strong className="text-gray-800">{fmtNum(filtered.reduce((s, i) => s + i.estoqueTotal, 0))}</strong></span>
                <span className="text-emerald-700">Disp: <strong>{fmtNum(filtered.reduce((s, i) => s + i.disponivel, 0))}</strong></span>
                <span className="text-violet-600">Valor: <strong>{fmtBRL(filtered.reduce((s, i) => s + i.valorEstoque, 0))}</strong></span>
                <span className="text-gray-500">Saída: <strong className="text-gray-800">{fmtNum(filtered.reduce((s, i) => s + i.qtdVendida, 0))}</strong></span>
                <span className="text-cockpit-accent font-bold">{fmtBRL(filtered.reduce((s, i) => s + i.fatVendido, 0))}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="text-center text-[10px] text-cockpit-muted py-2">
        Dados SAP B1 sincronizados · {ordData?.total ?? 0} pedidos · {totalDays} dias · Produtos agrupados por embalagem
      </footer>
    </div>
  );
}
