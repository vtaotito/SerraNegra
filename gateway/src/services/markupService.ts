import type pg from "pg";
import { SapEntitiesService, type SapItemRow } from "./sapEntitiesService.js";
import type { ItemPriceRow } from "../../../sap-connector/src/sqlQueries.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarkupOverrideRow {
  item_code: string;
  frete: number | null;
  embalagem: number | null;
  comissao: number | null;
  pis_cofins: number | null;
  icms_compra: number | null;
  ipi: number | null;
  custo_fixo_saco: number | null;
  custo_fixo_pallet: number | null;
  qtd_pallet: number | null;
  qtd_saco: number | null;
  preco_sem_imp: number | null;
  updated_at: string;
  updated_by: string | null;
}

export interface MarkupItemResult {
  itemCode: string;
  itemName: string;
  itemGroup: number | null;
  manufacturer: string;

  v: number;
  fr: number;
  sc: number;
  co: number;
  pc: number;
  ic: number;
  ip: number;

  qtdPallet: number;
  qtdSaco: number;
  custoFixoSaco: number;
  custoFixoPallet: number;

  prices: Record<string, number>;

  hasOverride: boolean;
}

export interface SaveOverrideInput {
  itemCode: string;
  frete?: number | null;
  embalagem?: number | null;
  comissao?: number | null;
  pisCofins?: number | null;
  icmsCompra?: number | null;
  ipi?: number | null;
  custoFixoSaco?: number | null;
  custoFixoPallet?: number | null;
  qtdPallet?: number | null;
  qtdSaco?: number | null;
  precoSemImp?: number | null;
  updatedBy?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MarkupService {
  constructor(
    private readonly db: pg.Pool,
    private readonly sapEntities: SapEntitiesService | null,
  ) {}

  /**
   * Fetches all items from SAP, enriches with price lists and overrides,
   * and returns markup-ready rows.
   */
  async listMarkupItems(correlationId?: string): Promise<MarkupItemResult[]> {
    const [items, prices, overrides] = await Promise.all([
      this.fetchSapItems(correlationId),
      this.fetchSapPrices(correlationId),
      this.fetchAllOverrides(),
    ]);

    const priceMap = new Map<string, Record<string, number>>();
    for (const p of prices) {
      if (!priceMap.has(p.ItemCode)) priceMap.set(p.ItemCode, {});
      priceMap.get(p.ItemCode)![p.ListName] = p.Price;
    }

    const overrideMap = new Map<string, MarkupOverrideRow>();
    for (const o of overrides) overrideMap.set(o.item_code, o);

    return items.map((item) => {
      const ov = overrideMap.get(item.ItemCode);
      const sapPriceLists = item.ItemPrices as Array<{ PriceList?: number; Price?: number }> | undefined;

      let itemPrices = priceMap.get(item.ItemCode) ?? {};
      if (sapPriceLists && Array.isArray(sapPriceLists)) {
        for (const entry of sapPriceLists) {
          if (entry.Price && entry.Price > 0 && entry.PriceList !== undefined) {
            itemPrices[`PL_${entry.PriceList}`] = entry.Price;
          }
        }
      }

      const avgPrice = typeof (item as any).AvgPrice === "number" ? (item as any).AvgPrice : 0;
      const lastPurchase = typeof (item as any).LastPurchasePrice === "number" ? (item as any).LastPurchasePrice : 0;
      const sapManufacturer = String((item as any).Manufacturer ?? (item as any).FirmName ?? "");

      return {
        itemCode: item.ItemCode,
        itemName: item.ItemName ?? "",
        itemGroup: item.ItemsGroupCode ?? null,
        manufacturer: sapManufacturer,

        v: num(ov?.preco_sem_imp ?? (lastPurchase || avgPrice)),
        fr: num(ov?.frete),
        sc: num(ov?.embalagem),
        co: num(ov?.comissao),
        pc: num(ov?.pis_cofins, 0.09),
        ic: num(ov?.icms_compra, 0.12),
        ip: num(ov?.ipi, 0.10),

        qtdPallet: num(ov?.qtd_pallet ?? item.SalesQtyPerPackUnit),
        qtdSaco: num(ov?.qtd_saco ?? item.SalesItemsPerUnit),
        custoFixoSaco: num(ov?.custo_fixo_saco, 0.06),
        custoFixoPallet: num(ov?.custo_fixo_pallet, 0.03),

        prices: itemPrices,
        hasOverride: ov != null,
      };
    });
  }

  /**
   * Save (upsert) an override for a single item.
   */
  async saveOverride(input: SaveOverrideInput): Promise<void> {
    await this.db.query(
      `INSERT INTO markup_overrides
         (item_code, frete, embalagem, comissao, pis_cofins, icms_compra, ipi,
          custo_fixo_saco, custo_fixo_pallet, qtd_pallet, qtd_saco,
          preco_sem_imp, updated_at, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13)
       ON CONFLICT (item_code) DO UPDATE SET
         frete           = COALESCE($2,  markup_overrides.frete),
         embalagem       = COALESCE($3,  markup_overrides.embalagem),
         comissao        = COALESCE($4,  markup_overrides.comissao),
         pis_cofins      = COALESCE($5,  markup_overrides.pis_cofins),
         icms_compra     = COALESCE($6,  markup_overrides.icms_compra),
         ipi             = COALESCE($7,  markup_overrides.ipi),
         custo_fixo_saco = COALESCE($8,  markup_overrides.custo_fixo_saco),
         custo_fixo_pallet = COALESCE($9, markup_overrides.custo_fixo_pallet),
         qtd_pallet      = COALESCE($10, markup_overrides.qtd_pallet),
         qtd_saco        = COALESCE($11, markup_overrides.qtd_saco),
         preco_sem_imp   = COALESCE($12, markup_overrides.preco_sem_imp),
         updated_at      = NOW(),
         updated_by      = COALESCE($13, markup_overrides.updated_by)`,
      [
        input.itemCode,
        input.frete ?? null,
        input.embalagem ?? null,
        input.comissao ?? null,
        input.pisCofins ?? null,
        input.icmsCompra ?? null,
        input.ipi ?? null,
        input.custoFixoSaco ?? null,
        input.custoFixoPallet ?? null,
        input.qtdPallet ?? null,
        input.qtdSaco ?? null,
        input.precoSemImp ?? null,
        input.updatedBy ?? null,
      ],
    );
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async fetchSapItems(correlationId?: string): Promise<SapItemRow[]> {
    if (!this.sapEntities) return [];
    try {
      return await this.sapEntities.listItems({ limit: 10000, onlyActive: true }, correlationId);
    } catch (err) {
      console.warn("[MarkupService] Falha ao buscar itens SAP:", err instanceof Error ? err.message : err);
      return [];
    }
  }

  private async fetchSapPrices(correlationId?: string): Promise<ItemPriceRow[]> {
    if (!this.sapEntities) return [];
    try {
      return await this.sapEntities.listItemPrices(correlationId);
    } catch (err) {
      console.warn("[MarkupService] Falha ao buscar preços SAP:", err instanceof Error ? err.message : err);
      return [];
    }
  }

  private async fetchAllOverrides(): Promise<MarkupOverrideRow[]> {
    const res = await this.db.query<MarkupOverrideRow>(
      `SELECT * FROM markup_overrides ORDER BY item_code`,
    );
    return res.rows;
  }
}
