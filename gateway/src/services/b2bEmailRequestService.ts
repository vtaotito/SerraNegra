import pg from "pg";

const { Pool } = pg;

export interface EmailAccessRequest {
  id: number;
  cnpj: string;
  card_code: string | null;
  card_name: string | null;
  requested_email: string;
  contact_name: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Solicitações de acesso por e-mail para clientes que JÁ existem no SAP B1 mas
 * não têm e-mail cadastrado. O cliente informa um e-mail no portal; a GSN
 * aprova/rejeita internamente em `/b2b-acessos`. Na aprovação, o e-mail é
 * gravado na credencial B2B (sem write-back no SAP).
 */
export class B2BEmailRequestService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_email_access_requests (
        id SERIAL PRIMARY KEY,
        cnpj VARCHAR(20) NOT NULL,
        card_code VARCHAR(50),
        card_name VARCHAR(255),
        requested_email VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR(100),
        reviewed_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Garante no máximo uma solicitação pendente por CNPJ.
    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS b2b_email_req_pending_uq
      ON b2b_email_access_requests (cnpj)
      WHERE status = 'pending'
    `);
  }

  async findPendingByCnpj(cnpj: string): Promise<EmailAccessRequest | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_email_access_requests WHERE cnpj = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
      [cnpj],
    );
    return rows[0] ?? null;
  }

  async findById(id: number): Promise<EmailAccessRequest | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_email_access_requests WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }

  async create(data: {
    cnpj: string;
    cardCode?: string | null;
    cardName?: string | null;
    requestedEmail: string;
    contactName?: string | null;
  }): Promise<EmailAccessRequest> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_email_access_requests
         (cnpj, card_code, card_name, requested_email, contact_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.cnpj,
        data.cardCode ?? null,
        data.cardName ?? null,
        data.requestedEmail,
        data.contactName ?? null,
      ],
    );
    return rows[0];
  }

  async list(status?: string): Promise<EmailAccessRequest[]> {
    const where = status ? "WHERE status = $1" : "";
    const params = status ? [status] : [];
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_email_access_requests ${where} ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         created_at DESC`,
      params,
    );
    return rows;
  }

  async setStatus(
    id: number,
    status: "approved" | "rejected",
    reviewedBy: string,
    notes?: string | null,
  ): Promise<EmailAccessRequest | null> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_email_access_requests SET
         status = $1, reviewed_by = $2, reviewed_at = NOW(),
         notes = COALESCE($3, notes), updated_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [status, reviewedBy, notes ?? null, id],
    );
    return rows[0] ?? null;
  }
}
