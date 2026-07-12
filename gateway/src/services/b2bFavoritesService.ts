import pg from "pg";

const { Pool } = pg;

export interface FavoriteRow {
  id: number;
  card_code: string;
  cnpj: string | null;
  sku: string;
  created_at: string;
}

export class B2BFavoritesService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_favorites (
        id SERIAL PRIMARY KEY,
        card_code VARCHAR(50) NOT NULL,
        cnpj VARCHAR(20),
        sku VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (card_code, sku)
      )
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS b2b_favorites_card_code_idx ON b2b_favorites (card_code)`,
    );
  }

  // Marca um SKU como favorito do cliente (idempotente).
  async add(cardCode: string, cnpj: string | null, sku: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO b2b_favorites (card_code, cnpj, sku)
       VALUES ($1, $2, $3)
       ON CONFLICT (card_code, sku) DO NOTHING`,
      [cardCode, cnpj ?? null, sku],
    );
  }

  async remove(cardCode: string, sku: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM b2b_favorites WHERE card_code = $1 AND sku = $2`,
      [cardCode, sku],
    );
  }

  // Lista os SKUs favoritos do cliente, do mais recente ao mais antigo.
  async listSkus(cardCode: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT sku FROM b2b_favorites WHERE card_code = $1 ORDER BY created_at DESC`,
      [cardCode],
    );
    return rows.map((r: FavoriteRow) => r.sku);
  }
}
