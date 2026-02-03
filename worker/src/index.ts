import pino from "pino";
import { v4 as uuidv4 } from "uuid";

import { SapServiceLayerClient } from "../../sap-connector/src/index.js";
import type { ServiceLayerOrder } from "../../mappings/src/order.js";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "wms-worker";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

const CORE_INTERNAL_BASE_URL = process.env.CORE_INTERNAL_BASE_URL ?? "http://core:8000";
const INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET ?? "dev-internal-secret";
const POLL_INTERVAL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS ?? "30");

const SAP_BASE_URL = process.env.SAP_BASE_URL ?? "";
const SAP_COMPANY_DB = process.env.SAP_COMPANY_DB ?? "";
const SAP_USERNAME = process.env.SAP_USERNAME ?? "";
const SAP_PASSWORD = process.env.SAP_PASSWORD ?? "";

const logger = pino({
  level: LOG_LEVEL,
  base: { service: SERVICE_NAME }
});

function isSapConfigured() {
  return Boolean(SAP_BASE_URL && SAP_COMPANY_DB && SAP_USERNAME && SAP_PASSWORD);
}

function createSapClient() {
  // Adapter mínimo do logger para o client do SAP
  const sapLogger = {
    debug: (msg: string, extra?: unknown) => logger.debug({ extra }, msg),
    info: (msg: string, extra?: unknown) => logger.info({ extra }, msg),
    warn: (msg: string, extra?: unknown) => logger.warn({ extra }, msg),
    error: (msg: string, extra?: unknown) => logger.error({ extra }, msg)
  };

  return new SapServiceLayerClient({
    baseUrl: SAP_BASE_URL,
    credentials: { companyDb: SAP_COMPANY_DB, username: SAP_USERNAME, password: SAP_PASSWORD },
    logger: sapLogger
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  const parsed = text ? safeJsonParse(text) : null;
  return { status: res.status, body: parsed };
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function syncOrdersOnce() {
  const correlationId = uuidv4();
  const baseLog = logger.child({ correlationId });

  if (!isSapConfigured()) {
    baseLog.warn("SAP não configurado. Preencha SAP_BASE_URL/SAP_COMPANY_DB/SAP_USERNAME/SAP_PASSWORD.");
    return;
  }

  const sap = createSapClient();

  // Query simples (MVP): pega últimos pedidos (ajuste filtro/Delta depois).
  // Referência no contrato: API_CONTRACTS/sap-b1-integration-contract.md
  const path =
    "/Orders?$select=DocEntry,DocNum,CardCode,DocStatus,UpdateDate,UpdateTime" +
    "&$expand=DocumentLines($select=LineNum,ItemCode,Quantity,WarehouseCode)" +
    "&$orderby=UpdateDate desc,UpdateTime desc&$top=50";

  baseLog.info("Iniciando sync SAP -> Core.", { path });
  const res = await sap.get<{ value?: ServiceLayerOrder[] }>(path, { correlationId });
  const orders = Array.isArray((res.data as any)?.value) ? ((res.data as any).value as ServiceLayerOrder[]) : (res.data as any);

  if (!Array.isArray(orders)) {
    baseLog.error("Resposta inesperada do SAP (esperado array).", { sample: res.data });
    return;
  }

  const coreUrl = `${CORE_INTERNAL_BASE_URL}/internal/sap/orders`;
  const coreRes = await postJson(
    coreUrl,
    { orders },
    { "x-correlation-id": correlationId, "x-internal-secret": INTERNAL_SHARED_SECRET }
  );
  baseLog.info("Core sync respondeu.", { status: coreRes.status, body: coreRes.body });
}

async function main() {
  logger.info("Worker iniciado.", {
    intervalSeconds: POLL_INTERVAL_SECONDS,
    sapConfigured: isSapConfigured()
  });

  // loop
  for (;;) {
    try {
      await syncOrdersOnce();
    } catch (err) {
      logger.error(
        {
          error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { value: err }
        },
        "Sync falhou."
      );
    }
    await sleep(Math.max(1, POLL_INTERVAL_SECONDS) * 1000);
  }
}

await main();

