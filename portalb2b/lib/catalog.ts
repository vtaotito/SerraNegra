// Tipos e helpers do catálogo unificado do Portal B2B.
// Espelham os DTOs do gateway (gateway/src/services/b2bCatalogService.ts) e a
// lógica de grupos/embalagens do painel da garrafaria.

export interface PackagingVariant {
  sku: string;
  /** Tipo de embalagem ("Unidade" | "Caixa" | "Fardo" | ...). */
  packagingType: string;
  /** Unidades por embalagem (>= 1). */
  unitsPerPack: number;
  unitOfMeasure: string;
  inStock: boolean;
  /** Estoque disponível na unidade nativa da variante (ex.: nº de caixas). */
  stockQuantity: number;
  /** Estoque disponível em UNIDADES (= stockQuantity × unitsPerPack). */
  stockUnits: number;
}

/**
 * Variante concreta de um modelo (um SKU SAP): embalagem + atributos de cor e
 * fechamento. Espelha B2BAttributeVariant do gateway. Para garrafas há uma
 * entrada por combinação real; para os demais produtos color/closure são null.
 */
export interface AttributeVariant extends PackagingVariant {
  color: string | null;
  closure: string | null;
  /** Imagem específica da variante (troca de foto por cor), quando houver. */
  imageUrl?: string | null;
}

export interface UnifiedProduct {
  id: string;
  /** SKU representativo (menor embalagem em estoque) — usado no link do card. */
  sku: string;
  name: string;
  description: string;
  /** Categoria comercial (grupo do produto). */
  category: string | null;
  /** Sigla do grupo (2 chars). */
  groupCode: string;
  capacity: string | null;
  /** Cor única do card (derivada do nome-base); null caso contrário. */
  color: string | null;
  /** Fechamento único do card (derivado do nome-base); null caso contrário. */
  closure: string | null;
  /** Diâmetro de boca/gargalo do card (ex.: "31MM"); null quando não há. */
  diameter: string | null;
  /** Cores distintas disponíveis no card (≤ 1 item; mantido p/ compatibilidade). */
  colors: string[];
  /** Fechamentos distintos disponíveis no card (≤ 1 item). */
  closures: string[];
  ean: string | null;
  imageUrl: string | null;
  inStock: boolean;
  /** Estoque disponível total em UNIDADES (soma das variantes) — "ESTOQUE (UND)". */
  stockUnits: number;
  variants: AttributeVariant[];
}

export interface UnifiedProductDetail extends UnifiedProduct {
  fullDescription: string | null;
}

/** Cores disponíveis (opcionalmente restritas a um fechamento). */
export function availableColors(
  variants: AttributeVariant[],
  closure?: string | null,
): string[] {
  const src = closure ? variants.filter((v) => v.closure === closure) : variants;
  return [...new Set(src.map((v) => v.color).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

/** Fechamentos disponíveis (opcionalmente restritos a uma cor). */
export function availableClosures(
  variants: AttributeVariant[],
  color?: string | null,
): string[] {
  const src = color ? variants.filter((v) => v.color === color) : variants;
  return [...new Set(src.map((v) => v.closure).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

/** Variantes de embalagem para uma combinação de cor + fechamento. */
export function availablePackagings(
  variants: AttributeVariant[],
  color: string | null,
  closure: string | null,
): AttributeVariant[] {
  return variants
    .filter(
      (v) =>
        (color == null || v.color === color) &&
        (closure == null || v.closure === closure),
    )
    .sort((a, b) => a.unitsPerPack - b.unitsPerPack || a.sku.localeCompare(b.sku));
}

/**
 * Resolve o SKU final a partir da combinação escolhida. Retorna null enquanto a
 * combinação não corresponde a uma variante real (ex.: falta cor/fechamento ou
 * a embalagem não existe para a combinação selecionada).
 */
export function resolveSku(
  variants: AttributeVariant[],
  color: string | null,
  closure: string | null,
  packagingSku: string | null,
): string | null {
  if (!packagingSku) return null;
  const v = variants.find((x) => x.sku === packagingSku);
  if (!v) return null;
  if (color != null && v.color !== color) return null;
  if (closure != null && v.closure !== closure) return null;
  return v.sku;
}

/** Formata quantidade de unidades em estoque para exibição (pt-BR). */
export function formatStockUnits(units: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(units)));
}

/** Passo de compra em unidades (unidades por embalagem; 1 = unidade avulsa). */
export function packStep(unitsPerPack: number): number {
  return unitsPerPack > 1 ? unitsPerPack : 1;
}

/**
 * Máximo de UNIDADES que podem ser pedidas de uma variante, respeitando
 * embalagens inteiras (não se vende meia caixa). Ex.: 84 un disponíveis de uma
 * "Caixa c/24" → 72 un (3 caixas). Para unidade avulsa, é o próprio estoque.
 */
export function maxOrderableUnits(variant: {
  stockUnits: number;
  unitsPerPack: number;
}): number {
  const step = packStep(variant.unitsPerPack);
  const units = Math.max(0, Math.floor(variant.stockUnits));
  return Math.floor(units / step) * step;
}

/** Máximo de EMBALAGENS que podem ser pedidas (estoque ÷ un. por embalagem). */
export function maxOrderablePacks(variant: {
  stockUnits: number;
  unitsPerPack: number;
}): number {
  return Math.floor(maxOrderableUnits(variant) / packStep(variant.unitsPerPack));
}

/** Nome amigável e curto do tipo de embalagem. */
export function packagingTypeName(type: string | null | undefined): string {
  if (!type) return "Unidade";
  const t = type.toLowerCase().trim();
  if (t.includes("cx") || t.includes("caixa")) return "Caixa";
  if (t.includes("frd") || t.includes("fardo")) return "Fardo";
  if (t.includes("plt") || t.includes("palet") || t.includes("pallet")) return "Palete";
  if (t.includes("sc") || t.includes("saco")) return "Saco";
  if (t.includes("pct") || t.includes("pcte") || t.includes("pacote") || t.includes("pack")) return "Pacote";
  if (t.includes("dz") || t.includes("duzia")) return "Dúzia";
  if (t.includes("engradado")) return "Engradado";
  if (t.includes("un")) return "Unidade";
  return type;
}

/** Rótulo completo, ex.: "Caixa c/12" ou "Unidade". */
export function packagingLabel(
  type: string | null | undefined,
  unitsPerPack: number,
): string {
  const name = packagingTypeName(type);
  if (unitsPerPack > 1 && name !== "Unidade") return `${name} c/${unitsPerPack}`;
  return name;
}

/** Rótulo curto para chips, ex.: "CX 12" ou "UND". */
export function packagingShort(
  type: string | null | undefined,
  unitsPerPack: number,
): string {
  const name = packagingTypeName(type);
  if (name === "Unidade") return "UND";
  const abbr: Record<string, string> = {
    Caixa: "CX",
    Fardo: "FRD",
    Palete: "PLT",
    Saco: "SC",
    Pacote: "PCT",
    Dúzia: "DZ",
    Engradado: "ENG",
  };
  const short = abbr[name] ?? name;
  return unitsPerPack > 1 ? `${short} ${unitsPerPack}` : short;
}

/** Paleta de cor por grupo (espelha painel/lib/format.ts). */
const GROUP_COLORS: Record<string, string> = {
  AR: "#d97706",
  EQ: "#475569",
  GF: "#14b8a6",
  GI: "#c42538",
  GN: "#A81C2C",
  IS: "#65a30d",
  LA: "#78696c",
  ME: "#6366f1",
  PO: "#0ea5e9",
  RO: "#ec4899",
  TA: "#8b5cf6",
  TM: "#f59e0b",
  TP: "#10b981",
};

export function groupColor(groupCode: string | null | undefined): string {
  if (!groupCode) return "#A81C2C";
  return GROUP_COLORS[groupCode.toUpperCase()] ?? "#A81C2C";
}

/**
 * Cor por nome de categoria comercial (espelha as cores de grupo). Permite
 * colorir os filtros de categoria de forma consistente com os badges dos cards.
 */
const CATEGORY_COLORS: Record<string, string> = {
  "garrafas artesanais": GROUP_COLORS.AR,
  "equipamentos": GROUP_COLORS.EQ,
  "garrafão": GROUP_COLORS.GF,
  "garrafao": GROUP_COLORS.GF,
  "garrafa importada": GROUP_COLORS.GI,
  "garrafa nacional": GROUP_COLORS.GN,
  "insumos": GROUP_COLORS.IS,
  "lacre": GROUP_COLORS.LA,
  "medidores": GROUP_COLORS.ME,
  "pote": GROUP_COLORS.PO,
  "rolha": GROUP_COLORS.RO,
  "tampa alumínio": GROUP_COLORS.TA,
  "tampa aluminio": GROUP_COLORS.TA,
  "tampa metálica": GROUP_COLORS.TM,
  "tampa metalica": GROUP_COLORS.TM,
  "tampa plástica": GROUP_COLORS.TP,
  "tampa plastica": GROUP_COLORS.TP,
};

/** Paleta de fallback determinística para categorias sem cor mapeada. */
const FALLBACK_CATEGORY_COLORS = [
  "#A81C2C", "#0ea5e9", "#65a30d", "#8b5cf6", "#f59e0b",
  "#ec4899", "#14b8a6", "#6366f1", "#d97706", "#475569",
];

export function categoryColor(name: string | null | undefined): string {
  if (!name) return "#A81C2C";
  const mapped = CATEGORY_COLORS[name.trim().toLowerCase()];
  if (mapped) return mapped;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_CATEGORY_COLORS[hash % FALLBACK_CATEGORY_COLORS.length];
}
