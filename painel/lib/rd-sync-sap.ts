import "server-only";

/**
 * Motor de sincronização SAP Business One → RD Station Marketing.
 *
 * Lê clientes do gateway (SAP) e envia conversões para o RD Marketing
 * via API Key, criando/atualizando leads automaticamente.
 *
 * Tags inteligentes (derivadas dos dados SAP):
 *  - `sap-cliente`: identifica a origem SAP
 *  - `sap-ativo` / `sap-inativo`: status do cadastro
 *  - `uf-SP`, `uf-MG`, etc: UF do endereço
 *  - `regiao-sudeste`, `regiao-sul`, etc: macro-região
 *  - `tipo-cliente` / `tipo-fornecedor`: card_type
 *
 * Log em `panel_rd_sync_log` para auditoria e rastreamento.
 */

import { gatewayGet } from "@/lib/gateway-fetch";
import {
  rdMarketingSendConversion,
  rdMarketingApiTokenConfigured,
  type RdConversionResult,
} from "@/lib/rd-station-server";
import { query } from "@/lib/db";
import { STATE_TO_REGION } from "@/lib/format";

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

export interface SapRdSyncOptions {
  triggeredBy?: string | null;
  dryRun?: boolean;
  conversionIdentifier?: string;
  maxContacts?: number;
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
}

function buildTags(c: GatewayCustomer): string[] {
  const tags: string[] = ["sap-cliente"];

  if (c.is_active) tags.push("sap-ativo");
  else tags.push("sap-inativo");

  if (c.card_type === "C" || c.card_type === "cCustomer") {
    tags.push("tipo-cliente");
  } else if (c.card_type === "S" || c.card_type === "cSupplier") {
    tags.push("tipo-fornecedor");
  }

  if (c.state) {
    const uf = c.state.trim().toUpperCase();
    if (uf.length === 2) {
      tags.push(`uf-${uf}`);
      const region = STATE_TO_REGION[uf];
      if (region) {
        tags.push(`regiao-${region.toLowerCase().replace(/\s+/g, "-")}`);
      }
    }
  }

  return tags;
}

async function logSyncEntry(detail: SapRdSyncDetail, convId: string, triggeredBy?: string | null): Promise<void> {
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
    console.error("[rd-sync] Falha ao gravar log:", err instanceof Error ? err.message : err);
  }
}

/**
 * Executa o sync: busca clientes SAP no gateway, filtra os que têm e-mail,
 * e envia uma conversão para cada um no RD Station Marketing.
 *
 * A conversão usa `conversion_identifier` como ponto de rastreamento —
 * visível nos dashboards e automações do RD.
 */
export async function runSapToRdSync(
  opts: SapRdSyncOptions = {},
): Promise<SapRdSyncResult> {
  const t0 = Date.now();
  const {
    triggeredBy = null,
    dryRun = false,
    conversionIdentifier = "sync-sap-cliente",
    maxContacts = 500,
  } = opts;

  if (!dryRun && !(await rdMarketingApiTokenConfigured())) {
    throw new Error(
      "API Token do RD Station Marketing não configurado. Vá em Integrações e salve o RD_STATION_API_TOKEN.",
    );
  }

  const customersRes = await gatewayGet<GatewayCustomersResult>(
    "/v1/customers",
    { limit: String(maxContacts), active: "true" },
  );

  const allCustomers = customersRes.data ?? [];
  const withEmail = allCustomers.filter(
    (c) => c.email && c.email.includes("@") && c.email.trim().length > 3,
  );
  const skippedNoEmail = allCustomers.length - withEmail.length;

  const details: SapRdSyncDetail[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const c of withEmail) {
    const email = c.email!.trim().toLowerCase();
    const tags = buildTags(c);

    if (dryRun) {
      details.push({
        cardCode: c.card_code,
        cardName: c.card_name,
        email,
        tags,
        ok: true,
        status: 0,
        reason: "dry-run",
        responseTimeMs: 0,
      });
      succeeded++;
      continue;
    }

    let result: RdConversionResult;
    try {
      result = await rdMarketingSendConversion({
        email,
        conversion_identifier: conversionIdentifier,
        name: c.card_name,
        city: c.city ?? undefined,
        state: c.state ?? undefined,
        personal_phone: c.phone ?? undefined,
        company_name: c.card_name,
        tags,
        cf_custom_fields: {
          cf_sap_card_code: c.card_code,
          cf_sap_card_type: c.card_type,
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

    const detail: SapRdSyncDetail = {
      cardCode: c.card_code,
      cardName: c.card_name,
      email,
      tags,
      ok: result.ok,
      status: result.status,
      reason: result.reason,
      responseTimeMs: result.responseTimeMs,
    };

    if (result.ok) succeeded++;
    else failed++;

    details.push(detail);
    await logSyncEntry(detail, conversionIdentifier, triggeredBy);

    // Rate limiting suave — RD aceita ~10 req/s, mas vamos ser conservadores
    if (withEmail.indexOf(c) < withEmail.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return {
    totalSapCustomers: allCustomers.length,
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

/**
 * Consulta o histórico de syncs recentes.
 */
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
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at as unknown as Date).toISOString(),
  }));
}
