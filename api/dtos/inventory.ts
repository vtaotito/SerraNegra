export type InventoryRecord = {
  id: string;
  itemCode: string;
  itemName?: string;
  warehouseCode: string;
  warehouseName?: string;
  quantity: number;
  reserved: number;
  available: number;
  batchNumber?: string;
  expirationDate?: string;
  location?: string;
  lastUpdated: string;
};

export type InventoryQuery = {
  itemCode?: string;
  warehouseCode?: string;
  batchNumber?: string;
  minQuantity?: number;
  includeReserved?: boolean;
  limit?: number;
  cursor?: string;
};

export type InventoryAdjustmentRequest = {
  itemCode: string;
  warehouseCode: string;
  quantity: number;
  adjustmentType: "ADD" | "REMOVE" | "SET";
  reason: string;
  batchNumber?: string;
  location?: string;
  notes?: string;
};

export type InventoryAdjustmentResponse = {
  adjustmentId: string;
  itemCode: string;
  warehouseCode: string;
  previousQuantity: number;
  newQuantity: number;
  adjustmentType: string;
  adjustedAt: string;
  actorId: string;
};

export type InventoryTransferRequest = {
  itemCode: string;
  fromWarehouseCode: string;
  toWarehouseCode: string;
  quantity: number;
  reason: string;
  batchNumber?: string;
  notes?: string;
};

export type InventoryTransferResponse = {
  transferId: string;
  status: "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  itemCode: string;
  fromWarehouse: string;
  toWarehouse: string;
  quantity: number;
  createdAt: string;
  completedAt?: string;
};
