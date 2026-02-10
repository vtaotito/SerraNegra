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
    const limit = opts.limit ?? 200;
    const candidates: string[] = [];

    const fullSelect = "ItemCode,ItemName,InventoryItem,SalesItem,PurchaseItem,InventoryUOM,Valid,Frozen,ItemsGroupCode,BarCode,UpdateDate";
    const minSelect = "ItemCode,ItemName,InventoryUOM,Valid,Frozen";
    const bareSelect = "ItemCode,ItemName";

    const activeFilter = opts.onlyActive !== false ? "&$filter=Valid eq 'tYES' and Frozen eq 'tNO'" : "";

    candidates.push(`/Items?$select=${fullSelect}${activeFilter}&$top=${limit}&$orderby=ItemCode asc`);
    candidates.push(`/Items?$select=${minSelect}${activeFilter}&$top=${limit}&$orderby=ItemCode asc`);
    candidates.push(`/Items?$select=${fullSelect}&$top=${limit}`);
    candidates.push(`/Items?$select=${minSelect}&$top=${limit}`);
    candidates.push(`/Items?$select=${bareSelect}&$top=${limit}`);

    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: SapItemRow[] }>(candidates[i], { correlationId });
        const items = res.data.value || [];
        console.log(`[listItems] Candidato #${i + 1} OK - ${items.length} itens`);
        return items;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Erro ao listar itens do SAP.");
  }

  // ========================================
  // INVENTORY (Estoque por depósito via OITW)
  // ========================================

  async listInventory(
    opts: { limit?: number } = {},
    correlationId?: string
  ): Promise<SapInventoryRow[]> {
    const limit = opts.limit ?? 500;

    // A abordagem via Service Layer para estoque por warehouse:
    // Opção 1: /Items com $expand=ItemWarehouseInfoCollection
    // Opção 2: Query SQL via /SQLQueries
    // Opção 3: /sml.svc/OITW
    // Vamos tentar expand primeiro, depois fallback
    const candidates: string[] = [];

    // Tentar expand do ItemWarehouseInfoCollection
    candidates.push(
      `/Items?$select=ItemCode,ItemName&$expand=ItemWarehouseInfoCollection($select=WarehouseCode,InStock,Committed,Ordered)&$top=${limit}&$filter=Valid eq 'tYES'`
    );
    candidates.push(
      `/Items?$select=ItemCode&$expand=ItemWarehouseInfoCollection($select=WarehouseCode,InStock)&$top=${limit}`
    );
    candidates.push(
      `/Items?$select=ItemCode&$expand=ItemWarehouseInfoCollection&$top=${limit}`
    );

    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: SapItemWithWarehouse[] }>(candidates[i], { correlationId });
        const items = res.data.value || [];
        console.log(`[listInventory] Candidato #${i + 1} OK - ${items.length} itens com warehouse info`);

        // Flatten: cada item pode ter múltiplos warehouses
        const inventory: SapInventoryRow[] = [];
        for (const item of items) {
          const whInfo = item.ItemWarehouseInfoCollection || [];
          for (const wh of whInfo) {
            // Só incluir se tem estoque
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

    // Se expand não funciona, retornar lista vazia (feature não suportada)
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

    const fullSelect = "CardCode,CardName,CardType,Phone1,EmailAddress,Address,City,State,Valid,Frozen,UpdateDate";
    const minSelect = "CardCode,CardName,CardType,Phone1,EmailAddress";
    const bareSelect = "CardCode,CardName";

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
  Phone1?: string;
  EmailAddress?: string;
  Address?: string;
  City?: string;
  State?: string;
  Valid?: string;
  Frozen?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};
