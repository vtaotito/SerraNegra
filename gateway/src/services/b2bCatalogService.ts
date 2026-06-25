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

// ─── Unificação de produtos (mesma lógica do painel da garrafaria) ────
//
// O catálogo do portal B2B passa a agrupar as variações de embalagem de um
// mesmo produto (UND, CAIXA C/12, FARDO C/24, ...) em um único "produto
// unificado", expondo o grupo (categoria), os atributos (capacidade/cor/
// fechamento) e a lista de embalagens disponíveis — espelhando o catálogo do
// painel (painel/lib/format.ts + painel/lib/item-parser.ts).

/** Catálogo de grupos comerciais por prefixo (2 chars) do código SAP. */
export const PRODUCT_GROUP_NAMES: Record<string, string> = {
  AR: "Garrafas Artesanais",
  EQ: "Equipamentos",
  GF: "Garrafão",
  GI: "Garrafa Importada",
  GN: "Garrafa Nacional",
  IS: "Insumos",
  LA: "Lacre",
  ME: "Medidores",
  PO: "Pote",
  RO: "Rolha",
  TA: "Tampa Alumínio",
  TM: "Tampa Metálica",
  TP: "Tampa Plástica",
};

/** Sigla (2 chars) do código SAP — ex.: "GN0000022" → "GN". */
export function getProductPrefix(itemCode: string | null | undefined): string {
  if (!itemCode) return "OUTRO";
  return itemCode.substring(0, 2).toUpperCase() || "OUTRO";
}

/** Nome amigável do grupo a partir do código SAP. */
export function getProductGroupName(itemCode: string | null | undefined): string | null {
  const prefix = getProductPrefix(itemCode);
  return PRODUCT_GROUP_NAMES[prefix] ?? null;
}

const PACK_WORD =
  "(?:CAIXA|CX|FARDO|FD|PALETE|PALET|PALLET|PLT|PACK|PACOTE|PCTE?|SACO|SC|ENGRADADO|DUZIA|DZ)";

/**
 * Nome "base" do produto, sem o sufixo/inline de embalagem
 * ("- CAIXA C/12 UND", "- UND", "FARDO C/1.000" etc.). Em maiúsculas e sem
 * espaços duplicados — pronto para servir de chave de agrupamento.
 */
export function getBaseProductName(name: string | null | undefined): string {
  let s = (name ?? "").trim();
  // " - <PACK> [C/]N [UND]" no final
  s = s.replace(
    new RegExp(`\\s*[-–]\\s*${PACK_WORD}\\s*(?:C\\s*/\\s*)?[\\d.,]*\\s*(?:UND|UNID)?\\s*$`, "i"),
    "",
  );
  // " - UND" no final
  s = s.replace(/\s*[-–]\s*(?:UND|UNID)\s*$/i, "");
  // "<PACK> [C/]N [UND]" inline no final (sem hífen)
  s = s.replace(
    new RegExp(`\\s+${PACK_WORD}\\s*(?:C\\s*/\\s*)?[\\d.,]+\\s*(?:UND|UNID)?\\s*$`, "i"),
    "",
  );
  return s.replace(/\s{2,}/g, " ").trim().toUpperCase();
}

/** Chave de unificação: "<prefixo>::<nome_base>". */
export function getUnifiedKey(itemCode: string | null | undefined, name: string | null | undefined): string {
  return `${getProductPrefix(itemCode)}::${getBaseProductName(name) || (itemCode ?? "—")}`;
}

const COLOR_MAP: Record<string, string> = {
  TRA: "Transparente", TRANSPARENTE: "Transparente", AMB: "Âmbar", AMBAR: "Âmbar",
  BRANCA: "Branca", PRETA: "Preta", DOURADA: "Dourada", PRATA: "Prata",
  CREME: "Creme", MARROM: "Marrom", VERMELHA: "Vermelha", VERDE: "Verde", AZUL: "Azul",
};

/** Extrai atributos (capacidade/cor/fechamento) do nome-base. */
export function parseProductAttributes(baseName: string): {
  capacity: string | null;
  color: string | null;
  closure: string | null;
} {
  const capM = baseName.match(/\b(\d[\d.,]*)\s*(ML|L)\b/i);
  const capacity = capM ? `${capM[1]} ${capM[2].toUpperCase()}` : null;

  const corM = baseName.match(/\b(TRA|AMB|AMBAR|BRANCA|PRETA|DOURADA|PRATA|CREME|MARROM|VERMELHA|VERDE|AZUL|TRANSPARENTE)\b/i);
  const color = corM ? COLOR_MAP[corM[1].toUpperCase()] ?? corM[1] : null;

  const fM = baseName.match(/\b(ROLHA|ROSCA|TWIST[.-]?OFF|FLIP[.-]?TOP|CONTA[.-]?GOTAS|COROA[.-]?PRY[.-]?OFF|COROA[.-]?TWIST[.-]?OFF)\b/i);
  const closure = fM ? fM[1].replace(/\./g, "-").toUpperCase() : null;

  return { capacity, color, closure };
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

// WooCommerce Store API (site institucional/catalogo da Garrafaria Serra Negra).
// E o catalogo da propria empresa, entao os nomes batem com os itens do SAP e
// traz imagens + descricoes ricas.
const WOO_API_BASE = "https://garrafariaserranegra.com.br/wp-json/wc/store/v1";

/**
 * Busca todos os produtos do WooCommerce (site garrafariaserranegra.com.br),
 * normalizando para o mesmo formato de GsnProduct usado no matching.
 */
export async function fetchAllWooProducts(): Promise<GsnProduct[]> {
  const all: GsnProduct[] = [];

  for (let page = 1; page <= 20; page++) {
    try {
      const url = `${WOO_API_BASE}/products?per_page=100&page=${page}`;
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) break;

      const products = (await res.json()) as any[];
      if (!Array.isArray(products) || products.length === 0) break;

      for (const p of products) {
        const firstImage =
          Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
        const images = firstImage
          ? [
              {
                url: String(firstImage.src ?? ""),
                thumbUrl: String(
                  firstImage.thumbnail ?? firstImage.src ?? "",
                ),
              },
            ]
          : [];

        // Descricao: WooCommerce retorna HTML; preferimos a descricao completa.
        const description = String(
          p.description ?? p.short_description ?? "",
        ).trim();

        const categoryName =
          Array.isArray(p.categories) && p.categories.length > 0
            ? String(p.categories[0].name ?? "")
            : "";

        all.push({
          id: `woo-${p.id}`,
          name: String(p.name ?? ""),
          slug: String(p.slug ?? ""),
          price: String(p.prices?.price ?? "0"),
          promotional_price: String(p.prices?.sale_price ?? "0"),
          available: p.is_in_stock ? "1" : "0",
          category_name: categoryName,
          images,
          description_small: description,
          // SKU do Woo costuma ser interno ("SN..."), nao um EAN confiavel para
          // casar com o BarCode do SAP — deixamos vazio e casamos por nome+volume.
          ean: "",
        });
      }

      if (products.length < 100) break;
    } catch {
      break;
    }
  }

  return all;
}

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
    // Palavras de fechamento/atributo/categoria: nao identificam a "linha" do
    // produto e, se mantidas, geram tanto falso-positivo (ex.: tampa x garrafa
    // compartilhando "rosca") quanto falso-negativo. Removidas do match.
    .replace(/\b(rosca|twistoff|twist|fliptop|flip|off|premium|standard|mini|bolso|kit|de|da|do|com)\b/g, "")
    // Cores: nao devem ser o unico sinal de match (ex.: "Caçula Ambar" x "STD Ambar").
    .replace(/\b(amb|ambar|amber|transparente|transp|tra)\b/g, "")
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

// Tokens irrelevantes para distinguir um produto (unidades / medidas). O volume
// e tratado separadamente por extractVolume, entao nao deve contar como "match".
const UNIT_TOKENS = new Set([
  "ml", "l", "lt", "litro", "litros", "mm", "cm", "kg", "g", "gr", "un",
]);

function distinctiveTokens(normalized: string): string[] {
  return extractTokens(normalized).filter(
    (t) =>
      !/^\d+$/.test(t) &&
      !UNIT_TOKENS.has(t) &&
      // Tokens "numero+unidade" colados (ex.: 600ml, 1000ml, 28mm) sao medida/
      // volume — tratados por extractVolume, nunca contam como nome do produto.
      !/^\d+(?:[.,]\d+)?(ml|l|lt|litros?|g|gr|kg|mm|cm|un)$/.test(t),
  );
}

function matchScore(sapName: string, gsnName: string): number {
  const sapNorm = normalizeForMatch(sapName);
  const gsnNorm = normalizeForMatch(gsnName);

  if (sapNorm.length > 0 && sapNorm === gsnNorm) return 100;

  // So consideramos tokens distintivos (nome do produto), ignorando numeros e
  // unidades — assim "1000 ml" sozinho nao gera match.
  const sapTokens = distinctiveTokens(sapNorm);
  const gsnTokens = distinctiveTokens(gsnNorm);
  if (sapTokens.length === 0 || gsnTokens.length === 0) return 0;

  let matches = 0;
  for (const st of sapTokens) {
    if (gsnTokens.some((gt) => gt === st || gt.includes(st) || st.includes(gt))) {
      matches++;
    }
  }

  // Sem nenhum token de nome em comum => nao e o mesmo produto.
  if (matches === 0) return 0;

  const sapVol = extractVolume(sapName);
  const gsnVol = extractVolume(gsnName);
  const volumeMatch = sapVol && gsnVol && sapVol === gsnVol;
  const volumeMismatch = sapVol && gsnVol && sapVol !== gsnVol;

  // Cobertura do nome mais curto: nomes do SAP costumam ter atributos extras
  // (cor, fechamento) ausentes no titulo do site, entao usar o menor evita
  // penalizar matches corretos.
  const minLen = Math.min(sapTokens.length, gsnTokens.length);
  let score = Math.round((matches / minLen) * 100);

  // Volume diferente e forte sinal de produto diferente: derruba o score.
  if (volumeMismatch) return Math.min(score, 15);
  if (volumeMatch) score = Math.min(100, score + 15);

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

    if (bestMatch && bestScore >= 55) {
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
         description_short = CASE WHEN b2b_catalog_products.match_confirmed THEN COALESCE(EXCLUDED.description_short, b2b_catalog_products.description_short) ELSE EXCLUDED.description_short END,
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

  /**
   * Desativa produtos "sinteticos" (codigo GSN-*) que nao existem no SAP e por
   * isso nao podem ser pedidos pelo portal. O catalogo deve conter apenas itens
   * SAP reais.
   */
  async deactivateSyntheticProducts(): Promise<number> {
    const res = await this.pool.query(
      `UPDATE b2b_catalog_products SET is_active = FALSE, is_sales_item = FALSE, updated_at = NOW()
       WHERE sap_item_code LIKE 'GSN-%' AND (is_active = TRUE OR is_sales_item = TRUE)`,
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

  /**
   * Catálogo unificado: agrupa as variações de embalagem de um mesmo produto
   * em um único item (espelha o catálogo do painel da garrafaria). A busca é
   * aplicada no banco; o agrupamento, filtro por categoria/estoque e paginação
   * acontecem em memória (necessário para paginar por produto, não por SKU).
   */
  async listUnifiedProducts(filters: CatalogFilters = {}): Promise<{
    items: B2BUnifiedProductDto[];
    total: number;
    categories: string[];
  }> {
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

    const where = `WHERE ${conditions.join(" AND ")}`;
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_catalog_products ${where} ORDER BY sap_item_name ASC`,
      params,
    );

    // Agrupa por chave de unificação.
    const groups = new Map<string, CatalogProduct[]>();
    for (const r of rows as CatalogProduct[]) {
      const key = getUnifiedKey(r.sap_item_code, r.sap_item_name);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    let unified = Array.from(groups.values()).map((g) => buildUnifiedProduct(g));

    // Lista completa de categorias (antes dos filtros de categoria/estoque).
    const categories = Array.from(
      new Set(unified.map((u) => u.category).filter((c): c is string => !!c)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    if (filters.category) {
      unified = unified.filter((u) => u.category === filters.category);
    }
    if (filters.inStock === true) {
      unified = unified.filter((u) => u.inStock);
    } else if (filters.inStock === false) {
      unified = unified.filter((u) => !u.inStock);
    }

    // Em estoque primeiro, depois ordem alfabética.
    unified.sort(
      (a, b) =>
        Number(b.inStock) - Number(a.inStock) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );

    const total = unified.length;
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 24));
    const offset = (page - 1) * limit;

    return { items: unified.slice(offset, offset + limit), total, categories };
  }

  /** Produto unificado que contém um SKU específico (para a tela de detalhe). */
  async getUnifiedProductBySku(
    sku: string,
  ): Promise<B2BUnifiedProductDetailDto | null> {
    const target = await this.getProduct(sku);
    if (!target) return null;

    const prefix = getProductPrefix(target.sap_item_code);
    const base = getBaseProductName(target.sap_item_name);
    const likeBase = `${base.replace(/[%_]/g, " ")}%`;

    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_catalog_products
       WHERE is_active = TRUE AND is_sales_item = TRUE
         AND UPPER(LEFT(sap_item_code, 2)) = $1
         AND UPPER(sap_item_name) LIKE $2`,
      [prefix, likeBase],
    );

    const variants = (rows as CatalogProduct[]).filter(
      (r) =>
        getProductPrefix(r.sap_item_code) === prefix &&
        getBaseProductName(r.sap_item_name) === base,
    );

    return buildUnifiedProduct(variants.length > 0 ? variants : [target]);
  }

  /**
   * Mapa sku → dados de exibição (imagem, slug, estoque) para enriquecer as
   * linhas de um pedido. Usado no detalhe do pedido do Portal B2B para mostrar
   * miniatura, link para o catálogo e disponibilidade de cada item.
   */
  async getManyBySkus(skus: string[]): Promise<
    Record<
      string,
      {
        name: string | null;
        imageUrl: string | null;
        thumbUrl: string | null;
        slug: string | null;
        isInStock: boolean;
        isActive: boolean;
        unitOfMeasure: string | null;
      }
    >
  > {
    if (skus.length === 0) return {};
    const { rows } = await this.pool.query(
      `SELECT sap_item_code, sap_item_name, gsn_product_name, gsn_slug,
              image_url, image_thumb_url, is_in_stock, is_active, is_sales_item,
              unit_of_measure
       FROM b2b_catalog_products
       WHERE sap_item_code = ANY($1::text[])`,
      [skus],
    );
    const out: Record<string, any> = {};
    for (const r of rows) {
      out[r.sap_item_code] = {
        name: r.gsn_product_name ?? r.sap_item_name ?? null,
        imageUrl: r.image_url ?? null,
        thumbUrl: r.image_thumb_url ?? r.image_url ?? null,
        slug: r.gsn_slug ?? null,
        isInStock: r.is_in_stock === true,
        isActive: r.is_active === true && r.is_sales_item === true,
        unitOfMeasure: r.unit_of_measure ?? null,
      };
    }
    return out;
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

// ─── DTOs do catálogo unificado ──────────────────────────────────────

/** Uma embalagem disponível de um produto unificado (cada uma é um SKU SAP). */
export interface B2BPackagingVariant {
  sku: string;
  /** Tipo de embalagem resolvido ("Unidade" | "Caixa" | "Fardo" | ...). */
  packagingType: string;
  /** Unidades por embalagem (>= 1). */
  unitsPerPack: number;
  unitOfMeasure: string;
  inStock: boolean;
  stockQuantity: number;
}

export interface B2BUnifiedProductDto {
  /** Chave de unificação ("<prefixo>::<nome_base>"). */
  id: string;
  /** SKU da variante padrão (menor embalagem disponível). */
  sku: string;
  /** Nome-base do produto (sem sufixo de embalagem). */
  name: string;
  description: string;
  /** Categoria comercial (grupo do produto) — ex.: "Garrafa Nacional". */
  category: string | null;
  /** Sigla do grupo (2 chars) — ex.: "GN". */
  groupCode: string;
  capacity: string | null;
  color: string | null;
  closure: string | null;
  ean: string | null;
  imageUrl: string | null;
  inStock: boolean;
  variants: B2BPackagingVariant[];
}

export interface B2BUnifiedProductDetailDto extends B2BUnifiedProductDto {
  fullDescription: string | null;
}

/** Normaliza units_per_package (number | string | null) para inteiro >= 1. */
function normUnitsPerPack(value: number | string | null | undefined): number {
  if (value == null) return 1;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Resolve o tipo de embalagem para exibição a partir das colunas do catálogo. */
function resolveVariantPackagingType(p: CatalogProduct, unitsPerPack: number): string {
  const raw = (p.packaging_type ?? "").trim();
  if (raw && raw.toLowerCase() !== "unidade" && raw.toUpperCase() !== "UN") return raw;
  if (unitsPerPack > 1) return "Caixa";
  return "Unidade";
}

/**
 * Constrói um produto unificado a partir das variantes (linhas SAP que
 * compartilham a mesma chave de unificação).
 */
export function buildUnifiedProduct(rows: CatalogProduct[]): B2BUnifiedProductDetailDto {
  const baseName = getBaseProductName(rows[0]?.sap_item_name);
  const groupCode = getProductPrefix(rows[0]?.sap_item_code);
  const attrs = parseProductAttributes(baseName || rows[0]?.sap_item_name || "");

  const variants: B2BPackagingVariant[] = rows
    .map((r) => {
      const unitsPerPack = normUnitsPerPack(r.units_per_package);
      return {
        sku: r.sap_item_code,
        packagingType: resolveVariantPackagingType(r, unitsPerPack),
        unitsPerPack,
        unitOfMeasure: r.unit_of_measure ?? "UN",
        inStock: r.is_in_stock === true,
        stockQuantity: Number(r.total_stock ?? 0),
      } satisfies B2BPackagingVariant;
    })
    // Ordena por unidades por embalagem (menor primeiro: UND → CAIXA → FARDO).
    .sort((a, b) => a.unitsPerPack - b.unitsPerPack || a.sku.localeCompare(b.sku));

  // Variante padrão: menor embalagem em estoque; senão a menor embalagem.
  const primaryVariant = variants.find((v) => v.inStock) ?? variants[0];
  const primaryRow =
    rows.find((r) => r.sap_item_code === primaryVariant?.sku) ?? rows[0];

  const imageUrl =
    primaryRow?.image_url ?? rows.find((r) => r.image_url)?.image_url ?? null;
  const ean = primaryRow?.ean || rows.find((r) => r.ean)?.ean || null;
  const category =
    getProductGroupName(rows[0]?.sap_item_code) ??
    primaryRow?.category_name ??
    rows.find((r) => r.category_name)?.category_name ??
    null;
  const descriptionShort =
    primaryRow?.description_short ??
    rows.find((r) => r.description_short)?.description_short ??
    "";

  return {
    id: getUnifiedKey(rows[0]?.sap_item_code, rows[0]?.sap_item_name),
    sku: primaryVariant?.sku ?? rows[0]?.sap_item_code,
    name: baseName || rows[0]?.sap_item_name || rows[0]?.sap_item_code,
    description: descriptionShort,
    fullDescription: descriptionShort || null,
    category,
    groupCode,
    capacity: attrs.capacity,
    color: attrs.color,
    closure: attrs.closure,
    ean,
    imageUrl,
    inStock: variants.some((v) => v.inStock),
    variants,
  };
}
