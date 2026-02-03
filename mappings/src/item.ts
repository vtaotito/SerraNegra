/**
 * Mapeamento: Item (OITM) do SAP B1 (Service Layer) -> catálogo do WMS.
 */

export type ServiceLayerItem = {
  ItemCode: string;
  ItemName?: string;
  InventoryItem?: "tYES" | "tNO";
  SalesItem?: "tYES" | "tNO";
  PurchaseItem?: "tYES" | "tNO";
  InventoryUOM?: string;
  UoMGroupEntry?: number;
  Valid?: "tYES" | "tNO";
  Frozen?: "tYES" | "tNO";
  UpdateDate?: string;
  UpdateTime?: string;
};

export type WmsItem = {
  sku: string;
  name?: string;
  uom?: string;
  active: boolean;
  flags: {
    inventoryItem?: boolean;
    salesItem?: boolean;
    purchaseItem?: boolean;
  };
};

function yn(v: "tYES" | "tNO" | undefined): boolean | undefined {
  if (v === "tYES") return true;
  if (v === "tNO") return false;
  return undefined;
}

export function mapItemFromSapB1(item: ServiceLayerItem): WmsItem {
  const valid = yn(item.Valid);
  const frozen = yn(item.Frozen);
  const active = (valid ?? true) && (frozen === undefined ? true : !frozen);

  return {
    sku: item.ItemCode,
    name: item.ItemName,
    uom: item.InventoryUOM,
    active,
    flags: {
      inventoryItem: yn(item.InventoryItem),
      salesItem: yn(item.SalesItem),
      purchaseItem: yn(item.PurchaseItem)
    }
  };
}

