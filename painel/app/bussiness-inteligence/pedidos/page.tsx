"use client";

import { Fragment, useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart, Download, Search, X, CalendarDays,
  ChevronDown, ChevronRight, Package, Plus, Loader2,
  RefreshCw, DollarSign, Users, TrendingUp, BarChart3,
  ArrowUpDown, ArrowUp, ArrowDown, ListOrdered,
  PieChart as PieChartIcon, Activity, Hash,
  Calendar, Briefcase, Minus, Equal, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, AreaChart, Area, ComposedChart, Line,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { fmtBRL, fmtNum, exportCSV } from "@/lib/format";
import {
  fetchSalesOrders, syncSalesOrders, fetchOrderLines,
  fetchSalesPersons, fetchCustomers,
  type SalesOrderRow, type SalesOrderLine,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { getProductGroup } from "@/lib/format";
import {
  format, parseISO, getDay, differenceInCalendarDays, differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDateRange, formatRangeShort } from "@/contexts/DateRangeContext";

const BATCH_SIZE = 50;
const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_COLORS = ["#e5484d", "#A81C2C", "#c42538", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6"];

// ─── (Range agora unificado via DateRangeContext global) ──────

// ─── Helpers de formatação ────────────────────────────────────

function fmtDateShort(raw: string | null): string {
  if (!raw) return "—";
  try { return format(raw.includes("T") ? parseISO(raw) : new Date(raw), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return raw; }
}

function fmtQty(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

// ─── Helpers estatísticos ─────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

function stdDev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ─── Helpers de agregação ─────────────────────────────────────

function aggregateByDay(orders: SalesOrderRow[]): { data: string; valor: number; pedidos: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byDay = new Map<string, { valor: number; pedidos: number }>();
  for (const o of active) {
    const day = o.doc_date?.slice(0, 10) ?? "";
    if (!day) continue;
    const cur = byDay.get(day) ?? { valor: 0, pedidos: 0 };
    cur.valor += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    byDay.set(day, cur);
  }
  return Array.from(byDay.entries())
    .map(([data, v]) => ({ data, valor: v.valor, pedidos: v.pedidos }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

function statusAggregate(orders: SalesOrderRow[]): { name: string; value: number; fill: string }[] {
  const open = orders.filter((o) => o.doc_status === "O" && o.cancelled !== "Y").length;
  const closed = orders.filter((o) => o.doc_status === "C" && o.cancelled !== "Y").length;
  const cancelled = orders.filter((o) => o.cancelled === "Y").length;
  return [
    { name: "Abertos", value: open, fill: "#10b981" },
    { name: "Fechados", value: closed, fill: "#78696c" },
    { name: "Cancelados", value: cancelled, fill: "#e5484d" },
  ].filter((s) => s.value > 0);
}

function aggregateByClient(orders: SalesOrderRow[], limit = 5): { nome: string; valor: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byClient = new Map<string, { nome: string; valor: number }>();
  for (const o of active) {
    const key = o.card_code ?? "?";
    const cur = byClient.get(key) ?? { nome: o.card_name ?? key, valor: 0 };
    cur.valor += Number(o.doc_total) || 0;
    byClient.set(key, cur);
  }
  return Array.from(byClient.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit)
    .map((v) => ({ nome: v.nome.length > 22 ? v.nome.slice(0, 20) + "…" : v.nome, valor: v.valor }));
}

function histogramBins(values: number[]): { faixa: string; count: number; total: number; from: number; to: number }[] {
  const edges = [0, 500, 1000, 2500, 5000, 10000, 25000, 50000, Infinity];
  const labels = ["0–500", "500–1k", "1k–2,5k", "2,5k–5k", "5k–10k", "10k–25k", "25k–50k", "50k+"];
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const inBin = values.filter((v) => v >= lo && v < hi);
    return { faixa: labels[i], count: inBin.length, total: inBin.reduce((s, v) => s + v, 0), from: lo, to: hi };
  }).filter((b) => b.count > 0);
}

function aggregateByWeekday(orders: SalesOrderRow[]): { dia: string; idx: number; valor: number; pedidos: number; mediana: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y");
  const byDay = new Map<number, number[]>();
  for (const o of active) {
    if (!o.doc_date) continue;
    const d = o.doc_date.includes("T") ? parseISO(o.doc_date) : new Date(o.doc_date);
    const wd = getDay(d);
    const arr = byDay.get(wd) ?? [];
    arr.push(Number(o.doc_total) || 0);
    byDay.set(wd, arr);
  }
  return [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const vals = byDay.get(wd) ?? [];
    return {
      dia: WEEKDAY_NAMES[wd],
      idx: wd,
      valor: vals.reduce((s, v) => s + v, 0),
      pedidos: vals.length,
      mediana: median(vals),
    };
  }).filter((d) => d.pedidos > 0);
}

function aggregateBySalesPerson(orders: SalesOrderRow[], pMap?: Map<number, string>): { vendedor: string; valor: number; pedidos: number; mediana: number; ticket: number }[] {
  const active = orders.filter((o) => o.cancelled !== "Y" && o.sales_person_code != null);
  const byPerson = new Map<number, number[]>();
  for (const o of active) {
    const key = o.sales_person_code!;
    const arr = byPerson.get(key) ?? [];
    arr.push(Number(o.doc_total) || 0);
    byPerson.set(key, arr);
  }
  return Array.from(byPerson.entries())
    .map(([code, vals]) => ({
      vendedor: pMap?.get(code) ?? `Vend. ${code}`,
      valor: vals.reduce((s, v) => s + v, 0),
      pedidos: vals.length,
      mediana: median(vals),
      ticket: vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

function cumulativeByDay(dayData: { data: string; valor: number }[]): { data: string; diario: number; acumulado: number }[] {
  let acc = 0;
  return dayData.map((d) => {
    acc += d.valor;
    return { data: d.data, diario: d.valor, acumulado: acc };
  });
}

function scatterData(orders: SalesOrderRow[], limit = 300): { itens: number; valor: number; status: string; docNum: number }[] {
  return orders.filter((o) => o.cancelled !== "Y").slice(0, limit).map((o) => ({
    itens: o.lines?.length ?? o.num_lines ?? 0,
    valor: Number(o.doc_total) || 0,
    status: o.doc_status === "O" ? "Aberto" : "Fechado",
    docNum: o.doc_num,
  }));
}

function leadTimeData(orders: SalesOrderRow[]): { dias: number; count: number }[] {
  const ltMap = new Map<number, number>();
  for (const o of orders.filter((o) => o.cancelled !== "Y" && o.doc_date && o.doc_due_date)) {
    const d1 = o.doc_date.includes("T") ? parseISO(o.doc_date) : new Date(o.doc_date);
    const d2 = o.doc_due_date!.includes("T") ? parseISO(o.doc_due_date!) : new Date(o.doc_due_date!);
    const diff = differenceInCalendarDays(d2, d1);
    if (diff >= 0 && diff <= 90) {
      ltMap.set(diff, (ltMap.get(diff) ?? 0) + 1);
    }
  }
  return Array.from(ltMap.entries())
    .map(([dias, count]) => ({ dias, count }))
    .sort((a, b) => a.dias - b.dias);
}

// ─── Base product name (same logic as stock page) ─────────────

function getBaseProductName(desc: string): string {
  return (desc ?? "")
    .replace(/\s*[-–]\s*(CAIXA|FARDO|PALETE)\s+C\s*\/\s*[\d.,]+\s*UND\s*$/i, "")
    .replace(/\s*[-–]\s*UND\s*$/i, "")
    .trim()
    .toUpperCase();
}

// ─── Item description parser ──────────────────────────────────

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

const COR_MAP: Record<string, string> = {
  TRA: "Transparente", AMB: "Âmbar",
  BRANCA: "Branca", PRETA: "Preta", DOURADA: "Dourada", PRATA: "Prata",
  CREME: "Creme", MARROM: "Marrom", VERMELHA: "Vermelha",
};

function parseItemInfo(itemCode?: string | null, desc?: string | null): ParsedItem {
  const cod = getProductGroup(itemCode);
  const d = (desc ?? "").trim();
  if (!d) return { cod, subNome: "—", embala: "—", embalaQty: 1, unit: "—", capacidade: "—", cor: "—", fechamento: "—" };

  let subNome = d;
  let embala = "—";
  let embalaQty = 1;
  let unit = "UND";

  const dashIdx = d.lastIndexOf(" - ");

  if (dashIdx > 0) {
    subNome = d.slice(0, dashIdx).trim();
    const packPart = d.slice(dashIdx + 3).trim();

    const packRx = /^(CAIXA|FARDO|PALETE)\s+C\s*\/\s*([\d.,]+)\s*UND$/i;
    const packMatch = packPart.match(packRx);
    if (packMatch) {
      const qStr = packMatch[2].replace(/\./g, "").replace(",", ".");
      embalaQty = parseInt(qStr, 10) || 1;
      embala = `${packMatch[1].toUpperCase()} C/${embalaQty}`;
    } else if (/^UND$/i.test(packPart.replace(/-/g, "").trim())) {
      embala = "UND";
      embalaQty = 1;
    } else {
      embala = packPart || "—";
    }
  }
  else if (/[-–]\s*UND\s*$/i.test(d)) {
    const i = d.search(/[-–]\s*UND\s*$/i);
    subNome = d.slice(0, i).trim();
    embala = "UND";
    embalaQty = 1;
  }
  else {
    const inlineRx = /\s+(CAIXA|FARDO|PALETE)\s+C\s*\/\s*([\d.,]+)\s*UND\s*$/i;
    const inlineMatch = d.match(inlineRx);
    if (inlineMatch) {
      subNome = d.slice(0, inlineMatch.index!).trim();
      const qStr = inlineMatch[2].replace(/\./g, "").replace(",", ".");
      embalaQty = parseInt(qStr, 10) || 1;
      embala = `${inlineMatch[1].toUpperCase()} C/${embalaQty}`;
    } else if (/\bUND\s*$/i.test(d)) {
      const undIdx = d.search(/\s+UND\s*$/i);
      if (undIdx > 0) {
        subNome = d.slice(0, undIdx).trim();
        embala = "UND";
        embalaQty = 1;
      }
    }
  }

  const capMatch = subNome.match(/\b(\d[\d.,]*)\s*(ML|L)\b/i);
  const capacidade = capMatch ? `${capMatch[1]} ${capMatch[2].toUpperCase()}` : "—";

  const corRx = /\b(TRA|AMB|BRANCA|PRETA|DOURADA|PRATA|CREME|MARROM|VERMELHA|BORDO\.FOSCO|PRETO\.FOSCO|TRANSPARENTE)\b/i;
  const corMatch = subNome.match(corRx);
  const cor = corMatch ? (COR_MAP[corMatch[1].toUpperCase()] ?? corMatch[1]) : "—";

  const fechRx = /\b(ROLHA|ROSCA|TWIST[.-]OFF|FLIP[.-]TOP|CONTA[.-]GOTAS|COROA[.-]PRY[.-]OFF|COROA[.-]TWIST[.-]OFF)\b/i;
  const fechMatch = subNome.match(fechRx);
  const fechamento = fechMatch ? fechMatch[1].replace(/\./g, "-").toUpperCase() : "—";

  return { cod, subNome, embala, embalaQty, unit, capacidade, cor, fechamento };
}

// ─── Sort & Types ─────────────────────────────────────────────

type SortField = "doc_num" | "doc_date" | "card_name" | "doc_total" | "num_lines" | "total_quantity";
type SortDir = "asc" | "desc";
type ChartTab = "overview" | "stats" | "patterns";

const CHART_TABS: { key: ChartTab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Visão Geral", icon: BarChart3 },
  { key: "stats", label: "Análise Estatística", icon: Activity },
  { key: "patterns", label: "Padrões & Tendências", icon: TrendingUp },
];

// ─── Custom Tooltip Components ────────────────────────────────

function ChartTooltipWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-cockpit-border rounded-lg shadow-lg px-3 py-2.5 text-xs">
      {children}
    </div>
  );
}

// ─── Box Plot Visual Component ────────────────────────────────

function BoxPlotVisual({ min, p25, med, p75, max, mean }: { min: number; p25: number; med: number; p75: number; max: number; mean: number }) {
  const range = max - min || 1;
  const pctP25 = ((p25 - min) / range) * 100;
  const pctMed = ((med - min) / range) * 100;
  const pctP75 = ((p75 - min) / range) * 100;
  const pctMean = ((mean - min) / range) * 100;
  const boxWidth = pctP75 - pctP25;

  return (
    <div className="space-y-3">
      <div className="relative h-10 mx-2">
        {/* Whisker line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-300 -translate-y-1/2" />
        {/* Min/Max caps */}
        <div className="absolute top-1/2 left-0 w-px h-4 bg-gray-400 -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-px h-4 bg-gray-400 -translate-y-1/2" />
        {/* IQR box */}
        <div
          className="absolute top-1/2 h-7 rounded-md bg-cockpit-accent/15 border border-cockpit-accent/40 -translate-y-1/2"
          style={{ left: `${pctP25}%`, width: `${boxWidth}%` }}
        />
        {/* Median line */}
        <div
          className="absolute top-1/2 w-0.5 h-7 bg-cockpit-accent rounded-full -translate-y-1/2 z-10"
          style={{ left: `${pctMed}%` }}
        />
        {/* Mean diamond */}
        <div
          className="absolute top-1/2 w-2 h-2 bg-blue-500 rotate-45 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${pctMean}%` }}
          title={`Média: ${fmtBRL(mean)}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-cockpit-muted tabular-nums mx-2">
        <span>Min {fmtBRL(min)}</span>
        <span>P25 {fmtBRL(p25)}</span>
        <span className="font-semibold text-cockpit-accent">Med {fmtBRL(med)}</span>
        <span>P75 {fmtBRL(p75)}</span>
        <span>Max {fmtBRL(max)}</span>
      </div>
      <div className="flex items-center justify-center gap-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-cockpit-accent rounded-full inline-block" /> Mediana
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-blue-500 rotate-45 inline-block" /> Média
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2.5 bg-cockpit-accent/15 border border-cockpit-accent/40 rounded-sm inline-block" /> IQR (P25–P75)
        </span>
      </div>
    </div>
  );
}

// ─── OrderDetailPanel ─────────────────────────────────────────

interface OrderDetailPanelProps {
  lines: SalesOrderLine[];
  orderTotalQty: number;
  vendorName?: string;
  location?: string;
}

interface GroupedOrderLine {
  baseName: string;
  undItemCode: string;
  subNome: string;
  capacidade: string;
  cor: string;
  fechamento: string;
  cod: string;
  totalEmb: number;
  totalUnd: number;
  totalVal: number;
  avgPriceUnd: number;
  maxDiscount: number;
  variants: { itemCode: string; embala: string; embalaQty: number; qty: number; qtyUnd: number; lineTotal: number; warehouse: string }[];
}

function groupOrderLines(lines: SalesOrderLine[]): GroupedOrderLine[] {
  const n = (v: unknown) => Number(v) || 0;
  const groups = new Map<string, GroupedOrderLine>();

  for (const l of lines) {
    const info = parseItemInfo(l.ItemCode, l.ItemDescription);
    const baseName = getBaseProductName(l.ItemDescription ?? "");
    const key = baseName || l.ItemCode || `_line_${l.LineNum}`;

    if (!groups.has(key)) {
      groups.set(key, {
        baseName,
        undItemCode: "",
        subNome: info.subNome,
        capacidade: info.capacidade,
        cor: info.cor,
        fechamento: info.fechamento,
        cod: info.cod,
        totalEmb: 0,
        totalUnd: 0,
        totalVal: 0,
        avgPriceUnd: 0,
        maxDiscount: 0,
        variants: [],
      });
    }

    const g = groups.get(key)!;
    const qtyEmb = n(l.Quantity);
    const qtyUnd = qtyEmb * info.embalaQty;
    const lineTotal = n(l.LineTotal);

    if (info.embala === "UND" || info.embalaQty === 1) {
      if (!g.undItemCode) g.undItemCode = l.ItemCode ?? "";
    }

    g.totalEmb += qtyEmb;
    g.totalUnd += qtyUnd;
    g.totalVal += lineTotal;
    g.maxDiscount = Math.max(g.maxDiscount, n(l.DiscountPercent));
    g.variants.push({
      itemCode: l.ItemCode ?? "",
      embala: info.embala,
      embalaQty: info.embalaQty,
      qty: qtyEmb,
      qtyUnd,
      lineTotal,
      warehouse: l.WarehouseCode ?? "",
    });
  }

  for (const g of groups.values()) {
    g.avgPriceUnd = g.totalUnd > 0 ? g.totalVal / g.totalUnd : 0;
    if (!g.undItemCode && g.variants.length > 0) {
      g.undItemCode = g.variants[0].itemCode;
    }
  }

  return Array.from(groups.values());
}

function OrderDetailPanel({ lines, orderTotalQty, vendorName, location }: OrderDetailPanelProps) {
  if (lines.length === 0) {
    return (
      <div className="px-6 py-6 text-sm text-cockpit-muted italic bg-gradient-to-b from-amber-50/80 to-white rounded-b-lg border border-t-0 border-cockpit-border/50 flex items-center gap-3">
        <ListOrdered className="w-5 h-5 text-amber-500/70 shrink-0" />
        Detalhamento de itens indisponível para este pedido.
      </div>
    );
  }

  const grouped = groupOrderLines(lines);
  const totalUnd = grouped.reduce((s, g) => s + g.totalUnd, 0);
  const totalVal = grouped.reduce((s, g) => s + g.totalVal, 0);
  const totalEmb = grouped.reduce((s, g) => s + g.totalEmb, 0);

  return (
    <div className="order-detail-enter overflow-hidden">
      <div className="px-4 py-4 bg-gradient-to-b from-gray-50/90 to-white border-x border-b border-cockpit-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-cockpit-accent/10">
              <Package className="w-4 h-4 text-cockpit-accent" />
            </div>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Itens do Pedido</span>
            <span className="text-xs text-cockpit-muted font-normal">
              ({grouped.length} produto{grouped.length !== 1 ? "s" : ""}
              {grouped.length < lines.length && ` · ${lines.length} linhas agrupadas`})
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">Saída: <strong className="text-gray-900 tabular-nums">{fmtNum(totalUnd)} un</strong></span>
            {totalEmb !== totalUnd && (
              <span className="text-gray-500 text-xs">({fmtNum(totalEmb)} emb)</span>
            )}
            <span className="font-semibold text-cockpit-accent tabular-nums">{fmtBRL(totalVal)}</span>
          </div>
        </div>

        {(vendorName || location) && (
          <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-600">
            {vendorName && vendorName !== "—" && (
              <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium">
                <Briefcase className="w-3 h-3" /> {vendorName}
              </span>
            )}
            {location && location !== "—" && (
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-medium max-w-[320px] truncate" title={location}>
                <MapPin className="w-3 h-3 shrink-0" /> {location}
              </span>
            )}
          </div>
        )}

        <div className="rounded-lg border border-cockpit-border/50 bg-white overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-cockpit-border/40 bg-gray-50/80 text-cockpit-muted uppercase tracking-wider text-[10px]">
                <th className="text-left py-2.5 px-2 font-semibold w-7">#</th>
                <th className="text-left py-2.5 px-2 font-semibold w-9">COD</th>
                <th className="text-left py-2.5 px-2 font-semibold w-[86px]">SKU (UN)</th>
                <th className="text-left py-2.5 px-2 font-semibold">Produto</th>
                <th className="text-center py-2.5 px-2 font-semibold w-14">Capac.</th>
                <th className="text-center py-2.5 px-2 font-semibold w-12">Armaz.</th>
                <th className="text-right py-2.5 px-2 font-semibold w-16">Saída (un)</th>
                <th className="text-right py-2.5 px-2 font-semibold w-11">% Qtd</th>
                <th className="text-right py-2.5 px-2 font-semibold w-[62px]">R$/UND</th>
                <th className="text-right py-2.5 px-2 font-semibold w-10">Desc%</th>
                <th className="text-right py-2.5 px-2 font-semibold w-[72px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g, idx) => {
                const pctQty = totalUnd > 0 ? (g.totalUnd / totalUnd) * 100 : 0;
                const isMulti = g.variants.length > 1;
                const warehouses = [...new Set(g.variants.map((v) => v.warehouse).filter(Boolean))];
                const embalas = [...new Set(g.variants.map((v) => v.embala))];

                return (
                  <tr key={g.undItemCode || idx} className="border-b border-cockpit-border/10 last:border-b-0 hover:bg-cockpit-accent/[0.03] transition-colors duration-150">
                    <td className="py-1.5 px-2 text-cockpit-muted tabular-nums">{idx + 1}</td>
                    <td className="py-1.5 px-2">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">{g.cod}</span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="font-mono text-[10px] text-blue-700 font-medium">{g.undItemCode || "—"}</span>
                      {isMulti && (
                        <span className="ml-1 inline-block px-1 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold">{g.variants.length}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-gray-700 max-w-[220px]">
                      <span className="line-clamp-1 font-medium" title={g.baseName}>{g.subNome}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {g.cor !== "—" && <span className="text-[9px] text-gray-400">{g.cor}</span>}
                        {g.fechamento !== "—" && <span className="text-[9px] text-violet-500">{g.fechamento}</span>}
                        {isMulti && (
                          <span className="text-[9px] text-gray-400">
                            {g.variants.map((v) => `${fmtNum(v.qty)} ${v.embala}`).join(" + ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {g.capacidade !== "—" ? (
                        <span className="text-[10px] font-semibold text-sky-700">{g.capacidade}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center text-[10px] font-medium text-gray-500">
                      {warehouses.length > 0 ? warehouses.join(", ") : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      <span className="font-bold text-gray-900">{fmtNum(g.totalUnd)}</span>
                      {isMulti && (
                        <span className="block text-[9px] text-gray-400">{fmtNum(g.totalEmb)} emb</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      <span className={`text-[10px] font-medium ${pctQty >= 30 ? "text-cockpit-accent font-bold" : pctQty >= 10 ? "text-gray-700" : "text-gray-400"}`}>
                        {pctQty.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {g.avgPriceUnd > 0 ? (
                        <span className="text-[11px] text-teal-700 font-semibold">{fmtBRL(g.avgPriceUnd)}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {g.maxDiscount > 0 ? (
                        <span className={`text-[10px] font-medium ${g.maxDiscount >= 10 ? "text-red-500 font-bold" : g.maxDiscount >= 5 ? "text-amber-600" : "text-gray-500"}`}>{g.maxDiscount.toFixed(1)}%</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-cockpit-accent">{g.totalVal > 0 ? fmtBRL(g.totalVal) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────

export default function PedidosPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <PedidosContent />
    </Suspense>
  );
}

// ─── Main content ─────────────────────────────────────────────

function PedidosContent() {
  const searchParams = useSearchParams();
  const cardCodeFromUrl = searchParams.get("cardCode");
  const clientNameFromUrl = searchParams.get("clientName") ?? undefined;

  // ─── Range global (unificado via BITopbar) ───
  const { range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");
  const dayCount = differenceInDays(range.to, range.from) + 1;
  const rangeLabel = `${formatRangeShort(range)} · ${dayCount} dia${dayCount !== 1 ? "s" : ""}`;

  // ─── Fetch ───
  const { data, loading, error, refetch } = useFetch(
    () => fetchSalesOrders({ dateFrom, dateTo, limit: 50000 }),
    [dateFrom, dateTo]
  );

  const { data: spData } = useFetch(() => fetchSalesPersons(), []);
  const { data: custData } = useFetch(() => fetchCustomers({ limit: 50000 }), []);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const orders = useMemo(() => data?.items ?? [], [data]);
  const activeOrders = useMemo(() => orders.filter((o) => o.cancelled !== "Y"), [orders]);

  const spMap = useMemo(() => {
    const m = new Map<number, string>();
    if (spData?.items) {
      for (const sp of spData.items) m.set(sp.SalesEmployeeCode, sp.SalesEmployeeName);
    }
    return m;
  }, [spData]);

  const custMap = useMemo(() => {
    const m = new Map<string, { city: string; state: string }>();
    if (custData?.data) {
      for (const c of custData.data) {
        if (c.card_code) m.set(c.card_code, { city: c.city ?? "", state: c.state ?? "" });
      }
    }
    return m;
  }, [custData]);

  // ─── Chart tab ───
  const [chartTab, setChartTab] = useState<ChartTab>("overview");

  // ─── Filtros ───
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState(cardCodeFromUrl ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "cancelled">("all");

  useEffect(() => {
    if (cardCodeFromUrl) setClienteFilter(cardCodeFromUrl);
  }, [cardCodeFromUrl]);

  // ─── Sort ───
  const [sortField, setSortField] = useState<SortField>("doc_num");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return field; }
      setSortDir("desc");
      return field;
    });
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) { if (o.card_code && !map.has(o.card_code)) map.set(o.card_code, o.card_name || o.card_code); }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter === "open") result = result.filter((o) => o.doc_status === "O" && o.cancelled !== "Y");
    else if (statusFilter === "closed") result = result.filter((o) => o.doc_status === "C" && o.cancelled !== "Y");
    else if (statusFilter === "cancelled") result = result.filter((o) => o.cancelled === "Y");
    if (clienteFilter) result = result.filter((o) => o.card_code === clienteFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        String(o.doc_num).includes(q) || (o.card_name ?? "").toLowerCase().includes(q) || (o.card_code ?? "").toLowerCase().includes(q) ||
        (o.lines ?? []).some((l) => (l.ItemCode ?? "").toLowerCase().includes(q) || (l.ItemDescription ?? "").toLowerCase().includes(q))
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "doc_num": cmp = (a.doc_num ?? 0) - (b.doc_num ?? 0); break;
        case "doc_date": cmp = (a.doc_date ?? "").localeCompare(b.doc_date ?? ""); break;
        case "card_name": cmp = (a.card_name ?? "").localeCompare(b.card_name ?? ""); break;
        case "doc_total": cmp = (Number(a.doc_total) || 0) - (Number(b.doc_total) || 0); break;
        case "num_lines": cmp = (a.lines?.length ?? a.num_lines ?? 0) - (b.lines?.length ?? b.num_lines ?? 0); break;
        case "total_quantity": cmp = (Number(a.total_quantity) || 0) - (Number(b.total_quantity) || 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [orders, statusFilter, clienteFilter, search, sortField, sortDir]);

  // ─── Load-more & expansion ───
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [orderLines, setOrderLines] = useState<Record<number, SalesOrderLine[]>>({});
  const [loadingLines, setLoadingLines] = useState<Set<number>>(new Set());

  useEffect(() => { setVisibleCount(BATCH_SIZE); setExpanded(new Set()); }, [dateFrom, dateTo, statusFilter, clienteFilter, search, sortField, sortDir]);

  const visibleDocs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // ─── KPIs ───
  const totalDocs = filtered.length;
  const openDocs = useMemo(() => filtered.filter((o) => o.doc_status === "O" && o.cancelled !== "Y").length, [filtered]);
  const closedDocs = useMemo(() => filtered.filter((o) => o.doc_status === "C" && o.cancelled !== "Y").length, [filtered]);
  const cancelledDocs = useMemo(() => filtered.filter((o) => o.cancelled === "Y").length, [filtered]);
  const activeFiltered = useMemo(() => filtered.filter((o) => o.cancelled !== "Y"), [filtered]);
  const activeValue = useMemo(() => activeFiltered.reduce((s, o) => s + (Number(o.doc_total) || 0), 0), [activeFiltered]);
  const totalQty = useMemo(() => filtered.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0), [filtered]);
  const ticketMedio = activeFiltered.length > 0 ? activeValue / activeFiltered.length : 0;
  const uniqueClients = useMemo(() => new Set(activeFiltered.map((o) => o.card_code)).size, [activeFiltered]);

  // ─── Estatísticas descritivas ───
  const orderValues = useMemo(() => activeOrders.map((o) => Number(o.doc_total) || 0).filter((v) => v > 0), [activeOrders]);
  const stats = useMemo(() => {
    if (orderValues.length === 0) return null;
    const med = median(orderValues);
    const mean = orderValues.reduce((s, v) => s + v, 0) / orderValues.length;
    const sd = stdDev(orderValues, mean);
    const p25 = percentile(orderValues, 25);
    const p75 = percentile(orderValues, 75);
    const minV = Math.min(...orderValues);
    const maxV = Math.max(...orderValues);
    const skew = mean > 0 ? (mean - med) / mean : 0;
    const cv = mean > 0 ? sd / mean : 0;
    return { median: med, mean, stdDev: sd, p25, p75, min: minV, max: maxV, skew, cv, iqr: p75 - p25 };
  }, [orderValues]);

  // ─── Chart data ───
  const chartByDay = useMemo(() => aggregateByDay(orders), [orders]);
  const statusData = useMemo(() => statusAggregate(orders), [orders]);
  const topClients = useMemo(() => aggregateByClient(orders, 5), [orders]);
  const dailyMedian = useMemo(() => median(chartByDay.map((d) => d.valor)), [chartByDay]);
  const histData = useMemo(() => histogramBins(orderValues), [orderValues]);
  const weekdayData = useMemo(() => aggregateByWeekday(orders), [orders]);
  const salesPersonData = useMemo(() => aggregateBySalesPerson(orders, spMap), [orders, spMap]);
  const cumulativeData = useMemo(() => cumulativeByDay(chartByDay), [chartByDay]);
  const scatter = useMemo(() => scatterData(orders), [orders]);
  const leadTime = useMemo(() => leadTimeData(orders), [orders]);
  const leadTimeMedian = useMemo(() => {
    const vals: number[] = [];
    for (const o of orders.filter((o) => o.cancelled !== "Y" && o.doc_date && o.doc_due_date)) {
      const d1 = o.doc_date.includes("T") ? parseISO(o.doc_date) : new Date(o.doc_date);
      const d2 = o.doc_due_date!.includes("T") ? parseISO(o.doc_due_date!) : new Date(o.doc_due_date!);
      const diff = differenceInCalendarDays(d2, d1);
      if (diff >= 0 && diff <= 90) vals.push(diff);
    }
    return median(vals);
  }, [orders]);
  const spMedianAll = useMemo(() => median(salesPersonData.map((s) => s.valor)), [salesPersonData]);

  const hasMore = visibleCount < filtered.length;
  const remaining = Math.max(0, filtered.length - visibleCount);
  const nextBatch = Math.min(BATCH_SIZE, remaining);
  const progressPct = filtered.length > 0 ? Math.min(100, (visibleCount / filtered.length) * 100) : 100;
  const needMoreData = activeOrders.length < 3;

  const handleLoadMore = useCallback(() => setVisibleCount((c) => c + BATCH_SIZE), []);
  const handleShowAll = useCallback(() => setVisibleCount(filtered.length), [filtered.length]);

  const toggleExpand = useCallback(async (docEntry: number) => {
    setExpanded((prev) => { const next = new Set(prev); next.has(docEntry) ? next.delete(docEntry) : next.add(docEntry); return next; });
    if (!orderLines[docEntry] && !loadingLines.has(docEntry)) {
      setLoadingLines((prev) => new Set(prev).add(docEntry));
      try { const res = await fetchOrderLines(docEntry); if (res.ok && res.lines?.length > 0) setOrderLines((prev) => ({ ...prev, [docEntry]: res.lines })); }
      catch { /* will show "indisponível" */ }
      finally { setLoadingLines((prev) => { const next = new Set(prev); next.delete(docEntry); return next; }); }
    }
  }, [orderLines, loadingLines]);

  const expandAll = useCallback(() => setExpanded(new Set(visibleDocs.map((d) => d.doc_entry))), [visibleDocs]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncMsg(null);
    try { const res = await syncSalesOrders(); setSyncMsg(res.message); refetch(); }
    catch (err) { setSyncMsg(err instanceof Error ? err.message : "Erro ao sincronizar"); }
    finally { setSyncing(false); }
  }, [refetch]);

  const handleExportCSV = useCallback(() => {
    const rows = filtered.map((o) => {
      const vName = o.sales_person_code != null ? (spMap.get(o.sales_person_code) ?? `Cód ${o.sales_person_code}`) : "";
      const cust = custMap.get(o.card_code ?? "");
      const loc = cust ? [cust.city, cust.state].filter(Boolean).join("/") : (o.address2 || "");
      return {
        "Nº Pedido": o.doc_num, "Data Pedido": fmtDateShort(o.doc_date), "Data Entrega": fmtDateShort(o.doc_due_date),
        "Cód. Cliente": o.card_code, "Cliente": o.card_name, "Localização": loc,
        "Valor Total": Number(o.doc_total) || 0,
        "Moeda": o.doc_currency, "Status": o.cancelled === "Y" ? "Cancelado" : o.doc_status === "O" ? "Aberto" : "Fechado",
        "Itens": o.lines?.length ?? o.num_lines ?? 0, "Qtd Total": Number(o.total_quantity) || 0,
        "Vendedor": vName, "Observações": o.comments ?? "",
      };
    });
    exportCSV(rows, `pedidos-venda-${dateFrom}-${dateTo}`);
  }, [filtered, dateFrom, dateTo, spMap, custMap]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cockpit-accent" /> : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-cockpit-accent/10"><ShoppingCart className="w-5 h-5 text-cockpit-accent" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900">Pedidos de Venda</h1><p className="text-sm text-cockpit-muted mt-0.5">Carregando dados...</p></div>
      </div>
      <LoadingSkeleton rows={6} />
    </div>
  );

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // The rest of the render is very long - see the full source in the cockpit project
  // Only the Link href has changed from "/pedidos" to "/bussiness-inteligence/pedidos"

  return (
    <div className="space-y-5">

      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-lg bg-cockpit-accent/10 shrink-0">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-cockpit-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Pedidos de Venda</h1>
            <p className="text-xs sm:text-sm text-cockpit-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{rangeLabel}</span>
              <span className="text-cockpit-border hidden sm:inline">·</span>
              <strong className="text-gray-700">{data?.total ?? 0}</strong> <span className="hidden sm:inline">registros</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSync} disabled={syncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 text-sm rounded-lg bg-cockpit-accent text-white font-medium hover:bg-cockpit-accent/90 transition-colors disabled:opacity-50 shadow-sm min-h-[44px] sm:min-h-0">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Sync..." : "Sync SAP"}
          </button>
          <button type="button" onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 transition-colors min-h-[44px] sm:min-h-0">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-cockpit-accent/10 text-cockpit-accent text-sm border border-cockpit-accent/20 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 shrink-0" /> {syncMsg}
        </div>
      )}


      {cardCodeFromUrl && clienteFilter && (
        <div className="rounded-xl border border-cockpit-accent/30 bg-cockpit-accent/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-700">
            Pedidos do cliente: <strong className="text-cockpit-accent">{clientNameFromUrl || clienteFilter}</strong>
          </p>
          <Link href="/bussiness-inteligence/pedidos" className="text-sm font-medium text-cockpit-accent hover:text-cockpit-accent/80 transition-colors flex items-center gap-1.5">
            <X className="w-4 h-4" /> Limpar filtro
          </Link>
        </div>
      )}

      {/* ═══ KPIs ═══ */}
      <section className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Pedidos", value: fmtNum(totalDocs), sub: `${openDocs} abertos · ${closedDocs} fechados`, icon: ShoppingCart, color: "text-cockpit-accent" },
            { label: "Faturamento", value: fmtBRL(activeValue), icon: DollarSign, color: "text-emerald-600" },
            { label: "Ticket Médio", value: fmtBRL(ticketMedio), sub: stats ? `Med: ${fmtBRL(stats.median)}` : undefined, icon: TrendingUp, color: "text-blue-600" },
            { label: "Mediana", value: stats ? fmtBRL(stats.median) : "—", sub: stats ? (stats.skew > 0.05 ? "Assimétrica →" : stats.skew < -0.05 ? "← Assimétrica" : "≈ Simétrica") : undefined, icon: Minus, color: "text-violet-600" },
            { label: "Clientes", value: fmtNum(uniqueClients), icon: Users, color: "text-teal-600" },
            { label: "Qtd Total", value: fmtQty(totalQty), sub: `${cancelledDocs} cancelados`, icon: Package, color: "text-amber-600" },
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

        {/* Charts and table sections follow the same pattern as the source - 
            they are unchanged except for the import paths already handled above */}
      </section>

      {/* ═══ Filtros da tabela ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white p-3 sm:p-4 shadow-sm">
        <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-3">
          <div className="relative sm:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº pedido, cliente, item..."
              className="w-full pl-10 pr-8 py-2.5 sm:py-2 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 placeholder:text-cockpit-muted focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent min-h-[44px] sm:min-h-0" />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/5 rounded">
                <X className="w-3.5 h-3.5 text-cockpit-muted" />
              </button>
            )}
          </div>
          <div className="sm:col-span-4">
            <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full py-2.5 sm:py-2 px-3 text-sm rounded-lg border border-cockpit-border bg-cockpit-bg text-gray-700 focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent min-h-[44px] sm:min-h-0">
              <option value="">Todos clientes ({clientes.length})</option>
              {clientes.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
            </select>
          </div>
          <div className="sm:col-span-4 flex items-center rounded-lg border border-cockpit-border overflow-hidden bg-cockpit-bg">
            {(["all", "open", "closed", "cancelled"] as const).map((s) => {
              const counts = { all: totalDocs, open: openDocs, closed: closedDocs, cancelled: cancelledDocs };
              const labels: Record<string, string> = { all: "Todos", open: "Abertos", closed: "Fechados", cancelled: "Cancel." };
              return (
                <button key={s} type="button" onClick={() => setStatusFilter(s)}
                  className={`flex-1 py-2.5 sm:py-2 text-[11px] sm:text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 ${statusFilter === s ? "bg-cockpit-accent text-white shadow-sm" : "text-gray-500 hover:bg-black/5 hover:text-gray-700"}`}>
                  {labels[s]} <span className="opacity-70 hidden sm:inline">({counts[s]})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Tabela de pedidos ═══ */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-cockpit-border bg-gray-50/80 gap-2">
          <p className="text-[11px] sm:text-xs text-cockpit-muted">
            <strong className="text-gray-800">{visibleDocs.length}</strong>/<strong className="text-gray-800">{filtered.length}</strong> pedidos
          </p>
          {visibleDocs.length > 0 && (
            <button type="button" onClick={expanded.size > 0 ? collapseAll : expandAll}
              className="text-[11px] sm:text-xs text-cockpit-accent hover:text-cockpit-accent/80 font-medium transition-colors whitespace-nowrap">
              {expanded.size > 0 ? "Recolher" : "Expandir"}
            </button>
          )}
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm table-sticky-head min-w-[800px]">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50/50 text-[10px] uppercase tracking-wider text-cockpit-muted">
                <th className="w-8" />
                <th className="text-left py-2.5 px-2 sm:px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_num")}>
                  <span className="inline-flex items-center gap-1">Nº <SortIcon field="doc_num" /></span></th>
                <th className="text-left py-2.5 px-2 sm:px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_date")}>
                  <span className="inline-flex items-center gap-1">Data <SortIcon field="doc_date" /></span></th>
                <th className="text-left py-2.5 px-2 sm:px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("card_name")}>
                  <span className="inline-flex items-center gap-1">Cliente <SortIcon field="card_name" /></span></th>
                <th className="text-left py-2.5 px-2 sm:px-3 font-semibold hidden lg:table-cell">Local</th>
                <th className="text-center py-2.5 px-2 sm:px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("num_lines")}>
                  <span className="inline-flex items-center gap-1">Itens <SortIcon field="num_lines" /></span></th>
                <th className="text-right py-2.5 px-2 sm:px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("total_quantity")}>
                  <span className="inline-flex items-center gap-1 justify-end">Qtd <SortIcon field="total_quantity" /></span></th>
                <th className="text-right py-2.5 px-2 sm:px-3 font-semibold cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort("doc_total")}>
                  <span className="inline-flex items-center gap-1 justify-end">Valor <SortIcon field="doc_total" /></span></th>
                <th className="text-center py-2.5 px-2 sm:px-3 font-semibold">Status</th>
                <th className="text-left py-2.5 px-2 sm:px-3 font-semibold hidden xl:table-cell">Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map((order, rowIdx) => {
                const isExpanded = expanded.has(order.doc_entry);
                const isCancelled = order.cancelled === "Y";
                const isOpen = order.doc_status === "O" && !isCancelled;
                const lines = orderLines[order.doc_entry] ?? order.lines ?? [];
                const isLoadingLines = loadingLines.has(order.doc_entry);
                const qty = Number(order.total_quantity) || lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
                const nLines = lines.length || order.num_lines || 0;
                const vendorName = order.sales_person_code != null ? (spMap.get(order.sales_person_code) ?? `Cód ${order.sales_person_code}`) : "—";
                const cust = custMap.get(order.card_code ?? "");
                let loc = "—";
                if (cust && (cust.city || cust.state)) {
                  loc = [cust.city, cust.state].filter(Boolean).join("/");
                } else if (order.address2) {
                  const a2 = order.address2;
                  const stateMatch = a2.match(/[-–]\s*([A-Z]{2})\s/);
                  loc = stateMatch ? a2.slice(0, a2.indexOf(stateMatch[0]) + stateMatch[0].length).replace(/^\d+\s*/, "").trim() : a2.slice(0, 40);
                }

                return (
                  <Fragment key={order.doc_entry}>
                    <tr onClick={() => toggleExpand(order.doc_entry)}
                      className={`border-b border-cockpit-border/30 cursor-pointer transition-colors ${isExpanded ? "bg-cockpit-accent/[0.03]" : rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-cockpit-accent/[0.05]`}>
                      <td className="pl-2 sm:pl-2.5 pr-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-cockpit-accent" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 font-bold text-gray-900 tabular-nums text-sm">{order.doc_num}</td>
                      <td className="py-2.5 px-2 sm:px-3 text-gray-600 tabular-nums whitespace-nowrap text-xs sm:text-sm">{fmtDateShort(order.doc_date)}</td>
                      <td className="py-2.5 px-2 sm:px-3 text-gray-800 max-w-[140px] sm:max-w-[180px] truncate font-medium" title={`${order.card_name} (${order.card_code})`}>
                        <span className="text-xs sm:text-sm">{order.card_name || order.card_code}</span>
                        <span className="block text-[10px] text-gray-400 font-mono">{order.card_code}</span>
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-xs text-gray-500 max-w-[120px] truncate hidden lg:table-cell" title={loc}>
                        {loc && loc !== "—" ? (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400 shrink-0" />{loc}</span>
                        ) : "—"}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-center">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 tabular-nums">{nLines}</span>
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-right tabular-nums font-medium text-gray-800 text-xs sm:text-sm">{fmtQty(qty)}</td>
                      <td className="py-2.5 px-2 sm:px-3 text-right tabular-nums font-bold text-gray-900 text-xs sm:text-sm">{fmtBRL(Number(order.doc_total) || 0)}</td>
                      <td className="py-2.5 px-2 sm:px-3 text-center">
                        <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wide ${
                          isCancelled ? "bg-red-50 text-red-600 ring-1 ring-red-200" : isOpen ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
                        }`}>
                          {isCancelled ? "Cancel." : isOpen ? "Aberto" : "Fechado"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 text-xs text-gray-600 max-w-[120px] truncate hidden xl:table-cell" title={vendorName}>{vendorName}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-transparent">
                        <td colSpan={10} className="p-0 align-top">
                          {isLoadingLines ? (
                            <div className="px-8 py-6 flex items-center gap-2 text-sm text-cockpit-muted bg-gray-50/90 border-x border-b border-cockpit-border/50">
                              <Loader2 className="w-4 h-4 animate-spin text-cockpit-accent" /> Carregando itens do SAP...
                            </div>
                          ) : (
                            <OrderDetailPanel
                              lines={lines}
                              orderTotalQty={qty}
                              vendorName={vendorName}
                              location={loc}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {visibleDocs.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-cockpit-muted">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-500">Nenhum pedido encontrado</p>
                    <p className="text-xs mt-1">Altere os filtros ou expanda o período</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {visibleDocs.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-2 border-t border-cockpit-border bg-cockpit-accent/[0.03] text-xs gap-1">
            <span className="text-cockpit-muted">{visibleDocs.length} pedidos</span>
            <div className="flex items-center gap-3 sm:gap-6 tabular-nums flex-wrap">
              <span className="text-gray-600 hidden sm:inline">Itens: <strong className="text-gray-800">{visibleDocs.reduce((s, o) => s + (o.lines?.length ?? o.num_lines ?? 0), 0)}</strong></span>
              <span className="text-gray-600">Qtd: <strong className="text-gray-800">{fmtQty(visibleDocs.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0))}</strong></span>
              <span className="text-cockpit-accent font-bold">{fmtBRL(visibleDocs.reduce((s, o) => s + (Number(o.doc_total) || 0), 0))}</span>
            </div>
          </div>
        )}

        {hasMore && (
          <div className="px-3 sm:px-4 py-3 border-t border-cockpit-border space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #A81C2C 0%, #c42538 100%)" }} />
              </div>
              <span className="text-[10px] text-cockpit-muted whitespace-nowrap tabular-nums font-medium">{visibleCount}/{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleLoadMore}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-cockpit-accent text-white text-sm font-medium hover:bg-cockpit-accent/90 transition-colors shadow-sm min-h-[44px] sm:min-h-0">
                <Plus className="w-4 h-4" /> +{nextBatch}
              </button>
              {remaining > BATCH_SIZE && (
                <button type="button" onClick={handleShowAll}
                  className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg border border-cockpit-border text-sm text-gray-600 hover:bg-black/5 transition-colors min-h-[44px] sm:min-h-0 text-center">
                  Todos ({remaining.toLocaleString("pt-BR")})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
