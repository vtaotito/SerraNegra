/* ──────────────────────────────────────────────────────────────
 * Engine de Produção GSN
 *
 * Por produto unificado e por embalagem (FARDO / CAIXA / PALETE):
 *   - estoque disponível (embalagens e UND)
 *   - pedidos reservados ainda no on-hand (quantity_reserved)
 *   - média mensal vendida nos 3 meses anteriores
 *   - qtd a produzir = max(0, ceil(médiaMensalEmb − estoqueEmb))
 *
 * Grupos excluídos: TA, TM, TP, RO, OUTROS.
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

export type PackType = "FARDO" | "CAIXA" | "PALETE";

export const PACK_TYPES: PackType[] = ["FARDO", "CAIXA", "PALETE"];

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

/** Meses da janela de média de vendas */
export const PRODUCAO_MONTHS = 3;

export interface PackDetail {
  type: PackType;
  /** Und por embalagem (ex.: 20) */
  units: number;
  label: string;
  /**
   * Embalagens livres em estoque (unidade nativa do SKU):
   * max(on_hand − reserved, 0)
   */
  estoqueEmb: number;
  /** Unidades livres = estoqueEmb × units */
  estoqueUnd: number;
  /**
   * Embalagens comprometidas em pedidos (reserved/committed),
   * ainda presentes no on-hand físico.
   */
  pedidosEmb: number;
  /** Unidades comprometidas = pedidosEmb × units */
  pedidosUnd: number;
  /** Volume vendido nos 3 meses (unidade nativa da embalagem) */
  vol3mEmb: number;
  /** Média mensal vendida = vol3mEmb / 3 */
  mediaMensalEmb: number;
  /** Média mensal em UND = mediaMensalEmb × units */
  mediaMensalUnd: number;
  /**
   * Embalagens a produzir para atingir a média mensal disponível:
   * max(0, ceil(mediaMensalEmb − estoqueEmb))
   */
  produzir: number;
}

export interface ProducaoRow {
  key: string;
  nome: string;
  group: string;
  groupName: string;
  skus: number;
  /** Total UND livre (todas as embalagens + UND avulsa do produto) */
  estoqueUnd: number;
  /** Total UND reservada (pedidos) */
  pedidosUnd: number;
  /** Volume 3m em UND (todas as variantes) */
  vol3mUnd: number;
  /** Média mensal UND = vol3mUnd / 3 */
  mediaMensalUnd: number;
  /** Gap produto em UND = max(0, mediaMensalUnd − estoqueUnd) */
  gapUnd: number;
  packs: PackDetail[];
  /** Soma das embalagens a produzir (todas as linhas de pack) */
  qtdProduzirTotal: number;
  /** cobertura meses = estoqueUnd / mediaMensalUnd */
  coberturaMeses: number | null;
  status: ProducaoStatus;
}

const PACK_TYPE_SET = new Set<string>(PACK_TYPES);

function asPackType(raw: string): PackType | null {
  return PACK_TYPE_SET.has(raw) ? (raw as PackType) : null;
}

function packMeta(desc: string | null | undefined): {
  type: PackType | null;
  units: number;
  label: string;
} {
  const units = getEmbalaQty(desc);
  const label = getEmbalaLabel(desc);
  const type = units > 1 ? asPackType(label.split(" ")[0] || "") : null;
  return { type, units: Math.max(1, units), label };
}

export function getProducaoStatus(
  mediaMensalUnd: number,
  qtdProduzirTotal: number,
): ProducaoStatus {
  if (mediaMensalUnd <= 0) return "sem_venda";
  if (qtdProduzirTotal > 0) return "produzir";
  return "ok";
}

export const PRODUCAO_STATUS_META: Record<
  ProducaoStatus,
  { label: string; acao: string }
> = {
  produzir: {
    label: "Produzir",
    acao: "Produzir para atingir a média mensal (3m)",
  },
  ok: {
    label: "OK",
    acao: "Estoque cobre a média mensal (3m)",
  },
  sem_venda: {
    label: "Sem venda",
    acao: "Sem vendas nos últimos 3 meses",
  },
};

export function isProducaoGroup(group: string | null): group is string {
  return group != null && !PRODUCAO_EXCLUDED_GROUPS.has(group);
}

type PackAgg = {
  type: PackType;
  units: number;
  label: string;
  estoqueEmb: number;
  pedidosEmb: number;
  vol3mEmb: number;
};

type ProductAgg = {
  nome: string;
  group: string;
  skuSet: Set<string>;
  /** UND livre de SKUs sem FARDO/CAIXA/PALETE (ex.: UND avulsa) */
  estoqueUndAvulso: number;
  pedidosUndAvulso: number;
  vol3mUndAvulso: number;
  packs: Map<PackType, PackAgg>;
};

function ensurePack(
  packs: Map<PackType, PackAgg>,
  type: PackType,
  units: number,
  label: string,
): PackAgg {
  let p = packs.get(type);
  if (!p) {
    p = { type, units, label, estoqueEmb: 0, pedidosEmb: 0, vol3mEmb: 0 };
    packs.set(type, p);
  } else if (units > p.units) {
    // Prefere a variante com mais und/embalagem para o rótulo de conversão
    p.units = units;
    p.label = label;
  }
  return p;
}

/**
 * Constrói linhas de produção a partir de analytics (3 meses) e inventário
 * (já filtrado por praça). Só produtos com FARDO, CAIXA ou PALETE.
 */
export function buildProducaoRows(
  products: ProductAnalyticsRow[],
  inventory: InventoryRow[],
): ProducaoRow[] {
  const map = new Map<string, ProductAgg>();

  const ensure = (key: string, nome: string, group: string): ProductAgg => {
    let a = map.get(key);
    if (!a) {
      a = {
        nome,
        group,
        skuSet: new Set(),
        estoqueUndAvulso: 0,
        pedidosUndAvulso: 0,
        vol3mUndAvulso: 0,
        packs: new Map(),
      };
      map.set(key, a);
    }
    return a;
  };

  // Vendas 3m por SKU → embalagem
  for (const r of products) {
    const group = getComprasGroup(r.item_code);
    if (!isProducaoGroup(group)) continue;
    const key = getUnifiedProductKey(r.item_code, r.item_description);
    const nome = getBaseProductName(r.item_description) || r.item_code;
    const meta = packMeta(r.item_description);
    const a = ensure(key, nome, group);
    a.skuSet.add(r.item_code);
    const qty = r.total_qty ?? 0;
    if (meta.type) {
      const p = ensurePack(a.packs, meta.type, meta.units, meta.label);
      p.vol3mEmb += qty;
    } else {
      a.vol3mUndAvulso += qty * meta.units;
    }
  }

  // Estoque por SKU → embalagem
  for (const inv of inventory) {
    const group = getComprasGroup(inv.product_id);
    if (!isProducaoGroup(group)) continue;
    const desc = inv.item_name ?? "";
    const key = getUnifiedProductKey(inv.product_id, desc || inv.product_id);
    const nome = getBaseProductName(desc) || inv.product_id;
    const meta = packMeta(desc);
    const a = ensure(key, nome, group);
    a.skuSet.add(inv.product_id);

    const onHand = Math.max(inv.quantity_available ?? 0, 0);
    const reserved = Math.max(inv.quantity_reserved ?? 0, 0);
    const free = Math.max(onHand - reserved, 0);

    if (meta.type) {
      const p = ensurePack(a.packs, meta.type, meta.units, meta.label);
      p.estoqueEmb += free;
      p.pedidosEmb += reserved;
    } else {
      a.estoqueUndAvulso += free * meta.units;
      a.pedidosUndAvulso += reserved * meta.units;
    }
  }

  const entries = Array.from(map.entries()).filter(([, a]) => {
    if (a.packs.size === 0) return false;
    const hasVol =
      a.vol3mUndAvulso > 0 ||
      Array.from(a.packs.values()).some((p) => p.vol3mEmb > 0);
    const hasStock =
      a.estoqueUndAvulso > 0 ||
      Array.from(a.packs.values()).some(
        (p) => p.estoqueEmb > 0 || p.pedidosEmb > 0,
      );
    return hasVol || hasStock;
  });

  return entries.map(([key, a]) => {
    const packs: PackDetail[] = PACK_TYPES.map((type) => {
      const p = a.packs.get(type);
      if (!p) return null;
      const mediaMensalEmb = p.vol3mEmb / PRODUCAO_MONTHS;
      const estoqueEmb = p.estoqueEmb;
      const produzir =
        mediaMensalEmb > 0
          ? Math.max(0, Math.ceil(mediaMensalEmb - estoqueEmb))
          : 0;
      return {
        type: p.type,
        units: p.units,
        label: p.label,
        estoqueEmb,
        estoqueUnd: estoqueEmb * p.units,
        pedidosEmb: p.pedidosEmb,
        pedidosUnd: p.pedidosEmb * p.units,
        vol3mEmb: p.vol3mEmb,
        mediaMensalEmb,
        mediaMensalUnd: mediaMensalEmb * p.units,
        produzir,
      } satisfies PackDetail;
    }).filter((p): p is PackDetail => p != null);

    const estoqueUnd =
      a.estoqueUndAvulso + packs.reduce((s, p) => s + p.estoqueUnd, 0);
    const pedidosUnd =
      a.pedidosUndAvulso + packs.reduce((s, p) => s + p.pedidosUnd, 0);
    const vol3mUnd =
      a.vol3mUndAvulso +
      packs.reduce((s, p) => s + p.vol3mEmb * p.units, 0);
    const mediaMensalUnd = vol3mUnd / PRODUCAO_MONTHS;
    const gapUnd = Math.max(0, mediaMensalUnd - estoqueUnd);
    const qtdProduzirTotal = packs.reduce((s, p) => s + p.produzir, 0);
    const coberturaMeses =
      mediaMensalUnd > 0 ? estoqueUnd / mediaMensalUnd : null;
    const status = getProducaoStatus(mediaMensalUnd, qtdProduzirTotal);

    return {
      key,
      nome: a.nome,
      group: a.group,
      groupName: COMPRAS_GROUP_NAMES[a.group] ?? a.group,
      skus: a.skuSet.size,
      estoqueUnd,
      pedidosUnd,
      vol3mUnd,
      mediaMensalUnd,
      gapUnd,
      packs,
      qtdProduzirTotal,
      coberturaMeses,
      status,
    } satisfies ProducaoRow;
  });
}

export function sumProduzirByType(
  rows: ProducaoRow[],
): Record<PackType, number> {
  const totals: Record<PackType, number> = { FARDO: 0, CAIXA: 0, PALETE: 0 };
  for (const r of rows) {
    for (const p of r.packs) totals[p.type] += p.produzir;
  }
  return totals;
}

export function packOf(row: ProducaoRow, type: PackType): PackDetail | null {
  return row.packs.find((p) => p.type === type) ?? null;
}
