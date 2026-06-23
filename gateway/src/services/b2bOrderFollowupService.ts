import pg from "pg";

const { Pool } = pg;

export interface OrderFollowup {
  id: number;
  doc_entry: number;
  card_code: string | null;
  status_tag: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
}

/**
 * Anotações/interações dos vendedores sobre pedidos dos clientes. Permite
 * acompanhar o andamento (contato, observações, status interno) sem alterar o
 * pedido no SAP — uma timeline operacional por pedido.
 */
export class B2BOrderFollowupService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_order_followups (
        id SERIAL PRIMARY KEY,
        doc_entry INTEGER NOT NULL,
        card_code VARCHAR(50),
        status_tag VARCHAR(40),
        note TEXT NOT NULL,
        created_by VARCHAR(120),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_order_followups_doc_idx
      ON b2b_order_followups (doc_entry)
    `);
  }

  async listByOrder(docEntry: number): Promise<OrderFollowup[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_order_followups WHERE doc_entry = $1 ORDER BY created_at DESC",
      [docEntry],
    );
    return rows;
  }

  /** Contagem de anotações por pedido para um conjunto de doc_entries. */
  async countByOrders(docEntries: number[]): Promise<Record<number, number>> {
    if (docEntries.length === 0) return {};
    const { rows } = await this.pool.query(
      `SELECT doc_entry, COUNT(*)::int AS cnt
       FROM b2b_order_followups
       WHERE doc_entry = ANY($1::int[])
       GROUP BY doc_entry`,
      [docEntries],
    );
    const out: Record<number, number> = {};
    for (const r of rows) out[Number(r.doc_entry)] = Number(r.cnt);
    return out;
  }

  async create(data: {
    docEntry: number;
    cardCode?: string | null;
    statusTag?: string | null;
    note: string;
    createdBy?: string | null;
  }): Promise<OrderFollowup> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_order_followups
         (doc_entry, card_code, status_tag, note, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.docEntry,
        data.cardCode ?? null,
        data.statusTag ?? null,
        data.note,
        data.createdBy ?? null,
      ],
    );
    return rows[0];
  }
}
