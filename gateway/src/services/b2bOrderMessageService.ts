import pg from "pg";

const { Pool } = pg;

/**
 * Conversa compartilhada por pedido entre o CLIENTE (Portal B2B) e o VENDEDOR
 * (painel). Além de mensagens livres, o mesmo fio carrega solicitações
 * estruturadas do cliente (alteração / cancelamento), que o vendedor pode
 * resolver ou recusar. Nada disso altera o documento no SAP — é uma camada
 * operacional/relacionamento local indexada por `doc_entry`.
 */
export const MESSAGE_KINDS = [
  "message",
  "change_request",
  "cancel_request",
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const REQUEST_STATUSES = ["aberto", "resolvido", "recusado"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type AuthorType = "customer" | "seller";

export interface OrderMessageRow {
  id: number;
  doc_entry: number;
  card_code: string;
  author_type: AuthorType;
  author_name: string | null;
  kind: MessageKind;
  body: string;
  status: RequestStatus | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface OrderMessageSummary {
  /** Total de mensagens no fio. */
  messages: number;
  /** Solicitações (alteração/cancelamento) ainda em aberto. */
  openRequests: number;
  /** Tipo do autor da última mensagem (para sinalizar "aguardando resposta"). */
  lastAuthor: AuthorType | null;
}

export function isMessageKind(v: unknown): v is MessageKind {
  return typeof v === "string" && (MESSAGE_KINDS as readonly string[]).includes(v);
}

export class B2BOrderMessageService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_order_messages (
        id SERIAL PRIMARY KEY,
        doc_entry INTEGER NOT NULL,
        card_code VARCHAR(50) NOT NULL,
        author_type VARCHAR(10) NOT NULL,
        author_name VARCHAR(200),
        kind VARCHAR(20) NOT NULL DEFAULT 'message',
        body TEXT NOT NULL,
        status VARCHAR(20),
        resolution_note TEXT,
        resolved_by VARCHAR(120),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_order_messages_doc_idx
      ON b2b_order_messages (doc_entry)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS b2b_order_messages_open_req_idx
      ON b2b_order_messages (status) WHERE status = 'aberto'
    `);
  }

  /** Fio completo de um pedido (ordem cronológica). */
  async listByOrder(docEntry: number): Promise<OrderMessageRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_order_messages
       WHERE doc_entry = $1
       ORDER BY created_at ASC, id ASC`,
      [docEntry],
    );
    return rows;
  }

  async create(data: {
    docEntry: number;
    cardCode: string;
    authorType: AuthorType;
    authorName?: string | null;
    kind?: MessageKind;
    body: string;
  }): Promise<OrderMessageRow> {
    const kind = data.kind ?? "message";
    // Solicitações nascem "aberto"; mensagens livres não têm status.
    const status = kind === "message" ? null : "aberto";
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_order_messages
         (doc_entry, card_code, author_type, author_name, kind, body, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.docEntry,
        data.cardCode,
        data.authorType,
        data.authorName ?? null,
        kind,
        data.body,
        status,
      ],
    );
    return rows[0];
  }

  /** Resolve/recusa uma solicitação (apenas itens com status != null). */
  async resolveRequest(
    id: number,
    data: { status: RequestStatus; note?: string | null; by?: string | null },
  ): Promise<OrderMessageRow | null> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_order_messages
       SET status = $2, resolution_note = $3, resolved_by = $4, resolved_at = NOW()
       WHERE id = $1 AND status IS NOT NULL
       RETURNING *`,
      [id, data.status, data.note ?? null, data.by ?? null],
    );
    return rows[0] ?? null;
  }

  /** Resumo por pedido para badges na lista do painel. */
  async summary(
    docEntries: number[],
  ): Promise<Record<number, OrderMessageSummary>> {
    if (docEntries.length === 0) return {};
    const { rows } = await this.pool.query(
      `SELECT doc_entry,
              COUNT(*)::int AS messages,
              COUNT(*) FILTER (WHERE status = 'aberto')::int AS open_requests,
              (ARRAY_AGG(author_type ORDER BY created_at DESC, id DESC))[1] AS last_author
       FROM b2b_order_messages
       WHERE doc_entry = ANY($1::int[])
       GROUP BY doc_entry`,
      [docEntries],
    );
    const out: Record<number, OrderMessageSummary> = {};
    for (const r of rows) {
      out[Number(r.doc_entry)] = {
        messages: Number(r.messages),
        openRequests: Number(r.open_requests),
        lastAuthor: (r.last_author as AuthorType) ?? null,
      };
    }
    return out;
  }

  /**
   * Inbox do cliente: pedidos com conversa, ordenados pela última mensagem.
   * "Aguardando resposta" = última mensagem do vendedor.
   */
  async inboxByCustomer(cardCode: string): Promise<
    Array<{
      docEntry: number;
      messages: number;
      openRequests: number;
      lastAuthor: AuthorType | null;
      lastBody: string | null;
      lastAt: string | null;
    }>
  > {
    const { rows } = await this.pool.query(
      `SELECT doc_entry,
              COUNT(*)::int AS messages,
              COUNT(*) FILTER (WHERE status = 'aberto')::int AS open_requests,
              (ARRAY_AGG(author_type ORDER BY created_at DESC, id DESC))[1] AS last_author,
              (ARRAY_AGG(body ORDER BY created_at DESC, id DESC))[1] AS last_body,
              MAX(created_at) AS last_at
       FROM b2b_order_messages
       WHERE LOWER(card_code) = LOWER($1)
       GROUP BY doc_entry
       ORDER BY MAX(created_at) DESC
       LIMIT 50`,
      [cardCode],
    );
    return rows.map((r) => ({
      docEntry: Number(r.doc_entry),
      messages: Number(r.messages),
      openRequests: Number(r.open_requests),
      lastAuthor: (r.last_author as AuthorType) ?? null,
      lastBody: (r.last_body as string) ?? null,
      lastAt: r.last_at ? String(r.last_at) : null,
    }));
  }
}
