import type { SalesOrderRow } from "@/lib/cockpit-api";
import { excludeFreight } from "@/lib/orders";
import {
  getLineUnits,
  getBaseProductName,
  getProductPrefix,
  getUnifiedProductKey,
} from "@/lib/item-parser";
import {
  format,
  parseISO,
  differenceInDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  endOfWeek,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  subWeeks,
  isWeekend,
  isSameMonth,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ExecutiveKpis {
  fat: number;
  fatVar: number;
  pedidos: number;
  pedVar: number;
  ticket: number;
  ticketVar: number;
  clientesAtivos: number;
  clientesVar: number;
  qty: number;
  totalBase: number;
}

export interface BusinessDayDatum {
  /** yyyy-MM-dd */
  date: string;
  /** "dd/MM" */
  label: string;
  /** 1=Seg, 2=Ter, ..., 5=Sex */
  weekday: number;
  Faturamento: number;
  Pedidos: number;
}

export interface MonthProjection {
  /** "mai/26" */
  monthLabel: string;
  /** Faturamento já realizado no mês corrente (somente dias úteis até hoje). */
  realized: number;
  realizedOrders: number;
  /** Dias úteis com ao menos um pedido — base da média. */
  daysWithSales: number;
  /** Dias úteis decorridos no mês até hoje (inclusive). */
  daysElapsed: number;
  /** Total de dias úteis no mês inteiro. */
  totalBusinessDays: number;
  /** Dias úteis restantes (totalBusinessDays - daysElapsed). */
  remainingBusinessDays: number;
  /** Média realizado / daysElapsed (paira sobre dias úteis). */
  avgPerBusinessDay: number;
  /** Projeção: realizado + média × diasRestantes. */
  projection: number;
  /** % do mês transcorrido (em dias úteis). */
  pctElapsed: number;
}

export interface WeeklyDatum {
  /** yyyy-MM-dd da segunda-feira da semana */
  weekStart: string;
  /** "dd/MM" */
  label: string;
  /** "21–27/05" */
  rangeLabel: string;
  Faturamento: number;
  Pedidos: number;
}

export interface UnifiedTopProduct {
  /** Chave única de unificação ("GN::NOME BASE") */
  key: string;
  /** Sigla do grupo (GN, PO, GI…) */
  prefix: string;
  /** Nome descritivo SEM o sufixo de embalagem */
  desc: string;
  /** Quantidade total em unidades reais (qty × embalaQty) */
  qty: number;
  /** Faturamento somado de todas as variantes (UND + CAIXA + FARDO) */
  fat: number;
  /** Quantidade de SKUs (variantes de embalagem) agregados */
  skus: number;
  /** Embalagens encontradas, ex.: ["UND", "CAIXA C/12"] */
  embalas: string[];
}

export interface ExecutiveSummary {
  kpis: ExecutiveKpis;
  topVendedores: Array<{ code: number; nome: string; fat: number; pedidos: number }>;
  topClientes: Array<{ cardCode: string; nome: string; fat: number; pedidos: number }>;
  /** Serie agregada (dia/semana/mês) — utilizada em listagens auxiliares. */
  trendData: Array<{ label: string; Faturamento: number; Pedidos: number }>;
  /** Série diária restrita a dias úteis (Seg-Sex) para o gráfico de barras. */
  businessDayTrend: BusinessDayDatum[];
  /** Mediana do faturamento dos dias úteis com vendas. */
  businessDayMedian: number;
  /** Últimas 8 semanas a partir de hoje (independe do range selecionado). */
  weeklyTrend: WeeklyDatum[];
  /** Mediana das 8 semanas (apenas as com vendas). */
  weeklyMedian: number;
  /** Projeção do mês corrente (null quando o range não inclui o mês corrente). */
  monthProjection: MonthProjection | null;
  /** Top 10 produtos — visão UNIFICADA (agrupa por nome base + sigla). */
  topProdutos: UnifiedTopProduct[];
  statusData: Array<{ name: string; value: number; fill: string }>;
  meta: { orderCount: number; clienteAtivos: number; spCount: number };
}

function filterActive(orders: SalesOrderRow[]): SalesOrderRow[] {
  // Faturamento executivo exclui cancelados e pedidos de frete (num_lines = 0)
  return excludeFreight(orders.filter((o) => o.cancelled !== "Y"));
}

export function buildExecutiveSummary(
  ordersRaw: SalesOrderRow[],
  prevOrdersRaw: SalesOrderRow[],
  rangeFrom: Date,
  rangeTo: Date,
  spMap: Map<number, string>,
  custTotal: number,
  salesPersonCount: number,
  /**
   * Pedidos das últimas ~9 semanas (independe do range selecionado).
   * Usado para construir o gráfico semanal sem depender da seleção do usuário.
   */
  recentOrdersRaw: SalesOrderRow[] = [],
): ExecutiveSummary {
  const orders = filterActive(ordersRaw);
  const prevOrders = filterActive(prevOrdersRaw);
  const recentOrders = filterActive(recentOrdersRaw);

  const fat = orders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0);
  const prevFat = prevOrders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0);
  const fatVar = prevFat > 0 ? ((fat - prevFat) / prevFat) * 100 : 0;
  const pedidos = orders.length;
  const prevPedidos = prevOrders.length;
  const pedVar = prevPedidos > 0 ? ((pedidos - prevPedidos) / prevPedidos) * 100 : 0;
  const ticket = pedidos > 0 ? fat / pedidos : 0;
  const prevTicket = prevPedidos > 0 ? prevFat / prevPedidos : 0;
  const ticketVar = prevTicket > 0 ? ((ticket - prevTicket) / prevTicket) * 100 : 0;
  const clientesAtivos = new Set(orders.map((o) => o.card_code)).size;
  const prevClientes = new Set(prevOrders.map((o) => o.card_code)).size;
  const clientesVar = prevClientes > 0 ? ((clientesAtivos - prevClientes) / prevClientes) * 100 : 0;
  // Quantidade vendida considera unidades reais (qty × embalaQty da descrição)
  let qty = 0;
  for (const o of orders) {
    for (const line of o.lines ?? []) {
      qty += getLineUnits(line);
    }
  }

  const kpis: ExecutiveKpis = {
    fat,
    fatVar,
    pedidos,
    pedVar,
    ticket,
    ticketVar,
    clientesAtivos,
    clientesVar,
    qty,
    totalBase: custTotal,
  };

  const topVendedoresMap = new Map<number, { nome: string; fat: number; pedidos: number }>();
  for (const o of orders) {
    const code = o.sales_person_code ?? -1;
    const cur =
      topVendedoresMap.get(code) ?? {
        nome: spMap.get(code) ?? `Vend. ${code}`,
        fat: 0,
        pedidos: 0,
      };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    topVendedoresMap.set(code, cur);
  }
  const topVendedores = Array.from(topVendedoresMap.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.fat - a.fat)
    .slice(0, 10);

  const topClientesMap = new Map<string, { cardCode: string; nome: string; fat: number; pedidos: number }>();
  for (const o of orders) {
    const cur =
      topClientesMap.get(o.card_code) ?? {
        cardCode: o.card_code,
        nome: o.card_name,
        fat: 0,
        pedidos: 0,
      };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    topClientesMap.set(o.card_code, cur);
  }
  const topClientes = Array.from(topClientesMap.values()).sort((a, b) => b.fat - a.fat).slice(0, 10);

  const totalDays = differenceInDays(rangeTo, rangeFrom) + 1;
  let trendData: ExecutiveSummary["trendData"];

  if (totalDays <= 45) {
    const days = eachDayOfInterval({ start: rangeFrom, end: rangeTo });
    const dayMap = new Map<string, { fat: number; pedidos: number }>();
    for (const d of days) dayMap.set(format(d, "yyyy-MM-dd"), { fat: 0, pedidos: 0 });
    for (const o of orders) {
      const key = o.doc_date?.split("T")[0] || "";
      const cur = dayMap.get(key);
      if (cur) {
        cur.fat += Number(o.doc_total) || 0;
        cur.pedidos += 1;
      }
    }
    trendData = Array.from(dayMap.entries()).map(([date, v]) => ({
      label: format(parseISO(date), "dd/MM", { locale: ptBR }),
      Faturamento: v.fat,
      Pedidos: v.pedidos,
    }));
  } else if (totalDays <= 180) {
    const weeks = eachWeekOfInterval({ start: rangeFrom, end: rangeTo }, { weekStartsOn: 1 });
    trendData = weeks.map((wStart) => {
      const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
      let wf = 0,
        wp = 0;
      for (const o of orders) {
        const d = parseISO(o.doc_date?.split("T")[0] || "");
        if (d >= wStart && d <= wEnd) {
          wf += Number(o.doc_total) || 0;
          wp += 1;
        }
      }
      return { label: `${format(wStart, "dd/MM")}`, Faturamento: wf, Pedidos: wp };
    });
  } else {
    const months = eachMonthOfInterval({ start: rangeFrom, end: rangeTo });
    trendData = months.map((mStart) => {
      const mEnd = endOfMonth(mStart);
      let mf = 0,
        mp = 0;
      for (const o of orders) {
        const d = parseISO(o.doc_date?.split("T")[0] || "");
        if (d >= mStart && d <= mEnd) {
          mf += Number(o.doc_total) || 0;
          mp += 1;
        }
      }
      return { label: format(mStart, "MMM/yy", { locale: ptBR }), Faturamento: mf, Pedidos: mp };
    });
  }

  // ── Top produtos — visão UNIFICADA (mesma regra do /catalogo) ──
  // Agrupa por sigla + nome base, somando faturamento e unidades reais (qty × embalaQty).
  const unifiedProdMap = new Map<
    string,
    {
      prefix: string;
      desc: string;
      fat: number;
      qty: number;
      skus: Set<string>;
      embalas: Set<string>;
    }
  >();
  for (const o of orders) {
    if (!o.lines) continue;
    for (const line of o.lines) {
      const key = getUnifiedProductKey(line.ItemCode, line.ItemDescription);
      const prefix = getProductPrefix(line.ItemCode);
      const baseName = getBaseProductName(line.ItemDescription) || (line.ItemCode ?? "—");
      const cur =
        unifiedProdMap.get(key) ?? {
          prefix,
          desc: baseName,
          fat: 0,
          qty: 0,
          skus: new Set<string>(),
          embalas: new Set<string>(),
        };
      cur.fat += Number(line.LineTotal) || 0;
      cur.qty += getLineUnits(line);
      if (line.ItemCode) cur.skus.add(line.ItemCode);
      // Identifica embalagem pela diferença entre descrição completa e baseName
      const full = (line.ItemDescription ?? "").trim();
      const baseLen = baseName.length;
      if (full.length > baseLen) {
        const tail = full.slice(baseLen).replace(/^\s*[-–]\s*/, "").trim().toUpperCase();
        if (tail) cur.embalas.add(tail.replace(/\s+UND$/i, "").replace(/^C\s*\//i, "C/"));
      } else {
        cur.embalas.add("UND");
      }
      unifiedProdMap.set(key, cur);
    }
  }
  const topProdutos: UnifiedTopProduct[] = Array.from(unifiedProdMap.entries())
    .map(([key, v]) => ({
      key,
      prefix: v.prefix,
      desc: v.desc,
      fat: v.fat,
      qty: v.qty,
      skus: v.skus.size,
      embalas: Array.from(v.embalas).sort(),
    }))
    .sort((a, b) => b.fat - a.fat)
    .slice(0, 10);

  // ── Últimas 8 semanas (independente do range selecionado) ──
  const refToday = startOfDay(new Date());
  const weeklyTrend: WeeklyDatum[] = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = startOfWeek(subWeeks(refToday, i), { weekStartsOn: 1 });
    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
    let wf = 0;
    let wp = 0;
    for (const o of recentOrders) {
      if (!o.doc_date) continue;
      const d = parseISO(o.doc_date.split("T")[0] + "T12:00:00");
      if (d >= wStart && d <= wEnd) {
        wf += Number(o.doc_total) || 0;
        wp += 1;
      }
    }
    weeklyTrend.push({
      weekStart: format(wStart, "yyyy-MM-dd"),
      label: format(wStart, "dd/MM"),
      rangeLabel: `${format(wStart, "dd/MM")} – ${format(wEnd, "dd/MM")}`,
      Faturamento: wf,
      Pedidos: wp,
    });
  }

  // Mediana das 8 semanas (somente as com vendas)
  const weeklyValues = weeklyTrend.map((w) => w.Faturamento).filter((v) => v > 0).sort((a, b) => a - b);
  let weeklyMedian = 0;
  if (weeklyValues.length > 0) {
    const mid = Math.floor(weeklyValues.length / 2);
    weeklyMedian =
      weeklyValues.length % 2 !== 0 ? weeklyValues[mid] : (weeklyValues[mid - 1] + weeklyValues[mid]) / 2;
  }

  const open = orders.filter((o) => o.doc_status === "O").length;
  const closed = orders.filter((o) => o.doc_status === "C").length;
  const statusData = [
    { name: "Abertos", value: open, fill: "#10b981" },
    { name: "Fechados", value: closed, fill: "#78696c" },
  ].filter((s) => s.value > 0);

  // Série diária restrita a dias úteis (Seg-Sex) ─ usada no gráfico de barras
  const allDays = eachDayOfInterval({ start: rangeFrom, end: rangeTo });
  const businessDayMap = new Map<string, { fat: number; pedidos: number }>();
  for (const d of allDays) {
    if (isWeekend(d)) continue;
    businessDayMap.set(format(d, "yyyy-MM-dd"), { fat: 0, pedidos: 0 });
  }
  for (const o of orders) {
    const key = o.doc_date?.split("T")[0] || "";
    const slot = businessDayMap.get(key);
    if (!slot) continue;
    slot.fat += Number(o.doc_total) || 0;
    slot.pedidos += 1;
  }
  const businessDayTrend: BusinessDayDatum[] = Array.from(businessDayMap.entries())
    .map(([date, v]) => {
      const d = parseISO(date + "T12:00:00");
      return {
        date,
        label: format(d, "dd/MM"),
        weekday: d.getDay(),
        Faturamento: v.fat,
        Pedidos: v.pedidos,
      };
    });

  // Mediana — apenas dos dias úteis com vendas
  const businessDayValues = businessDayTrend
    .map((d) => d.Faturamento)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  let businessDayMedian = 0;
  if (businessDayValues.length > 0) {
    const mid = Math.floor(businessDayValues.length / 2);
    businessDayMedian = businessDayValues.length % 2 !== 0
      ? businessDayValues[mid]
      : (businessDayValues[mid - 1] + businessDayValues[mid]) / 2;
  }

  // Projeção do mês corrente — só faz sentido se o range inclui o mês atual.
  const today = startOfDay(new Date());
  const monthRef = startOfMonth(today);
  const rangeIncludesCurrentMonth =
    !isAfter(monthRef, rangeTo) && !isBefore(endOfMonth(today), rangeFrom);

  let monthProjection: MonthProjection | null = null;
  if (rangeIncludesCurrentMonth) {
    // Considera apenas pedidos do mês corrente, ativos, não-frete (já filtrado).
    const monthOrders = orders.filter((o) => {
      if (!o.doc_date) return false;
      const d = parseISO(o.doc_date.split("T")[0] + "T12:00:00");
      return isSameMonth(d, monthRef);
    });

    const realized = monthOrders.reduce((s, o) => s + (Number(o.doc_total) || 0), 0);
    const realizedOrders = monthOrders.length;

    // Conta dias úteis decorridos (do dia 1 até hoje, exclusivo de fds).
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const allMonthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const allBusinessDays = allMonthDays.filter((d) => !isWeekend(d));
    const totalBusinessDays = allBusinessDays.length;
    const daysElapsed = allBusinessDays.filter((d) => !isAfter(d, today)).length;
    const remainingBusinessDays = Math.max(0, totalBusinessDays - daysElapsed);

    // Dias úteis com ao menos um pedido (base mais conservadora para média).
    const daysWithSales = new Set(
      monthOrders
        .map((o) => {
          const d = parseISO((o.doc_date ?? "").split("T")[0] + "T12:00:00");
          return isWeekend(d) ? null : format(d, "yyyy-MM-dd");
        })
        .filter(Boolean),
    ).size;

    const avgPerBusinessDay = daysElapsed > 0 ? realized / daysElapsed : 0;
    const projection = realized + avgPerBusinessDay * remainingBusinessDays;

    monthProjection = {
      monthLabel: format(monthRef, "MMM/yy", { locale: ptBR }),
      realized,
      realizedOrders,
      daysWithSales,
      daysElapsed,
      totalBusinessDays,
      remainingBusinessDays,
      avgPerBusinessDay,
      projection,
      pctElapsed: totalBusinessDays > 0 ? (daysElapsed / totalBusinessDays) * 100 : 0,
    };
  }

  return {
    kpis,
    topVendedores,
    topClientes,
    trendData,
    businessDayTrend,
    businessDayMedian,
    weeklyTrend,
    weeklyMedian,
    monthProjection,
    topProdutos,
    statusData,
    meta: {
      orderCount: orders.length,
      clienteAtivos: clientesAtivos,
      spCount: salesPersonCount,
    },
  };
}
