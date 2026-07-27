export function fmtBRL(v: number, decimals = 2): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtNum(v: number): string {
  return v.toLocaleString("pt-BR");
}

export function fmtPct(v: number, decimals = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

export function fmtDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const d = new Date(clean + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function fmtQty(v: number, decimals = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export const STATE_TO_REGION: Record<string, string> = {
  SP: "Sudeste", RJ: "Sudeste", MG: "Sudeste", ES: "Sudeste",
  PR: "Sul", SC: "Sul", RS: "Sul",
  BA: "Nordeste", PE: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PI: "Nordeste", RN: "Nordeste", AL: "Nordeste", SE: "Nordeste",
  GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste", DF: "Centro-Oeste",
  PA: "Norte", AM: "Norte", RO: "Norte", AC: "Norte", AP: "Norte", RR: "Norte", TO: "Norte",
};

export function getProductGroup(itemCode: string | undefined | null): string {
  if (!itemCode) return "Outro";
  const prefix = itemCode.substring(0, 2).toUpperCase();
  return prefix || "Outro";
}

/**
 * Praça (localização física) derivada do código do depósito SAP.
 * Regra do negócio: depósitos que começam com "04" (04.01, 04.02) são de
 * São Paulo; todos os demais (01.*, 02.*, 03.*) são de Belo Horizonte.
 */
export type Praca = "todas" | "sp" | "bh";
export type PracaRegion = "sp" | "bh";

export const PRACA_LABELS: Record<Praca, string> = {
  todas: "Todas",
  sp: "São Paulo",
  bh: "Belo Horizonte",
};

export const PRACA_SHORT: Record<Praca, string> = {
  todas: "Todas",
  sp: "SP",
  bh: "BH",
};

/** Retorna a praça (SP/BH) de um código de depósito. Sem código → BH (matriz). */
export function getWarehouseRegion(code: string | null | undefined): PracaRegion {
  return (code ?? "").trim().startsWith("04") ? "sp" : "bh";
}

/** true quando o depósito pertence à praça selecionada ("todas" aceita tudo). */
export function matchesPraca(
  code: string | null | undefined,
  praca: Praca,
): boolean {
  return praca === "todas" || getWarehouseRegion(code) === praca;
}

/**
 * Catálogo de grupos de produto comerciais.
 * Single source of truth — altere aqui para refletir em toda a aplicação.
 */
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
  TA: "Tampa Aluminio",
  TM: "Tampa Metálica",
  TP: "Tampa Plástica",
};

/**
 * Paleta cromática estável por grupo (usada em charts, badges e progress bars).
 * Grupos sem cor explícita caem em #A81C2C (accent do cockpit).
 */
export const PRODUCT_GROUP_COLORS: Record<string, string> = {
  AR: "#d97706", // âmbar (artesanal)
  EQ: "#475569", // slate (equipamento)
  GF: "#14b8a6", // teal (garrafão)
  GI: "#c42538", // vermelho importado
  GN: "#A81C2C", // accent (nacional / principal)
  IS: "#65a30d", // verde-musgo (insumo)
  LA: "#78696c", // taupe (lacre)
  ME: "#6366f1", // indigo (medidor)
  PO: "#0ea5e9", // sky (pote)
  RO: "#ec4899", // rosa (rolha)
  TA: "#8b5cf6", // violeta (tampa alumínio)
  TM: "#f59e0b", // amber (tampa metálica)
  TP: "#10b981", // emerald (tampa plástica)
};

/**
 * Grupos auxiliares (logística / consumo interno) — escondidos das
 * visualizações comerciais.
 */
export const PRODUCT_GROUP_HIDDEN: ReadonlySet<string> = new Set([
  "CH", // Chapa
  "EM", // EM (placeholder)
  "MO", // Moldura
  "PA", // Palete
]);

/**
 * Devolve o nome amigável do grupo. Aceita tanto a sigla pura ("GN") quanto
 * um itemCode completo ("GN1234").
 */
export function getProductGroupName(codeOrItemCode: string | undefined | null): string {
  if (!codeOrItemCode) return "Outro";
  const code = codeOrItemCode.length === 2
    ? codeOrItemCode.toUpperCase()
    : getProductGroup(codeOrItemCode);
  return PRODUCT_GROUP_NAMES[code] ?? code;
}

export function getProductGroupColor(codeOrItemCode: string | undefined | null): string {
  if (!codeOrItemCode) return "#A81C2C";
  const code = codeOrItemCode.length === 2
    ? codeOrItemCode.toUpperCase()
    : getProductGroup(codeOrItemCode);
  return PRODUCT_GROUP_COLORS[code] ?? "#A81C2C";
}

export function isProductGroupHidden(codeOrItemCode: string | undefined | null): boolean {
  if (!codeOrItemCode) return false;
  const code = codeOrItemCode.length === 2
    ? codeOrItemCode.toUpperCase()
    : getProductGroup(codeOrItemCode);
  return PRODUCT_GROUP_HIDDEN.has(code);
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (typeof val === "string" && val.includes(";")) return `"${val}"`;
        return String(val ?? "");
      }).join(";")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
