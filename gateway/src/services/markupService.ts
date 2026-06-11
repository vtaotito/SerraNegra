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
  /** Valor s/ impostos vindo do SAP (última compra ou preço médio) — base para "reverter". */
  sapV: number;
  /** Campos que vêm de override manual (chaves do frontend: v, fr, sc, co, pc, ic, ip, cfSaco, cfPallet, qtdPallet, qtdSaco). */
  overriddenKeys: string[];
  updatedAt: string | null;
  updatedBy: string | null;
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
// Catálogo MarkUp — siglas de linha de produto
// ---------------------------------------------------------------------------

const MARKUP_ITEM_PREFIXES = [
  "AR", "EQ", "GF", "GI", "GN", "IS", "LA", "ME", "PO", "RO", "TA", "TM", "TP",
] as const;

function isMarkupCatalogItem(itemCode: string): boolean {
  const code = itemCode.trim().toUpperCase();
  return MARKUP_ITEM_PREFIXES.some((prefix) => code.startsWith(prefix));
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
// Cache do catálogo SAP (itens + preços). Overrides são sempre lidos do banco.
// ---------------------------------------------------------------------------

const CATALOG_CACHE_TTL_MS = num(process.env.MARKUP_CATALOG_CACHE_MS, 5 * 60 * 1000);

interface CatalogCache {
  items: SapItemRow[];
  prices: ItemPriceRow[];
  ts: number;
}

let catalogCache: CatalogCache | null = null;
let catalogInflight: Promise<CatalogCache> | null = null;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MarkupService {
  constructor(
    private readonly db: pg.Pool,
    private readonly sapEntities: SapEntitiesService | null,
  ) {}

  /**
   * Fetches all items from SAP (with cache), enriches with price lists and
   * overrides (always fresh from DB), and returns markup-ready rows.
   */
  async listMarkupItems(correlationId?: string): Promise<MarkupItemResult[]> {
    const [catalog, overrides] = await Promise.all([
      this.fetchCatalog(correlationId),
      this.fetchAllOverrides(),
    ]);

    // Normaliza TODAS as chaves de preço para "PL_<n>" (número da lista).
    const priceMap = new Map<string, Record<string, number>>();
    for (const p of catalog.prices) {
      if (!p.Price || p.Price <= 0) continue;
      if (!priceMap.has(p.ItemCode)) priceMap.set(p.ItemCode, {});
      const key = p.PriceList != null ? `PL_${p.PriceList}` : p.ListName;
      priceMap.get(p.ItemCode)![key] = p.Price;
    }

    const overrideMap = new Map<string, MarkupOverrideRow>();
    for (const o of overrides) overrideMap.set(o.item_code, o);

    return catalog.items
      .filter((item) => isMarkupCatalogItem(item.ItemCode))
      .map((item) => this.buildItem(item, priceMap.get(item.ItemCode) ?? {}, overrideMap.get(item.ItemCode)));
  }

  /**
   * Single item lookup — reuses the catalog cache.
   */
  async getMarkupItem(itemCode: string, correlationId?: string): Promise<MarkupItemResult | null> {
    const items = await this.listMarkupItems(correlationId);
    return items.find((i) => i.itemCode === itemCode) ?? null;
  }

  private buildItem(
    item: SapItemRow,
    itemPrices: Record<string, number>,
    ov: MarkupOverrideRow | undefined,
  ): MarkupItemResult {
    const sapPriceLists = item.ItemPrices as Array<{ PriceList?: number; Price?: number }> | undefined;
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
    const sapV = num(lastPurchase || avgPrice);

    const overriddenKeys: string[] = [];
    if (ov) {
      if (ov.preco_sem_imp != null) overriddenKeys.push("v");
      if (ov.frete != null) overriddenKeys.push("fr");
      if (ov.embalagem != null) overriddenKeys.push("sc");
      if (ov.comissao != null) overriddenKeys.push("co");
      if (ov.pis_cofins != null) overriddenKeys.push("pc");
      if (ov.icms_compra != null) overriddenKeys.push("ic");
      if (ov.ipi != null) overriddenKeys.push("ip");
      if (ov.custo_fixo_saco != null) overriddenKeys.push("cfSaco");
      if (ov.custo_fixo_pallet != null) overriddenKeys.push("cfPallet");
      if (ov.qtd_pallet != null) overriddenKeys.push("qtdPallet");
      if (ov.qtd_saco != null) overriddenKeys.push("qtdSaco");
    }

    return {
      itemCode: item.ItemCode,
      itemName: item.ItemName ?? "",
      itemGroup: item.ItemsGroupCode ?? null,
      manufacturer: sapManufacturer,

      v: num(ov?.preco_sem_imp ?? sapV),
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
      sapV,
      overriddenKeys,
      updatedAt: ov?.updated_at ?? null,
      updatedBy: ov?.updated_by ?? null,
    };
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

  /**
   * Remove o override de um item — o item volta a usar os valores do SAP.
   */
  async deleteOverride(itemCode: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM markup_overrides WHERE item_code = $1`,
      [itemCode],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // ── Private helpers ─────────────────────────────────────────────

  /**
   * Catálogo SAP (itens + preços) com cache em memória.
   * Evita uma consulta completa ao Service Layer a cada navegação.
   */
  private async fetchCatalog(correlationId?: string): Promise<CatalogCache> {
    const now = Date.now();
    if (catalogCache && now - catalogCache.ts < CATALOG_CACHE_TTL_MS) {
      return catalogCache;
    }
    if (catalogInflight) return catalogInflight;

    catalogInflight = (async () => {
      const [items, prices] = await Promise.all([
        this.fetchSapItems(correlationId),
        this.fetchSapPrices(correlationId),
      ]);
      // Não cacheia respostas vazias (SAP offline) para tentar de novo logo.
      if (items.length > 0) {
        catalogCache = { items, prices, ts: Date.now() };
        return catalogCache;
      }
      return { items, prices, ts: 0 };
    })();

    try {
      return await catalogInflight;
    } finally {
      catalogInflight = null;
    }
  }

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
