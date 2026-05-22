import { NextRequest, NextResponse } from "next/server";
import { parseISO, format, subWeeks, startOfWeek } from "date-fns";
import { buildExecutiveSummary } from "@/lib/bi/executive-aggregate";
import { gatewayGet, gatewayPost } from "@/lib/gateway-fetch";
import type { SalesOrderRow, SapSalesPerson } from "@/lib/cockpit-api";

interface SalesOrdersResult {
  ok: boolean;
  items: SalesOrderRow[];
}

interface SyncResult<T> {
  ok: boolean;
  count: number;
  items: T[];
}

interface PaginatedCustomers {
  total: number;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") ?? "";
  const dateTo = sp.get("dateTo") ?? "";
  const prevFrom = sp.get("prevFrom") ?? "";
  const prevTo = sp.get("prevTo") ?? "";
  const salesPersonStr = sp.get("salesPerson");

  if (!dateFrom || !dateTo || !prevFrom || !prevTo) {
    return NextResponse.json({ error: "dateFrom, dateTo, prevFrom e prevTo são obrigatórios" }, { status: 400 });
  }

  const salesPerson = salesPersonStr != null && salesPersonStr !== "" ? Number(salesPersonStr) : undefined;
  if (salesPersonStr != null && salesPersonStr !== "" && Number.isNaN(salesPerson)) {
    return NextResponse.json({ error: "salesPerson inválido" }, { status: 400 });
  }

  const pOrders: Record<string, string> = {
    dateFrom,
    dateTo,
    limit: "50000",
  };
  if (salesPerson != null) pOrders.salesPerson = String(salesPerson);

  const pPrev: Record<string, string> = {
    dateFrom: prevFrom,
    dateTo: prevTo,
    limit: "50000",
  };
  if (salesPerson != null) pPrev.salesPerson = String(salesPerson);

  // Janela fixa das últimas 8 semanas (independente do range do usuário)
  // — usada apenas para o gráfico semanal e mediana de 8 semanas.
  const today = new Date();
  const recentStart = format(startOfWeek(subWeeks(today, 8), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const recentEnd = format(today, "yyyy-MM-dd");
  const pRecent: Record<string, string> = {
    dateFrom: recentStart,
    dateTo: recentEnd,
    limit: "50000",
  };
  if (salesPerson != null) pRecent.salesPerson = String(salesPerson);

  try {
    const [ordersRes, prevRes, recentRes, spRes, custRes] = await Promise.all([
      gatewayGet<SalesOrdersResult>("/sap/sales-orders", pOrders),
      gatewayGet<SalesOrdersResult>("/sap/sales-orders", pPrev),
      gatewayGet<SalesOrdersResult>("/sap/sales-orders", pRecent),
      gatewayPost<SyncResult<SapSalesPerson>>("/sap/sync/salespersons"),
      gatewayGet<PaginatedCustomers>("/v1/customers", { limit: "1" }),
    ]);

    const spMap = new Map<number, string>();
    if (spRes?.items) {
      for (const s of spRes.items) {
        spMap.set(s.SalesEmployeeCode, s.SalesEmployeeName);
      }
    }

    const rangeFrom = parseISO(dateFrom + "T12:00:00");
    const rangeTo = parseISO(dateTo + "T12:00:00");

    const summary = buildExecutiveSummary(
      ordersRes?.items ?? [],
      prevRes?.items ?? [],
      rangeFrom,
      rangeTo,
      spMap,
      custRes?.total ?? 0,
      spRes?.count ?? spRes?.items?.length ?? 0,
      recentRes?.items ?? [],
    );

    return NextResponse.json(summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao agregar dados";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
