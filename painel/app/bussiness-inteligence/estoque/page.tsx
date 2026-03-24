"use client";

import { useState, useMemo } from "react";
import {
  Package, Boxes, AlertTriangle, Search, CalendarDays,
  TrendingUp, TrendingDown, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Gauge, BarChart3, Layers, Clock, Flame, Snowflake,
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
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { format, differenceInDays } from "date-fns";

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
  disponivel: number;
  reservado: number;
  emPedido: number;
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
}

function parseEmbalaQty(desc: string): { embalaQty: number; embala: string } {
  const d = (desc ?? "").trim();
  if (!d) return { embalaQty: 1, embala: "UND" };

  const packRx = /(CAIXA|FARDO|PALETE)\s+C\s*\/\s*([\d.,]+)\s*UND/i;
  const m = d.match(packRx);
  if (m) {
    const qty = parseInt(m[2].replace(/\./g, "").replace(",", "."), 10) || 1;
    return { embalaQty: qty, embala: `${m[1].toUpperCase()} C/${qty}` };
  }

  if (/[-–]\s*UND\s*$/i.test(d) || /\bUND\s*$/i.test(d)) {
    return { embalaQty: 1, embala: "UND" };
  }

  return { embalaQty: 1, embala: "UND" };
}

function getBaseProductName(desc: string): string {
  return (desc ?? "")
    .replace(/\s*[-–]\s*(CAIXA|FARDO|PALETE)\s+C\s*\/\s*[\d.,]+\s*UND\s*$/i, "")
    .replace(/\s*[-–]\s*UND\s*$/i, "")
    .trim()
    .toUpperCase();
}

const CURVA_STYLES: Record<CurvaABC, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-cockpit-accent/10", text: "text-cockpit-accent", ring: "ring-cockpit-accent/30" },
  B: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-300" },
  C: { bg: "bg-gray-100", text: "text-gray-500", ring: "ring-gray-300" },
};

const GIRO_STYLES: Record<Giro, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  alto: { bg: "bg-emerald-50", text: "text-emerald-700", icon: Flame, label: "Alto" },
  medio: { bg: "bg-sky-50", text: "text-sky-700", icon: TrendingUp, label: "Médio" },
  baixo: { bg: "bg-amber-50", text: "text-amber-700", icon: TrendingDown, label: "Baixo" },
  parado: { bg: "bg-gray-100", text: "text-gray-500", icon: Snowflake, label: "Parado" },
};

const COB_STYLES: Record<Cobertura, { bg: string; text: string; label: string }> = {
  critico: { bg: "bg-red-50", text: "text-red-700", label: "Crítico" },
  atencao: { bg: "bg-amber-50", text: "text-amber-700", label: "Atenção" },
  ok: { bg: "bg-emerald-50", text: "text-emerald-700", label: "OK" },
  excesso: { bg: "bg-violet-50", text: "text-violet-600", label: "Excesso" },
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
    const pct = total > 0 ? cum / total : 1;
    map.set(i.sku, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
  }
  return map;
}

type SortField = "sku" | "descricao" | "estoqueTotal" | "disponivel" | "qtdVendida" | "mediaDiaria" | "coberturaDias" | "fatVendido" | "curva" | "giro" | "numPedidos";

function CTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-gray-600">
          {p.name}: <span className="font-medium text-gray-900">
            {p.name === "Faturamento" ? fmtBRL(Number(p.value)) : fmtNum(Number(p.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function EstoquePage() {
  const { label: periodoLabel, range } = useDateRange();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");
  const totalDays = Math.max(1, differenceInDays(range.to, range.from) + 1);

  const { data: catalogData, loading: l1, error: e1, refetch: r1 } =
    useFetch(() => fetchCatalog({ limit: 5000 }), []);
  const { data: invData, loading: l2, error: e2, refetch: r2 } =
    useFetch(() => fetchInventory({ limit: 5000 }), []);
  const { data: ordData, loading: l3, error: e3, refetch: r3 } =
    useFetch(() => fetchSalesOrders({ dateFrom, dateTo, limit: 50000 }), [dateFrom, dateTo]);

  const loading = l1 || l2 || l3;
  const error = e1 || e2 || e3;

  const allItems = useMemo<StockItem[]>(() => {
    if (!catalogData || !invData || !ordData) return [];

    const invMap = new Map<string, { avail: number; free: number; reserved: number; onOrder: number }>();
    for (const inv of invData.data) {
      const cur = invMap.get(inv.product_id) ?? { avail: 0, free: 0, reserved: 0, onOrder: 0 };
      cur.avail += inv.quantity_available;
      cur.free += inv.quantity_free;
      cur.reserved += inv.quantity_reserved;
      cur.onOrder += inv.quantity_on_order;
      invMap.set(inv.product_id, cur);
    }

    const salesMap = new Map<string, { qty: number; fat: number; pedidos: Set<number>; clientes: Set<string> }>();
    for (const o of ordData.items) {
      if (o.cancelled === "Y") continue;
      for (const l of (o.lines ?? [])) {
        const code = l.ItemCode ?? "";
        if (!code) continue;
        const cur = salesMap.get(code) ?? { qty: 0, fat: 0, pedidos: new Set(), clientes: new Set() };
        cur.qty += Number(l.Quantity) || 0;
        cur.fat += Number(l.LineTotal) || 0;
        cur.pedidos.add(o.doc_num);
        cur.clientes.add(o.card_code);
        salesMap.set(code, cur);
      }
    }

    type RawItem = {
      sku: string;
      description: string;
      unitOfMeasure: string;
      embala: string;
      embalaQty: number;
      baseName: string;
      estoqueTotal: number;
      disponivel: number;
      reservado: number;
      emPedido: number;
      qtdEmb: number;
      qtdVendida: number;
      fatVendido: number;
      pedidos: Set<number>;
      clientes: Set<string>;
    };

    const rawItems: RawItem[] = catalogData.data.map((cat) => {
      const inv = invMap.get(cat.sku);
      const sales = salesMap.get(cat.sku);
      const { embalaQty, embala } = parseEmbalaQty(cat.description);
      const qtdEmb = sales?.qty ?? 0;
      return {
        sku: cat.sku,
        description: cat.description,
        unitOfMeasure: cat.unit_of_measure || "UN",
        embala,
        embalaQty,
        baseName: getBaseProductName(cat.description),
        estoqueTotal: inv?.avail ?? 0,
        disponivel: inv?.free ?? 0,
        reservado: inv?.reserved ?? 0,
        emPedido: inv?.onOrder ?? 0,
        qtdEmb,
        qtdVendida: qtdEmb * embalaQty,
        fatVendido: sales?.fat ?? 0,
        pedidos: sales?.pedidos ?? new Set<number>(),
        clientes: sales?.clientes ?? new Set<string>(),
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
      const disponivel = group.reduce((s, i) => s + i.disponivel, 0);
      const reservado = group.reduce((s, i) => s + i.reservado, 0);
      const emPedido = group.reduce((s, i) => s + i.emPedido, 0);
      const qtdVendida = group.reduce((s, i) => s + i.qtdVendida, 0);
      const qtdEmb = group.reduce((s, i) => s + i.qtdEmb, 0);
      const fatVendido = group.reduce((s, i) => s + i.fatVendido, 0);

      const allPedidos = new Set<number>();
      const allClientes = new Set<string>();
      for (const i of group) {
        for (const p of i.pedidos) allPedidos.add(p);
        for (const c of i.clientes) allClientes.add(c);
      }

      const mediaDiaria = qtdVendida / totalDays;
      const coberturaDias = mediaDiaria > 0 ? disponivel / mediaDiaria : disponivel > 0 ? 999 : 0;

      const allSkus = group.map((i) => i.sku);
      const embalas = [...new Set(group.map((i) => i.embala))];

      mergedItems.push({
        sku: undItem.sku,
        cod: getProductGroup(undItem.sku),
        descricao: baseName || undItem.description,
        und: undItem.unitOfMeasure,
        embala: embalas.join(", "),
        embalaQty: undItem.embalaQty,
        estoqueTotal,
        disponivel,
        reservado,
        emPedido,
        qtdEmb,
        qtdVendida,
        fatVendido,
        mediaDiaria,
        coberturaDias: Math.min(coberturaDias, 999),
        giro: "parado" as Giro,
        curva: "C" as CurvaABC,
        coberturaClass: classifyCobertura(coberturaDias, qtdVendida > 0),
        numPedidos: allPedidos.size,
        numClientes: allClientes.size,
        skuCount: group.length,
        allSkus,
        embalas,
      });
    }

    const curvaMap = classifyCurvaABC(
      mergedItems.map((i) => ({ sku: i.sku, fat: i.fatVendido }))
    );
    for (const item of mergedItems) {
      item.curva = curvaMap.get(item.sku) ?? "C";
    }

    const maxMedia = Math.max(...mergedItems.map((i) => i.mediaDiaria), 0);
    for (const item of mergedItems) {
      item.giro = classifyGiro(item.mediaDiaria, maxMedia);
    }

    return mergedItems;
  }, [catalogData, invData, ordData, totalDays]);

  const [search, setSearch] = useState("");
  const [curvaFilter, setCurvaFilter] = useState<CurvaABC | "ALL">("ALL");
  const [giroFilter, setGiroFilter] = useState<Giro | "ALL">("ALL");
  const [cobFilter, setCobFilter] = useState<Cobertura | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("fatVendido");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let res = allItems;
    if (curvaFilter !== "ALL") res = res.filter((i) => i.curva === curvaFilter);
    if (giroFilter !== "ALL") res = res.filter((i) => i.giro === giroFilter);
    if (cobFilter !== "ALL") res = res.filter((i) => i.coberturaClass === cobFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((i) => i.sku.toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q) || i.cod.toLowerCase().includes(q));
    }
    return [...res].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "sku": cmp = a.sku.localeCompare(b.sku); break;
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
  }, [allItems, curvaFilter, giroFilter, cobFilter, search, sortField, sortDir]);

  const kpis = useMemo(() => {
    const total = allItems.length;
    const totalSkus = allItems.reduce((s, i) => s + i.skuCount, 0);
    const estoqueTotal = allItems.reduce((s, i) => s + Math.max(i.estoqueTotal, 0), 0);
    const fatTotal = allItems.reduce((s, i) => s + i.fatVendido, 0);
    const criticos = allItems.filter((i) => i.coberturaClass === "critico").length;
    const curvaA = allItems.filter((i) => i.curva === "A").length;
    const parados = allItems.filter((i) => i.giro === "parado" && i.estoqueTotal > 0).length;
    const comVenda = allItems.filter((i) => i.qtdVendida > 0);
    const cobMedia = comVenda.length > 0
      ? comVenda.reduce((s, i) => s + Math.min(i.coberturaDias, 365), 0) / comVenda.length
      : 0;
    const orderNums = new Set<number>();
    const cardCodes = new Set<string>();
    if (ordData) {
      for (const o of ordData.items) {
        if (o.cancelled !== "Y") {
          orderNums.add(o.doc_num);
          cardCodes.add(o.card_code);
        }
      }
    }
    return { total, totalSkus, estoqueTotal, fatTotal, criticos, curvaA, parados, cobMedia, totalPedidos: orderNums.size, totalClientes: cardCodes.size };
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
    const groups: Record<string, number> = { "0-7d": 0, "8-21d": 0, "22-60d": 0, "61-90d": 0, "90d+": 0 };
    for (const i of allItems.filter((x) => x.qtdVendida > 0)) {
      if (i.coberturaDias <= 7) groups["0-7d"]++;
      else if (i.coberturaDias <= 21) groups["8-21d"]++;
      else if (i.coberturaDias <= 60) groups["22-60d"]++;
      else if (i.coberturaDias <= 90) groups["61-90d"]++;
      else groups["90d+"]++;
    }
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [allItems]);

  const alertas = useMemo(() => {
    return allItems
      .filter((i) => i.curva === "A" && i.coberturaClass === "critico")
      .sort((a, b) => a.coberturaDias - b.coberturaDias)
      .slice(0, 8);
  }, [allItems]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cockpit-accent" /> : <ArrowDown className="w-3 h-3 text-cockpit-accent" />;
  }

  const handleExport = () => {
    exportCSV(filtered.map((i) => ({
      "SKU (UN)": i.sku,
      COD: i.cod,
      Produto: i.descricao,
      "SKUs Agrupados": i.skuCount,
      "Todos SKUs": i.allSkus.join(", "),
      Embalagens: i.embalas.join(", "),
      Estoque: i.estoqueTotal,
      Disponivel: i.disponivel,
      Reservado: i.reservado,
      "Saída (un)": i.qtdVendida,
      Pedidos: i.numPedidos,
      Clientes: i.numClientes,
      "Fat. Vendido": i.fatVendido.toFixed(2),
      "Media Diaria (un)": i.mediaDiaria.toFixed(2),
      "Cobertura Dias": i.coberturaDias.toFixed(0),
      Curva: i.curva,
      Giro: i.giro,
      Cobertura: i.coberturaClass,
    })), `estoque-analise-${dateFrom}-${dateTo}`);
  };

  if (loading) return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Gestão de Estoque</h1><p className="text-cockpit-muted mt-1 text-sm">Carregando dados...</p></div>
      <LoadingSkeleton rows={6} />
    </div>
  );

  if (error) return <ErrorState message={error} onRetry={() => { r1(); r2(); r3(); }} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Estoque</h1>
          <p className="text-cockpit-muted mt-1 text-sm flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            Estoque × Vendas · <span className="text-gray-600 font-medium">{periodoLabel}</span>
            <span className="text-cockpit-border">·</span>
            <span>{kpis.total} produtos · {totalDays} dias</span>
          </p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
          <Download className="w-4 h-4" /> Exportar
        </button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { title: "Produtos", value: fmtNum(kpis.total), sub: `${fmtNum(kpis.totalSkus)} SKUs agrupados`, icon: Package, color: "text-cockpit-accent" },
          { title: "Estoque Total", value: `${fmtNum(kpis.estoqueTotal)} un`, icon: Boxes, color: "text-sky-500" },
          { title: "Saída Total", value: `${fmtNum(allItems.reduce((s, i) => s + i.qtdVendida, 0))} un`, icon: TrendingDown, color: "text-orange-500" },
          { title: "Fat. Período", value: fmtBRL(kpis.fatTotal), icon: TrendingUp, color: "text-emerald-600" },
          { title: "Total Pedidos", value: fmtNum(kpis.totalPedidos), sub: `${fmtNum(kpis.totalClientes)} clientes`, icon: Layers, color: "text-indigo-500" },
          { title: "Curva A", value: String(kpis.curvaA), sub: "Produtos 80% do fat.", icon: Flame, color: "text-cockpit-accent" },
          { title: "Críticos", value: String(kpis.criticos), sub: "≤ 7 dias de cobertura", icon: ShieldAlert, color: kpis.criticos > 0 ? "text-red-500" : "text-emerald-500" },
          { title: "Parados", value: String(kpis.parados), sub: "Estoque sem saída", icon: Snowflake, color: kpis.parados > 0 ? "text-amber-500" : "text-emerald-500" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.title} className="rounded-xl border border-cockpit-border bg-white p-3.5 hover:border-cockpit-accent/30 transition-all group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-muted">{k.title}</span>
                <Icon className={`w-3.5 h-3.5 ${k.color} opacity-60 group-hover:opacity-100`} />
              </div>
              <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{k.value}</p>
              {k.sub && <p className="text-[10px] text-cockpit-muted mt-0.5">{k.sub}</p>}
            </div>
          );
        })}
      </section>

      {/* Alertas inteligentes */}
      {alertas.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-red-800">Alerta: Produtos Curva A com Estoque Crítico</h2>
            <span className="ml-auto text-[10px] text-red-500 font-medium">{alertas.length} itens</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {alertas.map((a) => (
              <div key={a.sku} className="bg-white rounded-lg border border-red-100 p-3">
                <p className="text-xs font-semibold text-gray-900 truncate" title={a.descricao}>{a.descricao}</p>
                <p className="text-[10px] text-gray-400 font-mono">{a.sku}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-red-600 font-bold">{a.coberturaDias.toFixed(0)} dias</span>
                  <span className="text-gray-500">Disp: {fmtNum(a.disponivel)} · Méd: {a.mediaDiaria.toFixed(1)}/dia</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Charts: Curva ABC + Cobertura */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-sm font-semibold text-gray-900">Curva ABC — Participação no Faturamento</h2>
          </div>
          {curvaDistrib.length === 0 ? (
            <p className="text-center text-cockpit-muted py-8 text-sm">Sem dados de vendas</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-48 w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={curvaDistrib} dataKey="fat" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {curvaDistrib.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {curvaDistrib.map((d) => {
                  const totalFat = curvaDistrib.reduce((s, x) => s + x.fat, 0);
                  const pct = totalFat > 0 ? (d.fat / totalFat) * 100 : 0;
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center" style={{ background: d.fill + "20", color: d.fill }}>
                            {d.name}
                          </span>
                          <span className="text-xs text-gray-600"><strong>{d.skus}</strong> SKUs</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900 tabular-nums">{fmtBRL(d.fat)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: d.fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-cockpit-border bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-cockpit-accent" />
            <h2 className="text-sm font-semibold text-gray-900">Distribuição de Cobertura (dias)</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cobDistrib} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fill: "#78696c", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#78696c", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CTooltip />} />
                <Bar dataKey="value" name="SKUs" radius={[6, 6, 0, 0]}>
                  {cobDistrib.map((_, i) => (
                    <Cell key={i} fill={["#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-3 mt-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Crítico ≤7d</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Atenção 8-21d</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> OK 22-60d</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Bom 61-90d</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> Excesso 90d+</span>
          </div>
        </section>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar SKU, descrição..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30" />
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(["ALL", "A", "B", "C"] as const).map((opt) => (
            <button key={opt} onClick={() => setCurvaFilter(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                curvaFilter === opt
                  ? opt === "A" ? "bg-cockpit-accent/15 text-cockpit-accent" : opt === "B" ? "bg-amber-100 text-amber-700" : opt === "C" ? "bg-gray-200 text-gray-600" : "bg-gray-900 text-white"
                  : "text-gray-400 hover:text-gray-700"
              }`}>{opt === "ALL" ? "Curva" : `Curva ${opt}`}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(["ALL", "alto", "medio", "baixo", "parado"] as const).map((opt) => (
            <button key={opt} onClick={() => setGiroFilter(opt)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                giroFilter === opt ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700"
              }`}>{opt === "ALL" ? "Giro" : GIRO_STYLES[opt].label}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(["ALL", "critico", "atencao", "ok", "excesso"] as const).map((opt) => (
            <button key={opt} onClick={() => setCobFilter(opt)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                cobFilter === opt ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700"
              }`}>{opt === "ALL" ? "Cobertura" : COB_STYLES[opt].label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-cockpit-border bg-gray-50/80 flex items-center justify-between">
          <p className="text-xs text-cockpit-muted">
            <strong className="text-gray-800">{filtered.length}</strong> de <strong className="text-gray-800">{allItems.length}</strong> produtos
            <span className="text-gray-400 ml-1">({kpis.totalSkus} SKUs agrupados)</span>
          </p>
          <div className="flex gap-2 text-[10px]">
            {(["A", "B", "C"] as const).map((c) => {
              const s = CURVA_STYLES[c];
              return <span key={c} className={`px-1.5 py-0.5 rounded font-bold ${s.bg} ${s.text}`}>Curva {c}</span>;
            })}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50 text-[10px] uppercase tracking-wider text-cockpit-muted sticky top-0 z-10">
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("curva")}>
                  <span className="inline-flex items-center gap-1">ABC <SortIcon field="curva" /></span>
                </th>
                <th className="text-left py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("sku")}>
                  <span className="inline-flex items-center gap-1">SKU (UN) <SortIcon field="sku" /></span>
                </th>
                <th className="text-left py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("descricao")}>
                  <span className="inline-flex items-center gap-1">Produto <SortIcon field="descricao" /></span>
                </th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("estoqueTotal")}>
                  <span className="inline-flex items-center gap-1 justify-end">Estoque <SortIcon field="estoqueTotal" /></span>
                </th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("disponivel")}>
                  <span className="inline-flex items-center gap-1 justify-end">Disp. <SortIcon field="disponivel" /></span>
                </th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("qtdVendida")}>
                  <span className="inline-flex items-center gap-1 justify-end">Saída (un) <SortIcon field="qtdVendida" /></span>
                </th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("numPedidos")}>
                  <span className="inline-flex items-center gap-1 justify-end">Pedidos <SortIcon field="numPedidos" /></span>
                </th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("mediaDiaria")}>
                  <span className="inline-flex items-center gap-1 justify-end">Méd/Dia <SortIcon field="mediaDiaria" /></span>
                </th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("coberturaDias")}>
                  <span className="inline-flex items-center gap-1 justify-end">Cobert. <SortIcon field="coberturaDias" /></span>
                </th>
                <th className="text-center py-2.5 px-2 font-semibold bg-gray-50">Giro</th>
                <th className="text-right py-2.5 px-2 font-semibold cursor-pointer hover:text-gray-700 bg-gray-50" onClick={() => toggleSort("fatVendido")}>
                  <span className="inline-flex items-center gap-1 justify-end">Faturamento <SortIcon field="fatVendido" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-cockpit-muted">
                  <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500">Nenhum item encontrado</p>
                </td></tr>
              ) : filtered.map((item, idx) => {
                const cs = CURVA_STYLES[item.curva];
                const gs = GIRO_STYLES[item.giro];
                const cobS = COB_STYLES[item.coberturaClass];
                const isCritical = item.curva === "A" && item.coberturaClass === "critico";
                const GiroIcon = gs.icon;
                return (
                  <tr key={item.sku} className={`border-b border-cockpit-border/10 hover:bg-gray-50/80 transition-colors ${isCritical ? "bg-red-50/30" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                    <td className="py-2 px-3">
                      <span className={`inline-block w-6 text-center px-1 py-0.5 rounded text-[10px] font-bold ${cs.bg} ${cs.text}`}>{item.curva}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className="font-mono text-[10px] text-gray-500">{item.sku}</span>
                      {item.skuCount > 1 && (
                        <span className="ml-1 inline-block px-1 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold">{item.skuCount} SKUs</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-700 max-w-[220px]">
                      <span className="line-clamp-1 font-medium text-[11px]" title={item.descricao}>{item.descricao}</span>
                      {item.skuCount > 1 && (
                        <span className="block text-[9px] text-gray-400 mt-0.5">
                          {item.embalas.join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-600">{fmtNum(item.estoqueTotal)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums font-medium ${item.disponivel <= 0 ? "text-red-500" : "text-gray-700"}`}>
                      {fmtNum(item.disponivel)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={item.qtdVendida > 0 ? "text-gray-900 font-bold" : "text-gray-400"}>{fmtNum(item.qtdVendida)}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={item.numPedidos > 0 ? "text-indigo-700 font-semibold" : "text-gray-400"}>
                        {item.numPedidos > 0 ? fmtNum(item.numPedidos) : "—"}
                      </span>
                      {item.numClientes > 0 && (
                        <span className="block text-[9px] text-gray-400">{fmtNum(item.numClientes)} clientes</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-500">
                      {item.mediaDiaria > 0 ? item.mediaDiaria.toFixed(1) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cobS.bg} ${cobS.text}`}>
                        {item.coberturaDias >= 999 ? "∞" : `${item.coberturaDias.toFixed(0)}d`}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${gs.bg} ${gs.text}`}>
                        <GiroIcon className="w-2.5 h-2.5" /> {gs.label}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={item.fatVendido > 0 ? "text-cockpit-accent font-semibold" : "text-gray-400"}>
                        {item.fatVendido > 0 ? fmtBRL(item.fatVendido) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-cockpit-border bg-gray-50/80 text-xs">
            <span className="text-cockpit-muted">Total ({filtered.length} produtos · {filtered.reduce((s, i) => s + i.skuCount, 0)} SKUs)</span>
            <div className="flex items-center gap-4 tabular-nums">
              <span className="text-gray-500">Estoque: <strong className="text-gray-800">{fmtNum(filtered.reduce((s, i) => s + i.estoqueTotal, 0))} un</strong></span>
              <span className="text-gray-500">Saída: <strong className="text-gray-800">{fmtNum(filtered.reduce((s, i) => s + i.qtdVendida, 0))} un</strong></span>
              <span className="text-cockpit-accent font-bold">{fmtBRL(filtered.reduce((s, i) => s + i.fatVendido, 0))}</span>
            </div>
          </div>
        )}
      </div>

      <footer className="text-center text-xs text-cockpit-muted py-3 border-t border-cockpit-border">
        Estoque SAP B1 cruzado com {ordData?.total ?? 0} pedidos de venda · {totalDays} dias · Produtos agrupados por embalagem · Cobertura = Disponível ÷ Média diária de saída
      </footer>
    </div>
  );
}
