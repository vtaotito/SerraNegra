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
  stockQuantity: number;
}

export interface UnifiedProduct {
  id: string;
  /** SKU da variante padrão (menor embalagem disponível). */
  sku: string;
  name: string;
  description: string;
  /** Categoria comercial (grupo do produto). */
  category: string | null;
  /** Sigla do grupo (2 chars). */
  groupCode: string;
  capacity: string | null;
  color: string | null;
  closure: string | null;
  ean: string | null;
  imageUrl: string | null;
  inStock: boolean;
  variants: PackagingVariant[];
}

export interface UnifiedProductDetail extends UnifiedProduct {
  fullDescription: string | null;
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
