/**
 * Mapeamento: Estoque SAP B1 -> visão WMS (por depósito e opcionalmente por bin).
 *
 * Notas:
 * - No SAP B1, o estoque por depósito costuma vir de OITW (Warehouse).
 * - Quando bins estão habilitados, quantidades por bin podem vir de entidades como BinLocations/BinLocationQuantities.
 * - Como os nomes exatos variam por versão/configuração do Service Layer, este módulo foca no formato canônico
 *   (item + warehouse + bin + quantidades) e deixa a coleta/consulta para o conector.
 */

export type WarehouseInventoryRow = {
  ItemCode: string;
  WarehouseCode: string;
  InStock?: number; // disponível em algumas consultas
  OnHand?: number;
  Committed?: number;
  Ordered?: number;
  UpdateDate?: string;
  UpdateTime?: string;
};

export type BinQuantityRow = {
  ItemCode: string;
  WarehouseCode: string;
  BinAbsEntry: number;
  BinCode?: string;
  OnHandQty: number;
  UpdateDate?: string;
  UpdateTime?: string;
};

export type WmsInventoryByWarehouse = {
  sku: string;
  warehouseCode: string;
  onHand?: number;
  committed?: number;
  ordered?: number;
  inStock?: number;
};

export type WmsInventoryByBin = {
  sku: string;
  warehouseCode: string;
  binAbsEntry: number;
  binCode?: string;
  onHandQty: number;
};

export function mapWarehouseInventoryFromSapB1(row: WarehouseInventoryRow): WmsInventoryByWarehouse {
  return {
    sku: row.ItemCode,
    warehouseCode: row.WarehouseCode,
    onHand: row.OnHand,
    committed: row.Committed,
    ordered: row.Ordered,
    inStock: row.InStock
  };
}

export function mapBinInventoryFromSapB1(row: BinQuantityRow): WmsInventoryByBin {
  return {
    sku: row.ItemCode,
    warehouseCode: row.WarehouseCode,
    binAbsEntry: row.BinAbsEntry,
    binCode: row.BinCode,
    onHandQty: row.OnHandQty
  };
}

