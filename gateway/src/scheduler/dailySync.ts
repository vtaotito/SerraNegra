import cron from "node-cron";
import pg from "pg";
import { createSapClient } from "../config/sap.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import { SapEntitiesService, type SapSalesOrderRow, type SapInvoiceRow, type SapInvoiceLine } from "../services/sapEntitiesService.js";
import { InventoryEnrichmentService } from "../services/inventoryEnrichmentService.js";

// ─── Config ───────────────────────────────────────────────────
const SYNC_CRON = process.env.SAP_SYNC_CRON ?? "0 * * * *"; // cada hora, minuto 0
const DB_URL = process.env.B2B_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const CORE_BASE_URL = process.env.CORE_BASE_URL ?? "http://localhost:8000";
const BOOT_SYNC_DELAY_MS = Number(process.env.SAP_BOOT_SYNC_DELAY_MS ?? "15000");
// 400 dias cobre os 12 meses exibidos no catálogo/detalhe de produto, com folga
const LINES_ENRICH_DAYS = Number(process.env.SAP_LINES_ENRICH_DAYS ?? "400");
const LINES_ENRICH_CONCURRENCY = Number(process.env.SAP_LINES_ENRICH_CONCURRENCY ?? "10");
const LINES_ENRICH_BATCH = Number(process.env.SAP_LINES_ENRICH_BATCH ?? "2000");
// Janela (dias) de movimentações de estoque (OINM) sincronizadas a cada execução.
const MOVEMENTS_SYNC_DAYS = Number(process.env.SAP_MOVEMENTS_SYNC_DAYS ?? "120");

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

    -- Marca quando as linhas do pedido foram buscadas no SAP (mesmo que vazias,
    -- ex.: pedidos de frete) — evita re-buscar o mesmo pedido a cada sync
    ALTER TABLE sap_sales_orders ADD COLUMN IF NOT EXISTS lines_synced_at TIMESTAMPTZ;

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

    -- Notas fiscais (cabeçalho) — espelho local do SAP
    CREATE TABLE IF NOT EXISTS sap_invoices (
      doc_entry         INTEGER PRIMARY KEY,
      doc_num           INTEGER NOT NULL,
      doc_date          DATE,
      doc_due_date      DATE,
      tax_date          DATE,
      card_code         TEXT,
      card_name         TEXT,
      doc_total         NUMERIC(18,2) DEFAULT 0,
      document_status   TEXT,
      cancelled         TEXT DEFAULT 'N',
      payment_method    TEXT,
      payment_group_code INTEGER,
      sales_person_code INTEGER,
      num_lines         INTEGER DEFAULT 0,
      total_quantity    NUMERIC(18,4) DEFAULT 0,
      synced_at         TIMESTAMPTZ DEFAULT NOW()
    );

    -- Linhas das notas fiscais
    CREATE TABLE IF NOT EXISTS sap_invoice_lines (
      id                SERIAL PRIMARY KEY,
      doc_entry         INTEGER NOT NULL REFERENCES sap_invoices(doc_entry) ON DELETE CASCADE,
      item_code         TEXT,
      item_description  TEXT,
      quantity          NUMERIC(18,4) DEFAULT 0,
      unit_price        NUMERIC(18,4) DEFAULT 0,
      price             NUMERIC(18,4) DEFAULT 0,
      line_total        NUMERIC(18,2) DEFAULT 0,
      discount_percent  NUMERIC(8,2) DEFAULT 0,
      cfop_code         TEXT,
      usage_code        INTEGER,
      UNIQUE (doc_entry, item_code, quantity)
    );

    CREATE INDEX IF NOT EXISTS idx_inv_doc_date     ON sap_invoices (doc_date DESC);
    CREATE INDEX IF NOT EXISTS idx_inv_card_code    ON sap_invoices (card_code);
    CREATE INDEX IF NOT EXISTS idx_inv_sales_person ON sap_invoices (sales_person_code);
    CREATE INDEX IF NOT EXISTS idx_inv_cancelled    ON sap_invoices (cancelled);
    CREATE INDEX IF NOT EXISTS idx_invl_doc_entry   ON sap_invoice_lines (doc_entry);
    CREATE INDEX IF NOT EXISTS idx_invl_item_code   ON sap_invoice_lines (item_code);

    -- Migrations idempotentes — adicionar campos fiscais e relação com pedido base.
    -- Cabeçalho:
    ALTER TABLE sap_invoices ADD COLUMN IF NOT EXISTS nfe_number     TEXT;
    ALTER TABLE sap_invoices ADD COLUMN IF NOT EXISTS folio_number   TEXT;
    ALTER TABLE sap_invoices ADD COLUMN IF NOT EXISTS nfe_key        TEXT;
    ALTER TABLE sap_invoices ADD COLUMN IF NOT EXISTS series_number  INTEGER;
    ALTER TABLE sap_invoices ADD COLUMN IF NOT EXISTS base_doc_entry INTEGER;
    ALTER TABLE sap_invoices ADD COLUMN IF NOT EXISTS base_doc_num   INTEGER;
    CREATE INDEX IF NOT EXISTS idx_inv_nfe_number    ON sap_invoices (nfe_number);
    CREATE INDEX IF NOT EXISTS idx_inv_base_doc      ON sap_invoices (base_doc_entry);

    -- Linhas: relação com pedido fonte (BaseType=17 = Sales Order).
    ALTER TABLE sap_invoice_lines ADD COLUMN IF NOT EXISTS base_entry INTEGER;
    ALTER TABLE sap_invoice_lines ADD COLUMN IF NOT EXISTS base_type  INTEGER;
    ALTER TABLE sap_invoice_lines ADD COLUMN IF NOT EXISTS base_line  INTEGER;
    CREATE INDEX IF NOT EXISTS idx_invl_base_entry ON sap_invoice_lines (base_entry);

    -- Overrides de markup (custos que não existem no SAP ou divergem)
    CREATE TABLE IF NOT EXISTS markup_overrides (
      item_code         VARCHAR(50) PRIMARY KEY,
      frete             NUMERIC(12,2),
      embalagem         NUMERIC(12,2),
      comissao          NUMERIC(12,2),
      pis_cofins        NUMERIC(6,4),
      icms_compra       NUMERIC(6,4),
      ipi               NUMERIC(6,4),
      custo_fixo_saco   NUMERIC(6,4) DEFAULT 0.06,
      custo_fixo_pallet NUMERIC(6,4) DEFAULT 0.03,
      qtd_pallet        INTEGER,
      qtd_saco          INTEGER,
      preco_sem_imp     NUMERIC(12,2),
      updated_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_by        VARCHAR(100)
    );
    CREATE INDEX IF NOT EXISTS idx_markup_item ON markup_overrides (item_code);
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

// ─── Upsert invoices + lines ──────────────────────────────────
async function upsertInvoices(invoices: SapInvoiceRow[]) {
  const db = getPool();
  let upserted = 0;
  let linesWritten = 0;

  for (const inv of invoices) {
    const docEntry = inv.DocEntry ?? 0;
    if (!docEntry) continue;

    const lines = inv.DocumentLines ?? [];
    const totalQty = lines.reduce((s, l) => s + (l.Quantity ?? 0), 0);
    const cancelled = normCancelled(inv.Cancelled);

    // Campos fiscais BR — extrai do payload do SAP (podem vir como null/undefined)
    const invAny = inv as Record<string, unknown>;
    const nfeNumber =
      (invAny["U_TX_NDfe"] as string | null | undefined) ??
      (invAny["U_nfe_NDfe"] as string | null | undefined) ??
      null;
    const folioNumber = invAny["FolioNumber"] != null ? String(invAny["FolioNumber"]) : null;
    const nfeKey =
      (invAny["U_nfe_ChaveAcesso"] as string | null | undefined) ??
      (invAny["U_ChaveAcesso"] as string | null | undefined) ??
      null;
    const seriesNumber = invAny["Series"] != null ? Number(invAny["Series"]) : null;

    // Relação com pedido base — pega a primeira linha com BaseType = 17 (Sales Order)
    let baseDocEntry: number | null = null;
    for (const l of lines) {
      const lineAny = l as Record<string, unknown>;
      const bt = Number(lineAny["BaseType"] ?? -1);
      const be = Number(lineAny["BaseEntry"] ?? 0);
      if (bt === 17 && be > 0) {
        baseDocEntry = be;
        break;
      }
    }

    await db.query(`
      INSERT INTO sap_invoices (
        doc_entry, doc_num, doc_date, doc_due_date, tax_date, card_code, card_name,
        doc_total, document_status, cancelled, payment_method, payment_group_code,
        sales_person_code, num_lines, total_quantity,
        nfe_number, folio_number, nfe_key, series_number, base_doc_entry, synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
      ON CONFLICT (doc_entry) DO UPDATE SET
        doc_num = EXCLUDED.doc_num,
        doc_date = EXCLUDED.doc_date,
        doc_due_date = EXCLUDED.doc_due_date,
        tax_date = EXCLUDED.tax_date,
        card_code = EXCLUDED.card_code,
        card_name = EXCLUDED.card_name,
        doc_total = EXCLUDED.doc_total,
        document_status = EXCLUDED.document_status,
        cancelled = EXCLUDED.cancelled,
        payment_method = EXCLUDED.payment_method,
        payment_group_code = EXCLUDED.payment_group_code,
        sales_person_code = EXCLUDED.sales_person_code,
        num_lines = EXCLUDED.num_lines,
        total_quantity = EXCLUDED.total_quantity,
        nfe_number = EXCLUDED.nfe_number,
        folio_number = EXCLUDED.folio_number,
        nfe_key = EXCLUDED.nfe_key,
        series_number = EXCLUDED.series_number,
        base_doc_entry = COALESCE(EXCLUDED.base_doc_entry, sap_invoices.base_doc_entry),
        synced_at = NOW()
    `, [
      docEntry,
      inv.DocNum ?? null,
      inv.DocDate ?? null,
      inv.DocDueDate ?? null,
      inv.TaxDate ?? null,
      inv.CardCode ?? null,
      inv.CardName ?? null,
      inv.DocTotal ?? 0,
      String(inv.DocumentStatus ?? ""),
      cancelled,
      inv.PaymentMethod ?? null,
      inv.PaymentGroupCode ?? null,
      inv.SalesPersonCode ?? null,
      lines.length,
      totalQty,
      nfeNumber,
      folioNumber,
      nfeKey,
      seriesNumber,
      baseDocEntry,
    ]);
    upserted++;

    if (lines.length > 0) {
      await db.query(`DELETE FROM sap_invoice_lines WHERE doc_entry = $1`, [docEntry]);
      for (const l of lines) {
        const lineAny = l as Record<string, unknown>;
        const baseEntry = lineAny["BaseEntry"] != null ? Number(lineAny["BaseEntry"]) : null;
        const baseType = lineAny["BaseType"] != null ? Number(lineAny["BaseType"]) : null;
        const baseLine = lineAny["BaseLine"] != null ? Number(lineAny["BaseLine"]) : null;

        await db.query(
          `INSERT INTO sap_invoice_lines
            (doc_entry, item_code, item_description, quantity, unit_price, price, line_total, discount_percent, cfop_code, usage_code,
             base_entry, base_type, base_line)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            docEntry,
            l.ItemCode ?? null,
            l.ItemDescription ?? null,
            l.Quantity ?? 0,
            l.UnitPrice ?? l.Price ?? 0,
            l.Price ?? 0,
            l.LineTotal ?? 0,
            l.DiscountPercent ?? 0,
            l.CFOPCode ?? null,
            l.Usage ?? null,
            baseEntry && baseEntry > 0 ? baseEntry : null,
            baseType ?? null,
            baseLine ?? null,
          ]
        );
        linesWritten++;
      }
    }
  }

  // Resolve base_doc_num via JOIN com sap_sales_orders (espelho local).
  // Roda em batch após upsert para popular o número visível do pedido base.
  await db.query(`
    UPDATE sap_invoices i
       SET base_doc_num = so.doc_num
      FROM sap_sales_orders so
     WHERE i.base_doc_entry IS NOT NULL
       AND i.base_doc_entry = so.doc_entry
       AND (i.base_doc_num IS NULL OR i.base_doc_num <> so.doc_num);
  `);

  return { upserted, linesWritten };
}

// ─── Enriquecer pedidos recentes com DocumentLines (batch) ────
async function enrichRecentOrderLines(svc: SapEntitiesService) {
  const db = getPool();
  const client = svc.getSapClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LINES_ENRICH_DAYS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const res = await db.query(
    `SELECT doc_entry FROM sap_sales_orders
     WHERE doc_date >= $1
       AND lines_synced_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM sap_sales_order_lines l WHERE l.doc_entry = sap_sales_orders.doc_entry)
     ORDER BY doc_date DESC
     LIMIT $2`,
    [cutoff, LINES_ENRICH_BATCH]
  );

  const missing = res.rows.map((r) => r.doc_entry as number);
  if (missing.length === 0) {
    console.log("[syncOrders] Enrich: todos os pedidos recentes já possuem linhas.");
    return 0;
  }

  console.log(`[syncOrders] Enrich: ${missing.length} pedidos sem linhas (últimos ${LINES_ENRICH_DAYS} dias). Buscando no SAP...`);

  let enriched = 0;
  let errors = 0;

  for (let i = 0; i < missing.length; i += LINES_ENRICH_CONCURRENCY) {
    const batch = missing.slice(i, i + LINES_ENRICH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (docEntry) => {
        try {
          const full = await client.get<any>(`/Orders(${docEntry})`, {
            correlationId: `enrich-${docEntry}`,
          });
          const sapLines = full.data?.DocumentLines ?? [];

          if (sapLines.length === 0) {
            // Pedido sem itens (ex.: frete) — marca como sincronizado para não
            // consumir o orçamento de enriquecimento a cada sync
            await db.query(
              `UPDATE sap_sales_orders SET lines_synced_at = NOW() WHERE doc_entry = $1`,
              [docEntry]
            );
            return 0;
          }

          await db.query(`DELETE FROM sap_sales_order_lines WHERE doc_entry = $1`, [docEntry]);
          for (const l of sapLines) {
            await db.query(
              `INSERT INTO sap_sales_order_lines
                (doc_entry, line_num, item_code, item_description, quantity, unit_price, line_total, discount_percent, warehouse_code, price, cfop_code, weight, tax_code, usage_code)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
              [docEntry, l.LineNum, l.ItemCode, l.ItemDescription, l.Quantity ?? 0, l.UnitPrice ?? l.Price ?? 0, l.LineTotal ?? 0, l.DiscountPercent ?? 0, l.WarehouseCode, l.Price ?? 0, l.CFOPCode ?? null, l.Weight1 ?? 0, l.TaxCode ?? null, l.Usage ?? null]
            );
          }

          await db.query(
            `UPDATE sap_sales_orders SET num_lines = $1, total_quantity = $2, lines_synced_at = NOW() WHERE doc_entry = $3`,
            [sapLines.length, sapLines.reduce((s: number, l: any) => s + (l.Quantity ?? 0), 0), docEntry]
          );

          return sapLines.length;
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value != null) enriched++;
      else errors++;
    }

    if (i > 0 && i % 100 === 0) {
      console.log(`[syncOrders] Enrich progresso: ${i}/${missing.length} (${enriched} OK, ${errors} erros)`);
    }
  }

  console.log(`[syncOrders] Enrich completo: ${enriched}/${missing.length} pedidos enriquecidos com linhas.`);
  return enriched;
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

    // Phase 2: enriquecer pedidos recentes com DocumentLines
    let linesEnriched = 0;
    try {
      linesEnriched = await enrichRecentOrderLines(svc);
    } catch (err) {
      console.warn(`[syncOrders] Enrich de linhas falhou (não-fatal): ${err instanceof Error ? err.message : err}`);
    }

    const durationMs = Date.now() - startMs;
    const elapsed = (durationMs / 1000).toFixed(1);

    const msg = `Sync OK: ${totalFetched} pedidos buscados, ${totalSaved} salvos, ${linesEnriched} enriquecidos com linhas em ${elapsed}s`;
    console.log(`[syncOrders] ${msg}`);

    await db.query(
      `UPDATE sap_sync_log SET status='success', finished_at=NOW(), fetched=$1, upserted=$2, lines_written=$3, duration_ms=$4, message=$5 WHERE id=$6`,
      [totalFetched, totalSaved, linesEnriched, durationMs, msg, logId]
    );

    return { ok: true, fetched: totalFetched, upserted: totalSaved, linesWritten: linesEnriched, message: msg, durationMs };
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

/**
 * Aggregated product analytics — all heavy work done in PostgreSQL.
 * Returns ~200-500 rows instead of 50k raw orders.
 */
export async function queryProductAnalytics(opts: {
  dateFrom: string;
  dateTo: string;
  date3mCutoff: string;
  estado?: string;
  salesPerson?: number;
}) {
  const db = getPool();
  const conditions: string[] = ["o.cancelled = 'N'"];
  const params: unknown[] = [];
  let idx = 1;

  conditions.push(`o.doc_date >= $${idx++}`); params.push(opts.dateFrom);
  conditions.push(`o.doc_date <= $${idx++}`); params.push(opts.dateTo);

  const date3mIdx = idx++;
  params.push(opts.date3mCutoff);

  if (opts.salesPerson != null) {
    conditions.push(`o.sales_person_code = $${idx++}`);
    params.push(opts.salesPerson);
  }
  if (opts.estado) {
    conditions.push(`(
      substring(COALESCE(o.raw_json->>'Address','') from '-([A-Z]{2})[[:space:]]') = $${idx}
      OR substring(COALESCE(o.raw_json->>'Address2','') from '-([A-Z]{2})[[:space:]]') = $${idx}
    )`);
    params.push(opts.estado);
    idx++;
  }

  const where = conditions.join(" AND ");

  const sql = `
    WITH all_lines AS (
      SELECT o.doc_entry, o.doc_date, o.card_code, o.sales_person_code,
             l.item_code, l.item_description, l.quantity, l.line_total, l.unit_price, l.discount_percent
      FROM sap_sales_orders o
      INNER JOIN sap_sales_order_lines l ON l.doc_entry = o.doc_entry
      WHERE ${where}
    )
    SELECT
      item_code,
      item_description,
      SUM(quantity)::float                                         AS total_qty,
      SUM(line_total)::float                                       AS total_revenue,
      MAX(CASE WHEN line_total > 0 THEN line_total END)::float     AS max_sale,
      MIN(CASE WHEN line_total > 0 THEN line_total END)::float     AS min_sale,
      COUNT(*)::int                                                AS sale_count,
      COUNT(DISTINCT card_code)::int                               AS unique_clients,
      SUM(CASE WHEN doc_date >= $${date3mIdx} THEN quantity ELSE 0 END)::float  AS qty_3m,
      SUM(CASE WHEN doc_date >= $${date3mIdx} THEN line_total ELSE 0 END)::float AS revenue_3m,
      MIN(doc_date)                                                AS first_sale_date,
      MAX(doc_date)                                                AS last_sale_date
    FROM all_lines
    WHERE item_code IS NOT NULL AND item_code <> ''
    GROUP BY item_code, item_description
    ORDER BY total_revenue DESC
  `;

  const filtersSql = `
    SELECT
      array_agg(DISTINCT uf ORDER BY uf) FILTER (WHERE uf IS NOT NULL) AS estados,
      array_agg(DISTINCT sales_person_code ORDER BY sales_person_code) FILTER (WHERE sales_person_code IS NOT NULL) AS vendedor_codes
    FROM (
      SELECT
        sales_person_code,
        COALESCE(
          substring(COALESCE(raw_json->>'Address','') from '-([A-Z]{2})[[:space:]]'),
          substring(COALESCE(raw_json->>'Address2','') from '-([A-Z]{2})[[:space:]]')
        ) AS uf
      FROM sap_sales_orders
      WHERE cancelled = 'N' AND doc_date >= $1 AND doc_date <= $2
    ) sub
  `;

  // Totais globais via HEADER (doc_total) — independem das linhas detalhadas estarem sincronizadas.
  // Necessário porque o sync de linhas só cobre os últimos N dias (SAP_LINES_ENRICH_DAYS).
  const summaryConditions = ["o.cancelled = 'N'", `o.doc_date >= $1`, `o.doc_date <= $2`];
  const summaryParams: unknown[] = [opts.dateFrom, opts.dateTo];
  let sumIdx = 3;
  if (opts.salesPerson != null) {
    summaryConditions.push(`o.sales_person_code = $${sumIdx++}`);
    summaryParams.push(opts.salesPerson);
  }
  if (opts.estado) {
    summaryConditions.push(`(
      substring(COALESCE(o.raw_json->>'Address','') from '-([A-Z]{2})[[:space:]]') = $${sumIdx}
      OR substring(COALESCE(o.raw_json->>'Address2','') from '-([A-Z]{2})[[:space:]]') = $${sumIdx}
    )`);
    summaryParams.push(opts.estado);
    sumIdx++;
  }
  const summaryWhere = summaryConditions.join(" AND ");
  const summarySql = `
    SELECT
      COUNT(DISTINCT o.doc_entry)::int                                                       AS total_orders,
      COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM sap_sales_order_lines l WHERE l.doc_entry = o.doc_entry) THEN o.doc_entry END)::int AS orders_with_lines,
      COALESCE(SUM(o.doc_total), 0)::float                                                   AS total_revenue_header,
      COALESCE(SUM(CASE WHEN o.doc_date >= '${opts.date3mCutoff}' THEN o.doc_total ELSE 0 END), 0)::float AS total_revenue_header_3m,
      COUNT(DISTINCT o.card_code)::int                                                       AS total_clients,
      MIN(o.doc_date)                                                                        AS first_order_date,
      MAX(o.doc_date)                                                                        AS last_order_date
    FROM sap_sales_orders o
    WHERE ${summaryWhere}
  `;

  const [prodRes, filtersRes, summaryRes] = await Promise.all([
    db.query(sql, params),
    db.query(filtersSql, [opts.dateFrom, opts.dateTo]),
    db.query(summarySql, summaryParams),
  ]);

  const summaryRow = summaryRes.rows[0] ?? {};

  return {
    products: prodRes.rows,
    estados: filtersRes.rows[0]?.estados ?? [],
    vendedorCodes: filtersRes.rows[0]?.vendedor_codes ?? [],
    summary: {
      totalOrders: Number(summaryRow.total_orders ?? 0),
      ordersWithLines: Number(summaryRow.orders_with_lines ?? 0),
      totalRevenueHeader: Number(summaryRow.total_revenue_header ?? 0),
      totalRevenueHeader3m: Number(summaryRow.total_revenue_header_3m ?? 0),
      totalClients: Number(summaryRow.total_clients ?? 0),
      firstOrderDate: summaryRow.first_order_date ?? null,
      lastOrderDate: summaryRow.last_order_date ?? null,
    },
  };
}

/**
 * Fetch order lines for specific item codes (for product detail modal).
 * Much smaller payload than fetching all orders.
 */
export async function queryProductOrders(opts: {
  itemCodes: string[];
  dateFrom: string;
  dateTo: string;
}) {
  const db = getPool();

  const sql = `
    WITH matched_lines AS (
      SELECT o.doc_num, o.doc_date, o.card_code, o.card_name,
             l.item_code, l.item_description, l.quantity, l.unit_price, l.line_total, l.discount_percent
      FROM sap_sales_orders o
      INNER JOIN sap_sales_order_lines l ON l.doc_entry = o.doc_entry
      WHERE o.cancelled = 'N' AND o.doc_date >= $1 AND o.doc_date <= $2
        AND l.item_code = ANY($3)
    )
    SELECT * FROM matched_lines ORDER BY doc_date DESC, doc_num DESC
  `;

  const res = await db.query(sql, [opts.dateFrom, opts.dateTo, opts.itemCodes]);
  return { orders: res.rows };
}

export async function querySyncHistory(limit = 20, entity = "sales_orders") {
  const db = getPool();
  const res = await db.query(
    `SELECT id, entity, started_at, finished_at, status, fetched, upserted, lines_written, errors, duration_ms, message, error_detail
     FROM sap_sync_log WHERE entity = $2
     ORDER BY started_at DESC LIMIT $1`,
    [limit, entity]
  );
  return res.rows;
}

// ─── Inventory sync (estoque SAP → Core) ──────────────────────
let inventorySyncRunning = false;

export async function runInventorySync(): Promise<{
  ok: boolean;
  fetched: number;
  upserted: number;
  level: number | null;
  message: string;
  durationMs: number;
}> {
  if (inventorySyncRunning) {
    return { ok: true, fetched: 0, upserted: 0, level: null, message: "Inventory sync já em execução", durationMs: 0 };
  }
  inventorySyncRunning = true;
  const startMs = Date.now();
  const db = getPool();

  console.log("[syncInventory] Iniciando sync de Estoque...");

  const logRes = await db.query(
    `INSERT INTO sap_sync_log (entity, started_at, status) VALUES ('inventory', NOW(), 'running') RETURNING id`
  );
  const logId = logRes.rows[0]?.id;

  const svc = getSapEntitiesService();
  if (!svc) {
    inventorySyncRunning = false;
    const msg = "SAP client não configurado";
    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), message=$1, duration_ms=$2 WHERE id=$3`,
      [msg, Date.now() - startMs, logId]
    );
    return { ok: false, fetched: 0, upserted: 0, level: null, message: msg, durationMs: Date.now() - startMs };
  }

  try {
    const enrichment = new InventoryEnrichmentService(svc);
    const result = await enrichment.syncToCore(CORE_BASE_URL, `sync-inv-${Date.now()}`);
    const durationMs = Date.now() - startMs;
    const msg = result.message;
    console.log(`[syncInventory] ${msg} (${(durationMs / 1000).toFixed(1)}s)`);

    await db.query(
      `UPDATE sap_sync_log SET status=$1, finished_at=NOW(), fetched=$2, upserted=$3, duration_ms=$4, message=$5 WHERE id=$6`,
      [result.ok ? "success" : "error", result.count, result.count, durationMs, msg, logId]
    );

    return { ok: result.ok, fetched: result.count, upserted: result.count, level: result.level, message: msg, durationMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error(`[syncInventory] Erro: ${msg}`);
    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), duration_ms=$1, message='Erro na sync estoque', error_detail=$2 WHERE id=$3`,
      [durationMs, msg.slice(0, 2000), logId]
    ).catch(() => {});
    return { ok: false, fetched: 0, upserted: 0, level: null, message: msg, durationMs };
  } finally {
    inventorySyncRunning = false;
  }
}

// ─── Movements sync (OINM → Core) ─────────────────────────────
let movementsSyncRunning = false;

export async function runMovementsSync(daysBack = MOVEMENTS_SYNC_DAYS): Promise<{
  ok: boolean;
  fetched: number;
  inserted: number;
  message: string;
  durationMs: number;
}> {
  if (movementsSyncRunning) {
    return { ok: true, fetched: 0, inserted: 0, message: "Movements sync já em execução", durationMs: 0 };
  }
  movementsSyncRunning = true;
  const startMs = Date.now();
  const db = getPool();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const dateFrom = cutoff.toISOString().slice(0, 10);

  console.log(`[syncMovements] Iniciando sync de Movimentações (desde ${dateFrom})...`);

  const logRes = await db.query(
    `INSERT INTO sap_sync_log (entity, started_at, status) VALUES ('inventory_movements', NOW(), 'running') RETURNING id`
  );
  const logId = logRes.rows[0]?.id;

  const svc = getSapEntitiesService();
  if (!svc) {
    movementsSyncRunning = false;
    const msg = "SAP client não configurado";
    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), message=$1, duration_ms=$2 WHERE id=$3`,
      [msg, Date.now() - startMs, logId]
    );
    return { ok: false, fetched: 0, inserted: 0, message: msg, durationMs: Date.now() - startMs };
  }

  try {
    const correlationId = `sync-mov-${Date.now()}`;
    const rows = await svc.listStockMovements(dateFrom, correlationId);
    const fetched = rows.length;

    const items = rows.map((r) => ({
      sku: r.ItemCode,
      warehouse_code: r.Warehouse,
      doc_date: r.DocDate ? String(r.DocDate).slice(0, 10) : null,
      create_date: r.CreateDate ? String(r.CreateDate).slice(0, 10) : null,
      in_qty: Number(r.InQty) || 0,
      out_qty: Number(r.OutQty) || 0,
      trans_type: r.TransType != null ? Number(r.TransType) : null,
      base_ref: r.BASE_REF ?? null,
      calc_price: Number(r.CalcPrice) || 0,
      balance: Number(r.Balance) || 0,
    }));

    let inserted = 0;
    if (items.length > 0) {
      const res = await fetch(`${CORE_BASE_URL}/v1/inventory/movements/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items, date_from: dateFrom }),
      });
      const result = res.ok ? ((await res.json()) as { inserted?: number }) : null;
      inserted = result?.inserted ?? 0;
    }

    const durationMs = Date.now() - startMs;
    const msg = `${fetched} movimentações obtidas, ${inserted} inseridas (desde ${dateFrom})`;
    console.log(`[syncMovements] ${msg} (${(durationMs / 1000).toFixed(1)}s)`);

    await db.query(
      `UPDATE sap_sync_log SET status='success', finished_at=NOW(), fetched=$1, upserted=$2, duration_ms=$3, message=$4 WHERE id=$5`,
      [fetched, inserted, durationMs, msg, logId]
    );

    return { ok: true, fetched, inserted, message: msg, durationMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error(`[syncMovements] Erro: ${msg}`);
    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), duration_ms=$1, message='Erro na sync movimentações', error_detail=$2 WHERE id=$3`,
      [durationMs, msg.slice(0, 2000), logId]
    ).catch(() => {});
    return { ok: false, fetched: 0, inserted: 0, message: msg, durationMs };
  } finally {
    movementsSyncRunning = false;
  }
}

/**
 * Analytics agregado de estoque: cruza o snapshot de estoque (Core) com as vendas
 * (base local do gateway), retornando uma linha compacta por SKU já com faturamento,
 * giro e valor de estoque pré-calculados — evitando enviar 50k pedidos ao browser.
 */
export async function queryInventoryAnalytics(opts: {
  dateFrom: string;
  dateTo: string;
  date3mCutoff: string;
  salesPerson?: number;
}): Promise<{
  items: Array<{
    sku: string;
    qty_sold: number;
    qty_sold_3m: number;
    revenue: number;
    revenue_3m: number;
    order_count: number;
    client_count: number;
    last_sale_date: string | null;
  }>;
  totalDays: number;
}> {
  const db = getPool();
  const conditions: string[] = ["o.cancelled = 'N'"];
  const params: unknown[] = [];
  let idx = 1;

  conditions.push(`o.doc_date >= $${idx++}`); params.push(opts.dateFrom);
  conditions.push(`o.doc_date <= $${idx++}`); params.push(opts.dateTo);
  const date3mIdx = idx++;
  params.push(opts.date3mCutoff);
  if (opts.salesPerson != null) {
    conditions.push(`o.sales_person_code = $${idx++}`);
    params.push(opts.salesPerson);
  }
  const where = conditions.join(" AND ");

  const sql = `
    WITH all_lines AS (
      SELECT o.doc_entry, o.doc_num, o.doc_date, o.card_code,
             l.item_code, l.quantity, l.line_total
      FROM sap_sales_orders o
      INNER JOIN sap_sales_order_lines l ON l.doc_entry = o.doc_entry
      WHERE ${where}
    )
    SELECT
      item_code AS sku,
      SUM(quantity)::float                                                      AS qty_sold,
      SUM(CASE WHEN doc_date >= $${date3mIdx} THEN quantity ELSE 0 END)::float   AS qty_sold_3m,
      SUM(line_total)::float                                                    AS revenue,
      SUM(CASE WHEN doc_date >= $${date3mIdx} THEN line_total ELSE 0 END)::float AS revenue_3m,
      COUNT(DISTINCT doc_num)::int                                              AS order_count,
      COUNT(DISTINCT card_code)::int                                           AS client_count,
      MAX(doc_date)::text                                                       AS last_sale_date
    FROM all_lines
    WHERE item_code IS NOT NULL AND item_code <> ''
    GROUP BY item_code
    ORDER BY revenue DESC
  `;

  const res = await db.query(sql, params);
  const fromDate = new Date(opts.dateFrom);
  const toDate = new Date(opts.dateTo);
  const totalDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);

  return { items: res.rows, totalDays };
}

// ─── Invoice sync (Problema 1) ────────────────────────────────
let invoiceSyncRunning = false;

export async function runInvoicesSync(): Promise<{
  ok: boolean;
  fetched: number;
  upserted: number;
  linesWritten: number;
  message: string;
  durationMs: number;
}> {
  if (invoiceSyncRunning) {
    return { ok: true, fetched: 0, upserted: 0, linesWritten: 0, message: "Invoice sync já em execução", durationMs: 0 };
  }
  invoiceSyncRunning = true;
  const startMs = Date.now();
  const db = getPool();

  console.log("[syncInvoices] Iniciando sync de Notas Fiscais...");

  const logRes = await db.query(
    `INSERT INTO sap_sync_log (entity, started_at, status) VALUES ('invoices', NOW(), 'running') RETURNING id`
  );
  const logId = logRes.rows[0]?.id;

  const svc = getSapEntitiesService();
  if (!svc) {
    invoiceSyncRunning = false;
    const msg = "SAP client não configurado";
    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), message=$1, duration_ms=$2 WHERE id=$3`,
      [msg, Date.now() - startMs, logId]
    );
    return { ok: false, fetched: 0, upserted: 0, linesWritten: 0, message: msg, durationMs: Date.now() - startMs };
  }

  try {
    const entSvc = svc;
    const invoices = await entSvc.listInvoices({ limit: 10000 }, `sync-inv-${Date.now()}`);
    const totalFetched = invoices.length;

    console.log(`[syncInvoices] ${totalFetched} notas fiscais obtidas do SAP. Persistindo...`);
    const { upserted, linesWritten } = await upsertInvoices(invoices);

    const durationMs = Date.now() - startMs;
    const msg = `Invoice sync OK: ${totalFetched} buscadas, ${upserted} salvas, ${linesWritten} linhas em ${(durationMs / 1000).toFixed(1)}s`;
    console.log(`[syncInvoices] ${msg}`);

    await db.query(
      `UPDATE sap_sync_log SET status='success', finished_at=NOW(), fetched=$1, upserted=$2, lines_written=$3, duration_ms=$4, message=$5 WHERE id=$6`,
      [totalFetched, upserted, linesWritten, durationMs, msg, logId]
    );

    return { ok: true, fetched: totalFetched, upserted, linesWritten, message: msg, durationMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error(`[syncInvoices] Erro: ${msg}`);

    await db.query(
      `UPDATE sap_sync_log SET status='error', finished_at=NOW(), duration_ms=$1, message='Erro na sync invoices', error_detail=$2 WHERE id=$3`,
      [durationMs, msg.slice(0, 2000), logId]
    ).catch(() => {});

    return { ok: false, fetched: 0, upserted: 0, linesWritten: 0, message: msg, durationMs };
  } finally {
    invoiceSyncRunning = false;
  }
}

// ─── Query invoices locais ────────────────────────────────────
export async function queryInvoices(opts: {
  dateFrom?: string;
  dateTo?: string;
  cardCode?: string;
  salesPerson?: number;
  cancelled?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.dateFrom) { conditions.push(`i.doc_date >= $${idx++}`); params.push(opts.dateFrom); }
  if (opts.dateTo)   { conditions.push(`i.doc_date <= $${idx++}`); params.push(opts.dateTo); }
  if (opts.cardCode) { conditions.push(`i.card_code = $${idx++}`); params.push(opts.cardCode); }
  if (opts.salesPerson != null) { conditions.push(`i.sales_person_code = $${idx++}`); params.push(opts.salesPerson); }
  if (opts.cancelled === "active") conditions.push(`i.cancelled = 'N'`);
  if (opts.cancelled === "cancelled") conditions.push(`i.cancelled = 'Y'`);
  if (opts.search) {
    conditions.push(`(
      i.card_name ILIKE $${idx} OR i.card_code ILIKE $${idx} OR CAST(i.doc_num AS TEXT) ILIKE $${idx}
      OR EXISTS (SELECT 1 FROM sap_invoice_lines l WHERE l.doc_entry = i.doc_entry AND (l.item_code ILIKE $${idx} OR l.item_description ILIKE $${idx}))
    )`);
    params.push(`%${opts.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 10000;
  const offset = opts.offset ?? 0;

  const countSql = `SELECT COUNT(*) as total FROM sap_invoices i ${where}`;
  const dataSql = `
    SELECT
      i.doc_entry AS "DocEntry",
      i.doc_num AS "DocNum",
      i.doc_date AS "DocDate",
      i.doc_due_date AS "DocDueDate",
      i.tax_date AS "TaxDate",
      i.card_code AS "CardCode",
      i.card_name AS "CardName",
      i.document_status AS "DocumentStatus",
      i.cancelled AS "Cancelled",
      i.doc_total AS "DocTotal",
      i.payment_method AS "PaymentMethod",
      i.payment_group_code AS "PaymentGroupCode",
      i.sales_person_code AS "SalesPersonCode",
      i.nfe_number AS "NfeNumber",
      i.folio_number AS "FolioNumber",
      i.nfe_key AS "NfeKey",
      i.series_number AS "SeriesNumber",
      i.base_doc_entry AS "BaseDocEntry",
      COALESCE(i.base_doc_num, (SELECT so.doc_num FROM sap_sales_orders so WHERE so.doc_entry = i.base_doc_entry)) AS "BaseDocNum",
      COALESCE(
        (SELECT json_agg(json_build_object(
          'ItemCode', l.item_code, 'ItemDescription', l.item_description,
          'Quantity', l.quantity, 'UnitPrice', l.unit_price, 'Price', l.price,
          'LineTotal', l.line_total, 'DiscountPercent', l.discount_percent,
          'CFOPCode', l.cfop_code, 'Usage', l.usage_code,
          'BaseEntry', l.base_entry, 'BaseType', l.base_type, 'BaseLine', l.base_line
        ))
        FROM sap_invoice_lines l WHERE l.doc_entry = i.doc_entry),
        '[]'::json
      ) AS "DocumentLines"
    FROM sap_invoices i ${where}
    ORDER BY i.doc_date DESC, i.doc_num DESC
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

  // Job recorrente — pedidos + notas fiscais + estoque + movimentações
  cron.schedule(SYNC_CRON, async () => {
    console.log(`[sync] Cron disparado: ${new Date().toISOString()}`);
    await runSalesOrdersSync();
    await runInvoicesSync();
    await runInventorySync();
    await runMovementsSync();
  });

  // Sync inicial após boot (com delay para garantir que o SAP está acessível)
  setTimeout(async () => {
    console.log("[sync] Executando sync inicial pós-boot...");
    await runSalesOrdersSync();
    await runInvoicesSync();
    await runInventorySync();
    await runMovementsSync();
  }, BOOT_SYNC_DELAY_MS);
}

// Manter compatibilidade com import anterior
export const startDailySyncScheduler = startSyncScheduler;
