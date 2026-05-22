// ---------------------------------------------------------------------------
// Motor de cálculo de MarkUp — Garrafaria Serra Negra
// Portado do HTML v6.0 para TypeScript tipado.
// Todas as fórmulas operam em valores por MILHEIRO.
// ---------------------------------------------------------------------------

export interface MarkupCostParams {
  /** Valor sem impostos (milheiro) */
  v: number;
  /** Frete (milheiro) */
  fr: number;
  /** Custo embalagem / fardo / caixa (milheiro) */
  sc: number;
  /** Comissão (milheiro) */
  co: number;
  /** PIS/COFINS — ex: 0.09 = 9% */
  pc: number;
  /** ICMS de compra — ex: 0.12 = 12% */
  ic: number;
  /** IPI — ex: 0.10 = 10% */
  ip: number;
}

export interface MarkupPriceParams extends MarkupCostParams {
  /** ICMS de venda — ex: 0.12, 0.07, 0.18, 0 (ME) */
  icmsVenda: number;
  /** Imposto garrafaria ou ME — 0.0704 ou 0.094 */
  ig: number;
  /** Custo fixo (%) — ex: 0.06 para saco, 0.03 para pallet */
  cf: number;
}

/** Imposto Garrafaria (Lucro Presumido) */
export const IG = 0.0704;

/** Regime Micro Empresa */
export const ME = 0.094;

export const ICMS_FAIXAS = [
  { label: "ICMS 12%", rate: 0.12, color: "#AF272F" },
  { label: "ICMS 7%", rate: 0.07, color: "#7B1A1F" },
  { label: "ICMS 18%", rate: 0.18, color: "#5B3A6B" },
  { label: "Micro Empresa", rate: 0, color: "#8B7435" },
] as const;

/** Siglas de linha de produto elegíveis no catálogo MarkUp */
export const MARKUP_ITEM_PREFIXES = [
  "AR", "EQ", "GF", "GI", "GN", "IS", "LA", "ME", "PO", "RO", "TA", "TM", "TP",
] as const;

export type MarkupItemPrefix = (typeof MARKUP_ITEM_PREFIXES)[number];

export function getMarkupPrefix(itemCode: string): MarkupItemPrefix | null {
  const code = itemCode.trim().toUpperCase();
  return MARKUP_ITEM_PREFIXES.find((prefix) => code.startsWith(prefix)) ?? null;
}

export function isMarkupCatalogItem(itemCode: string): boolean {
  return getMarkupPrefix(itemCode) != null;
}

/**
 * Custo de Mercadoria Vendida (por milheiro).
 *
 * base = v / (1 - (pc + ic))
 * CMV  = base + base * ip + fr + co + sc
 */
export function calcCMV({ v, fr, sc, co, pc, ic, ip }: MarkupCostParams): number {
  const denom = 1 - (pc + ic);
  if (denom <= 0) return v + fr + co + sc;
  const base = v / denom;
  return base + base * ip + fr + co + sc;
}

/**
 * Ponto de Equilíbrio — preço mínimo de venda (por milheiro).
 */
export function calcPE({
  v, fr, sc, co, pc, ic, ip, icmsVenda, ig, cf,
}: MarkupPriceParams): number {
  const denom = 1 - (pc + ic);
  const base = denom > 0 ? v / denom : v;
  const custoBase = v + fr + sc + co + base * pc;
  const denomVenda = 1 - (ig + icmsVenda + cf);
  if (denomVenda <= 0) return custoBase * (1 + ip);
  return (custoBase / denomVenda) * (1 + ip);
}

/**
 * Margem de lucro (%) para um dado preço de venda (por milheiro).
 * Retorna `null` se o preço for zero.
 */
export function calcLucro(
  preco: number,
  { v, fr, sc, co, pc, ic, ip, icmsVenda, ig, cf }: MarkupPriceParams,
): number | null {
  if (!preco) return null;
  const cmv = calcCMV({ v, fr, sc, co, pc, ic, ip });
  const denom = 1 - (pc + ic);
  const base = denom > 0 ? v / denom : v;
  const impCompra = base * (ip + ic);
  const psi = preco / (1 + ip);
  const icmsV = psi * icmsVenda;
  const ipiV = preco - psi;
  const taxas = psi * (cf + ig);
  return (preco - (icmsV + ipiV - impCompra + taxas + cmv)) / preco;
}

/**
 * Calcula o preço de venda (por milheiro) necessário para atingir
 * uma margem-alvo (busca binária).
 */
export function calcPrecoFromMargem(
  margem: number,
  params: MarkupPriceParams,
): number {
  const pe = calcPE(params);
  let lo = 0.01;
  let hi = pe * 10;

  for (let i = 0; i < 10; i++) {
    const lucroHi = calcLucro(hi, params);
    if (lucroHi !== null && lucroHi >= margem) break;
    hi *= 2;
  }

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const lucro = calcLucro(mid, params);
    if (lucro === null) return mid;
    if (Math.abs(lucro - margem) < 0.00001) return mid;
    if (lucro < margem) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}

/**
 * Retorna o `ig` correto para a faixa ICMS.
 * ME (rate === 0) usa a constante ME; demais usam IG.
 */
export function igForFaixa(icmsRate: number): number {
  return icmsRate === 0 ? ME : IG;
}
