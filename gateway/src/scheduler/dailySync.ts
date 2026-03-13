import cron from "node-cron";
import pg from "pg";
import { createSapClient } from "../config/sap.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import { SapEntitiesService, type SapSalesOrderRow } from "../services/sapEntitiesService.js";

const SYNC_CRON = process.env.SAP_SYNC_CRON ?? "0 6 * * *"; // Default: 06:00 diário
const DB_URL = process.env.B2B_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: DB_URL, max: 3 });
  }
  return pool;
}

async function ensureTable() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS sap_sales_orders (
      doc_entry       INTEGER PRIMARY KEY,
      doc_num         INTEGER,
      doc_date        DATE,
      doc_due_date    DATE,
      card_code       TEXT,
      card_name       TEXT,
      doc_total       NUMERIC(18,2),
      doc_currency    TEXT DEFAULT 'BRL',
      doc_status      TEXT,
      document_status TEXT,
      sales_person    INTEGER,
      cancelled       TEXT DEFAULT 'N',
      comments        TEXT,
      lines_json      JSONB DEFAULT '[]'::jsonb,
      raw_json        JSONB,
      synced_at       TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_sales_order_doc_entry UNIQUE (doc_entry)
    );

    CREATE INDEX IF NOT EXISTS idx_sales_orders_doc_date ON sap_sales_orders (doc_date DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_orders_card_code ON sap_sales_orders (card_code);
    CREATE INDEX IF NOT EXISTS idx_sales_orders_synced ON sap_sales_orders (synced_at DESC);
  `);
}

function getSapEntitiesService(): SapEntitiesService | null {
  const logger = {
    debug: (msg: string) => console.log(`[dailySync] ${msg}`),
    info: (msg: string) => console.log(`[dailySync] ${msg}`),
    warn: (msg: string) => console.warn(`[dailySync] ${msg}`),
    error: (msg: string) => console.error(`[dailySync] ${msg}`),
  };

  const storedClient = sapConfigStore.getClient(logger);
  if (storedClient) return new SapEntitiesService(storedClient);

  try {
    const envClient = createSapClient(logger);
    return new SapEntitiesService(envClient);
  } catch {
    return null;
  }
}

async function upsertOrders(orders: SapSalesOrderRow[]) {
  const db = getPool();
  const now = new Date().toISOString();

  const BATCH = 50;
  let upserted = 0;

  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH);

    const values: unknown[] = [];
    const rows: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const o = batch[j];
      const offset = j * 14;
      rows.push(
        `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12},$${offset + 13},$${offset + 14})`
      );
      values.push(
        o.DocEntry ?? 0,
        o.DocNum ?? null,
        o.DocDate ?? null,
        o.DocDueDate ?? null,
        o.CardCode ?? null,
        o.CardName ?? null,
        o.DocTotal ?? 0,
        o.DocCurrency ?? "BRL",
        o.DocStatus ?? null,
        o.DocumentStatus ?? null,
        o.SalesPersonCode ?? null,
        o.Cancelled ?? "N",
        o.Comments ?? null,
        JSON.stringify(o.DocumentLines ?? [])
      );
    }

    const sql = `
      INSERT INTO sap_sales_orders (
        doc_entry, doc_num, doc_date, doc_due_date, card_code, card_name,
        doc_total, doc_currency, doc_status, document_status, sales_person,
        cancelled, comments, lines_json
      ) VALUES ${rows.join(",")}
      ON CONFLICT (doc_entry) DO UPDATE SET
        doc_num = EXCLUDED.doc_num,
        doc_date = EXCLUDED.doc_date,
        doc_due_date = EXCLUDED.doc_due_date,
        card_code = EXCLUDED.card_code,
        card_name = EXCLUDED.card_name,
        doc_total = EXCLUDED.doc_total,
        doc_currency = EXCLUDED.doc_currency,
        doc_status = EXCLUDED.doc_status,
        document_status = EXCLUDED.document_status,
        sales_person = EXCLUDED.sales_person,
        cancelled = EXCLUDED.cancelled,
        comments = EXCLUDED.comments,
        lines_json = EXCLUDED.lines_json,
        synced_at = NOW()
    `;

    const result = await db.query(sql, values);
    upserted += result.rowCount ?? 0;
  }

  return upserted;
}

export async function runSalesOrdersSync(): Promise<{
  ok: boolean;
  fetched: number;
  upserted: number;
  message: string;
}> {
  const startMs = Date.now();
  console.log("[dailySync] Iniciando sync de Pedidos de Venda...");

  const svc = getSapEntitiesService();
  if (!svc) {
    return { ok: false, fetched: 0, upserted: 0, message: "SAP client não configurado" };
  }

  try {
    await ensureTable();

    const orders = await svc.listSalesOrders(
      { limit: 5000 },
      `daily-sync-${Date.now()}`
    );

    const upserted = await upsertOrders(orders);
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    const msg = `Sync OK: ${orders.length} buscados, ${upserted} upserted em ${elapsed}s`;
    console.log(`[dailySync] ${msg}`);
    return { ok: true, fetched: orders.length, upserted, message: msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[dailySync] Erro: ${msg}`);
    return { ok: false, fetched: 0, upserted: 0, message: msg };
  }
}

export function startDailySyncScheduler() {
  if (!DB_URL) {
    console.warn("[dailySync] DATABASE_URL não configurada — scheduler desativado");
    return;
  }

  const isValid = cron.validate(SYNC_CRON);
  if (!isValid) {
    console.error(`[dailySync] Cron expression inválida: ${SYNC_CRON}`);
    return;
  }

  console.log(`[dailySync] Scheduler ativado — cron: "${SYNC_CRON}"`);

  cron.schedule(SYNC_CRON, async () => {
    console.log(`[dailySync] Cron disparado: ${new Date().toISOString()}`);
    await runSalesOrdersSync();
  });

  ensureTable().catch((err) => {
    console.warn(`[dailySync] Aviso ao criar tabela: ${err instanceof Error ? err.message : err}`);
  });
}

export async function querySalesOrders(opts: {
  dateFrom?: string;
  dateTo?: string;
  cardCode?: string;
  limit?: number;
  offset?: number;
}) {
  await ensureTable();
  const db = getPool();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.dateFrom) {
    conditions.push(`doc_date >= $${idx++}`);
    params.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push(`doc_date <= $${idx++}`);
    params.push(opts.dateTo);
  }
  if (opts.cardCode) {
    conditions.push(`card_code = $${idx++}`);
    params.push(opts.cardCode);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 500;
  const offset = opts.offset ?? 0;

  const countSql = `SELECT COUNT(*) as total FROM sap_sales_orders ${where}`;
  const dataSql = `
    SELECT doc_entry, doc_num, doc_date, doc_due_date, card_code, card_name,
           doc_total, doc_currency, doc_status, document_status, sales_person,
           cancelled, comments, lines_json, synced_at
    FROM sap_sales_orders ${where}
    ORDER BY doc_date DESC, doc_num DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRes, dataRes] = await Promise.all([
    db.query(countSql, params),
    db.query(dataSql, params),
  ]);

  return {
    total: Number(countRes.rows[0]?.total ?? 0),
    items: dataRes.rows,
  };
}
