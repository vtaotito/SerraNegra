import cron from "node-cron";
import pg from "pg";
import { createSapClient } from "../config/sap.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import { SapEntitiesService, type SapSalesOrderRow } from "../services/sapEntitiesService.js";

// ─── Config ───────────────────────────────────────────────────
const SYNC_CRON = process.env.SAP_SYNC_CRON ?? "0 * * * *"; // cada hora, minuto 0
const DB_URL = process.env.B2B_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const BOOT_SYNC_DELAY_MS = Number(process.env.SAP_BOOT_SYNC_DELAY_MS ?? "15000");

// ─── Pool ─────────────────────────────────────────────────────
let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: DB_URL, max: 5 });
  }
  return pool;
}

export function getDbPool(): pg.Pool {
  return getPool();
}

// ─── Schema ───────────────────────────────────────────────────
async function ensureSchema() {
  const db = getPool();

  // Migração: se tabela antiga existe com schema incompatível, recriar
  const oldCheck = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sap_sales_orders' AND column_name = 'sales_person'
  `);
  if (oldCheck.rows.length > 0) {
    console.log("[syncOrders] Migrando tabela antiga sap_sales_orders para novo schema...");
    await db.query(`DROP TABLE IF EXISTS sap_sales_order_lines CASCADE`);
    await db.query(`DROP TABLE IF EXISTS sap_sales_orders CASCADE`);
    await db.query(`DROP TABLE IF EXISTS sap_sync_log CASCADE`);
  }

  await db.query(`
    -- Pedidos de venda (cabeçalho)
    CREATE TABLE IF NOT EXISTS sap_sales_orders (
      doc_entry         INTEGER PRIMARY KEY,
      doc_num           INTEGER NOT NULL,
      doc_date          DATE,
      doc_due_date      DATE,
      card_code         TEXT,
      card_name         TEXT,
      doc_total         NUMERIC(18,2) DEFAULT 0,
      doc_currency      TEXT DEFAULT 'BRL',
      doc_status        TEXT,
      document_status   TEXT,
      sales_person_code INTEGER,
      cancelled         TEXT DEFAULT 'N',
      comments          TEXT,
      num_lines         INTEGER DEFAULT 0,
      total_quantity    NUMERIC(18,4) DEFAULT 0,
      raw_json          JSONB,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      synced_at         TIMESTAMPTZ DEFAULT NOW()
    );

    -- Linhas dos pedidos (itens)
    CREATE TABLE IF NOT EXISTS sap_sales_order_lines (
      id                SERIAL PRIMARY KEY,
      doc_entry         INTEGER NOT NULL REFERENCES sap_sales_orders(doc_entry) ON DELETE CASCADE,
      line_num          INTEGER,
      item_code         TEXT,
      item_description  TEXT,
      quantity          NUMERIC(18,4) DEFAULT 0,
      unit_price        NUMERIC(18,4) DEFAULT 0,
      line_total        NUMERIC(18,2) DEFAULT 0,
      discount_percent  NUMERIC(8,2) DEFAULT 0,
      warehouse_code    TEXT,
      UNIQUE (doc_entry, line_num)
    );

    -- Histórico de sincronizações
    CREATE TABLE IF NOT EXISTS sap_sync_log (
      id            SERIAL PRIMARY KEY,
      entity        TEXT NOT NULL DEFAULT 'sales_orders',
      started_at    TIMESTAMPTZ NOT NULL,
      finished_at   TIMESTAMPTZ,
      status        TEXT NOT NULL DEFAULT 'running',
      fetched       INTEGER DEFAULT 0,
      upserted      INTEGER DEFAULT 0,
      lines_written INTEGER DEFAULT 0,
      errors        INTEGER DEFAULT 0,
      duration_ms   INTEGER DEFAULT 0,
      message       TEXT,
      error_detail  TEXT
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_so_doc_date      ON sap_sales_orders (doc_date DESC);
    CREATE INDEX IF NOT EXISTS idx_so_card_code     ON sap_sales_orders (card_code);
    CREATE INDEX IF NOT EXISTS idx_so_doc_status    ON sap_sales_orders (doc_status);
    CREATE INDEX IF NOT EXISTS idx_so_synced        ON sap_sales_orders (synced_at DESC);
    CREATE INDEX IF NOT EXISTS idx_so_sales_person  ON sap_sales_orders (sales_person_code);
    CREATE INDEX IF NOT EXISTS idx_sol_doc_entry    ON sap_sales_order_lines (doc_entry);
    CREATE INDEX IF NOT EXISTS idx_sol_item_code    ON sap_sales_order_lines (item_code);
    CREATE INDEX IF NOT EXISTS idx_sync_log_entity  ON sap_sync_log (entity, started_at DESC);

    -- Colunas enriquecidas (linhas) — adicionadas via migração
    ALTER TABLE sap_sales_order_lines ADD COLUMN IF NOT EXISTS price NUMERIC(18,4) DEFAULT 0;
    ALTER TABLE sap_sales_order_lines ADD COLUMN IF NOT EXISTS cfop_code TEXT;
    ALTER TABLE sap_sales_order_lines ADD COLUMN IF NOT EXISTS weight NUMERIC(18,4) DEFAULT 0;
    ALTER TABLE sap_sales_order_lines ADD COLUMN IF NOT EXISTS tax_code TEXT;
    ALTER TABLE sap_sales_order_lines ADD COLUMN IF NOT EXISTS usage_code INTEGER;

    -- Views úteis para trabalhar sobre a base
    CREATE OR REPLACE VIEW vw_pedidos_resumo AS
    SELECT
      o.doc_entry,
      o.doc_num,
      o.doc_date,
      o.doc_due_date,
      o.card_code,
      o.card_name,
      o.doc_total,
      o.doc_currency,
      o.doc_status,
      o.cancelled,
      o.sales_person_code,
      o.num_lines,
      o.total_quantity,
      o.synced_at
    FROM sap_sales_orders o
    ORDER BY o.doc_date DESC, o.doc_num DESC;

    CREATE OR REPLACE VIEW vw_pedidos_por_cliente AS
    SELECT
      card_code,
      card_name,
      COUNT(*)                                       AS total_pedidos,
      SUM(doc_total)                                 AS valor_total,
      SUM(CASE WHEN cancelled = 'N' THEN doc_total ELSE 0 END) AS valor_ativo,
      SUM(total_quantity)                            AS qtd_total,
      MIN(doc_date)                                  AS primeiro_pedido,
      MAX(doc_date)                                  AS ultimo_pedido,
      COUNT(*) FILTER (WHERE doc_status = 'O' AND cancelled = 'N') AS pedidos_abertos,
      COUNT(*) FILTER (WHERE cancelled = 'Y')       AS pedidos_cancelados
    FROM sap_sales_orders
    GROUP BY card_code, card_name
    ORDER BY valor_total DESC;

    CREATE OR REPLACE VIEW vw_pedidos_por_vendedor AS
    SELECT
      sales_person_code,
      COUNT(*)                                       AS total_pedidos,
      SUM(doc_total)                                 AS valor_total,
      SUM(CASE WHEN cancelled = 'N' THEN doc_total ELSE 0 END) AS valor_ativo,
      COUNT(*) FILTER (WHERE doc_status = 'O' AND cancelled = 'N') AS pedidos_abertos,
      MIN(doc_date)                                  AS primeiro_pedido,
      MAX(doc_date)                                  AS ultimo_pedido
    FROM sap_sales_orders
    WHERE sales_person_code IS NOT NULL
    GROUP BY sales_person_code
    ORDER BY valor_total DESC;

    CREATE OR REPLACE VIEW vw_itens_mais_vendidos AS
    SELECT
      l.item_code,
      l.item_description,
      SUM(l.quantity)     AS qtd_total,
      SUM(l.line_total)   AS valor_total,
      COUNT(DISTINCT l.doc_entry) AS em_pedidos,
      AVG(l.unit_price)   AS preco_medio
    FROM sap_sales_order_lines l
    INNER JOIN sap_sales_orders o ON o.doc_entry = l.doc_entry AND o.cancelled = 'N'
    GROUP BY l.item_code, l.item_description
    ORDER BY qtd_total DESC;

    CREATE OR REPLACE VIEW vw_pedidos_por_mes AS
    SELECT
      DATE_TRUNC('month', doc_date)::DATE AS mes,
      COUNT(*)                            AS total_pedidos,
      SUM(doc_total)                      AS valor_total,
      SUM(total_quantity)                 AS qtd_total,
      COUNT(*) FILTER (WHERE cancelled = 'Y') AS cancelados
    FROM sap_sales_orders
    GROUP BY DATE_TRUNC('month', doc_date)
    ORDER BY mes DESC;

    CREATE OR REPLACE VIEW vw_ultimo_sync AS
    SELECT
      id, entity, started_at, finished_at, status,
      fetched, upserted, lines_written, errors,
      duration_ms, message
    FROM sap_sync_log
    WHERE entity = 'sales_orders'
    ORDER BY started_at DESC
    LIMIT 1;
  `);
}

// ─── SAP client helper ────────────────────────────────────────
function getSapEntitiesService(): SapEntitiesService | null {
  const logger = {
    debug: (msg: string) => console.log(`[syncOrders] ${msg}`),
    info: (msg: string) => console.log(`[syncOrders] ${msg}`),
    warn: (msg: string) => console.warn(`[syncOrders] ${msg}`),
    error: (msg: string) => console.error(`[syncOrders] ${msg}`),
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

// ─── Normalização dos enums SAP ───────────────────────────────
function normCancelled(raw: unknown): string {
  const s = String(raw ?? "");
  if (s === "tYES" || s === "Y") return "Y";
  return "N";
}
function normDocStatus(raw: unknown, docStatus: unknown): string {
  const ds = String(docStatus ?? "");
  if (ds === "O" || ds === "C") return ds;
  const s = String(raw ?? "");
  if (s.includes("Open")) return "O";
  if (s.includes("Close")) return "C";
  return ds || "O";
}

// ─── Upsert pedidos + linhas ──────────────────────────────────
async function upsertOrders(orders: SapSalesOrderRow[]) {
  const db = getPool();
  let upsertedOrders = 0;
  let linesWritten = 0;

  for (const o of orders) {
    const docEntry = o.DocEntry ?? 0;
    if (!docEntry) continue;

    const lines = o.DocumentLines ?? [];
    const totalQty = lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
    const cancelled = normCancelled(o.Cancelled);
    const docStatus = normDocStatus(o.DocumentStatus, o.DocStatus);

    const orderSql = `
      INSERT INTO sap_sales_orders (
        doc_entry, doc_num, doc_date, doc_due_date, card_code, card_name,
        doc_total, doc_currency, doc_status, document_status, sales_person_code,
        cancelled, comments, num_lines, total_quantity, raw_json, synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
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
        sales_person_code = EXCLUDED.sales_person_code,
        cancelled = EXCLUDED.cancelled,
        comments = EXCLUDED.comments,
        num_lines = EXCLUDED.num_lines,
        total_quantity = EXCLUDED.total_quantity,
        raw_json = EXCLUDED.raw_json,
        synced_at = NOW()
    `;

    await db.query(orderSql, [
      docEntry,
      o.DocNum ?? null,
      o.DocDate ?? null,
      o.DocDueDate ?? null,
      o.CardCode ?? null,
      o.CardName ?? null,
      o.DocTotal ?? 0,
      o.DocCurrency ?? "BRL",
      docStatus,
      String(o.DocumentStatus ?? ""),
      o.SalesPersonCode ?? null,
      cancelled,
      o.Comments ?? null,
      lines.length,
      totalQty,
      JSON.stringify(o),
    ]);
    upsertedOrders++;

    // Upsert linhas
    if (lines.length > 0) {
      await db.query(`DELETE FROM sap_sales_order_lines WHERE doc_entry = $1`, [docEntry]);

      for (const l of lines) {
        await db.query(
          `INSERT INTO sap_sales_order_lines
            (doc_entry, line_num, item_code, item_description, quantity, unit_price, line_total, discount_percent, warehouse_code, price, cfop_code, weight, tax_code, usage_code)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            docEntry,
            l.LineNum ?? null,
            l.ItemCode ?? null,
            l.ItemDescription ?? null,
            l.Quantity ?? 0,
            l.UnitPrice ?? l.Price ?? 0,
            l.LineTotal ?? 0,
            l.DiscountPercent ?? 0,
            l.WarehouseCode ?? null,
            l.Price ?? 0,
            (l as any).CFOPCode ?? null,
            (l as any).Weight1 ?? 0,
            (l as any).TaxCode ?? null,
            (l as any).Usage ?? null,
          ]
        );
        linesWritten++;
      }
    }
  }

  return { upsertedOrders, linesWritten };
}

// ─── Upsert apenas headers (sem linhas) ──────────────────────
async function upsertOrderHeaders(orders: SapSalesOrderRow[]) {
  const db = getPool();
  let count = 0;

  for (const o of orders) {
    const docEntry = o.DocEntry ?? 0;
    if (!docEntry) continue;

    const lines = o.DocumentLines ?? [];
    const totalQty = lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
    const cancelled = normCancelled(o.Cancelled);
    const docStatus = normDocStatus(o.DocumentStatus, o.DocStatus);

    await db.query(`
      INSERT INTO sap_sales_orders (
        doc_entry, doc_num, doc_date, doc_due_date, card_code, card_name,
        doc_total, doc_currency, doc_status, document_status, sales_person_code,
        cancelled, comments, num_lines, total_quantity, raw_json, synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
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
        sales_person_code = EXCLUDED.sales_person_code,
        cancelled = EXCLUDED.cancelled,
        comments = EXCLUDED.comments,
        num_lines = CASE WHEN EXCLUDED.num_lines > 0 THEN EXCLUDED.num_lines ELSE sap_sales_orders.num_lines END,
        total_quantity = CASE WHEN EXCLUDED.total_quantity > 0 THEN EXCLUDED.total_quantity ELSE sap_sales_orders.total_quantity END,
        raw_json = EXCLUDED.raw_json,
        synced_at = NOW()
    `, [
      docEntry,
      o.DocNum ?? null,
      o.DocDate ?? null,
      o.DocDueDate ?? null,
      o.CardCode ?? null,
      o.CardName ?? null,
      o.DocTotal ?? 0,
      o.DocCurrency ?? "BRL",
      docStatus,
      String(o.DocumentStatus ?? ""),
      o.SalesPersonCode ?? null,
      cancelled,
      o.Comments ?? null,
      lines.length,
      totalQty,
      JSON.stringify(o),
    ]);
    count++;
  }
  return count;
}

// ─── Run sync (com mutex) ─────────────────────────────────────
let syncRunning = false;

export async function runSalesOrdersSync(): Promise<{
  ok: boolean;
  fetched: number;
  upserted: number;
  linesWritten: number;
  message: string;
  durationMs: number;
}> {
  if (syncRunning) {
    console.log("[syncOrders] Sync já em execução, pulando.");
    return { ok: true, fetched: 0, upserted: 0, linesWritten: 0, message: "Sync já em execução", durationMs: 0 };
  }
  syncRunning = true;
  const startMs = Date.now();
  const db = getPool();

  console.log("[syncOrders] Iniciando sync de Pedidos de Venda...");

  const logRes = await db.query(
    `INSERT INTO sap_sync_log (entity, started_at, status) VALUES ('sales_orders', NOW(), 'running') RETURNING id`
  );
  const logId = logRes.rows[0]?.id;

  const svc = getSapEntitiesService();
  if (!svc) {
    syncRunning = false;
    const msg = "SAP client não configurado";
    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), message=$1, duration_ms=$2 WHERE id=$3`,
      [msg, Date.now() - startMs, logId]
    );
    return { ok: false, fetched: 0, upserted: 0, linesWritten: 0, message: msg, durationMs: Date.now() - startMs };
  }

  try {
    console.log("[syncOrders] Paginando e salvando pedidos em lotes...");

    const client = svc.getSapClient();
    const preferHeaders = { "Prefer": "odata.maxpagesize=500" };
    const PAGE_SIZE = 500;
    let skip = 0;
    let totalFetched = 0;
    let totalSaved = 0;
    let emptyPages = 0;

    while (true) {
      const url = `/Orders?$top=${PAGE_SIZE}&$skip=${skip}&$orderby=DocDate desc`;
      try {
        const res = await client.get<{ value: SapSalesOrderRow[] }>(url, {
          correlationId: `sync-${Date.now()}`,
          headers: preferHeaders,
        });
        const page = res.data.value || [];

        if (page.length === 0) {
          emptyPages++;
          if (emptyPages >= 2) break;
          skip += PAGE_SIZE;
          continue;
        }
        emptyPages = 0;

        const saved = await upsertOrderHeaders(page);
        totalFetched += page.length;
        totalSaved += saved;
        skip += page.length;

        if (totalFetched % 2000 === 0 || page.length < PAGE_SIZE) {
          const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
          console.log(`[syncOrders] Progresso: ${totalFetched} buscados, ${totalSaved} salvos (${elapsed}s)`);
        }

        if (page.length < PAGE_SIZE) break;
        if (totalFetched >= 50000) break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[syncOrders] Erro na página skip=${skip}: ${errMsg}`);
        if (totalFetched > 0) break;
        throw err;
      }
    }

    const durationMs = Date.now() - startMs;
    const elapsed = (durationMs / 1000).toFixed(1);

    const msg = `Sync OK: ${totalFetched} pedidos buscados, ${totalSaved} salvos em ${elapsed}s`;
    console.log(`[syncOrders] ${msg}`);

    await db.query(
      `UPDATE sap_sync_log SET status='success', finished_at=NOW(), fetched=$1, upserted=$2, lines_written=0, duration_ms=$3, message=$4 WHERE id=$5`,
      [totalFetched, totalSaved, durationMs, msg, logId]
    );

    return { ok: true, fetched: totalFetched, upserted: totalSaved, linesWritten: 0, message: msg, durationMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error(`[syncOrders] Erro: ${msg}`);

    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), duration_ms=$1, message='Erro na sync', error_detail=$2 WHERE id=$3`,
      [durationMs, msg.slice(0, 2000), logId]
    ).catch(() => {});

    return { ok: false, fetched: 0, upserted: 0, linesWritten: 0, message: msg, durationMs };
  } finally {
    syncRunning = false;
  }
}

// ─── Query helpers (usados pelas rotas) ───────────────────────
export async function querySalesOrders(opts: {
  dateFrom?: string;
  dateTo?: string;
  cardCode?: string;
  status?: string;
  salesPerson?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getPool();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.dateFrom) { conditions.push(`o.doc_date >= $${idx++}`); params.push(opts.dateFrom); }
  if (opts.dateTo)   { conditions.push(`o.doc_date <= $${idx++}`); params.push(opts.dateTo); }
  if (opts.cardCode) { conditions.push(`o.card_code = $${idx++}`); params.push(opts.cardCode); }
  if (opts.status === "open")      conditions.push(`o.doc_status = 'O' AND o.cancelled = 'N'`);
  if (opts.status === "closed")    conditions.push(`o.doc_status = 'C' AND o.cancelled = 'N'`);
  if (opts.status === "cancelled") conditions.push(`o.cancelled = 'Y'`);
  if (opts.salesPerson != null)    { conditions.push(`o.sales_person_code = $${idx++}`); params.push(opts.salesPerson); }
  if (opts.search) {
    conditions.push(`(
      o.card_name ILIKE $${idx} OR o.card_code ILIKE $${idx} OR CAST(o.doc_num AS TEXT) ILIKE $${idx}
      OR EXISTS (SELECT 1 FROM sap_sales_order_lines l WHERE l.doc_entry = o.doc_entry AND (l.item_code ILIKE $${idx} OR l.item_description ILIKE $${idx}))
    )`);
    params.push(`%${opts.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 50000;
  const offset = opts.offset ?? 0;

  const countSql = `SELECT COUNT(*) as total FROM sap_sales_orders o ${where}`;
  const dataSql = `
    SELECT
      o.doc_entry, o.doc_num, o.doc_date, o.doc_due_date, o.card_code, o.card_name,
      o.doc_total, o.doc_currency, o.doc_status, o.document_status, o.sales_person_code,
      o.cancelled, o.comments, o.num_lines, o.total_quantity, o.synced_at,
      o.raw_json->>'PaymentMethod' AS payment_method,
      (o.raw_json->>'PaymentGroupCode')::int AS payment_group_code,
      o.raw_json->>'ShipToCode' AS ship_to_code,
      o.raw_json->>'TaxDate' AS tax_date,
      o.raw_json->>'Address' AS address,
      o.raw_json->>'Address2' AS address2,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'LineNum', l.line_num, 'ItemCode', l.item_code, 'ItemDescription', l.item_description,
          'Quantity', l.quantity, 'UnitPrice', l.unit_price, 'LineTotal', l.line_total,
          'DiscountPercent', l.discount_percent, 'WarehouseCode', l.warehouse_code,
          'Price', l.price, 'CFOPCode', l.cfop_code, 'Weight', l.weight
        ) ORDER BY l.line_num)
        FROM sap_sales_order_lines l WHERE l.doc_entry = o.doc_entry),
        (SELECT json_agg(json_build_object(
          'LineNum', (dl->>'LineNum')::int,
          'ItemCode', dl->>'ItemCode',
          'ItemDescription', dl->>'ItemDescription',
          'Quantity', (dl->>'Quantity')::numeric,
          'UnitPrice', (dl->>'UnitPrice')::numeric,
          'LineTotal', (dl->>'LineTotal')::numeric,
          'DiscountPercent', (dl->>'DiscountPercent')::numeric,
          'WarehouseCode', dl->>'WarehouseCode',
          'Price', (dl->>'Price')::numeric,
          'CFOPCode', dl->>'CFOPCode',
          'Weight', (dl->>'Weight1')::numeric
        ) ORDER BY (dl->>'LineNum')::int)
        FROM jsonb_array_elements(o.raw_json->'DocumentLines') dl),
        '[]'::json
      ) AS lines
    FROM sap_sales_orders o ${where}
    ORDER BY o.doc_date DESC, o.doc_num DESC
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

export async function querySyncHistory(limit = 20) {
  const db = getPool();
  const res = await db.query(
    `SELECT id, entity, started_at, finished_at, status, fetched, upserted, lines_written, errors, duration_ms, message, error_detail
     FROM sap_sync_log WHERE entity = 'sales_orders'
     ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function queryDbStats() {
  const db = getPool();
  const res = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM sap_sales_orders) AS total_pedidos,
      (SELECT COUNT(*) FROM sap_sales_orders WHERE cancelled = 'N') AS pedidos_ativos,
      (SELECT COUNT(*) FROM sap_sales_orders WHERE doc_status = 'O' AND cancelled = 'N') AS pedidos_abertos,
      (SELECT COUNT(*) FROM sap_sales_order_lines) AS total_linhas,
      (SELECT SUM(doc_total) FROM sap_sales_orders WHERE cancelled = 'N') AS valor_total_ativo,
      (SELECT MIN(doc_date) FROM sap_sales_orders) AS data_mais_antiga,
      (SELECT MAX(doc_date) FROM sap_sales_orders) AS data_mais_recente,
      (SELECT MAX(synced_at) FROM sap_sales_orders) AS ultimo_sync,
      (SELECT COUNT(DISTINCT card_code) FROM sap_sales_orders) AS clientes_distintos,
      (SELECT COUNT(DISTINCT item_code) FROM sap_sales_order_lines) AS itens_distintos
  `);
  return res.rows[0] ?? {};
}

// ─── Scheduler ────────────────────────────────────────────────
export async function startSyncScheduler() {
  if (!DB_URL) {
    console.warn("[syncOrders] DATABASE_URL não configurada — scheduler desativado");
    return;
  }

  // Criar schema
  try {
    await ensureSchema();
    console.log("[syncOrders] Schema criado/verificado com sucesso");
  } catch (err) {
    console.error(`[syncOrders] Erro ao criar schema: ${err instanceof Error ? err.message : err}`);
    return;
  }

  // Validar cron
  if (!cron.validate(SYNC_CRON)) {
    console.error(`[syncOrders] Cron expression inválida: ${SYNC_CRON}`);
    return;
  }

  console.log(`[syncOrders] Scheduler ativado — cron: "${SYNC_CRON}" (a cada hora)`);

  // Job recorrente
  cron.schedule(SYNC_CRON, async () => {
    console.log(`[syncOrders] Cron disparado: ${new Date().toISOString()}`);
    await runSalesOrdersSync();
  });

  // Sync inicial após boot (com delay para garantir que o SAP está acessível)
  setTimeout(async () => {
    console.log("[syncOrders] Executando sync inicial pós-boot...");
    await runSalesOrdersSync();
  }, BOOT_SYNC_DELAY_MS);
}

// Manter compatibilidade com import anterior
export const startDailySyncScheduler = startSyncScheduler;
