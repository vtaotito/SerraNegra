import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { Product, ProductsListParams, ProductsListResponse } from "../types";

export function useProducts(params?: ProductsListParams) {
  return useQuery<ProductsListResponse>({
    queryKey: ["products", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append("search", params.search);
      if (params?.categoryId) searchParams.append("categoryId", params.categoryId);
      if (params?.active !== undefined)
        searchParams.append("active", params.active.toString());
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      if (params?.cursor) searchParams.append("cursor", params.cursor);

      const url = `${API_ENDPOINTS.CATALOG_ITEMS}?${searchParams.toString()}`;
      return get<ProductsListResponse>(url);
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useProduct(itemCode: string) {
  return useQuery<Product>({
    queryKey: ["products", itemCode],
    queryFn: () => get<Product>(API_ENDPOINTS.CATALOG_ITEM_BY_CODE(itemCode)),
    enabled: !!itemCode,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
