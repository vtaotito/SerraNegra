import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { Stock, InventoryListParams, InventoryListResponse } from "../types";

export function useInventory(params?: InventoryListParams) {
  return useQuery<InventoryListResponse>({
    queryKey: ["inventory", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.itemCode) searchParams.append("itemCode", params.itemCode);
      if (params?.warehouseCode)
        searchParams.append("warehouseCode", params.warehouseCode);
      if (params?.batchNumber) searchParams.append("batchNumber", params.batchNumber);
      if (params?.minQuantity)
        searchParams.append("minQuantity", params.minQuantity.toString());
      if (params?.includeReserved !== undefined)
        searchParams.append("includeReserved", params.includeReserved.toString());
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      if (params?.cursor) searchParams.append("cursor", params.cursor);

      const url = `${API_ENDPOINTS.INVENTORY}?${searchParams.toString()}`;
      return get<InventoryListResponse>(url);
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

export function useStock(itemCode: string, warehouseCode: string) {
  return useQuery<Stock>({
    queryKey: ["inventory", itemCode, warehouseCode],
    queryFn: () =>
      get<Stock>(API_ENDPOINTS.INVENTORY_BY_ITEM_AND_WAREHOUSE(itemCode, warehouseCode)),
    enabled: !!itemCode && !!warehouseCode,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
