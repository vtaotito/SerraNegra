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
  sap_group_code: number | null;
  description_short: string | null;
  ean: string | null;
  unit_of_measure: string;
  packaging_type: string | null;
  units_per_package: number | null;
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

export const EXCLUDED_SAP_GROUPS = [
  123, // DESPESA ADMINISTRATIVA
  124, // DESPESA DIRETA
  127, // DESPESA COM TRIBUTOS
  129, // ATIVO IMOBILIZADO
  134, // CHAPATEX
  139, // DESPESA COM VEÍCULOS
  140, // DESPESA FINANCEIRA
];

export const SAP_GROUP_NAME_MAP: Record<number, string> = {};

export function setSapGroupNames(groups: { Number: number; GroupName: string }[]): void {
  for (const g of groups) {
    SAP_GROUP_NAME_MAP[g.Number] = g.GroupName;
  }
}

export function getGroupDisplayName(groupCode: number | null | undefined): string | null {
  if (groupCode == null) return null;
  return SAP_GROUP_NAME_MAP[groupCode] ?? `Grupo ${groupCode}`;
}

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  "grf standard": "Garrafas Standard",
  "grf premium": "Garrafas Premium",
  "grf artesanal": "Garrafas Artesanais",
  "pote standard": "Potes",
  "garrafao": "Garrafões",
  "rolha": "Rolhas",
  "lacre grf": "Lacres",
  "lacre gfao": "Lacres Garrafão",
  "tampa": "Tampas",
  "embalagem": "Embalagens",
  "equipamentos": "Equipamentos",
  "insumos": "Insumos",
  "potes e molhos": "Potes e Molhos",
  "ambar": "Garrafas Âmbar",
  "miniaturas": "Miniaturas",
  "premium": "Premium",
  "garrafas de vidro": "Garrafas de Vidro",
  "garrafas de vidro premium": "Garrafas de Vidro Premium",
  "vinhos": "Vinhos",
  "destilados": "Destilados",
  "cervejas": "Cervejas",
  "espumantes": "Espumantes",
  "whisky": "Whisky",
  "vodka": "Vodka",
  "gin": "Gin",
  "rum": "Rum",
  "tequila": "Tequila",
  "licores": "Licores",
  "acessorios": "Acessórios",
  "nao alcoolicos": "Não Alcoólicos",
  "agua": "Água",
  "refrigerantes": "Refrigerantes",
  "sucos": "Sucos",
  "energeticos": "Energéticos",
  "alimentos": "Alimentos",
};

export function normalizeCategoryName(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.trim();
  const key = cleaned.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (CATEGORY_DISPLAY_MAP[key]) return CATEGORY_DISPLAY_MAP[key];

  if (/^grupo\s+\d+$/i.test(cleaned)) return null;

  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function parsePackagingFromName(name: string): { type: string | null; units: number | null } {
  const lower = name.toLowerCase();

  const qtyWord = `(?:(?:com|c[/.]?)\\s+)`;
  const patterns: [RegExp, string][] = [
    [new RegExp(`\\bcaixa\\s+${qtyWord}?(\\d+)`, "i"), "Caixa"],
    [new RegExp(`\\bcx\\s*${qtyWord}?(\\d+)`, "i"), "Caixa"],
    [new RegExp(`\\bfardo\\s+${qtyWord}?(\\d+)`, "i"), "Fardo"],
    [new RegExp(`\\bfd\\s*${qtyWord}?(\\d+)`, "i"), "Fardo"],
    [new RegExp(`\\bpack\\s+${qtyWord}?(\\d+)`, "i"), "Pack"],
    [new RegExp(`\\bpacote\\s+${qtyWord}?(\\d+)`, "i"), "Pacote"],
    [new RegExp(`\\bpcte?\\s*${qtyWord}?(\\d+)`, "i"), "Pacote"],
    [new RegExp(`\\bsaco\\s+${qtyWord}?(\\d+)`, "i"), "Saco"],
    [new RegExp(`\\bpalet[e]?\\s+${qtyWord}?(\\d+)`, "i"), "Palete"],
    [new RegExp(`\\bengradado\\s+${qtyWord}?(\\d+)`, "i"), "Engradado"],
    [/(\d+)\s*(?:un(?:id(?:ades?)?)?|pcs?|pecas?)\b/i, "_units_first"],
  ];

  for (const [re, type] of patterns) {
    const m = lower.match(re);
    if (m) {
      const units = parseInt(m[1], 10);
      if (units > 0 && units <= 9999) {
        if (type === "_units_first") return { type: "Caixa", units };
        return { type, units };
      }
    }
  }

  if (/\bcaixa\b|\bcx\b/i.test(lower)) return { type: "Caixa", units: null };
  if (/\bfardo\b|\bfd\b/i.test(lower)) return { type: "Fardo", units: null };
  if (/\bpack\b/i.test(lower)) return { type: "Pack", units: null };
  if (/\bsaco\b/i.test(lower)) return { type: "Saco", units: null };
  if (/\bpalet[e]?\b/i.test(lower)) return { type: "Palete", units: null };
  if (/\bengradado\b/i.test(lower)) return { type: "Engradado", units: null };

  return { type: null, units: null };
}

const UOM_PACKAGING_MAP: Record<string, string> = {
  "CX": "Caixa",
  "FD": "Fardo",
  "PCT": "Pacote",
  "PC": "Pacote",
  "UN": "Unidade",
  "KG": "Quilograma",
  "LT": "Litro",
  "L": "Litro",
  "ML": "Mililitro",
  "SC": "Saco",
  "PT": "Palete",
  "GR": "Garrafa",
  "BT": "Garrafa",
  "DZ": "Dúzia",
  "GL": "Galão",
  "ENG": "Engradado",
};

export function resolvePackaging(
  sapUOM: string | null | undefined,
  salesUnit: string | null | undefined,
  salesPackagingUnit: string | null | undefined,
  salesQtyPerPack: number | null | undefined,
  salesItemsPerUnit: number | null | undefined,
  productName: string,
): { type: string; units: number | null } {
  const fromName = parsePackagingFromName(productName);

  const sapType = salesPackagingUnit || salesUnit || sapUOM || null;
  const sapUnits = salesQtyPerPack || salesItemsPerUnit || null;

  let resolvedType = "Unidade";
  let resolvedUnits: number | null = null;

  if (sapType && sapType !== "UN" && UOM_PACKAGING_MAP[sapType.toUpperCase()]) {
    resolvedType = UOM_PACKAGING_MAP[sapType.toUpperCase()];
  } else if (fromName.type) {
    resolvedType = fromName.type;
  } else if (sapType && sapType !== "UN") {
    resolvedType = sapType;
  }

  if (sapUnits && sapUnits > 1) {
    resolvedUnits = sapUnits;
  } else if (fromName.units) {
    resolvedUnits = fromName.units;
  }

  return { type: resolvedType, units: resolvedUnits };
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

        let categoryName = p.category_name ?? "";
        if (!categoryName) {
          const rawSlug = p.slug ?? "";
          const slashIdx = rawSlug.indexOf("/");
          if (slashIdx > 0) {
            const catSlug = rawSlug.substring(0, slashIdx);
            categoryName = catSlug
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
          }
        }

        all.push({
          id: String(p.id ?? ""),
          name: p.name ?? "",
          slug: p.slug ?? "",
          price: p.price ?? "0",
          promotional_price: p.promotional_price ?? "0",
          available: p.available ?? "0",
          category_name: categoryName,
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
    .replace(/\b(garrafa|garrafinha|pote|vidro|para|tra|rolha|cortica|tampa|metalica|mm|pcte?|pct|un|c\/)\b/g, "")
    .replace(/\b\d{2}mm\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVolume(name: string): string | null {
  const lower = name.toLowerCase();
  const m = lower.match(/(\d+)\s*ml\b/) || lower.match(/(\d+(?:[.,]\d+)?)\s*l(?:itros?)?\b/);
  if (m) {
    const raw = m[0].replace(",", ".");
    if (raw.includes("l") && !raw.includes("ml")) {
      const liters = parseFloat(m[1].replace(",", "."));
      return `${Math.round(liters * 1000)}ml`;
    }
    return `${m[1]}ml`;
  }
  return null;
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

  const sapVol = extractVolume(sapName);
  const gsnVol = extractVolume(gsnName);
  const volumeMatch = sapVol && gsnVol && sapVol === gsnVol;
  const volumeMismatch = sapVol && gsnVol && sapVol !== gsnVol;

  if (volumeMismatch) return Math.min(matches, 10);

  const maxLen = Math.max(sapTokens.length, gsnTokens.length);
  let score = Math.round((matches / maxLen) * 100);
  if (volumeMatch && score >= 20) score = Math.min(100, score + 10);
  return score;
}

export function matchSapToGsn(
  sapItems: { ItemCode: string; ItemName?: string; BarCode?: string }[],
  gsnProducts: GsnProduct[],
): Map<string, { gsn: GsnProduct; score: number }> {
  const result = new Map<string, { gsn: GsnProduct; score: number }>();

  const gsnByEan = new Map<string, GsnProduct>();
  for (const gsn of gsnProducts) {
    if (gsn.ean) {
      const clean = gsn.ean.replace(/\D/g, "");
      if (clean.length >= 8) gsnByEan.set(clean, gsn);
    }
  }

  const usedGsnIds = new Set<string>();

  for (const sap of sapItems) {
    if (sap.BarCode) {
      const cleanBar = sap.BarCode.replace(/\D/g, "");
      if (cleanBar.length >= 8) {
        const gsnByBar = gsnByEan.get(cleanBar);
        if (gsnByBar && !usedGsnIds.has(gsnByBar.id)) {
          result.set(sap.ItemCode, { gsn: gsnByBar, score: 100 });
          usedGsnIds.add(gsnByBar.id);
          continue;
        }
      }
    }

    const sapName = sap.ItemName ?? sap.ItemCode;
    let bestMatch: GsnProduct | null = null;
    let bestScore = 0;

    for (const gsn of gsnProducts) {
      if (usedGsnIds.has(gsn.id)) continue;
      const score = matchScore(sapName, gsn.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = gsn;
      }
    }

    if (bestMatch && bestScore >= 35) {
      result.set(sap.ItemCode, { gsn: bestMatch, score: bestScore });
      usedGsnIds.add(bestMatch.id);
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
        sap_group_code INTEGER,
        description_short TEXT,
        ean VARCHAR(128),
        unit_of_measure VARCHAR(64) NOT NULL DEFAULT 'UN',
        packaging_type VARCHAR(64),
        units_per_package NUMERIC(12,2),
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

    const migrations = [
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS packaging_type VARCHAR(64)",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS units_per_package NUMERIC(12,2)",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS sap_group_code INTEGER",
    ];
    for (const sql of migrations) {
      try { await this.pool.query(sql); } catch { /* column may already exist */ }
    }

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
    sap_group_code?: number | null;
    description_short?: string | null;
    ean?: string | null;
    unit_of_measure?: string;
    packaging_type?: string | null;
    units_per_package?: number | null;
    is_active?: boolean;
    is_sales_item?: boolean;
    match_score?: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO b2b_catalog_products
        (sap_item_code, sap_item_name, gsn_product_id, gsn_product_name, gsn_slug,
         image_url, image_thumb_url, category_name, sap_group_code, description_short, ean,
         unit_of_measure, packaging_type, units_per_package,
         is_active, is_sales_item, match_score, last_sync_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
       ON CONFLICT (sap_item_code) DO UPDATE SET
         sap_item_name = EXCLUDED.sap_item_name,
         gsn_product_id = CASE WHEN b2b_catalog_products.match_confirmed THEN b2b_catalog_products.gsn_product_id ELSE EXCLUDED.gsn_product_id END,
         gsn_product_name = CASE WHEN b2b_catalog_products.match_confirmed THEN b2b_catalog_products.gsn_product_name ELSE EXCLUDED.gsn_product_name END,
         gsn_slug = CASE WHEN b2b_catalog_products.match_confirmed THEN b2b_catalog_products.gsn_slug ELSE EXCLUDED.gsn_slug END,
         image_url = CASE WHEN b2b_catalog_products.match_confirmed THEN COALESCE(EXCLUDED.image_url, b2b_catalog_products.image_url) ELSE EXCLUDED.image_url END,
         image_thumb_url = CASE WHEN b2b_catalog_products.match_confirmed THEN COALESCE(EXCLUDED.image_thumb_url, b2b_catalog_products.image_thumb_url) ELSE EXCLUDED.image_thumb_url END,
         category_name = COALESCE(EXCLUDED.category_name, b2b_catalog_products.category_name),
         sap_group_code = COALESCE(EXCLUDED.sap_group_code, b2b_catalog_products.sap_group_code),
         description_short = COALESCE(EXCLUDED.description_short, b2b_catalog_products.description_short),
         ean = COALESCE(EXCLUDED.ean, b2b_catalog_products.ean),
         unit_of_measure = EXCLUDED.unit_of_measure,
         packaging_type = COALESCE(EXCLUDED.packaging_type, b2b_catalog_products.packaging_type),
         units_per_package = COALESCE(EXCLUDED.units_per_package, b2b_catalog_products.units_per_package),
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
        p.sap_group_code ?? null,
        p.description_short ?? null,
        p.ean ?? null,
        p.unit_of_measure ?? "UN",
        p.packaging_type ?? null,
        p.units_per_package ?? null,
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
      const inStock = total > 0;
      await this.pool.query(
        `UPDATE b2b_catalog_products
         SET total_stock = $1, is_in_stock = $2, updated_at = NOW()
         WHERE sap_item_code = $3`,
        [total, inStock, sku],
      );
    }
  }

  async deactivateByGroupCodes(groupCodes: number[]): Promise<number> {
    if (groupCodes.length === 0) return 0;
    const res = await this.pool.query(
      `UPDATE b2b_catalog_products SET is_active = FALSE, is_sales_item = FALSE, updated_at = NOW()
       WHERE sap_group_code = ANY($1::integer[]) AND (is_active = TRUE OR is_sales_item = TRUE)`,
      [groupCodes],
    );
    return res.rowCount ?? 0;
  }

  async countAll(): Promise<{ total: number; active: number; inStock: number }> {
    const totalRes = await this.pool.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products");
    const activeRes = await this.pool.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE is_active = TRUE AND is_sales_item = TRUE");
    const stockRes = await this.pool.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE is_in_stock = TRUE");
    return {
      total: Number(totalRes.rows[0].cnt),
      active: Number(activeRes.rows[0].cnt),
      inStock: Number(stockRes.rows[0].cnt),
    };
  }

  async listProducts(
    filters: CatalogFilters = {},
  ): Promise<{ items: CatalogProduct[]; total: number }> {
    const conditions: string[] = ["is_active = TRUE"];
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

/** Formato esperado pelo portal B2B (painel) */
export interface B2BCatalogItemDto {
  sku: string;
  name: string;
  description: string;
  category: string | null;
  ean: string | null;
  imageUrl: string | null;
  price: number;
  inStock: boolean;
  stockQuantity: number;
  unitOfMeasure: string;
  packagingType: string | null;
  unitsPerPack: number | null;
}

export interface B2BProductDetailDto extends B2BCatalogItemDto {
  fullDescription: string | null;
}

export function toB2BCatalogItem(p: CatalogProduct): B2BCatalogItemDto {
  return {
    sku: p.sap_item_code,
    name: p.sap_item_name,
    description: p.description_short ?? "",
    category: p.category_name,
    ean: p.ean || null,
    imageUrl: p.image_url,
    price: 0,
    inStock: p.is_in_stock,
    stockQuantity: Number(p.total_stock ?? 0),
    unitOfMeasure: p.unit_of_measure ?? "UN",
    packagingType: p.packaging_type,
    unitsPerPack: p.units_per_package,
  };
}

export function toB2BProductDetail(p: CatalogProduct): B2BProductDetailDto {
  return {
    ...toB2BCatalogItem(p),
    fullDescription: p.description_short ?? null,
  };
}
