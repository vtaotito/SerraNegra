import pg from "pg";

const { Pool } = pg;

/**
 * Pedidos do Portal B2B aguardando confirmação manual da equipe de vendas.
 *
 * Pedidos feitos pelo cliente no portal NÃO são enviados ao SAP no ato: ficam
 * registrados aqui como `pendente` e só são criados no SAP após o vendedor
 * confirmar no painel. Isso dá ao comercial a chance de revisar quantidades,
 * preço e disponibilidade antes de oficializar o documento no ERP.
 */
export const PENDING_ORDER_STATUSES = [
  "pendente",
  "confirmado",
  "rejeitado",
  // Cancelado pelo próprio cliente no portal, antes de o vendedor confirmar.
  // Distinto de `rejeitado` (recusa feita pela equipe de vendas).
  "cancelado",
] as const;

export type PendingOrderStatus = (typeof PENDING_ORDER_STATUSES)[number];

export interface PendingOrderItem {
  sku: string;
  name: string | null;
  quantity: number;
  warehouse?: string | null;
}

export interface PendingOrderRow {
  id: number;
  card_code: string;
  card_name: string | null;
  items: PendingOrderItem[];
  notes: string | null;
  due_date: string | null;
  status: PendingOrderStatus;
  origin: string;
  created_by: string | null;
  total_quantity: number;
  sap_doc_entry: number | null;
  sap_doc_num: number | null;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export class B2BPendingOrderService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_pending_orders (
        id SERIAL PRIMARY KEY,
        card_code VARCHAR(50) NOT NULL,
        card_name VARCHAR(200),
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT,
        due_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'pendente',
        origin VARCHAR(20) NOT NULL DEFAULT 'portal',
        created_by VARCHAR(200),
        total_quantity INTEGER NOT NULL DEFAULT 0,
        sap_doc_entry INTEGER,
        sap_doc_num INTEGER,
        reject_reason TEXT,
        reviewed_by VARCHAR(120),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_pending_orders_status_idx
      ON b2b_pending_orders (status)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_pending_orders_card_idx
      ON b2b_pending_orders (card_code)
    `);
  }

  async create(data: {
    cardCode: string;
    cardName?: string | null;
    items: PendingOrderItem[];
    notes?: string | null;
    dueDate?: string | null;
    origin?: string;
    createdBy?: string | null;
  }): Promise<PendingOrderRow> {
    const totalQuantity = data.items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0),
      0,
    );
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_pending_orders
         (card_code, card_name, items, notes, due_date, origin, created_by, total_quantity)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.cardCode,
        data.cardName ?? null,
        JSON.stringify(data.items ?? []),
        data.notes ?? null,
        data.dueDate ?? null,
        data.origin ?? "portal",
        data.createdBy ?? null,
        totalQuantity,
      ],
    );
    return rows[0];
  }

  async get(id: number): Promise<PendingOrderRow | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_pending_orders WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }

  /** Lista pedidos por status (mais recentes primeiro). Sem status, retorna todos. */
  async list(filter?: {
    status?: PendingOrderStatus;
    cardCode?: string;
    limit?: number;
  }): Promise<PendingOrderRow[]> {
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
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_pending_orders ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit}`,
      params,
    );
    return rows;
  }

  /** Pedidos pendentes de um cliente (para exibir no portal do próprio cliente). */
  async listPendingForCustomer(cardCode: string): Promise<PendingOrderRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_pending_orders
       WHERE card_code = $1 AND status IN ('pendente', 'rejeitado', 'cancelado')
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      [cardCode],
    );
    return rows;
  }

  async countByStatus(status: PendingOrderStatus): Promise<number> {
    const { rows } = await this.pool.query(
      "SELECT COUNT(*)::int AS cnt FROM b2b_pending_orders WHERE status = $1",
      [status],
    );
    return rows[0]?.cnt ?? 0;
  }

  /** Marca como confirmado e grava o vínculo com o documento criado no SAP. */
  async markConfirmed(
    id: number,
    data: { sapDocEntry: number; sapDocNum?: number | null; reviewedBy?: string | null },
  ): Promise<PendingOrderRow> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_pending_orders
       SET status = 'confirmado',
           sap_doc_entry = $2,
           sap_doc_num = $3,
           reviewed_by = $4,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, data.sapDocEntry, data.sapDocNum ?? null, data.reviewedBy ?? null],
    );
    return rows[0];
  }

  async markRejected(
    id: number,
    data: { reason?: string | null; reviewedBy?: string | null },
  ): Promise<PendingOrderRow> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_pending_orders
       SET status = 'rejeitado',
           reject_reason = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, data.reason ?? null, data.reviewedBy ?? null],
    );
    return rows[0];
  }

  /**
   * Cancelamento feito pelo próprio cliente (portal), enquanto o pedido ainda
   * está `pendente` (não foi confirmado no SAP). Só afeta linhas pendentes.
   */
  async markCancelled(
    id: number,
    data: { reason?: string | null; cancelledBy?: string | null },
  ): Promise<PendingOrderRow | null> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_pending_orders
       SET status = 'cancelado',
           reject_reason = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status = 'pendente'
       RETURNING *`,
      [id, data.reason ?? null, data.cancelledBy ?? null],
    );
    return rows[0] ?? null;
  }
}
