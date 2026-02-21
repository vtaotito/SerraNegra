import pg from "pg";

const { Pool } = pg;

// ─── Types ───────────────────────────────────────────────────────────

export interface CatalogProduct {
  id: number;
  sap_item_code: string;
  sap_item_name: string;
  gsn_product_id: string | null;
  gsn_product_name: string | null;
  gsn_slug: string | null;
  image_url: string | null;
  image_thumb_url: string | null;
  category_name: string | null;
  description_short: string | null;
  ean: string | null;
  unit_of_measure: string;
  is_active: boolean;
  is_sales_item: boolean;
  match_score: number;
  match_confirmed: boolean;
  total_stock: number;
  is_in_stock: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockNotification {
  id: number;
  sap_item_code: string;
  cnpj: string;
  email: string;
  notified: boolean;
  created_at: string;
}

export interface GsnProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  promotional_price: string;
  available: string;
  category_name: string;
  images: { url: string; thumbUrl: string }[];
  description_small: string;
  ean: string;
}

interface CatalogFilters {
  search?: string;
  category?: string;
  inStock?: boolean;
  page?: number;
  limit?: number;
}

// ─── GSN Online API fetcher ──────────────────────────────────────────

const GSN_API_BASE = "https://garrafariaonline.commercesuite.com.br/web_api";
const TCDN_BASE = "https://images.tcdn.com.br/img/img_prod/1123510";

export async function fetchAllGsnProducts(): Promise<GsnProduct[]> {
  const all: GsnProduct[] = [];
  let offset = 0;
  const limit = 50;

  for (let page = 0; page < 20; page++) {
    try {
      const url = `${GSN_API_BASE}/products?limit=${limit}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) break;

      const json = (await res.json()) as any;
      const products: any[] = json.Products ?? json.products ?? [];
      if (products.length === 0) break;

      for (const entry of products) {
        const p = entry.Product ?? entry;
        const images: { url: string; thumbUrl: string }[] = [];

        const productImages: any[] = p.ProductImage ?? [];
        for (const img of productImages) {
          const httpsUrl = img.https ?? img.http ?? "";
          if (httpsUrl) {
            const thumbUrl = httpsUrl.replace(
              `${TCDN_BASE}/`,
              `${TCDN_BASE}/180_`,
            );
            images.push({ url: httpsUrl, thumbUrl });
          }
        }

        all.push({
          id: String(p.id ?? ""),
          name: p.name ?? "",
          slug: p.slug ?? "",
          price: p.price ?? "0",
          promotional_price: p.promotional_price ?? "0",
          available: p.available ?? "0",
          category_name: p.category_name ?? "",
          images,
          description_small: p.description_small ?? "",
          ean: p.ean ?? "",
        });
      }

      const paging = json.paging ?? {};
      const total = Number(paging.total ?? 0);
      offset += limit;
      if (offset >= total || products.length < limit) break;
    } catch {
      break;
    }
  }

  return all;
}

// ─── Fuzzy matching ──────────────────────────────────────────────────

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(garrafa|pote|fardo|caixa|com|de|unidades?|ml|und|vidro|para)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 1);
}

function matchScore(sapName: string, gsnName: string): number {
  const sapNorm = normalizeForMatch(sapName);
  const gsnNorm = normalizeForMatch(gsnName);

  if (sapNorm === gsnNorm) return 100;

  const sapTokens = extractTokens(sapNorm);
  const gsnTokens = extractTokens(gsnNorm);
  if (sapTokens.length === 0 || gsnTokens.length === 0) return 0;

  let matches = 0;
  for (const st of sapTokens) {
    if (gsnTokens.some((gt) => gt === st || gt.includes(st) || st.includes(gt))) {
      matches++;
    }
  }

  const maxLen = Math.max(sapTokens.length, gsnTokens.length);
  return Math.round((matches / maxLen) * 100);
}

export function matchSapToGsn(
  sapItems: { ItemCode: string; ItemName?: string }[],
  gsnProducts: GsnProduct[],
): Map<string, { gsn: GsnProduct; score: number }> {
  const result = new Map<string, { gsn: GsnProduct; score: number }>();

  for (const sap of sapItems) {
    const sapName = sap.ItemName ?? sap.ItemCode;
    let bestMatch: GsnProduct | null = null;
    let bestScore = 0;

    for (const gsn of gsnProducts) {
      const score = matchScore(sapName, gsn.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = gsn;
      }
    }

    if (bestMatch && bestScore >= 40) {
      result.set(sap.ItemCode, { gsn: bestMatch, score: bestScore });
    }
  }

  return result;
}

// ─── Service ─────────────────────────────────────────────────────────

export class B2BCatalogService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_catalog_products (
        id SERIAL PRIMARY KEY,
        sap_item_code VARCHAR(128) NOT NULL UNIQUE,
        sap_item_name VARCHAR(512) NOT NULL DEFAULT '',
        gsn_product_id VARCHAR(64),
        gsn_product_name VARCHAR(512),
        gsn_slug VARCHAR(512),
        image_url TEXT,
        image_thumb_url TEXT,
        category_name VARCHAR(255),
        description_short TEXT,
        ean VARCHAR(128),
        unit_of_measure VARCHAR(64) NOT NULL DEFAULT 'UN',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_sales_item BOOLEAN NOT NULL DEFAULT TRUE,
        match_score INTEGER NOT NULL DEFAULT 0,
        match_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        total_stock NUMERIC(18,2) NOT NULL DEFAULT 0,
        is_in_stock BOOLEAN NOT NULL DEFAULT FALSE,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_stock_notifications (
        id SERIAL PRIMARY KEY,
        sap_item_code VARCHAR(128) NOT NULL,
        cnpj VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        notified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sap_item_code, cnpj)
      )
    `);
  }

  async upsertProduct(p: {
    sap_item_code: string;
    sap_item_name: string;
    gsn_product_id?: string | null;
    gsn_product_name?: string | null;
    gsn_slug?: string | null;
    image_url?: string | null;
    image_thumb_url?: string | null;
    category_name?: string | null;
    description_short?: string | null;
    ean?: string | null;
    unit_of_measure?: string;
    is_active?: boolean;
    is_sales_item?: boolean;
    match_score?: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO b2b_catalog_products
        (sap_item_code, sap_item_name, gsn_product_id, gsn_product_name, gsn_slug,
         image_url, image_thumb_url, category_name, description_short, ean,
         unit_of_measure, is_active, is_sales_item, match_score, last_sync_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (sap_item_code) DO UPDATE SET
         sap_item_name = EXCLUDED.sap_item_name,
         gsn_product_id = COALESCE(EXCLUDED.gsn_product_id, b2b_catalog_products.gsn_product_id),
         gsn_product_name = COALESCE(EXCLUDED.gsn_product_name, b2b_catalog_products.gsn_product_name),
         gsn_slug = COALESCE(EXCLUDED.gsn_slug, b2b_catalog_products.gsn_slug),
         image_url = COALESCE(EXCLUDED.image_url, b2b_catalog_products.image_url),
         image_thumb_url = COALESCE(EXCLUDED.image_thumb_url, b2b_catalog_products.image_thumb_url),
         category_name = COALESCE(EXCLUDED.category_name, b2b_catalog_products.category_name),
         description_short = COALESCE(EXCLUDED.description_short, b2b_catalog_products.description_short),
         ean = COALESCE(EXCLUDED.ean, b2b_catalog_products.ean),
         unit_of_measure = EXCLUDED.unit_of_measure,
         is_active = EXCLUDED.is_active,
         is_sales_item = EXCLUDED.is_sales_item,
         match_score = CASE WHEN b2b_catalog_products.match_confirmed THEN b2b_catalog_products.match_score ELSE EXCLUDED.match_score END,
         last_sync_at = NOW(),
         updated_at = NOW()`,
      [
        p.sap_item_code,
        p.sap_item_name,
        p.gsn_product_id ?? null,
        p.gsn_product_name ?? null,
        p.gsn_slug ?? null,
        p.image_url ?? null,
        p.image_thumb_url ?? null,
        p.category_name ?? null,
        p.description_short ?? null,
        p.ean ?? null,
        p.unit_of_measure ?? "UN",
        p.is_active ?? true,
        p.is_sales_item ?? true,
        p.match_score ?? 0,
      ],
    );
  }

  async updateStock(
    stockBySku: Map<string, number>,
  ): Promise<void> {
    for (const [sku, total] of stockBySku) {
      await this.pool.query(
        `UPDATE b2b_catalog_products
         SET total_stock = $1, is_in_stock = $1 > 0, updated_at = NOW()
         WHERE sap_item_code = $2`,
        [total, sku],
      );
    }
  }

  async listProducts(
    filters: CatalogFilters = {},
  ): Promise<{ items: CatalogProduct[]; total: number }> {
    const conditions: string[] = ["is_active = TRUE", "is_sales_item = TRUE"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      conditions.push(
        `(LOWER(sap_item_name) LIKE $${idx} OR LOWER(sap_item_code) LIKE $${idx} OR LOWER(COALESCE(ean,'')) LIKE $${idx})`,
      );
      params.push(`%${filters.search.toLowerCase()}%`);
      idx++;
    }

    if (filters.category) {
      conditions.push(`category_name = $${idx}`);
      params.push(filters.category);
      idx++;
    }

    if (filters.inStock === true) {
      conditions.push("is_in_stock = TRUE");
    } else if (filters.inStock === false) {
      conditions.push("is_in_stock = FALSE");
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 24));
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*) AS cnt FROM b2b_catalog_products ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]?.cnt ?? 0);

    const dataRes = await this.pool.query(
      `SELECT * FROM b2b_catalog_products ${where}
       ORDER BY is_in_stock DESC, match_score DESC, sap_item_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return { items: dataRes.rows as CatalogProduct[], total };
  }

  async getProduct(sku: string): Promise<CatalogProduct | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_catalog_products WHERE sap_item_code = $1",
      [sku],
    );
    return (rows[0] as CatalogProduct) ?? null;
  }

  async getCategories(): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT category_name FROM b2b_catalog_products
       WHERE category_name IS NOT NULL AND is_active = TRUE
       ORDER BY category_name`,
    );
    return rows.map((r: any) => r.category_name);
  }

  async requestNotification(
    sapItemCode: string,
    cnpj: string,
    email: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO b2b_stock_notifications (sap_item_code, cnpj, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (sap_item_code, cnpj) DO UPDATE SET
         email = EXCLUDED.email, notified = FALSE`,
      [sapItemCode, cnpj, email],
    );
  }

  async getPendingNotifications(
    sapItemCode: string,
  ): Promise<StockNotification[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_stock_notifications WHERE sap_item_code = $1 AND notified = FALSE",
      [sapItemCode],
    );
    return rows as StockNotification[];
  }

  async markNotified(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(
      `UPDATE b2b_stock_notifications SET notified = TRUE WHERE id = ANY($1)`,
      [ids],
    );
  }

  async listBackInStockSkus(): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT n.sap_item_code FROM b2b_stock_notifications n
       JOIN b2b_catalog_products p ON p.sap_item_code = n.sap_item_code
       WHERE n.notified = FALSE AND p.is_in_stock = TRUE`,
    );
    return rows.map((r: any) => r.sap_item_code);
  }

  async listMatches(
    onlyUnconfirmed = false,
  ): Promise<CatalogProduct[]> {
    const where = onlyUnconfirmed
      ? "WHERE gsn_product_id IS NOT NULL AND match_confirmed = FALSE"
      : "WHERE gsn_product_id IS NOT NULL";
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_catalog_products ${where} ORDER BY match_score DESC`,
    );
    return rows as CatalogProduct[];
  }

  async confirmMatch(
    id: number,
    gsnProductId?: string | null,
    imageUrl?: string | null,
    imageThumbUrl?: string | null,
  ): Promise<void> {
    if (gsnProductId !== undefined) {
      await this.pool.query(
        `UPDATE b2b_catalog_products SET
           gsn_product_id = $1, image_url = COALESCE($2, image_url),
           image_thumb_url = COALESCE($3, image_thumb_url),
           match_confirmed = TRUE, updated_at = NOW()
         WHERE id = $4`,
        [gsnProductId, imageUrl ?? null, imageThumbUrl ?? null, id],
      );
    } else {
      await this.pool.query(
        `UPDATE b2b_catalog_products SET match_confirmed = TRUE, updated_at = NOW() WHERE id = $1`,
        [id],
      );
    }
  }
}
