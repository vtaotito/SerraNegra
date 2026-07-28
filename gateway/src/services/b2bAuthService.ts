import pg from "pg";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const { Pool } = pg;

export class B2BAuthService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_credentials (
        id SERIAL PRIMARY KEY,
        card_code VARCHAR(50) UNIQUE NOT NULL,
        cnpj VARCHAR(20) UNIQUE NOT NULL,
        card_name VARCHAR(255),
        email VARCHAR(255),
        password_hash VARCHAR(255),
        otp_code VARCHAR(10),
        otp_expires_at TIMESTAMPTZ,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Vendedor (SalesPersonCode do Business Partner no SAP) associado ao cliente.
    await this.pool.query(
      "ALTER TABLE b2b_credentials ADD COLUMN IF NOT EXISTS sales_person_code INTEGER",
    );
  }

  async findByCnpj(cnpj: string) {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_credentials WHERE cnpj = $1",
      [cnpj]
    );
    return rows[0] ?? null;
  }

  async findByCardCode(cardCode: string) {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_credentials WHERE card_code = $1",
      [cardCode]
    );
    return rows[0] ?? null;
  }

  async upsertCredential(data: {
    cardCode: string;
    cnpj: string;
    cardName: string;
    email: string;
    /** Vendedor vindo do SAP (BP.SalesPersonCode). Preenche só se ainda vazio. */
    salesPersonCode?: number | null;
  }) {
    await this.pool.query(
      `INSERT INTO b2b_credentials (card_code, cnpj, card_name, email, sales_person_code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cnpj) DO UPDATE SET
         card_code = EXCLUDED.card_code,
         card_name = EXCLUDED.card_name,
         email = EXCLUDED.email,
         -- Preserva um vendedor já ajustado no painel; só herda do SAP quando ainda vazio.
         sales_person_code = COALESCE(b2b_credentials.sales_person_code, EXCLUDED.sales_person_code),
         updated_at = NOW()`,
      [
        data.cardCode,
        data.cnpj,
        data.cardName,
        data.email,
        data.salesPersonCode ?? null,
      ]
    );
  }

  /** Define/atualiza o vendedor (SalesPersonCode) associado ao cliente. */
  async setSalesPerson(cardCode: string, salesPersonCode: number | null) {
    await this.pool.query(
      "UPDATE b2b_credentials SET sales_person_code = $1, updated_at = NOW() WHERE card_code = $2",
      [salesPersonCode, cardCode],
    );
  }

  /**
   * Preenche sales_person_code a partir do SAP somente quando ainda está vazio
   * (não sobrescreve associação já feita no painel).
   * `pairs`: Map cardCode → SalesPersonCode válido (>= 0).
   */
  async syncSalesPersonsFromSap(
    pairs: Map<string, number>,
  ): Promise<{ updated: number; alreadySet: number; missingInSap: number; total: number }> {
    const { rows } = await this.pool.query<{
      card_code: string;
      sales_person_code: number | null;
    }>("SELECT card_code, sales_person_code FROM b2b_credentials");

    let updated = 0;
    let alreadySet = 0;
    let missingInSap = 0;

    for (const row of rows) {
      if (row.sales_person_code != null) {
        alreadySet += 1;
        continue;
      }
      const code = pairs.get(row.card_code);
      if (code === undefined) {
        missingInSap += 1;
        continue;
      }
      await this.pool.query(
        `UPDATE b2b_credentials
         SET sales_person_code = $1, updated_at = NOW()
         WHERE card_code = $2 AND sales_person_code IS NULL`,
        [code, row.card_code],
      );
      updated += 1;
    }

    return { updated, alreadySet, missingInSap, total: rows.length };
  }

  async generateOtp(cnpj: string): Promise<string> {
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.pool.query(
      "UPDATE b2b_credentials SET otp_code = $1, otp_expires_at = $2, updated_at = NOW() WHERE cnpj = $3",
      [otp, expiresAt, cnpj]
    );
    return otp;
  }

  async verifyOtp(cnpj: string, otp: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      "SELECT id FROM b2b_credentials WHERE cnpj = $1 AND otp_code = $2 AND otp_expires_at > NOW()",
      [cnpj, otp]
    );
    if (rows.length === 0) return false;
    await this.pool.query(
      "UPDATE b2b_credentials SET email_verified = TRUE, otp_code = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE cnpj = $1",
      [cnpj]
    );
    return true;
  }

  async setPassword(cnpj: string, password: string) {
    const hash = await bcrypt.hash(password, 12);
    await this.pool.query(
      "UPDATE b2b_credentials SET password_hash = $1, updated_at = NOW() WHERE cnpj = $2",
      [hash, cnpj]
    );
  }

  async verifyPassword(cnpj: string, password: string): Promise<boolean> {
    const cred = await this.findByCnpj(cnpj);
    if (!cred?.password_hash) return false;
    return bcrypt.compare(password, cred.password_hash);
  }

  async hasPassword(cnpj: string): Promise<boolean> {
    const cred = await this.findByCnpj(cnpj);
    return !!cred?.password_hash;
  }

  async resetPassword(cnpj: string) {
    await this.pool.query(
      "UPDATE b2b_credentials SET password_hash = NULL, email_verified = FALSE, otp_code = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE cnpj = $1",
      [cnpj]
    );
  }

  /**
   * Atualiza ou remove o e-mail cadastrado de uma credencial B2B.
   * Como o e-mail muda, a verificação é zerada e qualquer OTP pendente é
   * descartado — o cliente precisará verificar o novo e-mail no próximo acesso.
   * Passe `null` para remover o e-mail.
   */
  async updateEmail(cnpj: string, email: string | null) {
    await this.pool.query(
      "UPDATE b2b_credentials SET email = $1, email_verified = FALSE, otp_code = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE cnpj = $2",
      [email, cnpj]
    );
  }

  /** Lista credenciais sem expor hashes — apenas status de senha/verificação. */
  async listCredentials(): Promise<
    {
      id: number;
      card_code: string;
      cnpj: string;
      card_name: string | null;
      email: string | null;
      has_password: boolean;
      email_verified: boolean;
      sales_person_code: number | null;
      created_at: string;
      updated_at: string;
    }[]
  > {
    const { rows } = await this.pool.query(`
      SELECT id, card_code, cnpj, card_name, email,
             (password_hash IS NOT NULL) AS has_password,
             COALESCE(email_verified, FALSE) AS email_verified,
             sales_person_code,
             created_at, updated_at
      FROM b2b_credentials
      ORDER BY card_name NULLS LAST, cnpj
    `);
    return rows;
  }
}
