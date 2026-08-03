/* ──────────────────────────────────────────────────────────────
 * Engine de Produção GSN
 *
 * Calcula quantas embalagens (FARDO/CAIXA) produzir na semana:
 *   mediaSemanalUnd = totalUndPeriodo / 4   (28 dias rolantes)
 *   gapUnd          = max(0, mediaSemanalUnd - estoqueAtualUnd)
 *   qtdProduzir     = ceil(gapUnd / undPorEmbalagemProducao)
 *
 * Embalagem de produção: FARDO → CAIXA → maior multiunidade.
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

export interface PackCandidate {
  type: string;
  units: number;
  label: string;
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
  /** Embalagem escolhida para produção */
  embalagemLabel: string;
  embalagemType: string;
  undPorEmbalagem: number;
  /** Quantidade de embalagens a produzir (ceil) */
  qtdProduzir: number;
  /** estoqueUnd / mediaSemanalUnd (null se sem venda) */
  coberturaSemanas: number | null;
  status: ProducaoStatus;
}

const WEEKS_IN_WINDOW = 4;

const PACK_PRIORITY: Record<string, number> = {
  FARDO: 0,
  CAIXA: 1,
};

function packFromDescription(desc: string | null | undefined): PackCandidate | null {
  const units = getEmbalaQty(desc);
  const label = getEmbalaLabel(desc);
  if (units <= 1) return null;
  const type = label.split(" ")[0] || "CAIXA";
  return { type, units, label };
}

/**
 * Escolhe a embalagem de produção: FARDO, senão CAIXA, senão a maior
 * multiunidade conhecida do produto.
 */
export function pickProductionPack(candidates: PackCandidate[]): PackCandidate {
  if (candidates.length === 0) {
    return { type: "UND", units: 1, label: "UND" };
  }
  const unique = new Map<string, PackCandidate>();
  for (const c of candidates) {
    const k = `${c.type}:${c.units}`;
    if (!unique.has(k)) unique.set(k, c);
  }
  const list = Array.from(unique.values());
  list.sort((a, b) => {
    const pa = PACK_PRIORITY[a.type] ?? 99;
    const pb = PACK_PRIORITY[b.type] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.units - a.units;
  });
  return list[0];
}

export function getProducaoStatus(
  mediaSemanalUnd: number,
  qtdProduzir: number,
): ProducaoStatus {
  if (mediaSemanalUnd <= 0) return "sem_venda";
  if (qtdProduzir > 0) return "produzir";
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

/**
 * Constrói as linhas de produção a partir do analytics (28d) e do inventário
 * já filtrado por praça (quando aplicável).
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
    if (!group) continue;
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
    if (!group) continue;
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

  const entries = Array.from(map.entries()).filter(
    ([, a]) => a.volPeriodoUnd > 0 || a.estoqueUnd > 0,
  );

  return entries.map(([key, a]) => {
    const mediaSemanalUnd = a.volPeriodoUnd / WEEKS_IN_WINDOW;
    const gapUnd = Math.max(0, mediaSemanalUnd - a.estoqueUnd);
    const pack = pickProductionPack(a.packs);
    const undPorEmbalagem = Math.max(1, pack.units);
    const qtdProduzir =
      gapUnd > 0 ? Math.ceil(gapUnd / undPorEmbalagem) : 0;
    const coberturaSemanas =
      mediaSemanalUnd > 0 ? a.estoqueUnd / mediaSemanalUnd : null;
    const status = getProducaoStatus(mediaSemanalUnd, qtdProduzir);

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
      embalagemLabel: pack.label,
      embalagemType: pack.type,
      undPorEmbalagem,
      qtdProduzir,
      coberturaSemanas,
      status,
    } satisfies ProducaoRow;
  });
}
