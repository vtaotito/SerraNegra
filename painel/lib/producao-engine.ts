/* ──────────────────────────────────────────────────────────────
 * Engine de Produção GSN
 *
 * Calcula quantas embalagens produzir na semana para cobrir o gap:
 *   mediaSemanalUnd = totalUndPeriodo / 4   (28 dias rolantes)
 *   gapUnd          = max(0, mediaSemanalUnd - estoqueAtualUnd)
 *   qtd[tipo]       = ceil(gapUnd / undPorEmbalagemDoTipo)
 *
 * Tipos considerados: FARDO, CAIXA, PALETE (alternativas para o mesmo gap).
 * Grupos excluídos: TA, TM, TP, RO, OUTROS.
 * Unificação e conversão UND idênticas a Compras / item-parser.
 * ────────────────────────────────────────────────────────────── */

import type { InventoryRow, ProductAnalyticsRow } from "@/lib/cockpit-api";
import {
  getBaseProductName,
  getEmbalaLabel,
  getEmbalaQty,
  getUnifiedProductKey,
} from "@/lib/item-parser";
import {
  COMPRAS_GROUP_NAMES,
  getComprasGroup,
} from "@/lib/compras-engine";

export type ProducaoStatus = "produzir" | "ok" | "sem_venda";

/** Tipos de embalagem de produção */
export type PackType = "FARDO" | "CAIXA" | "PALETE";

export const PACK_TYPES: PackType[] = ["FARDO", "CAIXA", "PALETE"];

/** Grupos fora do escopo de Produção */
export const PRODUCAO_EXCLUDED_GROUPS = new Set([
  "TA",
  "TM",
  "TP",
  "RO",
  "OUTROS",
]);

export const PRODUCAO_GROUP_ORDER = [
  "GN",
  "GI",
  "GF",
  "PO",
  "AR",
  "LA",
] as const;

export interface PackCandidate {
  type: PackType;
  units: number;
  label: string;
}

/** Quantidade sugerida para um tipo de embalagem (null = produto sem essa variante) */
export interface PackQty {
  type: PackType;
  units: number;
  label: string;
  /** ceil(gap / units); 0 quando gap = 0 */
  qtd: number;
}

export interface ProducaoRow {
  key: string;
  nome: string;
  group: string;
  groupName: string;
  skus: number;
  /** Volume vendido no período (28d) em unidades */
  volPeriodoUnd: number;
  /** Média semanal = volPeriodoUnd / 4 */
  mediaSemanalUnd: number;
  /** Estoque disponível (livre) em unidades */
  estoqueUnd: number;
  /** max(0, mediaSemanal - estoque) */
  gapUnd: number;
  /** Embalagens disponíveis no produto (FARDO/CAIXA/PALETE) */
  packs: PackQty[];
  /** Maior qtd entre as embalagens (para ordenação / status) */
  qtdProduzirMax: number;
  /** estoqueUnd / mediaSemanalUnd (null se sem venda) */
  coberturaSemanas: number | null;
  status: ProducaoStatus;
}

const WEEKS_IN_WINDOW = 4;

const PACK_TYPE_SET = new Set<string>(PACK_TYPES);

function asPackType(raw: string): PackType | null {
  return PACK_TYPE_SET.has(raw) ? (raw as PackType) : null;
}

function packFromDescription(desc: string | null | undefined): PackCandidate | null {
  const units = getEmbalaQty(desc);
  const label = getEmbalaLabel(desc);
  if (units <= 1) return null;
  const type = asPackType(label.split(" ")[0] || "");
  if (!type) return null;
  return { type, units, label };
}

/** Dedup por tipo: mantém a variante com mais unidades (ex.: FARDO C/24 > C/20). */
export function dedupePacksByType(candidates: PackCandidate[]): PackCandidate[] {
  const best = new Map<PackType, PackCandidate>();
  for (const c of candidates) {
    const prev = best.get(c.type);
    if (!prev || c.units > prev.units) best.set(c.type, c);
  }
  return PACK_TYPES.map((t) => best.get(t)).filter(
    (p): p is PackCandidate => p != null,
  );
}

export function qtyForGap(gapUnd: number, units: number): number {
  if (gapUnd <= 0) return 0;
  return Math.ceil(gapUnd / Math.max(1, units));
}

export function getProducaoStatus(
  mediaSemanalUnd: number,
  gapUnd: number,
): ProducaoStatus {
  if (mediaSemanalUnd <= 0) return "sem_venda";
  if (gapUnd > 0) return "produzir";
  return "ok";
}

export const PRODUCAO_STATUS_META: Record<
  ProducaoStatus,
  { label: string; acao: string }
> = {
  produzir: { label: "Produzir", acao: "Produzir para cobrir a média semanal" },
  ok: { label: "OK", acao: "Estoque cobre a média semanal" },
  sem_venda: { label: "Sem venda", acao: "Sem vendas nas últimas 4 semanas" },
};

export function isProducaoGroup(group: string | null): group is string {
  return group != null && !PRODUCAO_EXCLUDED_GROUPS.has(group);
}

/**
 * Constrói as linhas de produção a partir do analytics (28d) e do inventário
 * já filtrado por praça (quando aplicável).
 * Só inclui produtos com ao menos uma embalagem FARDO, CAIXA ou PALETE.
 */
export function buildProducaoRows(
  products: ProductAnalyticsRow[],
  inventory: InventoryRow[],
): ProducaoRow[] {
  type Agg = {
    nome: string;
    group: string;
    skuSet: Set<string>;
    volPeriodoUnd: number;
    estoqueUnd: number;
    packs: PackCandidate[];
  };
  const map = new Map<string, Agg>();

  const ensure = (key: string, nome: string, group: string): Agg => {
    let a = map.get(key);
    if (!a) {
      a = {
        nome,
        group,
        skuSet: new Set(),
        volPeriodoUnd: 0,
        estoqueUnd: 0,
        packs: [],
      };
      map.set(key, a);
    }
    return a;
  };

  for (const r of products) {
    const group = getComprasGroup(r.item_code);
    if (!isProducaoGroup(group)) continue;
    const key = getUnifiedProductKey(r.item_code, r.item_description);
    const nome = getBaseProductName(r.item_description) || r.item_code;
    const emb = getEmbalaQty(r.item_description);
    const a = ensure(key, nome, group);
    a.skuSet.add(r.item_code);
    a.volPeriodoUnd += (r.total_qty ?? 0) * emb;
    const pack = packFromDescription(r.item_description);
    if (pack) a.packs.push(pack);
  }

  for (const inv of inventory) {
    const group = getComprasGroup(inv.product_id);
    if (!isProducaoGroup(group)) continue;
    const desc = inv.item_name ?? "";
    const key = getUnifiedProductKey(inv.product_id, desc || inv.product_id);
    const nome = getBaseProductName(desc) || inv.product_id;
    const emb = getEmbalaQty(desc);
    const a = ensure(key, nome, group);
    a.skuSet.add(inv.product_id);
    const disponivelDeposito = Math.max(
      (inv.quantity_available ?? 0) - (inv.quantity_reserved ?? 0),
      0,
    );
    a.estoqueUnd += disponivelDeposito * emb;
    const pack = packFromDescription(desc);
    if (pack) a.packs.push(pack);
  }

  const entries = Array.from(map.entries()).filter(([, a]) => {
    if (!(a.volPeriodoUnd > 0 || a.estoqueUnd > 0)) return false;
    return dedupePacksByType(a.packs).length > 0;
  });

  return entries.map(([key, a]) => {
    const mediaSemanalUnd = a.volPeriodoUnd / WEEKS_IN_WINDOW;
    const gapUnd = Math.max(0, mediaSemanalUnd - a.estoqueUnd);
    const uniquePacks = dedupePacksByType(a.packs);
    const packs: PackQty[] = uniquePacks.map((p) => ({
      type: p.type,
      units: p.units,
      label: p.label,
      qtd: qtyForGap(gapUnd, p.units),
    }));
    const qtdProduzirMax = packs.reduce((m, p) => Math.max(m, p.qtd), 0);
    const coberturaSemanas =
      mediaSemanalUnd > 0 ? a.estoqueUnd / mediaSemanalUnd : null;
    const status = getProducaoStatus(mediaSemanalUnd, gapUnd);

    return {
      key,
      nome: a.nome,
      group: a.group,
      groupName: COMPRAS_GROUP_NAMES[a.group] ?? a.group,
      skus: a.skuSet.size,
      volPeriodoUnd: a.volPeriodoUnd,
      mediaSemanalUnd,
      estoqueUnd: a.estoqueUnd,
      gapUnd,
      packs,
      qtdProduzirMax,
      coberturaSemanas,
      status,
    } satisfies ProducaoRow;
  });
}

/** Soma de quantidades sugeridas por tipo (alternativa por produto; útil como KPI). */
export function sumPackQtyByType(
  rows: ProducaoRow[],
): Record<PackType, number> {
  const totals: Record<PackType, number> = { FARDO: 0, CAIXA: 0, PALETE: 0 };
  for (const r of rows) {
    for (const p of r.packs) totals[p.type] += p.qtd;
  }
  return totals;
}

export function packQtyOf(row: ProducaoRow, type: PackType): PackQty | null {
  return row.packs.find((p) => p.type === type) ?? null;
}
