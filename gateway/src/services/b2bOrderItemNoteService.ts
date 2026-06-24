import pg from "pg";

const { Pool } = pg;

/**
 * Sinalizações por item de um pedido feitas pela equipe de vendas (ex.: item em
 * falta, sugestão de substituição, observação). Ficam visíveis também para o
 * cliente no detalhe do pedido do Portal B2B, dando mais transparência sobre
 * cada produto. Indexado por `doc_entry` + `sku`.
 */
export const ITEM_FLAGS = ["falta", "substituicao", "observacao"] as const;
export type ItemFlag = (typeof ITEM_FLAGS)[number];

export interface OrderItemNoteRow {
  id: number;
  doc_entry: number;
  sku: string;
  flag: ItemFlag;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export function isItemFlag(v: unknown): v is ItemFlag {
  return typeof v === "string" && (ITEM_FLAGS as readonly string[]).includes(v);
}

export class B2BOrderItemNoteService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_order_item_notes (
        id SERIAL PRIMARY KEY,
        doc_entry INTEGER NOT NULL,
        sku VARCHAR(50) NOT NULL,
        flag VARCHAR(20) NOT NULL DEFAULT 'observacao',
        note TEXT,
        created_by VARCHAR(120),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_order_item_notes_doc_idx
      ON b2b_order_item_notes (doc_entry)
    `);
  }

  async listByOrder(docEntry: number): Promise<OrderItemNoteRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_order_item_notes
       WHERE doc_entry = $1
       ORDER BY created_at DESC, id DESC`,
      [docEntry],
    );
    return rows;
  }

  async create(data: {
    docEntry: number;
    sku: string;
    flag: ItemFlag;
    note?: string | null;
    createdBy?: string | null;
  }): Promise<OrderItemNoteRow> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_order_item_notes (doc_entry, sku, flag, note, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.docEntry, data.sku, data.flag, data.note ?? null, data.createdBy ?? null],
    );
    return rows[0];
  }

  async remove(id: number): Promise<void> {
    await this.pool.query("DELETE FROM b2b_order_item_notes WHERE id = $1", [id]);
  }
}
