import { NextRequest, NextResponse } from "next/server";
import {
  rdCrmOverviewData,
  rdStationCrmConfigured,
  type RdCrmPipeline,
} from "@/lib/rd-station-server";
import { gatewayGet } from "@/lib/gateway-fetch";
import type { SalesOrderRow } from "@/lib/cockpit-api";
import { excludeFreight } from "@/lib/orders";

interface SalesOrdersResult {
  ok: boolean;
  items: SalesOrderRow[];
}

/** Resposta agregada — Marketing & CRM BI + métricas SAP opcionais (periodo igual ao BI). */
export async function GET(req: NextRequest) {
  if (!(await rdStationCrmConfigured())) {
    return NextResponse.json({
      configured: false as const,
      error: null as string | null,
      pipelines: [] as RdCrmPipeline[],
      pipelinesWithCounts: [],
      ongoingDealsSample: [],
      ongoingTotals: null,
      sapBridge: null,
    });
  }

  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") ?? "";
  const dateTo = sp.get("dateTo") ?? "";
  const salesPersonStr = sp.get("salesPerson");

  try {
    const crm = await rdCrmOverviewData();

    let sapBridge: {
      pedidosNoPeriodo: number;
      faturamentoNoPeriodo: number;
      dateFrom: string;
      dateTo: string;
    } | null = null;

    if (dateFrom && dateTo) {
      let skipSap = false;
      let salesPerson: number | undefined;
      if (salesPersonStr != null && salesPersonStr !== "") {
        const spn = Number(salesPersonStr);
        if (Number.isNaN(spn)) skipSap = true;
        else salesPerson = spn;
      }
      if (!skipSap) {
        const pOrders: Record<string, string> = {
          dateFrom,
          dateTo,
          limit: "50000",
        };
        if (salesPerson != null) pOrders.salesPerson = String(salesPerson);

        const ordersRes = await gatewayGet<SalesOrdersResult>("/sap/sales-orders", pOrders).catch(() => ({
          ok: false,
          items: [] as SalesOrderRow[],
        }));

        const items = ordersRes?.items ?? [];
        // Faturamento exclui cancelados e pedidos de frete (num_lines = 0)
        const ativos = excludeFreight(items.filter((o) => o.cancelled !== "Y"));
        sapBridge = {
          pedidosNoPeriodo: ativos.length,
          faturamentoNoPeriodo: ativos.reduce((s, o) => s + (Number(o.doc_total) || 0), 0),
          dateFrom,
          dateTo,
        };
      }
    }

    return NextResponse.json({
      configured: true as const,
      error: null as string | null,
      pipelines: crm.pipelines,
      pipelinesWithCounts: crm.pipelinesWithCounts,
      ongoingDealsSample: crm.ongoingDealsSample,
      ongoingTotals: crm.ongoingTotals,
      sapBridge,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao ler RD Station CRM";
    return NextResponse.json(
      {
        configured: true as const,
        error: msg,
        pipelines: [] as RdCrmPipeline[],
        pipelinesWithCounts: [],
        ongoingDealsSample: [],
        ongoingTotals: null,
        sapBridge: null,
      },
      { status: 502 }
    );
  }
}
