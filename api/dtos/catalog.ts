export type CatalogItem = {
  itemCode: string;
  itemName: string;
  description?: string;
  barcode?: string;
  uomCode?: string;
  uomName?: string;
  weight?: number;
  volume?: number;
  categoryId?: string;
  categoryName?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CatalogItemRequest = {
  itemCode: string;
  itemName: string;
  description?: string;
  barcode?: string;
  uomCode?: string;
  weight?: number;
  volume?: number;
  categoryId?: string;
  active?: boolean;
};

export type CatalogItemQuery = {
  search?: string;
  categoryId?: string;
  active?: boolean;
  limit?: number;
  cursor?: string;
};

export type Warehouse = {
  warehouseCode: string;
  warehouseName: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  active: boolean;
  type?: "PRINCIPAL" | "SECUNDARIO" | "TERCEIROS";
  createdAt: string;
  updatedAt: string;
};

export type WarehouseRequest = {
  warehouseCode: string;
  warehouseName: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  active?: boolean;
  type?: "PRINCIPAL" | "SECUNDARIO" | "TERCEIROS";
};

export type WarehouseQuery = {
  search?: string;
  active?: boolean;
  type?: string;
  limit?: number;
  cursor?: string;
};
