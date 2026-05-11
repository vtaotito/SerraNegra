import "server-only";

/**
 * Motor de sincronização SAP Business One → RD Station Marketing.
 *
 * Usa a **mesma fonte de dados** da página /clientes: busca pedidos de
 * venda (sales-orders) + cadastro de customers e cruza. Isso pega os
 * ~5000 clientes reais, não apenas os ~20 do cadastro de BusinessPartners.
 *
 * Para cada cliente único com e-mail, envia uma conversão ao RD Marketing
 * e aplica tags inteligentes via endpoint POST /tag.
 */

import { gatewayGet } from "@/lib/gateway-fetch";
import {
  rdMarketingSendConversion,
  rdMarketingApiTokenConfigured,
  rdMarketingAddTags,
  type RdConversionResult,
} from "@/lib/rd-station-server";
import { query } from "@/lib/db";
import { STATE_TO_REGION } from "@/lib/format";

interface GatewaySalesOrder {
  card_code: string;
  card_name: string;
  doc_total: number;
  doc_date: string;
  cancelled: string;
  sales_person_code: number | null;
  address?: string | null;
  address2?: string | null;
}

interface GatewaySalesOrdersResult {
  ok: boolean;
  items: GatewaySalesOrder[];
  total: number;
}

interface GatewayCustomer {
  card_code: string;
  card_name: string;
  card_type: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
}

interface GatewayCustomersResult {
  data: GatewayCustomer[];
  total: number;
}

interface MergedClient {
  cardCode: string;
  cardName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  cardType: string;
  fat: number;
  pedidos: number;
}

export interface SapRdSyncOptions {
  triggeredBy?: string | null;
  dryRun?: boolean;
  conversionIdentifier?: string;
  maxContacts?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface SapRdSyncResult {
  totalSapCustomers: number;
  withEmail: number;
  sent: number;
  succeeded: number;
  failed: number;
  skippedNoEmail: number;
  dryRun: boolean;
  details: SapRdSyncDetail[];
  elapsedMs: number;
}

export interface SapRdSyncDetail {
  cardCode: string;
  cardName: string;
  email: string;
  tags: string[];
  ok: boolean;
  status: number;
  reason?: string;
  responseTimeMs: number;
  tagsApplied: number;
  tagsNote?: string;
}

function extractUF(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const m = addr.match(/-([A-Z]{2})\s*[\r\n]/);
  return m && STATE_TO_REGION[m[1]] ? m[1] : null;
}

function buildTags(c: MergedClient): string[] {
  const tags: string[] = ["sap-cliente"];

  if (c.isActive) tags.push("sap-ativo");
  else tags.push("sap-inativo");

  if (c.cardType === "C" || c.cardType === "cCustomer") {
    tags.push("tipo-cliente");
  } else if (c.cardType === "S" || c.cardType === "cSupplier") {
    tags.push("tipo-fornecedor");
  }

  if (c.state && c.state !== "—") {
    const uf = c.state.trim().toUpperCase();
    if (uf.length === 2) {
      tags.push(`uf-${uf}`);
      const region = STATE_TO_REGION[uf];
      if (region) {
        tags.push(`regiao-${region.toLowerCase().replace(/\s+/g, "-")}`);
      }
    }
  }

  if (c.fat > 0) {
    if (c.fat >= 100000) tags.push("faturamento-alto");
    else if (c.fat >= 10000) tags.push("faturamento-medio");
    else tags.push("faturamento-baixo");
  }

  return tags;
}

async function logSyncEntry(
  detail: SapRdSyncDetail,
  convId: string,
  triggeredBy?: string | null,
): Promise<void> {
  try {
    await query(
      `INSERT INTO panel_rd_sync_log
         (card_code, card_name, email, conversion_identifier, tags, rd_status, rd_ok, rd_reason, rd_response_ms, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        detail.cardCode,
        detail.cardName,
        detail.email,
        convId,
        detail.tags,
        detail.status,
        detail.ok,
        detail.reason ?? null,
        detail.responseTimeMs,
        triggeredBy ?? null,
      ],
    );
  } catch (err) {
    console.error(
      "[rd-sync] Falha ao gravar log:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Busca pedidos SAP + cadastro de clientes, cruza para obter a lista
 * completa de clientes com dados de contato enriquecidos.
 */
async function fetchMergedClients(
  dateFrom: string,
  dateTo: string,
): Promise<MergedClient[]> {
  const [ordersRes, custRes] = await Promise.all([
    gatewayGet<GatewaySalesOrdersResult>("/sap/sales-orders", {
      limit: "50000",
      dateFrom,
      dateTo,
    }),
    gatewayGet<GatewayCustomersResult>("/v1/customers", {
      limit: "5000",
    }),
  ]);

  const orders = ordersRes.items ?? [];
  const customers = custRes.data ?? [];

  const custMap = new Map<string, GatewayCustomer>();
  for (const c of customers) custMap.set(c.card_code, c);

  const clientAgg = new Map<
    string,
    {
      name: string;
      fat: number;
      pedidos: number;
      uf: string | null;
      city: string | null;
    }
  >();

  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const cur = clientAgg.get(o.card_code) ?? {
      name: o.card_name,
      fat: 0,
      pedidos: 0,
      uf: null,
      city: null,
    };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    if (!cur.name && o.card_name) cur.name = o.card_name;
    if (!cur.uf) {
      cur.uf =
        extractUF(o.address) ?? extractUF(o.address2) ?? null;
    }
    clientAgg.set(o.card_code, cur);
  }

  const merged: MergedClient[] = [];
  for (const [cardCode, agg] of clientAgg) {
    const cust = custMap.get(cardCode);
    merged.push({
      cardCode,
      cardName: cust?.card_name ?? agg.name ?? cardCode,
      email: cust?.email?.trim() || null,
      phone: cust?.phone || null,
      city: cust?.city || agg.city || null,
      state: cust?.state || agg.uf || null,
      isActive: cust?.is_active ?? true,
      cardType: cust?.card_type ?? "C",
      fat: agg.fat,
      pedidos: agg.pedidos,
    });
  }

  return merged.sort((a, b) => b.fat - a.fat);
}

/**
 * Executa o sync completo: lê pedidos SAP + cadastro, cruza para obter
 * todos os clientes reais, e envia conversão + tags para cada um com e-mail.
 */
export async function runSapToRdSync(
  opts: SapRdSyncOptions = {},
): Promise<SapRdSyncResult> {
  const t0 = Date.now();
  const {
    triggeredBy = null,
    dryRun = false,
    conversionIdentifier = "sync-sap-cliente",
    maxContacts = 5000,
    dateFrom = "2024-01-01",
    dateTo = new Date().toISOString().slice(0, 10),
  } = opts;

  if (!dryRun && !(await rdMarketingApiTokenConfigured())) {
    throw new Error(
      "API Token do RD Station Marketing não configurado.",
    );
  }

  const allClients = await fetchMergedClients(dateFrom, dateTo);

  const withEmail = allClients
    .filter(
      (c) => c.email && c.email.includes("@") && c.email.trim().length > 3,
    )
    .slice(0, maxContacts);

  const skippedNoEmail = allClients.length - withEmail.length;

  const details: SapRdSyncDetail[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const c of withEmail) {
    const email = c.email!.trim().toLowerCase();
    const tags = buildTags(c);

    if (dryRun) {
      details.push({
        cardCode: c.cardCode,
        cardName: c.cardName,
        email,
        tags,
        ok: true,
        status: 0,
        reason: "dry-run",
        responseTimeMs: 0,
        tagsApplied: 0,
        tagsNote: "dry-run",
      });
      succeeded++;
      continue;
    }

    let result: RdConversionResult;
    try {
      result = await rdMarketingSendConversion({
        email,
        conversion_identifier: conversionIdentifier,
        name: c.cardName,
        city: c.city ?? undefined,
        state: c.state ?? undefined,
        personal_phone: c.phone ?? undefined,
        company_name: c.cardName,
        tags,
        cf_custom_fields: {
          cf_sap_card_code: c.cardCode,
          cf_sap_card_type: c.cardType,
          cf_sap_faturamento: c.fat,
          cf_sap_pedidos: c.pedidos,
        },
      });
    } catch (err) {
      result = {
        ok: false,
        status: 0,
        reason: err instanceof Error ? err.message : "Erro inesperado",
        responseTimeMs: 0,
      };
    }

    let tagsApplied = 0;
    let tagsNote: string | undefined;

    if (result.ok) {
      const tagResult = await rdMarketingAddTags(email, tags);
      tagsApplied = tagResult.addedTags;
      if (!tagResult.ok && tagResult.reason) {
        tagsNote = tagResult.reason;
      }
    }

    const detail: SapRdSyncDetail = {
      cardCode: c.cardCode,
      cardName: c.cardName,
      email,
      tags,
      ok: result.ok,
      status: result.status,
      reason: result.reason,
      responseTimeMs: result.responseTimeMs,
      tagsApplied,
      tagsNote,
    };

    if (result.ok) succeeded++;
    else failed++;

    details.push(detail);
    await logSyncEntry(detail, conversionIdentifier, triggeredBy);

    if (withEmail.indexOf(c) < withEmail.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return {
    totalSapCustomers: allClients.length,
    withEmail: withEmail.length,
    sent: details.length,
    succeeded,
    failed,
    skippedNoEmail,
    dryRun,
    details,
    elapsedMs: Date.now() - t0,
  };
}

export async function getRecentSyncLogs(limit = 50): Promise<
  Array<{
    id: string;
    cardCode: string;
    cardName: string | null;
    email: string;
    conversionIdentifier: string;
    tags: string[];
    rdOk: boolean;
    rdReason: string | null;
    rdResponseMs: number | null;
    createdAt: string;
  }>
> {
  interface Row {
    id: string;
    card_code: string;
    card_name: string | null;
    email: string;
    conversion_identifier: string;
    tags: string[] | null;
    rd_ok: boolean;
    rd_reason: string | null;
    rd_response_ms: number | null;
    created_at: string;
  }
  const rows = await query<Row>(
    `SELECT id, card_code, card_name, email, conversion_identifier, tags, rd_ok, rd_reason, rd_response_ms, created_at
     FROM panel_rd_sync_log ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    cardCode: r.card_code,
    cardName: r.card_name,
    email: r.email,
    conversionIdentifier: r.conversion_identifier,
    tags: r.tags ?? [],
    rdOk: r.rd_ok,
    rdReason: r.rd_reason,
    rdResponseMs: r.rd_response_ms,
    createdAt:
      typeof r.created_at === "string"
        ? r.created_at
        : new Date(r.created_at as unknown as Date).toISOString(),
  }));
}
