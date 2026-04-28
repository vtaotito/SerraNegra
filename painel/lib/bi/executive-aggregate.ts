import type { SalesOrderRow } from "@/lib/cockpit-api";
import {
  format,
  parseISO,
  differenceInDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  endOfWeek,
  endOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

export interface ExecutiveSummary {
  kpis: ExecutiveKpis;
  topVendedores: Array<{ code: number; nome: string; fat: number; pedidos: number }>;
  topClientes: Array<{ cardCode: string; nome: string; fat: number; pedidos: number }>;
  trendData: Array<{ label: string; Faturamento: number; Pedidos: number }>;
  topProdutos: Array<{ code: string; desc: string; fat: number; qty: number }>;
  dowData: Array<{ name: string; Faturamento: number; Pedidos: number }>;
  statusData: Array<{ name: string; value: number; fill: string }>;
  meta: { orderCount: number; clienteAtivos: number; spCount: number };
}

function filterActive(orders: SalesOrderRow[]): SalesOrderRow[] {
  return orders.filter((o) => o.cancelled !== "Y");
}

export function buildExecutiveSummary(
  ordersRaw: SalesOrderRow[],
  prevOrdersRaw: SalesOrderRow[],
  rangeFrom: Date,
  rangeTo: Date,
  spMap: Map<number, string>,
  custTotal: number,
  salesPersonCount: number
): ExecutiveSummary {
  const orders = filterActive(ordersRaw);
  const prevOrders = filterActive(prevOrdersRaw);

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
  const qty = orders.reduce((s, o) => s + (Number(o.total_quantity) || 0), 0);

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

  const prodMap = new Map<string, { desc: string; fat: number; qty: number }>();
  for (const o of orders) {
    if (!o.lines) continue;
    for (const line of o.lines) {
      const code = line.ItemCode || "N/D";
      const cur =
        prodMap.get(code) ?? {
          desc: line.ItemDescription || code,
          fat: 0,
          qty: 0,
        };
      cur.fat += Number(line.LineTotal) || 0;
      cur.qty += Number(line.Quantity) || 0;
      prodMap.set(code, cur);
    }
  }
  const topProdutos = Array.from(prodMap.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.fat - a.fat)
    .slice(0, 10);

  const dowAgg = Array.from({ length: 7 }, () => ({ fat: 0, pedidos: 0 }));
  for (const o of orders) {
    const d = parseISO(o.doc_date?.split("T")[0] || "");
    const dow = d.getDay();
    dowAgg[dow].fat += Number(o.doc_total) || 0;
    dowAgg[dow].pedidos += 1;
  }
  const dowData = dowAgg.map((v, i) => ({
    name: DOW_LABELS[i],
    Faturamento: v.fat,
    Pedidos: v.pedidos,
  }));

  const open = orders.filter((o) => o.doc_status === "O").length;
  const closed = orders.filter((o) => o.doc_status === "C").length;
  const statusData = [
    { name: "Abertos", value: open, fill: "#10b981" },
    { name: "Fechados", value: closed, fill: "#78696c" },
  ].filter((s) => s.value > 0);

  return {
    kpis,
    topVendedores,
    topClientes,
    trendData,
    topProdutos,
    dowData,
    statusData,
    meta: {
      orderCount: orders.length,
      clienteAtivos: clientesAtivos,
      spCount: salesPersonCount,
    },
  };
}
