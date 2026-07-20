import pg from "pg";

const { Pool } = pg;

// ─── URL pública do produto (para casar com o Google Search Console) ──
//
// O catálogo B2B é privado; o ranqueamento é medido sobre o site PÚBLICO. Cada
// produto é mapeado para sua URL pública a partir do slug de origem: produtos
// vindos do gsnonline (Tray) usam a base GSN; os vindos do WooCommerce usam a
// base Woo (detectados pelo prefixo "woo-" no gsn_product_id). Bases
// configuráveis por env; sem slug de origem → sem página pública (null).

const PUBLIC_STORE_GSN_BASE = (
  process.env.PUBLIC_STORE_GSN_BASE ?? "https://www.gsnonline.com.br"
).replace(/\/+$/, "");
const PUBLIC_STORE_WOO_BASE = (
  process.env.PUBLIC_STORE_WOO_BASE ?? "https://garrafariaserranegra.com.br"
).replace(/\/+$/, "");
// Prefixo do permalink de produto do WooCommerce (pt-BR normalmente "produto").
const PUBLIC_STORE_WOO_PRODUCT_PATH = (
  process.env.PUBLIC_STORE_WOO_PRODUCT_PATH ?? "produto"
).replace(/^\/+|\/+$/g, "");

/**
 * URL pública canônica do produto a partir do slug de origem. Retorna null
 * quando o produto não tem página pública (sem slug de origem).
 */
export function deriveCanonicalUrl(
  gsnProductId: string | null | undefined,
  gsnSlug: string | null | undefined,
): string | null {
  const slug = (gsnSlug ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!slug) return null;
  const isWoo = (gsnProductId ?? "").startsWith("woo-");
  if (isWoo) {
    const path = PUBLIC_STORE_WOO_PRODUCT_PATH ? `${PUBLIC_STORE_WOO_PRODUCT_PATH}/` : "";
    return `${PUBLIC_STORE_WOO_BASE}/${path}${slug}`;
  }
  return `${PUBLIC_STORE_GSN_BASE}/${slug}`;
}

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
  // Campos de gestão do admin (editáveis fora do sync).
  seo_title: string | null;
  seo_description: string | null;
  seo_slug: string | null;
  /** Palavras-chave de SEO (armazenadas separadas por vírgula). */
  seo_keywords: string | null;
  /** Atributos sugeridos pela IA (JSON string de {name,value}[]). */
  seo_attributes: string | null;
  og_image_url: string | null;
  /** Trava contra o sync: quando true, descrição/imagem manuais são preservadas. */
  content_locked: boolean;
  /** Ocultação individual do produto no catálogo do cliente (o sync nunca toca). */
  admin_hidden: boolean;
  content_updated_by: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Configuração de visibilidade por categoria no catálogo do cliente. */
export interface CategorySetting {
  id: number;
  category_name: string;
  is_visible: boolean;
  updated_by: string | null;
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

/**
 * Converte a quantidade capturada do nome (ex.: "1.200", "5.661", "24") em
 * inteiro. No padrão brasileiro o "." (e às vezes ",") é separador de MILHAR
 * para contagens de embalagem ("PALETE C/ 1.200 UND" = 1200), então removemos
 * esses separadores antes de converter.
 */
function parsePackUnits(raw: string): number {
  const digits = raw.replace(/[.,]/g, "");
  return parseInt(digits, 10);
}

/** Palavras de embalagem reconhecidas (com abreviações). Mais longas primeiro. */
const PACK_ALT =
  "pallet|palete|palet|plt|caixa|cx|fardo|fd|pacote|pcte|pct|pack|saco|sc|engradado";

/** Normaliza a palavra de embalagem capturada para o rótulo de exibição. */
function packWordToType(w: string): string {
  const t = w.toLowerCase();
  if (t === "fardo" || t === "fd") return "Fardo";
  if (t === "pallet" || t.startsWith("palet") || t === "plt") return "Palete";
  if (t === "saco" || t === "sc") return "Saco";
  if (t === "pacote" || t === "pcte" || t === "pct") return "Pacote";
  if (t === "pack") return "Pack";
  if (t === "engradado") return "Engradado";
  return "Caixa"; // caixa | cx | fallback genérico multi-unidade
}

/**
 * Extrai a embalagem (tipo + unidades) do NOME do item. Fonte autoritativa da
 * contagem de unidades por embalagem no portal. Robusto a variações reais do
 * SAP da Garrafaria:
 *   - "CAIXA C / 24 UND"        (espaços em "C / N")
 *   - "PALETE C/ 2.025 UND VDP" ("lixo" após a contagem)
 *   - "PALETE C/ 4.224 UN"      ("UN" em vez de "UND")
 *   - "... - ROSCA 31 PALETE C/ 1232 UND" (hífen usado no meio do nome)
 *   - "FARDO  C/20"             (sem "UND")
 *   - "ROLHA- 980 UNID"         (contagem sem palavra de embalagem)
 * Evita falsos positivos como "CAIXA 550 ML 425X250X130" (produto que É a
 * caixa) e "... 22,5MM - UND" (diâmetro/rosca), que resultam em 1.
 */
export function parsePackagingFromName(name: string): { type: string | null; units: number | null } {
  const lower = (name ?? "").toLowerCase();
  const UNIT = "(?:un|und|unid|unidades?)";

  // Melhor candidato = ocorrência mais à direita (sufixo de embalagem no final).
  let best: { idx: number; type: string; units: number } | null = null;
  const consider = (idx: number, packWord: string | null, rawNum: string) => {
    const u = parsePackUnits(rawNum);
    if (!(u > 1 && u <= 999999)) return;
    if (!best || idx >= best.idx) {
      best = { idx, type: packWord ? packWordToType(packWord) : "Caixa", units: u };
    }
  };

  // A) <PACK> [C/ | COM] <N>  — contagem explícita por embalagem.
  const reA = new RegExp(`\\b(${PACK_ALT})\\b\\s*(?:c\\s*[\\/.]\\s*|com\\s+)\\s*([\\d.,]+)`, "gi");
  for (const m of lower.matchAll(reA)) consider(m.index ?? 0, m[1], m[2]);

  // B) <PACK> <N> <UNIT>  — contagem sem "C/", mas seguida de UN/UND/UNID.
  const reB = new RegExp(`\\b(${PACK_ALT})\\b\\s*([\\d.,]+)\\s*${UNIT}\\b`, "gi");
  for (const m of lower.matchAll(reB)) consider(m.index ?? 0, m[1], m[2]);

  if (best) return { type: best.type, units: best.units };

  // C) <N> <UNIT> ao final, sem palavra de embalagem ("... 980 UNID").
  const mc = lower.match(new RegExp(`([\\d.,]+)\\s*${UNIT}\\s*$`, "i"));
  if (mc) {
    const u = parsePackUnits(mc[1]);
    if (u > 1 && u <= 999999) return { type: "Caixa", units: u };
  }

  // Sem contagem: identifica só o TIPO quando a palavra de embalagem aparece
  // isolada (para exibição), sem multiplicador.
  const mType = lower.match(new RegExp(`\\b(${PACK_ALT})\\b`, "i"));
  if (mType) return { type: packWordToType(mType[1]), units: null };

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
  // O NOME do item é a fonte autoritativa da embalagem neste catálogo: o sufixo
  // descreve a embalagem do SKU ("- CAIXA C/ 24 UND", "- PALETE C/ 4.972 UND",
  // "- UND"). Os campos de embalagem do master do SAP estão frequentemente
  // errados (ex.: garrafa "- UND" gravada como Caixa/100), por isso o nome tem
  // prioridade. O master só é usado como fallback quando o nome não traz nada.
  const fromName = parsePackagingFromName(productName);

  if (fromName.type && fromName.units) {
    return { type: fromName.type, units: fromName.units };
  }

  if (fromName.type) {
    // Embalagem citada no nome sem contagem explícita (ex.: "CAIXA" solto):
    // mantém o tipo para exibição, mas SEM multiplicador. Não usamos os campos
    // de embalagem do master do SAP porque frequentemente estão errados
    // (ex.: garrafa "- UND" gravada como Caixa/100), gerando volume inflado.
    return { type: fromName.type, units: null };
  }

  // Nome sem palavra de embalagem (ex.: "- UND") → unidade individual.
  if (productName && productName.trim() !== "") {
    return { type: "Unidade", units: null };
  }

  // Nome ausente — fallback raro ao master do SAP.
  const sapUnits =
    salesQtyPerPack && salesQtyPerPack > 1
      ? salesQtyPerPack
      : salesItemsPerUnit && salesItemsPerUnit > 1
        ? salesItemsPerUnit
        : null;
  const sapType = salesPackagingUnit || salesUnit || sapUOM || null;
  let resolvedType = "Unidade";
  if (sapType && sapType !== "UN" && UOM_PACKAGING_MAP[sapType.toUpperCase()]) {
    resolvedType = UOM_PACKAGING_MAP[sapType.toUpperCase()];
  } else if (sapType && sapType !== "UN") {
    resolvedType = sapType;
  }
  return { type: resolvedType, units: sapUnits };
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

/**
 * Categorias que NÃO devem aparecer no catálogo do Portal B2B (itens internos /
 * não comercializáveis para o cliente). Comparação case-insensitive.
 */
export const EXCLUDED_B2B_CATEGORIES = new Set([
  "embalagens",
  "moldura",
  "palete",
  "serv prestados",
]);

/** Indica se uma categoria deve ser ocultada do Portal B2B. */
export function isExcludedB2BCategory(category: string | null | undefined): boolean {
  return !!category && EXCLUDED_B2B_CATEGORIES.has(category.trim().toLowerCase());
}

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
  // Sufixo de unidade "solto" no final, sem hífen nem palavra de embalagem
  // (ex.: "...22.5MM UND", "...ROSCA 33MM UN"). Sem isso, a variante avulsa não
  // agruparia com as embalagens do mesmo produto.
  s = s.replace(/\s+(?:UND|UNID|UN)\s*$/i, "");
  return s.replace(/\s{2,}/g, " ").trim().toUpperCase();
}

/** Chave de unificação: "<prefixo>::<nome_base>". */
export function getUnifiedKey(itemCode: string | null | undefined, name: string | null | undefined): string {
  return `${getProductPrefix(itemCode)}::${getBaseProductName(name) || (itemCode ?? "—")}`;
}

const COLOR_MAP: Record<string, string> = {
  TRA: "Transparente", TRANSPARENTE: "Transparente", AMB: "Âmbar", AMBAR: "Âmbar",
  BRANCA: "Branca", BRANCO: "Branca", PRETA: "Preta", PRETO: "Preta",
  DOURADA: "Dourada", PRATA: "Prata", CREME: "Creme", MARROM: "Marrom",
  VERMELHA: "Vermelha", VERDE: "Verde", AZUL: "Azul", FUME: "Fumê", FUMÊ: "Fumê",
};

/** Tokens de cor reconhecidos no nome (chaves do COLOR_MAP). */
const COLOR_TOKENS = Object.keys(COLOR_MAP);
const COLOR_RE = new RegExp(`\\b(${COLOR_TOKENS.join("|")})\\b`, "i");

/**
 * Padrões de fechamento, dos mais específicos (compostos) para os mais simples.
 * A ordem importa: `ROLHA.CORTIÇA` deve casar antes de `ROLHA`/`CORTIÇA` e
 * `COROA-PRY-OFF`/`COROA-TWIST-OFF` antes de `COROA`. Aceita separadores por
 * ponto, hífen ou espaço (o SAP mistura `ROLHA.CORTIÇA`, `TWIST-OFF`, etc.) e a
 * cedilha opcional (`CORTICA`/`CORTIÇA`).
 */
const CLOSURE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /ROLHA[.\-\s]?CORTI[ÇC]A/i, label: "Rolha/Cortiça" },
  { re: /COROA[.\-\s]?PRY[.\-\s]?OFF/i, label: "Coroa Pry-Off" },
  { re: /COROA[.\-\s]?TWIST[.\-\s]?OFF/i, label: "Coroa Twist-Off" },
  { re: /TWIST[.\-\s]?OFF/i, label: "Twist-Off" },
  { re: /FLIP[.\-\s]?TOP/i, label: "Flip-Top" },
  { re: /CONTA[.\-\s]?GOTAS/i, label: "Conta-Gotas" },
  { re: /CORTI[ÇC]A/i, label: "Cortiça" },
  { re: /\bROLHA\b/i, label: "Rolha" },
  { re: /\bROSCA\b/i, label: "Rosca" },
  { re: /\bCOROA\b/i, label: "Coroa" },
];

/**
 * Diâmetro de gargalo/rosca (ex.: "31MM", "00MM", "19,28MM", "22,5MM") — não é
 * atributo selecionável. Cobre parte decimal com "," ou ".".
 */
const DIAMETER_RE = /\b\d{1,3}(?:[.,]\d{1,3})?\s*MM\b/gi;

/** True quando o nome é de uma GARRAFA (prefixo exato, sem pegar GARRAFÃO). */
export function isBottleName(name: string | null | undefined): boolean {
  return /^\s*GARRAFA(?:\s|$)/i.test(name ?? "");
}

/** Extrai atributos (capacidade/cor/fechamento) do nome-base. */
export function parseProductAttributes(baseName: string): {
  capacity: string | null;
  color: string | null;
  closure: string | null;
} {
  const capM = baseName.match(/\b(\d[\d.,]*)\s*(ML|L)\b/i);
  const capacity = capM ? `${capM[1]} ${capM[2].toUpperCase()}` : null;

  const corM = baseName.match(COLOR_RE);
  const color = corM ? COLOR_MAP[corM[1].toUpperCase()] ?? corM[1] : null;

  let closure: string | null = null;
  for (const { re, label } of CLOSURE_PATTERNS) {
    if (re.test(baseName)) {
      closure = label;
      break;
    }
  }

  return { capacity, color, closure };
}

/**
 * Diâmetro de boca/gargalo do nome-base (ex.: "31MM", "19,29MM"), normalizado
 * para exibição (sempre com "MM" maiúsculo e sem espaço). Como o diâmetro agora
 * distingue cards de garrafa, é exposto como atributo do produto unificado.
 * Retorna null quando o nome não traz diâmetro.
 */
export function extractDiameter(name: string | null | undefined): string | null {
  const m = (name ?? "").match(/\b(\d{1,3}(?:[.,]\d{1,3})?)\s*MM\b/i);
  return m ? `${m[1]}MM` : null;
}

/**
 * Nome amigável do card a partir do nome-base (que já contém cor/fechamento/
 * diâmetro). Faz capitalização por palavra preservando unidades/medidas em
 * maiúsculas (ML, L, MM) — ex.: "GARRAFA CACHAÇA 500 ML ROSCA 31MM" →
 * "Garrafa Cachaça 500 ML Rosca 31MM". É determinístico, então nomes-base
 * distintos geram nomes distintos (cards não colidem).
 */
export function prettifyProductName(baseName: string | null | undefined): string {
  const s = (baseName ?? "").trim();
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((word) => {
      // Medida colada à unidade: "500ml", "31mm", "1,5l" → mantém a unidade em
      // maiúsculas e o número intacto.
      const m = word.match(/^([\d.,]+)(ml|l|mm)$/i);
      if (m) return `${m[1]}${m[2].toUpperCase()}`;
      // Unidade isolada.
      if (/^(ml|l|mm)$/i.test(word)) return word.toUpperCase();
      // Código de cor do SAP (TRA/AMB/…) → nome legível ("Transparente").
      const colorFull = COLOR_MAP[word.toUpperCase()];
      if (colorFull) return colorFull;
      // Palavra comum: capitaliza a inicial e as letras após ".", "-" ou "/"
      // (ex.: "litro.magnum" → "Litro.Magnum", "cachaça.imp" → "Cachaça.Imp").
      return word
        .toLowerCase()
        .replace(/(^|[.\-/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(" ");
}

/**
 * Nome do MODELO do produto (chave de agrupamento das variações de cor/
 * fechamento). Parte do nome-base (sem embalagem) e, apenas para garrafas,
 * remove também os tokens de cor, fechamento e diâmetro, preservando a
 * identidade `linha + volume`. Ex.: `GARRAFA ALFA 750 ML TRA ROLHA` →
 * `GARRAFA ALFA 750 ML`. Para não-garrafas, é igual a getBaseProductName (sem
 * regressão na unificação por embalagem).
 */
export function getModelBaseName(name: string | null | undefined): string {
  const base = getBaseProductName(name);
  if (!isBottleName(base)) return base;

  let s = base;
  s = s.replace(DIAMETER_RE, " ");
  for (const { re } of CLOSURE_PATTERNS) {
    s = s.replace(new RegExp(re.source, "gi"), " ");
  }
  s = s.replace(new RegExp(`\\b(${COLOR_TOKENS.join("|")})\\b`, "gi"), " ");
  // Remove pontuação residual solta no fim (ex.: vírgula de diâmetro decimal já removido).
  return s.replace(/\s{2,}/g, " ").replace(/[\s,;.\-]+$/, "").trim();
}

/**
 * Chave de agrupamento por modelo: "<prefixo>::<nome_do_modelo>". Aceita tanto
 * o código SAP completo quanto o prefixo de 2 chars (getProductPrefix trata os
 * dois). Para não-garrafas equivale a getUnifiedKey (agrupamento por embalagem).
 */
export function getModelKey(itemCode: string | null | undefined, name: string | null | undefined): string {
  const model = getModelBaseName(name) || getBaseProductName(name) || (itemCode ?? "—");
  return `${getProductPrefix(itemCode)}::${model}`;
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
  /** Se true, restringe a itens com pedido de venda nos últimos 12 meses. */
  onlyRecentlySold?: boolean;
}

/** Janela (em meses) da regra "produtos com pedido de venda recente". */
export const RECENT_SALES_MONTHS = 12;

// ─── GSN Online API fetcher ──────────────────────────────────────────

// Loja B2C oficial GSN Online (gsnonline.com.br) — plataforma Tray, store 1123510.
// E a vitrine voltada ao consumidor, com as fotos oficiais dos produtos; usamos
// o domInio canonico da loja (mesmo store/web_api do antigo garrafariaonline).
const GSN_API_BASE = "https://www.gsnonline.com.br/web_api";
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

/**
 * Grupo físico grosseiro do produto a partir do nome. Serve de guarda para o
 * fallback de imagem por família: nunca aplica a foto de uma garrafa em um
 * fecho/pote e vice-versa.
 */
export function physGroupOfName(name: string): string {
  const n = (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\b(garrafa|garrafinha|gfa|growler|garrafao)\b/.test(n)) return "bottle";
  if (/\b(pote|copo|frasco|erlenmeyer|balao|becker|proveta)\b/.test(n)) return "pot";
  if (/\b(tampa|batoque|gotejador|valvula|dosador|conta.?gotas|flip.?top|pump|spray)\b/.test(n))
    return "cap";
  if (/\b(rolha|cortica)\b/.test(n)) return "cork";
  if (/\b(lacre|selo|termoencolhivel|termo.?encolhivel)\b/.test(n)) return "seal";
  if (/\b(saco|sacola|bag)\b/.test(n)) return "bag";
  return "other";
}

/**
 * Chave de "família" para casar imagens IGNORANDO a litragem/volume e a
 * embalagem: grupo físico + tokens distintivos do nome (marca/linha), sem
 * números, unidades nem palavras genéricas. Ex.: "GARRAFA BURDEOS 500 ML ..."
 * e "Garrafa Burdeos 750 ml" → ambas "bottle|burdeos".
 */
export function familyKeyOfName(name: string): string | null {
  // Usa o nome-base (sem sufixo de embalagem "- UND" / "- FARDO C/ 24 UND"),
  // senão tokens como "und" poluiriam a família e quebrariam o agrupamento.
  const base = getBaseProductName(name);
  const tokens = distinctiveTokens(normalizeForMatch(base));
  if (tokens.length === 0) return null;
  const uniq = [...new Set(tokens)].sort();
  return `${physGroupOfName(name)}|${uniq.join(" ")}`;
}

/**
 * Índice família → imagem, a partir dos produtos do site. A ordem da lista
 * define a prioridade em empates de família: passamos o gsnonline (loja B2C
 * oficial) primeiro, então suas fotos têm precedência; o WooCommerce entra
 * como complemento. Usado como fallback quando uma variante do SAP não tem
 * imagem própria (mesma linha, litragem diferente).
 */
export function buildFamilyImageIndex(
  products: GsnProduct[],
): Map<string, { url: string; thumbUrl: string }> {
  const idx = new Map<string, { url: string; thumbUrl: string }>();
  for (const p of products) {
    const img = p.images?.[0];
    if (!img || !img.url) continue;
    const key = familyKeyOfName(p.name);
    if (!key) continue;
    if (!idx.has(key)) {
      idx.set(key, { url: img.url, thumbUrl: img.thumbUrl || img.url });
    }
  }
  return idx;
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

  // Cache curto (em memória) das categorias ocultas — a config muda pouco e é
  // consultada em todo request de catálogo. TTL evita bater no banco a cada leitura.
  private hiddenCategoriesCache: { value: Set<string>; expiresAt: number } | null = null;
  private static readonly HIDDEN_CATEGORIES_TTL_MS = 30_000;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  /** Invalida o cache de categorias ocultas (após um PATCH de visibilidade). */
  invalidateCategoryCache(): void {
    this.hiddenCategoriesCache = null;
  }

  /**
   * Conjunto (lowercase) das categorias ocultas do catálogo do cliente. Lê de
   * b2b_catalog_category_settings com cache curto; em falha, cai para o Set
   * hardcoded legado (nunca deixa vazar categoria interna por indisponibilidade).
   */
  async getHiddenCategories(): Promise<Set<string>> {
    const now = Date.now();
    if (this.hiddenCategoriesCache && this.hiddenCategoriesCache.expiresAt > now) {
      return this.hiddenCategoriesCache.value;
    }
    try {
      const { rows } = await this.pool.query(
        "SELECT category_name FROM b2b_catalog_category_settings WHERE is_visible = FALSE",
      );
      const set = new Set(
        rows.map((r: any) => String(r.category_name).trim().toLowerCase()),
      );
      this.hiddenCategoriesCache = {
        value: set,
        expiresAt: now + B2BCatalogService.HIDDEN_CATEGORIES_TTL_MS,
      };
      return set;
    } catch {
      return new Set([...EXCLUDED_B2B_CATEGORIES].map((c) => c.toLowerCase()));
    }
  }

  private isHiddenCategory(hidden: Set<string>, category: string | null | undefined): boolean {
    return !!category && hidden.has(category.trim().toLowerCase());
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
      // Gestão de catálogo no admin: SEO, trava contra sync e ocultação individual.
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255)",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS seo_description TEXT",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS seo_slug VARCHAR(255)",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS og_image_url TEXT",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS seo_keywords TEXT",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS seo_attributes TEXT",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS content_locked BOOLEAN NOT NULL DEFAULT FALSE",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS admin_hidden BOOLEAN NOT NULL DEFAULT FALSE",
      "ALTER TABLE b2b_catalog_products ADD COLUMN IF NOT EXISTS content_updated_by VARCHAR(128)",
    ];
    for (const sql of migrations) {
      try { await this.pool.query(sql); } catch { /* column may already exist */ }
    }

    // Visibilidade por categoria (substitui o Set hardcoded EXCLUDED_B2B_CATEGORIES).
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_catalog_category_settings (
        id SERIAL PRIMARY KEY,
        category_name VARCHAR(255) UNIQUE NOT NULL,
        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by VARCHAR(128),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // SEO por categoria (gerado/revisado no admin, armazenado para uso futuro na vitrine).
    const categoryMigrations = [
      "ALTER TABLE b2b_catalog_category_settings ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255)",
      "ALTER TABLE b2b_catalog_category_settings ADD COLUMN IF NOT EXISTS seo_description TEXT",
      "ALTER TABLE b2b_catalog_category_settings ADD COLUMN IF NOT EXISTS intro_text TEXT",
      "ALTER TABLE b2b_catalog_category_settings ADD COLUMN IF NOT EXISTS seo_keywords TEXT",
    ];
    for (const sql of categoryMigrations) {
      try { await this.pool.query(sql); } catch { /* column may already exist */ }
    }

    // Seed inicial: as categorias antes ocultas por código ficam is_visible=false.
    // ON CONFLICT DO NOTHING preserva qualquer decisão manual posterior do admin.
    for (const raw of EXCLUDED_B2B_CATEGORIES) {
      const name = normalizeCategoryName(raw) ?? raw;
      try {
        await this.pool.query(
          `INSERT INTO b2b_catalog_category_settings (category_name, is_visible, updated_by)
           VALUES ($1, FALSE, 'seed')
           ON CONFLICT (category_name) DO NOTHING`,
          [name],
        );
      } catch { /* ignore seed errors */ }
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
         image_url = CASE WHEN b2b_catalog_products.content_locked THEN b2b_catalog_products.image_url WHEN b2b_catalog_products.match_confirmed THEN COALESCE(EXCLUDED.image_url, b2b_catalog_products.image_url) ELSE EXCLUDED.image_url END,
         image_thumb_url = CASE WHEN b2b_catalog_products.content_locked THEN b2b_catalog_products.image_thumb_url WHEN b2b_catalog_products.match_confirmed THEN COALESCE(EXCLUDED.image_thumb_url, b2b_catalog_products.image_thumb_url) ELSE EXCLUDED.image_thumb_url END,
         category_name = COALESCE(EXCLUDED.category_name, b2b_catalog_products.category_name),
         sap_group_code = COALESCE(EXCLUDED.sap_group_code, b2b_catalog_products.sap_group_code),
         description_short = CASE WHEN b2b_catalog_products.content_locked THEN b2b_catalog_products.description_short WHEN b2b_catalog_products.match_confirmed THEN COALESCE(EXCLUDED.description_short, b2b_catalog_products.description_short) ELSE EXCLUDED.description_short END,
         ean = COALESCE(EXCLUDED.ean, b2b_catalog_products.ean),
         unit_of_measure = EXCLUDED.unit_of_measure,
         -- A embalagem e derivada do NOME DO ITEM NO SAP (fonte autoritativa) a
         -- cada sync, entao sobrescrevemos sempre. COALESCE preservava valores
         -- antigos/errados (ex.: "Unidade" com units_per_package=4693) quando o
         -- parser evoluia ou quando um item passava a ser individual.
         packaging_type = EXCLUDED.packaging_type,
         units_per_package = EXCLUDED.units_per_package,
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
    if (stockBySku.size === 0) return;
    // UPDATE em lote via unnest: um único round-trip mesmo com milhares de SKUs
    // (agora atualizamos todos os itens do sync, inclusive zerando os sem estoque).
    const skus: string[] = [];
    const totals: number[] = [];
    for (const [sku, total] of stockBySku) {
      skus.push(sku);
      totals.push(total);
    }
    await this.pool.query(
      `UPDATE b2b_catalog_products AS p
       SET total_stock = s.total,
           is_in_stock = s.total > 0,
           updated_at = NOW()
       FROM (
         SELECT UNNEST($1::text[]) AS sku, UNNEST($2::numeric[]) AS total
       ) AS s
       WHERE p.sap_item_code = s.sku`,
      [skus, totals],
    );
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
    const conditions: string[] = ["is_active = TRUE", "admin_hidden = FALSE"];
    const params: unknown[] = [];
    let idx = 1;

    // Remove categorias ocultas (config por categoria) do catálogo do cliente.
    const hidden = await this.getHiddenCategories();
    if (hidden.size > 0) {
      conditions.push(`LOWER(COALESCE(category_name,'')) <> ALL($${idx}::text[])`);
      params.push([...hidden]);
      idx++;
    }

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

    // Regra de negócio: só produtos com pedido de venda nos últimos N meses.
    if (filters.onlyRecentlySold) {
      conditions.push(
        `sap_item_code IN (
           SELECT DISTINCT l.item_code
             FROM sap_sales_order_lines l
             JOIN sap_sales_orders o ON o.doc_entry = l.doc_entry
            WHERE o.cancelled = 'N'
              AND l.item_code IS NOT NULL
              AND o.doc_date >= (CURRENT_DATE - (${RECENT_SALES_MONTHS}::int * INTERVAL '1 month'))
         )`,
      );
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
    categories: { name: string; count: number }[];
  }> {
    // Apenas is_active (mesmo critério do catálogo legado listProducts). O flag
    // is_sales_item nem sempre é populado pelo sync, então não filtramos por ele
    // aqui para não esvaziar o catálogo.
    const conditions: string[] = ["is_active = TRUE", "admin_hidden = FALSE"];
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
    const hidden = await this.getHiddenCategories();
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_catalog_products ${where} ORDER BY sap_item_name ASC`,
      params,
    );

    // Agrupa por nome-base (unificação só por EMBALAGEM): cada combinação
    // distinta de cor/fechamento/diâmetro vira um card separado. Para
    // não-garrafas, getUnifiedKey já era equivalente ao antigo getModelKey.
    const groups = new Map<string, CatalogProduct[]>();
    for (const r of rows as CatalogProduct[]) {
      const key = getUnifiedKey(r.sap_item_code, r.sap_item_name);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    let unified = Array.from(groups.values()).map((g) => buildUnifiedProduct(g));

    // Remove categorias ocultas (configuráveis em b2b_catalog_category_settings).
    unified = unified.filter((u) => !this.isHiddenCategory(hidden, u.category));

    // Regra de negócio: só exibir produtos com pedido de venda nos últimos 12
    // meses. Mantém o produto se QUALQUER variação de embalagem vendeu (assim as
    // demais embalagens do mesmo produto continuam disponíveis para pedido).
    // Se o conjunto vier vazio (dados de venda indisponíveis), não filtra.
    const soldSkus = await this.getRecentlySoldSkus();
    if (soldSkus.size > 0) {
      unified = unified.filter((u) => u.variants.some((v) => soldSkus.has(v.sku)));
    }

    // Categorias com contagem de produtos (antes dos filtros de categoria/estoque).
    const categoryCounts = new Map<string, number>();
    for (const u of unified) {
      if (!u.category) continue;
      categoryCounts.set(u.category, (categoryCounts.get(u.category) ?? 0) + 1);
    }
    const categories = Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

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
    if (target.admin_hidden) return null;

    const prefix = getProductPrefix(target.sap_item_code);
    const targetKey = getUnifiedKey(target.sap_item_code, target.sap_item_name);
    // O nome-base (sem sufixo de embalagem) é sempre um prefixo do nome completo,
    // então serve de filtro grosseiro no SQL; o agrupamento exato é feito abaixo.
    const base = getBaseProductName(target.sap_item_name);
    const likeBase = `${base.replace(/[%_]/g, " ")}%`;

    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_catalog_products
       WHERE is_active = TRUE
         AND admin_hidden = FALSE
         AND UPPER(LEFT(sap_item_code, 2)) = $1
         AND UPPER(sap_item_name) LIKE $2`,
      [prefix, likeBase],
    );

    const variants = (rows as CatalogProduct[]).filter(
      (r) => getUnifiedKey(r.sap_item_code, r.sap_item_name) === targetKey,
    );

    const unified = buildUnifiedProduct(variants.length > 0 ? variants : [target]);
    // Não expõe produtos de categorias ocultas no Portal B2B.
    const hidden = await this.getHiddenCategories();
    if (this.isHiddenCategory(hidden, unified.category)) return null;

    // Regra de negócio: só expõe produtos com pedido de venda nos últimos 12
    // meses (qualquer variação de embalagem). Conjunto vazio = não filtra.
    const soldSkus = await this.getRecentlySoldSkus();
    if (soldSkus.size > 0 && !unified.variants.some((v) => soldSkus.has(v.sku))) {
      return null;
    }
    return unified;
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
       WHERE category_name IS NOT NULL AND is_active = TRUE AND admin_hidden = FALSE
       ORDER BY category_name`,
    );
    const hidden = await this.getHiddenCategories();
    return rows
      .map((r: any) => r.category_name as string)
      .filter((c) => !this.isHiddenCategory(hidden, c));
  }

  /**
   * Conjunto de SKUs (item_code do SAP) com pelo menos um pedido de venda NÃO
   * cancelado nos últimos `months` meses. Base para a regra de negócio "o
   * catálogo do Portal B2B só exibe produtos vendidos recentemente".
   *
   * Em caso de falha (ex.: tabelas de pedidos ainda não sincronizadas) retorna
   * um conjunto vazio; os chamadores tratam o conjunto vazio como "não filtrar",
   * evitando esvaziar o catálogo por indisponibilidade dos dados de venda.
   */
  async getRecentlySoldSkus(
    months: number = RECENT_SALES_MONTHS,
  ): Promise<Set<string>> {
    try {
      const { rows } = await this.pool.query(
        `SELECT DISTINCT l.item_code
           FROM sap_sales_order_lines l
           JOIN sap_sales_orders o ON o.doc_entry = l.doc_entry
          WHERE o.cancelled = 'N'
            AND l.item_code IS NOT NULL
            AND o.doc_date >= (CURRENT_DATE - ($1::int * INTERVAL '1 month'))`,
        [months],
      );
      return new Set(rows.map((r: any) => String(r.item_code)));
    } catch {
      return new Set<string>();
    }
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

  // ─── Gestão de catálogo (admin) ────────────────────────────────────

  /**
   * Lista paginada para o admin com filtros ricos (busca, categoria,
   * visibilidade, travados, sem imagem). Retorna as linhas completas (com os
   * campos de SEO/trava) e o total para paginação.
   */
  async listAdminProducts(filters: {
    search?: string;
    category?: string;
    visibility?: "visible" | "hidden";
    locked?: boolean;
    noImage?: boolean;
    activeOnly?: boolean;
    sort?: "name" | "category" | "updated";
    order?: "asc" | "desc";
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: CatalogProduct[]; total: number }> {
    const conditions: string[] = ["sap_item_code NOT LIKE 'GSN-%'"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.activeOnly !== false) conditions.push("is_active = TRUE");

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
    if (filters.visibility === "hidden") conditions.push("admin_hidden = TRUE");
    else if (filters.visibility === "visible") conditions.push("admin_hidden = FALSE");
    if (filters.locked === true) conditions.push("content_locked = TRUE");
    else if (filters.locked === false) conditions.push("content_locked = FALSE");
    if (filters.noImage === true) conditions.push("image_url IS NULL");
    else if (filters.noImage === false) conditions.push("image_url IS NOT NULL");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const sortCol =
      filters.sort === "category"
        ? "category_name"
        : filters.sort === "updated"
          ? "updated_at"
          : "sap_item_name";
    const sortDir = filters.order === "desc" ? "DESC" : "ASC";

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*) AS cnt FROM b2b_catalog_products ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]?.cnt ?? 0);

    const dataRes = await this.pool.query(
      `SELECT * FROM b2b_catalog_products ${where}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST, sap_item_code ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );
    return { items: dataRes.rows as CatalogProduct[], total };
  }

  /** KPIs da visão geral do catálogo (admin). */
  async getAdminOverview(): Promise<{
    totalActive: number;
    noImage: number;
    hidden: number;
    locked: number;
    hiddenCategories: number;
    seoIncomplete: number;
  }> {
    const q = (sql: string) => this.pool.query(sql).then((r) => Number(r.rows[0]?.cnt ?? 0));
    const base = "FROM b2b_catalog_products WHERE sap_item_code NOT LIKE 'GSN-%' AND is_active = TRUE";
    const [totalActive, noImage, hidden, locked, seoIncomplete, hiddenCategories] =
      await Promise.all([
        q(`SELECT COUNT(*) AS cnt ${base}`),
        q(`SELECT COUNT(*) AS cnt ${base} AND image_url IS NULL`),
        q(`SELECT COUNT(*) AS cnt ${base} AND admin_hidden = TRUE`),
        q(`SELECT COUNT(*) AS cnt ${base} AND content_locked = TRUE`),
        q(`SELECT COUNT(*) AS cnt ${base} AND (seo_title IS NULL OR seo_title = '' OR seo_description IS NULL OR seo_description = '')`),
        q("SELECT COUNT(*) AS cnt FROM b2b_catalog_category_settings WHERE is_visible = FALSE"),
      ]);
    return { totalActive, noImage, hidden, locked, hiddenCategories, seoIncomplete };
  }

  /**
   * Atualiza os campos editáveis pelo admin. Ao mexer em descrição ou imagem,
   * seta content_locked = true para o sync não reverter. SEO/admin_hidden não
   * travam o produto (o sync nunca toca neles).
   */
  async updateAdminProduct(
    sku: string,
    patch: {
      description_short?: string | null;
      seo_title?: string | null;
      seo_description?: string | null;
      seo_slug?: string | null;
      seo_keywords?: string | null;
      seo_attributes?: string | null;
      og_image_url?: string | null;
      image_url?: string | null;
      image_thumb_url?: string | null;
      admin_hidden?: boolean;
    },
    updatedBy: string,
  ): Promise<CatalogProduct | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    let locksContent = false;

    const add = (col: string, value: unknown) => {
      sets.push(`${col} = $${idx}`);
      params.push(value);
      idx++;
    };

    if (patch.description_short !== undefined) {
      add("description_short", patch.description_short);
      locksContent = true;
    }
    if (patch.image_url !== undefined) {
      add("image_url", patch.image_url);
      add("image_thumb_url", patch.image_thumb_url ?? patch.image_url);
      locksContent = true;
    }
    if (patch.seo_title !== undefined) add("seo_title", patch.seo_title);
    if (patch.seo_description !== undefined) add("seo_description", patch.seo_description);
    if (patch.seo_slug !== undefined) add("seo_slug", patch.seo_slug);
    if (patch.seo_keywords !== undefined) add("seo_keywords", patch.seo_keywords);
    if (patch.seo_attributes !== undefined) add("seo_attributes", patch.seo_attributes);
    if (patch.og_image_url !== undefined) add("og_image_url", patch.og_image_url);
    if (patch.admin_hidden !== undefined) add("admin_hidden", patch.admin_hidden);

    if (sets.length === 0) return this.getProduct(sku);

    if (locksContent) sets.push("content_locked = TRUE");
    add("content_updated_by", updatedBy);
    sets.push("updated_at = NOW()");

    params.push(sku);
    const { rows } = await this.pool.query(
      `UPDATE b2b_catalog_products SET ${sets.join(", ")} WHERE sap_item_code = $${idx} RETURNING *`,
      params,
    );
    return (rows[0] as CatalogProduct) ?? null;
  }

  /** Grava a imagem enviada pelo admin e trava o conteúdo contra o sync. */
  async setProductImage(
    sku: string,
    imageUrl: string,
    imageThumbUrl: string,
    updatedBy: string,
  ): Promise<CatalogProduct | null> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_catalog_products
       SET image_url = $1, image_thumb_url = $2, content_locked = TRUE,
           content_updated_by = $3, updated_at = NOW()
       WHERE sap_item_code = $4 RETURNING *`,
      [imageUrl, imageThumbUrl, updatedBy, sku],
    );
    return (rows[0] as CatalogProduct) ?? null;
  }

  /** Destrava o produto — volta a seguir descrição/imagem do sync. */
  async unlockProduct(sku: string, updatedBy: string): Promise<CatalogProduct | null> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_catalog_products
       SET content_locked = FALSE, content_updated_by = $1, updated_at = NOW()
       WHERE sap_item_code = $2 RETURNING *`,
      [updatedBy, sku],
    );
    return (rows[0] as CatalogProduct) ?? null;
  }

  /**
   * Categorias existentes no catálogo (produtos ativos) com a visibilidade
   * configurada e a contagem de produtos. Faz LEFT JOIN com a config para
   * refletir tanto categorias sem registro (visíveis por padrão) quanto a
   * decisão manual do admin.
   */
  async listCategorySettings(): Promise<
    {
      category_name: string;
      is_visible: boolean;
      product_count: number;
      seo_title: string | null;
      seo_description: string | null;
      intro_text: string | null;
      seo_keywords: string | null;
      updated_by: string | null;
      updated_at: string | null;
    }[]
  > {
    const { rows } = await this.pool.query(
      `SELECT p.category_name,
              COUNT(*) AS product_count,
              COALESCE(cs.is_visible, TRUE) AS is_visible,
              cs.seo_title,
              cs.seo_description,
              cs.intro_text,
              cs.seo_keywords,
              cs.updated_by,
              cs.updated_at
         FROM b2b_catalog_products p
         LEFT JOIN b2b_catalog_category_settings cs
           ON LOWER(cs.category_name) = LOWER(p.category_name)
        WHERE p.category_name IS NOT NULL
          AND p.is_active = TRUE
          AND p.sap_item_code NOT LIKE 'GSN-%'
        GROUP BY p.category_name, cs.is_visible, cs.seo_title, cs.seo_description,
                 cs.intro_text, cs.seo_keywords, cs.updated_by, cs.updated_at
        ORDER BY p.category_name`,
    );
    return rows.map((r: any) => ({
      category_name: r.category_name,
      is_visible: r.is_visible === true || r.is_visible === "true",
      product_count: Number(r.product_count),
      seo_title: r.seo_title ?? null,
      seo_description: r.seo_description ?? null,
      intro_text: r.intro_text ?? null,
      seo_keywords: r.seo_keywords ?? null,
      updated_by: r.updated_by ?? null,
      updated_at: r.updated_at ?? null,
    }));
  }

  /**
   * Atualiza os campos de SEO de uma categoria (upsert). Preserva a
   * visibilidade existente quando o registro já existe.
   */
  async updateCategorySeo(
    categoryName: string,
    patch: {
      seo_title?: string | null;
      seo_description?: string | null;
      intro_text?: string | null;
      seo_keywords?: string | null;
    },
    updatedBy: string,
  ): Promise<void> {
    const cols: string[] = [];
    const insertVals: string[] = [];
    const updateSets: string[] = [];
    const params: unknown[] = [categoryName];
    let idx = 2;
    const add = (col: string, value: unknown) => {
      cols.push(col);
      insertVals.push(`$${idx}`);
      updateSets.push(`${col} = EXCLUDED.${col}`);
      params.push(value);
      idx++;
    };
    if (patch.seo_title !== undefined) add("seo_title", patch.seo_title);
    if (patch.seo_description !== undefined) add("seo_description", patch.seo_description);
    if (patch.intro_text !== undefined) add("intro_text", patch.intro_text);
    if (patch.seo_keywords !== undefined) add("seo_keywords", patch.seo_keywords);
    if (cols.length === 0) return;

    params.push(updatedBy);
    const updatedByPlaceholder = `$${idx}`;

    await this.pool.query(
      `INSERT INTO b2b_catalog_category_settings
         (category_name, ${cols.join(", ")}, updated_by, updated_at)
       VALUES ($1, ${insertVals.join(", ")}, ${updatedByPlaceholder}, NOW())
       ON CONFLICT (category_name) DO UPDATE SET
         ${updateSets.join(", ")},
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      params,
    );
    this.invalidateCategoryCache();
  }

  /**
   * Amostra de nomes de produtos de uma categoria — insumo para a IA de SEO
   * gerar o texto da categoria.
   */
  async getCategorySampleProducts(categoryName: string, limit = 12): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT sap_item_name FROM b2b_catalog_products
        WHERE category_name = $1 AND is_active = TRUE AND sap_item_code NOT LIKE 'GSN-%'
        ORDER BY is_in_stock DESC, sap_item_name ASC
        LIMIT $2`,
      [categoryName, limit],
    );
    return rows.map((r: any) => getBaseProductName(r.sap_item_name) || r.sap_item_name);
  }

  /**
   * Todos os produtos ativos (fora os sintéticos GSN-*) para o dashboard de SEO:
   * cálculo de score e casamento com o Search Console. Não paginado.
   */
  async listAllActiveProducts(): Promise<CatalogProduct[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_catalog_products
        WHERE is_active = TRUE AND sap_item_code NOT LIKE 'GSN-%'
        ORDER BY sap_item_name ASC`,
    );
    return rows as CatalogProduct[];
  }

  /**
   * Produtos-alvo da geração de SEO em massa. Com scope "visible" aplica os
   * MESMOS filtros de visibilidade do catálogo público do portal: respeita
   * admin_hidden e a visibilidade por categoria (b2b_catalog_category_settings).
   * Com scope "all" retorna todos os ativos (fora os sintéticos GSN-*).
   */
  async listProductsForBulkSeo(
    scope: "visible" | "all" = "visible",
  ): Promise<CatalogProduct[]> {
    const conditions: string[] = ["is_active = TRUE", "sap_item_code NOT LIKE 'GSN-%'"];
    const params: unknown[] = [];
    let idx = 1;

    if (scope === "visible") {
      conditions.push("admin_hidden = FALSE");
      const hidden = await this.getHiddenCategories();
      if (hidden.size > 0) {
        conditions.push(`LOWER(COALESCE(category_name,'')) <> ALL($${idx}::text[])`);
        params.push([...hidden]);
        idx++;
      }
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_catalog_products
        WHERE ${conditions.join(" AND ")}
        ORDER BY sap_item_name ASC`,
      params,
    );
    return rows as CatalogProduct[];
  }

  /** Upsert da visibilidade de uma categoria. Invalida o cache de leitura. */
  async upsertCategorySetting(
    categoryName: string,
    isVisible: boolean,
    updatedBy: string,
  ): Promise<CategorySetting> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_catalog_category_settings (category_name, is_visible, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (category_name) DO UPDATE SET
         is_visible = EXCLUDED.is_visible,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [categoryName, isVisible, updatedBy],
    );
    this.invalidateCategoryCache();
    return rows[0] as CategorySetting;
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

/** DTO completo para a Gestão de Catálogo do admin (inclui SEO/trava/visibilidade). */
export interface AdminCatalogProductDto {
  sku: string;
  name: string;
  category: string | null;
  groupCode: number | null;
  ean: string | null;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoSlug: string | null;
  seoKeywords: string[];
  seoAttributes: { name: string; value: string }[];
  ogImageUrl: string | null;
  /** URL pública canônica (site público) ou null se não houver página pública. */
  canonicalUrl: string | null;
  /** Slug de origem (gsnonline/woo) usado para casar com o Search Console. */
  sourceSlug: string | null;
  contentLocked: boolean;
  adminHidden: boolean;
  isActive: boolean;
  isInStock: boolean;
  stockQuantity: number;
  unitOfMeasure: string;
  matchConfirmed: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  lastSyncAt: string | null;
}

/** Converte a string "a, b, c" em array limpo de keywords. */
export function parseKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/** Faz o parse defensivo dos atributos SEO (JSON) armazenados. */
export function parseSeoAttributes(
  raw: string | null | undefined,
): { name: string; value: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.name === "string" && typeof a.value === "string")
      .map((a) => ({ name: String(a.name), value: String(a.value) }));
  } catch {
    return [];
  }
}

export function toAdminCatalogProduct(p: CatalogProduct): AdminCatalogProductDto {
  return {
    sku: p.sap_item_code,
    name: p.sap_item_name,
    category: p.category_name,
    groupCode: p.sap_group_code,
    ean: p.ean || null,
    imageUrl: p.image_url,
    imageThumbUrl: p.image_thumb_url ?? p.image_url,
    description: p.description_short ?? null,
    seoTitle: p.seo_title ?? null,
    seoDescription: p.seo_description ?? null,
    seoSlug: p.seo_slug ?? null,
    seoKeywords: parseKeywords(p.seo_keywords),
    seoAttributes: parseSeoAttributes(p.seo_attributes),
    ogImageUrl: p.og_image_url ?? null,
    canonicalUrl: deriveCanonicalUrl(p.gsn_product_id, p.gsn_slug),
    sourceSlug: p.gsn_slug ?? null,
    contentLocked: p.content_locked === true,
    adminHidden: p.admin_hidden === true,
    isActive: p.is_active === true,
    isInStock: p.is_in_stock === true,
    stockQuantity: Number(p.total_stock ?? 0),
    unitOfMeasure: p.unit_of_measure ?? "UN",
    matchConfirmed: p.match_confirmed === true,
    updatedBy: p.content_updated_by ?? null,
    updatedAt: p.updated_at ?? null,
    lastSyncAt: p.last_sync_at ?? null,
  };
}

// ─── DTOs do catálogo unificado ──────────────────────────────────────

/**
 * Uma variante concreta do modelo (um SKU SAP), com seus atributos de cor,
 * fechamento e embalagem. Para garrafas há uma entrada por combinação real de
 * (cor × fechamento × embalagem); o front deriva as opções disponíveis e
 * resolve o SKU a partir da seleção. Para os demais produtos, a cor/fechamento
 * costumam ser nulos e a variante representa só a embalagem (como antes).
 */
export interface B2BAttributeVariant {
  sku: string;
  /** Cor normalizada (ex.: "Transparente", "Âmbar") ou null. */
  color: string | null;
  /** Fechamento normalizado (ex.: "Rolha", "Rosca", "Coroa") ou null. */
  closure: string | null;
  /** Tipo de embalagem resolvido ("Unidade" | "Caixa" | "Fardo" | ...). */
  packagingType: string;
  /** Unidades por embalagem (>= 1). */
  unitsPerPack: number;
  unitOfMeasure: string;
  inStock: boolean;
  /** Estoque disponível na unidade nativa da variante (ex.: nº de caixas). */
  stockQuantity: number;
  /**
   * Estoque disponível em UNIDADES (= stockQuantity × unitsPerPack). Espelha a
   * coluna "ESTOQUE (UND)" da Gestão de Compras do painel.
   */
  stockUnits: number;
  /** Imagem específica da variante (troca de foto por cor), quando houver. */
  imageUrl?: string | null;
}

export interface B2BUnifiedProductDto {
  /** Chave de unificação por embalagem ("<prefixo>::<nome_base>"). */
  id: string;
  /** SKU representativo (menor embalagem em estoque) — usado no link do card. */
  sku: string;
  /** Nome exibido do card (nome-base com cor/fechamento/diâmetro, capitalizado). */
  name: string;
  description: string;
  /** Categoria comercial (grupo do produto) — ex.: "Garrafa Nacional". */
  category: string | null;
  /** Sigla do grupo (2 chars) — ex.: "GN". */
  groupCode: string;
  capacity: string | null;
  /** Cor única do card (derivada do nome-base); null quando não há. */
  color: string | null;
  /** Fechamento único do card (derivado do nome-base); null caso contrário. */
  closure: string | null;
  /** Diâmetro de boca/gargalo do card (ex.: "31MM"); null quando não há. */
  diameter: string | null;
  /** Cores distintas disponíveis no card (≤ 1 item; mantido p/ compatibilidade). */
  colors: string[];
  /** Fechamentos distintos disponíveis no modelo (ordenados). */
  closures: string[];
  ean: string | null;
  imageUrl: string | null;
  inStock: boolean;
  /**
   * Estoque disponível total do produto unificado em UNIDADES (soma das
   * variantes). É a "ESTOQUE (UND)" exibida na Gestão de Compras do painel.
   */
  stockUnits: number;
  /** Todas as variantes concretas (uma por SKU) do modelo. */
  variants: B2BAttributeVariant[];
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
  const first = rows[0];
  const groupCode = getProductPrefix(first?.sap_item_code);
  // Nome-base do card (sem embalagem, mas COM cor/fechamento/diâmetro). Todas as
  // variantes do card compartilham esse nome-base — a unificação agora é só por
  // embalagem, então cor/fechamento/diâmetro são atributos fixos do card.
  const baseName = getBaseProductName(first?.sap_item_name);
  const displayName = prettifyProductName(baseName) || first?.sap_item_name || first?.sap_item_code;
  // Capacidade/cor/fechamento/diâmetro saem do nome-base do card; comuns a todas
  // as variantes (que diferem apenas pela embalagem).
  const attrs = parseProductAttributes(baseName || first?.sap_item_name || "");
  const diameter = extractDiameter(baseName || first?.sap_item_name);

  const variants: B2BAttributeVariant[] = rows
    .map((r) => {
      const unitsPerPack = normUnitsPerPack(r.units_per_package);
      const stockQuantity = Number(r.total_stock ?? 0);
      // Cor/fechamento saem do nome-base da PRÓPRIA variante (cada SKU tem os seus).
      const vAttrs = parseProductAttributes(getBaseProductName(r.sap_item_name));
      return {
        sku: r.sap_item_code,
        color: vAttrs.color,
        closure: vAttrs.closure,
        packagingType: resolveVariantPackagingType(r, unitsPerPack),
        unitsPerPack,
        unitOfMeasure: r.unit_of_measure ?? "UN",
        inStock: r.is_in_stock === true,
        stockQuantity,
        stockUnits: Math.max(0, Math.round(stockQuantity * unitsPerPack)),
        imageUrl: r.image_url ?? null,
      } satisfies B2BAttributeVariant;
    })
    // Ordena por unidades por embalagem (menor primeiro: UND → CAIXA → FARDO).
    .sort((a, b) => a.unitsPerPack - b.unitsPerPack || a.sku.localeCompare(b.sku));

  // Dimensões distintas disponíveis (para os seletores em cascata do front).
  const colors = [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const closures = [...new Set(variants.map((v) => v.closure).filter((c): c is string => !!c))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Variante representativa: menor embalagem em estoque; senão a menor embalagem.
  const primaryVariant = variants.find((v) => v.inStock) ?? variants[0];
  const primaryRow =
    rows.find((r) => r.sap_item_code === primaryVariant?.sku) ?? first;

  const imageUrl =
    primaryRow?.image_url ?? rows.find((r) => r.image_url)?.image_url ?? null;
  const ean = primaryRow?.ean || rows.find((r) => r.ean)?.ean || null;
  const category =
    getProductGroupName(first?.sap_item_code) ??
    primaryRow?.category_name ??
    rows.find((r) => r.category_name)?.category_name ??
    null;
  const descriptionShort =
    primaryRow?.description_short ??
    rows.find((r) => r.description_short)?.description_short ??
    "";

  return {
    id: getUnifiedKey(first?.sap_item_code, first?.sap_item_name),
    sku: primaryVariant?.sku ?? first?.sap_item_code,
    name: displayName,
    description: descriptionShort,
    fullDescription: descriptionShort || null,
    category,
    groupCode,
    capacity: attrs.capacity,
    // Cor/fechamento/diâmetro são únicos por card (não geram seletor no front).
    color: attrs.color ?? (colors.length === 1 ? colors[0] : null),
    closure: attrs.closure ?? (closures.length === 1 ? closures[0] : null),
    diameter,
    colors,
    closures,
    ean,
    imageUrl,
    inStock: variants.some((v) => v.inStock),
    stockUnits: variants.reduce((sum, v) => sum + v.stockUnits, 0),
    variants,
  };
}
