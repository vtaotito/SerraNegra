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
  }

  async findByCnpj(cnpj: string) {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_credentials WHERE cnpj = $1",
      [cnpj]
    );
    return rows[0] ?? null;
  }

  async upsertCredential(data: {
    cardCode: string;
    cnpj: string;
    cardName: string;
    email: string;
  }) {
    await this.pool.query(
      `INSERT INTO b2b_credentials (card_code, cnpj, card_name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cnpj) DO UPDATE SET
         card_code = EXCLUDED.card_code,
         card_name = EXCLUDED.card_name,
         email = EXCLUDED.email,
         updated_at = NOW()`,
      [data.cardCode, data.cnpj, data.cardName, data.email]
    );
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
      "UPDATE b2b_credentials SET password_hash = NULL, email_verified = FALSE, updated_at = NOW() WHERE cnpj = $1",
      [cnpj]
    );
  }
}
