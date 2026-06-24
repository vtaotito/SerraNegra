import pg from "pg";

const { Pool } = pg;

/**
 * Estágios do funil de atendimento do canal e-commerce (Portal B2B). É um
 * status operacional gerido pela equipe de vendas, independente do `doc_status`
 * do SAP (que só conhece Aberto/Fechado/Cancelado).
 */
export const ORDER_STATUSES = [
  "novo",
  "em_analise",
  "separacao",
  "faturado",
  "enviado",
  "entregue",
  "cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export interface OrderStatusRow {
  doc_entry: number;
  card_code: string | null;
  status: OrderStatus;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  /** Confirmação operacional (local) feita pela equipe de vendas no painel. */
  confirmed_at: string | null;
  confirmed_by: string | null;
}

/** Estado de um pedido para o painel: etapa do funil + se já foi confirmado. */
export interface OrderStatusDetail {
  status: OrderStatus;
  confirmed: boolean;
}

/**
 * Status do funil e-commerce por pedido (uma linha por `doc_entry`). Permite à
 * equipe de vendas acompanhar e mover os pedidos do Portal B2B por estágios sem
 * depender do SAP/WMS.
 */
export class B2BOrderStatusService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_order_status (
        doc_entry INTEGER PRIMARY KEY,
        card_code VARCHAR(50),
        status VARCHAR(40) NOT NULL DEFAULT 'novo',
        updated_by VARCHAR(120),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_order_status_status_idx
      ON b2b_order_status (status)
    `);
    // Confirmação operacional local (não toca o documento no SAP). Migração
    // idempotente para bases já existentes.
    await this.pool.query(
      `ALTER TABLE b2b_order_status ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`,
    );
    await this.pool.query(
      `ALTER TABLE b2b_order_status ADD COLUMN IF NOT EXISTS confirmed_by VARCHAR(120)`,
    );
  }

  async get(docEntry: number): Promise<OrderStatusRow | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_order_status WHERE doc_entry = $1",
      [docEntry],
    );
    return rows[0] ?? null;
  }

  /** Mapa doc_entry → status para um conjunto de pedidos (badges/colunas). */
  async getMany(docEntries: number[]): Promise<Record<number, OrderStatus>> {
    if (docEntries.length === 0) return {};
    const { rows } = await this.pool.query(
      `SELECT doc_entry, status FROM b2b_order_status
       WHERE doc_entry = ANY($1::int[])`,
      [docEntries],
    );
    const out: Record<number, OrderStatus> = {};
    for (const r of rows) out[Number(r.doc_entry)] = r.status as OrderStatus;
    return out;
  }

  /**
   * Mapa doc_entry → { status, confirmed } para o painel — permite distinguir
   * pedidos "a confirmar" dos já confirmados, em qualquer origem.
   */
  async getManyDetailed(
    docEntries: number[],
  ): Promise<Record<number, OrderStatusDetail>> {
    if (docEntries.length === 0) return {};
    const { rows } = await this.pool.query(
      `SELECT doc_entry, status, confirmed_at FROM b2b_order_status
       WHERE doc_entry = ANY($1::int[])`,
      [docEntries],
    );
    const out: Record<number, OrderStatusDetail> = {};
    for (const r of rows) {
      out[Number(r.doc_entry)] = {
        status: r.status as OrderStatus,
        confirmed: r.confirmed_at != null,
      };
    }
    return out;
  }

  /**
   * Cria/atualiza o status de um pedido (upsert). Usado tanto na criação do
   * pedido pelo portal (status inicial `novo`) quanto pela equipe de vendas.
   */
  async set(data: {
    docEntry: number;
    status: OrderStatus;
    cardCode?: string | null;
    updatedBy?: string | null;
  }): Promise<OrderStatusRow> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_order_status (doc_entry, card_code, status, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (doc_entry) DO UPDATE SET
         status = EXCLUDED.status,
         card_code = COALESCE(EXCLUDED.card_code, b2b_order_status.card_code),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [data.docEntry, data.cardCode ?? null, data.status, data.updatedBy ?? null],
    );
    return rows[0];
  }

  /**
   * Define o status inicial apenas se ainda não existir registro (não
   * sobrescreve um status já trabalhado pela equipe).
   */
  async ensureInitial(data: {
    docEntry: number;
    status?: OrderStatus;
    cardCode?: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO b2b_order_status (doc_entry, card_code, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (doc_entry) DO NOTHING`,
      [data.docEntry, data.cardCode ?? null, data.status ?? "novo"],
    );
  }

  /**
   * Confirma um pedido (estado operacional local). Garante a etapa inicial do
   * funil sem sobrescrever um estágio já trabalhado, e marca a confirmação
   * (mantendo a primeira confirmação caso já exista). NÃO altera o SAP.
   */
  async confirm(data: {
    docEntry: number;
    cardCode?: string | null;
    by?: string | null;
  }): Promise<OrderStatusRow> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_order_status (doc_entry, card_code, status, confirmed_at, confirmed_by)
       VALUES ($1, $2, 'novo', NOW(), $3)
       ON CONFLICT (doc_entry) DO UPDATE SET
         card_code = COALESCE(b2b_order_status.card_code, EXCLUDED.card_code),
         confirmed_at = COALESCE(b2b_order_status.confirmed_at, NOW()),
         confirmed_by = COALESCE(b2b_order_status.confirmed_by, EXCLUDED.confirmed_by),
         updated_at = NOW()
       RETURNING *`,
      [data.docEntry, data.cardCode ?? null, data.by ?? null],
    );
    return rows[0];
  }
}
