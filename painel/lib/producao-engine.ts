/* ──────────────────────────────────────────────────────────────
 * Engine de Produção GSN
 *
 * Por produto unificado e por embalagem (FARDO / CAIXA / PALETE):
 *   estoque     = on-hand físico (emb / UND)
 *   pedidos     = reservado em pedidos (ainda no on-hand)
 *   disponivel  = max(estoque − pedidos, 0)
 *   média 3m    = vendas ÷ 3
 *   faltamUnd   = max(0, médiaMensalUnd − disponivelUnd)
 *   produzir    = ceil(faltamUnd / undPorEmbalagem)
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

export const PRODUCAO_MONTHS = 3;

export interface PackDetail {
  type: PackType;
  units: number;
  label: string;
  /** Embalagens físicas on-hand */
  estoqueEmb: number;
  estoqueUnd: number;
  /** Embalagens reservadas em pedidos */
  pedidosEmb: number;
  pedidosUnd: number;
  /** Disponível = max(estoque − pedidos, 0) */
  disponivelEmb: number;
  disponivelUnd: number;
  vol3mEmb: number;
  mediaMensalEmb: number;
  mediaMensalUnd: number;
  /** Unidades que faltam para atingir a média mensal */
  faltamUnd: number;
  /** Embalagens a produzir = ceil(faltamUnd / units) */
  produzir: number;
}

export interface ProducaoRow {
  key: string;
  nome: string;
  group: string;
  groupName: string;
  skus: number;
  /** On-hand total em UND */
  estoqueUnd: number;
  /** Reservado total em UND */
  pedidosUnd: number;
  /** Disponível = max(estoque − pedidos, 0) em UND */
  disponivelUnd: number;
  vol3mUnd: number;
  mediaMensalUnd: number;
  /** Unidades que faltam no produto = max(0, média − disponível) */
  faltamUnd: number;
  packs: PackDetail[];
  /** Soma das embalagens a produzir */
  qtdProduzirTotal: number;
  /** cobertura meses = disponivelUnd / mediaMensalUnd */
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
  faltamUnd: number,
): ProducaoStatus {
  if (mediaMensalUnd <= 0) return "sem_venda";
  if (faltamUnd > 0) return "produzir";
  return "ok";
}

export const PRODUCAO_STATUS_META: Record<
  ProducaoStatus,
  { label: string; acao: string }
> = {
  produzir: {
    label: "Produzir",
    acao: "Faltam unidades para atingir a média mensal (3m)",
  },
  ok: {
    label: "OK",
    acao: "Disponível cobre a média mensal (3m)",
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
    p.units = units;
    p.label = label;
  }
  return p;
}

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

    if (meta.type) {
      const p = ensurePack(a.packs, meta.type, meta.units, meta.label);
      p.estoqueEmb += onHand;
      p.pedidosEmb += reserved;
    } else {
      a.estoqueUndAvulso += onHand * meta.units;
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
      a.pedidosUndAvulso > 0 ||
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
      const mediaMensalUnd = mediaMensalEmb * p.units;
      const estoqueEmb = p.estoqueEmb;
      const pedidosEmb = p.pedidosEmb;
      const disponivelEmb = Math.max(estoqueEmb - pedidosEmb, 0);
      const disponivelUnd = disponivelEmb * p.units;
      const faltamUnd = Math.max(0, mediaMensalUnd - disponivelUnd);
      const produzir =
        faltamUnd > 0 ? Math.ceil(faltamUnd / Math.max(1, p.units)) : 0;
      return {
        type: p.type,
        units: p.units,
        label: p.label,
        estoqueEmb,
        estoqueUnd: estoqueEmb * p.units,
        pedidosEmb,
        pedidosUnd: pedidosEmb * p.units,
        disponivelEmb,
        disponivelUnd,
        vol3mEmb: p.vol3mEmb,
        mediaMensalEmb,
        mediaMensalUnd,
        faltamUnd,
        produzir,
      } satisfies PackDetail;
    }).filter((p): p is PackDetail => p != null);

    const estoqueUnd =
      a.estoqueUndAvulso + packs.reduce((s, p) => s + p.estoqueUnd, 0);
    const pedidosUnd =
      a.pedidosUndAvulso + packs.reduce((s, p) => s + p.pedidosUnd, 0);
    const disponivelUndAvulso = Math.max(
      a.estoqueUndAvulso - a.pedidosUndAvulso,
      0,
    );
    const disponivelUnd =
      disponivelUndAvulso + packs.reduce((s, p) => s + p.disponivelUnd, 0);
    const vol3mUnd =
      a.vol3mUndAvulso +
      packs.reduce((s, p) => s + p.vol3mEmb * p.units, 0);
    const mediaMensalUnd = vol3mUnd / PRODUCAO_MONTHS;
    const faltamUnd = Math.max(0, mediaMensalUnd - disponivelUnd);
    const qtdProduzirTotal = packs.reduce((s, p) => s + p.produzir, 0);
    const coberturaMeses =
      mediaMensalUnd > 0 ? disponivelUnd / mediaMensalUnd : null;
    const status = getProducaoStatus(mediaMensalUnd, faltamUnd);

    return {
      key,
      nome: a.nome,
      group: a.group,
      groupName: COMPRAS_GROUP_NAMES[a.group] ?? a.group,
      skus: a.skuSet.size,
      estoqueUnd,
      pedidosUnd,
      disponivelUnd,
      vol3mUnd,
      mediaMensalUnd,
      faltamUnd,
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
