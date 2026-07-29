import pg from "pg";

const { Pool } = pg;

/**
 * Espelho local das cotações B2B criadas no SAP (OQUT / Quotations).
 * Fonte da verdade do documento é o Service Layer; esta tabela acelera
 * listagens, e-mails e conversão para pedido no Painel.
 */
export const QUOTATION_STATUSES = [
  "aberta",
  "em_analise",
  "convertida",
  "recusada",
  "cancelada",
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface QuotationItem {
  sku: string;
  name: string | null;
  quantity: number;
  warehouse?: string | null;
  unitPrice?: number | null;
  lineNum?: number | null;
  stockAvailable?: number | null;
  exceedsStock?: boolean;
}

export interface QuotationRow {
  id: number;
  doc_entry: number | null;
  doc_num: number | null;
  card_code: string;
  card_name: string | null;
  status: QuotationStatus;
  items: QuotationItem[];
  notes: string | null;
  due_date: string | null;
  origin: string;
  created_by: string | null;
  total_quantity: number;
  has_stock_alert: boolean;
  doc_total: number | null;
  order_doc_entry: number | null;
  order_doc_num: number | null;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function isQuotationStatus(v: unknown): v is QuotationStatus {
  return (
    typeof v === "string" &&
    (QUOTATION_STATUSES as readonly string[]).includes(v)
  );
}

export class B2BQuotationService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_quotations (
        id SERIAL PRIMARY KEY,
        doc_entry INTEGER,
        doc_num INTEGER,
        card_code VARCHAR(50) NOT NULL,
        card_name VARCHAR(200),
        status VARCHAR(20) NOT NULL DEFAULT 'aberta',
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT,
        due_date DATE,
        origin VARCHAR(20) NOT NULL DEFAULT 'portal',
        created_by VARCHAR(200),
        total_quantity INTEGER NOT NULL DEFAULT 0,
        has_stock_alert BOOLEAN NOT NULL DEFAULT FALSE,
        doc_total NUMERIC(18, 2),
        order_doc_entry INTEGER,
        order_doc_num INTEGER,
        reject_reason TEXT,
        reviewed_by VARCHAR(120),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_quotations_status_idx
      ON b2b_quotations (status)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_quotations_card_idx
      ON b2b_quotations (card_code)
    `);
    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS b2b_quotations_doc_entry_uidx
      ON b2b_quotations (doc_entry)
      WHERE doc_entry IS NOT NULL
    `);
  }

  async create(data: {
    cardCode: string;
    cardName?: string | null;
    items: QuotationItem[];
    notes?: string | null;
    dueDate?: string | null;
    origin?: string;
    createdBy?: string | null;
    docEntry?: number | null;
    docNum?: number | null;
    docTotal?: number | null;
    status?: QuotationStatus;
  }): Promise<QuotationRow> {
    const totalQuantity = data.items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0),
      0,
    );
    const hasStockAlert = data.items.some((it) => it.exceedsStock === true);
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_quotations
         (doc_entry, doc_num, card_code, card_name, status, items, notes, due_date,
          origin, created_by, total_quantity, has_stock_alert, doc_total)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        data.docEntry ?? null,
        data.docNum ?? null,
        data.cardCode,
        data.cardName ?? null,
        data.status ?? "aberta",
        JSON.stringify(data.items ?? []),
        data.notes ?? null,
        data.dueDate ?? null,
        data.origin ?? "portal",
        data.createdBy ?? null,
        totalQuantity,
        hasStockAlert,
        data.docTotal ?? null,
      ],
    );
    return rows[0];
  }

  async get(id: number): Promise<QuotationRow | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_quotations WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }

  async getByDocEntry(docEntry: number): Promise<QuotationRow | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_quotations WHERE doc_entry = $1",
      [docEntry],
    );
    return rows[0] ?? null;
  }

  async list(filter?: {
    status?: QuotationStatus;
    cardCode?: string;
    limit?: number;
  }): Promise<QuotationRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter?.cardCode) {
      params.push(filter.cardCode);
      conditions.push(`card_code = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(Math.max(filter?.limit ?? 200, 1), 500);
    params.push(limit);
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_quotations ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows;
  }

  async listOpenForCustomer(cardCode: string): Promise<QuotationRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_quotations
       WHERE card_code = $1
         AND status IN ('aberta', 'em_analise', 'convertida', 'recusada', 'cancelada')
       ORDER BY created_at DESC
       LIMIT 100`,
      [cardCode],
    );
    return rows;
  }

  async countByStatus(status: QuotationStatus): Promise<number> {
    const { rows } = await this.pool.query(
      "SELECT COUNT(*)::int AS cnt FROM b2b_quotations WHERE status = $1",
      [status],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async updateItems(
    id: number,
    items: QuotationItem[],
    extras?: { notes?: string | null; dueDate?: string | null; docTotal?: number | null },
  ): Promise<QuotationRow | null> {
    const totalQuantity = items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0),
      0,
    );
    const hasStockAlert = items.some((it) => it.exceedsStock === true);
    const { rows } = await this.pool.query(
      `UPDATE b2b_quotations SET
         items = $1::jsonb,
         total_quantity = $2,
         has_stock_alert = $3,
         notes = COALESCE($4, notes),
         due_date = COALESCE($5, due_date),
         doc_total = COALESCE($6, doc_total),
         updated_at = NOW()
       WHERE id = $7 AND status IN ('aberta', 'em_analise')
       RETURNING *`,
      [
        JSON.stringify(items),
        totalQuantity,
        hasStockAlert,
        extras?.notes ?? null,
        extras?.dueDate ?? null,
        extras?.docTotal ?? null,
        id,
      ],
    );
    return rows[0] ?? null;
  }

  async setStatus(
    id: number,
    status: QuotationStatus,
    opts?: {
      reviewedBy?: string | null;
      rejectReason?: string | null;
      orderDocEntry?: number | null;
      orderDocNum?: number | null;
      docEntry?: number | null;
      docNum?: number | null;
      docTotal?: number | null;
    },
  ): Promise<QuotationRow | null> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_quotations SET
         status = $1,
         reviewed_by = COALESCE($2, reviewed_by),
         reviewed_at = CASE WHEN $2 IS NOT NULL THEN NOW() ELSE reviewed_at END,
         reject_reason = COALESCE($3, reject_reason),
         order_doc_entry = COALESCE($4, order_doc_entry),
         order_doc_num = COALESCE($5, order_doc_num),
         doc_entry = COALESCE($6, doc_entry),
         doc_num = COALESCE($7, doc_num),
         doc_total = COALESCE($8, doc_total),
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        status,
        opts?.reviewedBy ?? null,
        opts?.rejectReason ?? null,
        opts?.orderDocEntry ?? null,
        opts?.orderDocNum ?? null,
        opts?.docEntry ?? null,
        opts?.docNum ?? null,
        opts?.docTotal ?? null,
        id,
      ],
    );
    return rows[0] ?? null;
  }

  /** Upsert a partir do sync SAP (OQUT). */
  async upsertFromSap(data: {
    docEntry: number;
    docNum?: number | null;
    cardCode: string;
    cardName?: string | null;
    status: QuotationStatus;
    items?: QuotationItem[];
    notes?: string | null;
    dueDate?: string | null;
    docTotal?: number | null;
  }): Promise<QuotationRow> {
    const existing = await this.getByDocEntry(data.docEntry);
    if (existing) {
      const items = data.items ?? existing.items;
      const totalQuantity = items.reduce(
        (sum, it) => sum + (Number(it.quantity) || 0),
        0,
      );
      const { rows } = await this.pool.query(
        `UPDATE b2b_quotations SET
           doc_num = COALESCE($1, doc_num),
           card_code = $2,
           card_name = COALESCE($3, card_name),
           status = CASE
             WHEN status IN ('convertida', 'recusada', 'cancelada') THEN status
             ELSE $4
           END,
           items = $5::jsonb,
           notes = COALESCE($6, notes),
           due_date = COALESCE($7, due_date),
           doc_total = COALESCE($8, doc_total),
           total_quantity = $9,
           updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          data.docNum ?? null,
          data.cardCode,
          data.cardName ?? null,
          data.status,
          JSON.stringify(items),
          data.notes ?? null,
          data.dueDate ?? null,
          data.docTotal ?? null,
          totalQuantity,
          existing.id,
        ],
      );
      return rows[0];
    }
    return this.create({
      docEntry: data.docEntry,
      docNum: data.docNum,
      cardCode: data.cardCode,
      cardName: data.cardName,
      items: data.items ?? [],
      notes: data.notes,
      dueDate: data.dueDate,
      docTotal: data.docTotal,
      status: data.status,
      origin: "sap_sync",
    });
  }
}
