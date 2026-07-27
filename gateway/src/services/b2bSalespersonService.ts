import pg from "pg";

const { Pool } = pg;

/**
 * Contatos dos vendedores (SalesPerson) para exibição no Portal B2B.
 *
 * O SAP fornece apenas código e nome do vendedor (SalesEmployeeCode/Name). Para
 * mostrar ao cliente "seu vendedor" com telefone/WhatsApp/e-mail, mantemos esses
 * contatos aqui, editáveis no painel. A chave é o próprio `SalesPersonCode` do
 * Business Partner no SAP.
 */
export interface SalespersonContactRow {
  code: number;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  updated_at: string;
}

export class B2BSalespersonService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_salesperson_contacts (
        code INTEGER PRIMARY KEY,
        name VARCHAR(255),
        phone VARCHAR(40),
        whatsapp VARCHAR(40),
        email VARCHAR(255),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async list(): Promise<SalespersonContactRow[]> {
    const { rows } = await this.pool.query(
      "SELECT code, name, phone, whatsapp, email, updated_at FROM b2b_salesperson_contacts ORDER BY code",
    );
    return rows;
  }

  async get(code: number): Promise<SalespersonContactRow | null> {
    const { rows } = await this.pool.query(
      "SELECT code, name, phone, whatsapp, email, updated_at FROM b2b_salesperson_contacts WHERE code = $1",
      [code],
    );
    return rows[0] ?? null;
  }

  async upsert(data: {
    code: number;
    name?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
  }): Promise<SalespersonContactRow> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_salesperson_contacts (code, name, phone, whatsapp, email, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         whatsapp = EXCLUDED.whatsapp,
         email = EXCLUDED.email,
         updated_at = NOW()
       RETURNING code, name, phone, whatsapp, email, updated_at`,
      [
        data.code,
        data.name ?? null,
        data.phone ?? null,
        data.whatsapp ?? null,
        data.email ?? null,
      ],
    );
    return rows[0];
  }
}
