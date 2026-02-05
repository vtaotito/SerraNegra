export type Stock = {
  id: string;
  product_id: string;
  warehouse_id: string;

  quantity_available: number;
  quantity_reserved: number;
  quantity_on_order: number;
  quantity_free: number;

  location_zone?: string | null;
  location_aisle?: string | null;
  location_rack?: string | null;
  location_level?: string | null;
  location_position?: string | null;

  updated_at: string;
};

export type InventoryListParams = {
  itemCode?: string;
  warehouseCode?: string;
  batchNumber?: string;
  minQuantity?: number;
  includeReserved?: boolean;
  limit?: number;
  cursor?: string;
};

export type InventoryListResponse = {
  data: Stock[];
  nextCursor?: string;
};
