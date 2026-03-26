import { isSqlQueriesAvailable } from "../../../sap-connector/src/sqlQueries.js";
import type { SapEntitiesService, SapEnrichedInventoryRow, SapItemPricingRow } from "./sapEntitiesService.js";

/**
 * Nível de enriquecimento obtido — indica qual estratégia funcionou.
 *   1 = SQLQuery com UDFs (dados completos)
 *   2 = SQLQuery sem UDFs (sem U_COD/U_UNIT/U_EMBALA/U_SubNome)
 *   3 = OData enriquecido (merge Items pricing + warehouse + groups)
 *   4 = OData básico (apenas estoque quantitativo)
 */
export type EnrichmentLevel = 1 | 2 | 3 | 4;

export interface InventoryBulkItem {
  sku: string;
  warehouse_code: string;
  item_name: string | null;
  on_hand: number;
  committed: number;
  ordered: number;
  available: number;
  min_stock: number;
  max_stock: number;
  uom: string | null;
  avg_price: number;
  last_purchase_price: number;
  last_purchase_date: string | null;
  last_sale_date: string | null;
  gross_weight: number;
  lead_time: number;
  item_group_code: number | null;
  item_group_name: string | null;
  last_count_date: string | null;
  sap_update_date: string;
}

export interface EnrichmentResult {
  items: InventoryBulkItem[];
  level: EnrichmentLevel;
  message: string;
}

/**
 * Serviço de enriquecimento de inventário com fallback multi-nível.
 * Encapsula toda a lógica de obtenção de dados de estoque do SAP B1.
 */
export class InventoryEnrichmentService {
  constructor(private readonly entSvc: SapEntitiesService) {}

  /**
   * Busca dados de inventário enriquecidos do SAP usando a melhor
   * estratégia disponível. Tenta cada nível em ordem decrescente
   * de riqueza de dados.
   */
  async fetchEnrichedInventory(correlationId?: string): Promise<EnrichmentResult> {
    const now = new Date().toISOString();

    // Se já sabemos que /SQLQueries não funciona, pula direto para OData
    const sqlAvailable = isSqlQueriesAvailable();
    if (sqlAvailable === false) {
      console.log("[enrichment] SQLQueries indisponível (cache), pulando para OData");
      return this.tryODataEnriched(correlationId, now);
    }

    // NÍVEL 1+2: SQLQuery (com ou sem UDFs — gerenciado dentro de listInventoryEnriched)
    try {
      const enriched = await this.entSvc.listInventoryEnriched(correlationId);
      if (enriched.length > 0) {
        const hasUDFs = enriched.some((r) => r.U_COD || r.U_UNIT || r.U_EMBALA || r.U_SubNome);
        const level: EnrichmentLevel = hasUDFs ? 1 : 2;
        console.log(`[enrichment] Nível ${level} (SQLQuery${hasUDFs ? " + UDFs" : ""}) - ${enriched.length} linhas`);
        return {
          items: enriched.map((r) => mapEnrichedToInventoryBulk(r, now)),
          level,
          message: `${enriched.length} itens via SQLQuery (nível ${level})`,
        };
      }
    } catch (err) {
      console.warn("[enrichment] SQLQuery falhou:", err instanceof Error ? err.message : err);
    }

    // NÍVEL 3: OData Enriquecido
    return this.tryODataEnriched(correlationId, now);
  }

  /**
   * Nível 3: Busca dados via OData com campos de pricing e merge com warehouse data.
   * Se listItemsWithPricing falhar, usa listItems (que tem ItemsGroupCode) como
   * fonte secundária para pelo menos resolver GroupName.
   * Nível 4 (fallback): apenas warehouse data sem enriquecimento.
   */
  private async tryODataEnriched(correlationId: string | undefined, now: string): Promise<EnrichmentResult> {
    try {
      const [warehouse, pricing, groups, items] = await Promise.all([
        this.entSvc.listInventory({ limit: 5000 }, correlationId),
        this.entSvc.listItemsWithPricing({ limit: 5000 }, correlationId).catch(() => [] as SapItemPricingRow[]),
        this.entSvc.listItemGroups(correlationId).catch(() => []),
        this.entSvc.listItems({ limit: 5000 }, correlationId).catch(() => []),
      ]);

      if (warehouse.length === 0) {
        return { items: [], level: 4, message: "Sem dados de estoque via Service Layer" };
      }

      const pricingMap = new Map<string, SapItemPricingRow>();
      for (const p of pricing) pricingMap.set(p.ItemCode, p);

      const groupMap = new Map<number, string>();
      for (const g of groups) groupMap.set(g.Number, g.GroupName);

      type ItemInfo = { name?: string; groupCode?: number; uom?: string };
      const itemsMap = new Map<string, ItemInfo>();
      for (const it of items) {
        itemsMap.set(it.ItemCode, {
          name: it.ItemName,
          groupCode: it.ItemsGroupCode,
          uom: it.InventoryUOM,
        });
      }

      const hasPricing = pricing.length > 0;
      const hasItems = items.length > 0;
      const level: EnrichmentLevel = hasPricing ? 3 : (hasItems && groups.length > 0 ? 3 : 4);

      const result: InventoryBulkItem[] = warehouse.map((wh) => {
        const pr = pricingMap.get(wh.ItemCode);
        const info = itemsMap.get(wh.ItemCode);
        const groupCode = pr?.ItemsGroupCode ?? info?.groupCode ?? null;
        const groupName = groupCode != null ? (groupMap.get(groupCode) ?? null) : null;

        return {
          sku: wh.ItemCode,
          warehouse_code: wh.WarehouseCode,
          item_name: wh.ItemName ?? pr?.ItemName ?? info?.name ?? null,
          on_hand: wh.InStock,
          committed: wh.Committed,
          ordered: wh.Ordered,
          available: wh.Available ?? Math.max(wh.InStock - wh.Committed, 0),
          min_stock: wh.MinStock ?? 0,
          max_stock: pr?.MaxInventory ?? 0,
          uom: pr?.InventoryUOM ?? info?.uom ?? null,
          avg_price: pr?.AvgPrice ?? 0,
          last_purchase_price: pr?.LastPurchasePrice ?? 0,
          last_purchase_date: pr?.LastPurchaseDate ?? null,
          last_sale_date: null,
          gross_weight: pr?.SWeight1 ?? 0,
          lead_time: pr?.LeadTime ?? 0,
          item_group_code: groupCode,
          item_group_name: groupName,
          last_count_date: null,
          sap_update_date: now,
        };
      });

      const sources = [hasPricing ? "pricing" : null, hasItems ? "items" : null, groups.length > 0 ? "groups" : null].filter(Boolean).join("+");
      console.log(`[enrichment] Nível ${level} (OData ${sources}) - ${result.length} itens`);
      return {
        items: result,
        level,
        message: `${result.length} itens via OData (${sources}, nível ${level})`,
      };
    } catch (err) {
      console.warn("[enrichment] OData enriquecido falhou, tentando básico:", err instanceof Error ? err.message : err);
      return this.tryODataBasic(correlationId, now);
    }
  }

  /**
   * Nível 4: Fallback mínimo — apenas stock quantitativo.
   */
  private async tryODataBasic(correlationId: string | undefined, now: string): Promise<EnrichmentResult> {
    try {
      const [warehouse, allItems] = await Promise.all([
        this.entSvc.listInventory({ limit: 2000 }, correlationId),
        this.entSvc.listItems({ limit: 5000 }, correlationId).catch(() => []),
      ]);

      const namesMap = new Map<string, string>();
      for (const it of allItems) {
        if (it.ItemName) namesMap.set(it.ItemCode, it.ItemName);
      }

      const items: InventoryBulkItem[] = warehouse.map((wh) => ({
        sku: wh.ItemCode,
        warehouse_code: wh.WarehouseCode,
        item_name: wh.ItemName ?? namesMap.get(wh.ItemCode) ?? null,
        on_hand: wh.InStock,
        committed: wh.Committed,
        ordered: wh.Ordered,
        available: wh.Available ?? Math.max(wh.InStock - wh.Committed, 0),
        min_stock: wh.MinStock ?? 0,
        max_stock: 0,
        uom: null,
        avg_price: 0,
        last_purchase_price: 0,
        last_purchase_date: null,
        last_sale_date: null,
        gross_weight: 0,
        lead_time: 0,
        item_group_code: null,
        item_group_name: null,
        last_count_date: null,
        sap_update_date: now,
      }));

      console.log(`[enrichment] Nível 4 (OData básico) - ${items.length} itens`);
      return { items, level: 4, message: `${items.length} itens via OData básico (nível 4)` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[enrichment] Todos os níveis falharam: ${msg}`);
      return { items: [], level: 4, message: `Falha total: ${msg}` };
    }
  }

  /**
   * Busca inventário enriquecido e persiste no Core via bulk upsert.
   * Retorno unificado usado por todas as rotas de sync.
   */
  async syncToCore(
    coreUrl: string,
    correlationId: string,
  ): Promise<{ ok: boolean; count: number; level: EnrichmentLevel; message: string }> {
    const enrichment = await this.fetchEnrichedInventory(correlationId);

    if (enrichment.items.length === 0) {
      return { ok: true, count: 0, level: enrichment.level, message: enrichment.message };
    }

    const res = await fetch(`${coreUrl}/v1/inventory/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-correlation-id": correlationId },
      body: JSON.stringify({ items: enrichment.items }),
    });

    const result = res.ok ? (await res.json()) as { upserted?: number; created?: number; updated?: number } : null;
    const created = result?.created ?? 0;
    const updated = result?.updated ?? 0;
    const upserted = result?.upserted ?? 0;

    return {
      ok: res.ok,
      count: upserted,
      level: enrichment.level,
      message: `${created} criados, ${updated} atualizados (nível ${enrichment.level})`,
    };
  }
}

function mapEnrichedToInventoryBulk(row: SapEnrichedInventoryRow, now: string): InventoryBulkItem {
  return {
    sku: row.ItemCode,
    warehouse_code: row.WarehouseCode,
    item_name: row.ItemName ?? null,
    on_hand: row.InStock,
    committed: row.Committed,
    ordered: row.Ordered,
    available: row.Available ?? Math.max(row.InStock - row.Committed, 0),
    min_stock: row.MinStock ?? 0,
    max_stock: row.WhsMaxStock ?? row.MaxStock ?? 0,
    uom: row.UoM ?? null,
    avg_price: row.AvgPrice ?? 0,
    last_purchase_price: row.LastPurPrc ?? 0,
    last_purchase_date: row.LastPurDat ?? null,
    last_sale_date: row.LstSalDate ?? null,
    gross_weight: row.GrossWeight ?? 0,
    lead_time: row.LeadTime ?? 0,
    item_group_code: row.ItmsGrpCod ?? null,
    item_group_name: row.GroupName ?? null,
    last_count_date: row.LastCountDate ?? null,
    sap_update_date: now,
  };
}
