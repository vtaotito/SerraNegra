import { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import { SapHttpError } from "../../../sap-connector/src/errors.js";

/**
 * Serviço para sincronizar entidades adicionais do SAP B1:
 * - Items (Produtos/Catálogo)
 * - WarehouseGenEntries / ItemWarehouseInfo (Estoque por depósito)
 * - BusinessPartners (Clientes)
 */
export class SapEntitiesService {
  constructor(private readonly client: SapServiceLayerClient) {}

  // ========================================
  // ITEMS (Produtos)
  // ========================================

  async listItems(
    opts: { limit?: number; onlyActive?: boolean } = {},
    correlationId?: string
  ): Promise<SapItemRow[]> {
    const maxItems = opts.limit ?? 5000;

    const fullSelect = "ItemCode,ItemName,InventoryItem,SalesItem,PurchaseItem,InventoryUOM,SalesUnit,SalesPackagingUnit,SalesQtyPerPackUnit,SalesItemsPerUnit,QuantityOnStock,QuantityOrderedByCustomers,QuantityOrderedFromVendors,Valid,Frozen,ItemsGroupCode,BarCode,UpdateDate";
    const packSelect = "ItemCode,ItemName,InventoryUOM,SalesUnit,SalesPackagingUnit,SalesQtyPerPackUnit,SalesItemsPerUnit,QuantityOnStock,Valid,Frozen,ItemsGroupCode,BarCode";
    const minSelect = "ItemCode,ItemName,InventoryUOM,QuantityOnStock,Valid,Frozen,ItemsGroupCode";
    const bareSelect = "ItemCode,ItemName";

    const activeFilter = opts.onlyActive !== false ? "&$filter=Valid eq 'tYES' and Frozen eq 'tNO'" : "";

    const selectCandidates = [
      { select: fullSelect, filter: activeFilter },
      { select: packSelect, filter: activeFilter },
      { select: minSelect, filter: activeFilter },
      { select: fullSelect, filter: "" },
      { select: minSelect, filter: "" },
      { select: bareSelect, filter: "" },
    ];

    let lastError: unknown;
    for (let ci = 0; ci < selectCandidates.length; ci++) {
      const { select, filter } = selectCandidates[ci];
      try {
        const allItems: SapItemRow[] = [];
        const pageSize = 100;
        let skip = 0;

        while (allItems.length < maxItems) {
          const url = `/Items?$select=${select}${filter}&$top=${pageSize}&$skip=${skip}&$orderby=ItemCode asc`;
          const res = await this.client.get<{ value: SapItemRow[]; "odata.nextLink"?: string }>(url, { correlationId });
          const page = res.data.value || [];
          allItems.push(...page);

          if (page.length < pageSize || !res.data["odata.nextLink"]) break;
          skip += pageSize;
        }

        console.log(`[listItems] Candidato #${ci + 1} OK - ${allItems.length} itens (paginado)`);
        return allItems.slice(0, maxItems);
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Erro ao listar itens do SAP.");
  }

  // ========================================
  // ITEM GROUPS (Categorias/Grupos de Itens)
  // ========================================

  async listItemGroups(
    correlationId?: string
  ): Promise<SapItemGroupRow[]> {
    const candidates = [
      "/ItemGroups?$select=Number,GroupName&$top=500",
      "/ItemGroups?$top=500",
    ];
    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: SapItemGroupRow[] }>(candidates[i], { correlationId });
        const groups = res.data.value || [];
        console.log(`[listItemGroups] Candidato #${i + 1} OK - ${groups.length} grupos`);
        return groups;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    console.log("[listItemGroups] Nenhum candidato funcionou - retornando vazio");
    return [];
  }

  // ========================================
  // INVENTORY (Estoque por depósito via OITW)
  // ========================================

  async listInventory(
    opts: { limit?: number } = {},
    correlationId?: string
  ): Promise<SapInventoryRow[]> {
    const maxItems = opts.limit ?? 5000;

    const expandCandidates = [
      { select: "ItemCode,ItemName", expand: "ItemWarehouseInfoCollection($select=WarehouseCode,InStock,Committed,Ordered)", filter: "&$filter=Valid eq 'tYES'" },
      { select: "ItemCode", expand: "ItemWarehouseInfoCollection($select=WarehouseCode,InStock)", filter: "" },
      { select: "ItemCode", expand: "ItemWarehouseInfoCollection", filter: "" },
    ];

    let lastError: unknown;
    for (let ci = 0; ci < expandCandidates.length; ci++) {
      const { select, expand, filter } = expandCandidates[ci];
      try {
        const allItems: SapItemWithWarehouse[] = [];
        const pageSize = 50;
        let skip = 0;

        while (allItems.length < maxItems) {
          const url = `/Items?$select=${select}&$expand=${expand}${filter}&$top=${pageSize}&$skip=${skip}`;
          const res = await this.client.get<{ value: SapItemWithWarehouse[]; "odata.nextLink"?: string }>(url, { correlationId });
          const page = res.data.value || [];
          allItems.push(...page);

          if (page.length < pageSize || !res.data["odata.nextLink"]) break;
          skip += pageSize;
        }

        console.log(`[listInventory] Candidato #${ci + 1} OK - ${allItems.length} itens com warehouse info (paginado)`);

        const inventory: SapInventoryRow[] = [];
        for (const item of allItems) {
          const whInfo = item.ItemWarehouseInfoCollection || [];
          for (const wh of whInfo) {
            const inStock = wh.InStock ?? 0;
            const committed = wh.Committed ?? 0;
            const ordered = wh.Ordered ?? 0;
            if (inStock > 0 || committed > 0 || ordered > 0) {
              inventory.push({
                ItemCode: item.ItemCode,
                WarehouseCode: wh.WarehouseCode,
                InStock: inStock,
                Committed: committed,
                Ordered: ordered,
              });
            }
          }
        }
        return inventory;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }

    console.log("[listInventory] Nenhum candidato funcionou - retornando vazio");
    return [];
  }

  // ========================================
  // BUSINESS PARTNERS (Clientes)
  // ========================================

  async listBusinessPartners(
    opts: { limit?: number; cardType?: string } = {},
    correlationId?: string
  ): Promise<SapBusinessPartnerRow[]> {
    const limit = opts.limit ?? 200;
    const cardType = opts.cardType ?? "cCustomer"; // cCustomer, cSupplier, cLead

    const candidates: string[] = [];

    const fullSelect = "CardCode,CardName,CardType,FederalTaxID,Phone1,EmailAddress,Address,City,State,ZipCode,Valid,Frozen,UpdateDate";
    const minSelect = "CardCode,CardName,CardType,FederalTaxID,Phone1,EmailAddress";
    const bareSelect = "CardCode,CardName,FederalTaxID";

    candidates.push(`/BusinessPartners?$select=${fullSelect}&$filter=CardType eq '${cardType}' and Valid eq 'tYES'&$top=${limit}&$orderby=CardName asc`);
    candidates.push(`/BusinessPartners?$select=${minSelect}&$filter=CardType eq '${cardType}'&$top=${limit}&$orderby=CardName asc`);
    candidates.push(`/BusinessPartners?$select=${fullSelect}&$top=${limit}`);
    candidates.push(`/BusinessPartners?$select=${minSelect}&$top=${limit}`);
    candidates.push(`/BusinessPartners?$select=${bareSelect}&$top=${limit}`);

    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: SapBusinessPartnerRow[] }>(candidates[i], { correlationId });
        const bps = res.data.value || [];
        console.log(`[listBusinessPartners] Candidato #${i + 1} OK - ${bps.length} parceiros`);
        return bps;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Erro ao listar parceiros do SAP.");
  }
}

// ---- Tipos SAP ----

export type SapItemRow = {
  ItemCode: string;
  ItemName?: string;
  InventoryItem?: string;
  SalesItem?: string;
  PurchaseItem?: string;
  InventoryUOM?: string;
  SalesUnit?: string;
  SalesPackagingUnit?: string;
  SalesQtyPerPackUnit?: number;
  SalesItemsPerUnit?: number;
  QuantityOnStock?: number;
  QuantityOrderedByCustomers?: number;
  QuantityOrderedFromVendors?: number;
  Valid?: string;
  Frozen?: string;
  ItemsGroupCode?: number;
  BarCode?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};

type SapWarehouseInfo = {
  WarehouseCode: string;
  InStock?: number;
  Committed?: number;
  Ordered?: number;
  [key: string]: unknown;
};

type SapItemWithWarehouse = {
  ItemCode: string;
  ItemName?: string;
  ItemWarehouseInfoCollection?: SapWarehouseInfo[];
  [key: string]: unknown;
};

export type SapInventoryRow = {
  ItemCode: string;
  WarehouseCode: string;
  InStock: number;
  Committed: number;
  Ordered: number;
};

export type SapBusinessPartnerRow = {
  CardCode: string;
  CardName?: string;
  CardType?: string;
  FederalTaxID?: string;
  Phone1?: string;
  EmailAddress?: string;
  Address?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Valid?: string;
  Frozen?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};

export type SapItemGroupRow = {
  Number: number;
  GroupName: string;
  [key: string]: unknown;
};
