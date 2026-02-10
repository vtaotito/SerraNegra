import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { SapOrdersResponse, SapOrder } from "../types";

/** Lista pedidos SAP via gateway */
export function useSapOrders(params?: {
  top?: number;
  filter?: string;
  search?: string;
}) {
  return useQuery<SapOrdersResponse>({
    queryKey: ["sap", "orders", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.top) qs.append("$top", params.top.toString());
      if (params?.filter) qs.append("$filter", params.filter);
      if (params?.search) qs.append("search", params.search);
      const url = `${API_ENDPOINTS.SAP_ORDERS}?${qs.toString()}`;
      return get<SapOrdersResponse>(url);
    },
    retry: 1,
    staleTime: 1000 * 30,
  });
}

/** Detalhe de 1 pedido SAP por DocEntry */
export function useSapOrder(docEntry: number | string) {
  return useQuery<SapOrder>({
    queryKey: ["sap", "orders", docEntry],
    queryFn: () =>
      get<SapOrder>(API_ENDPOINTS.SAP_ORDER_BY_DOC_ENTRY(docEntry)),
    enabled: !!docEntry,
    retry: 1,
    staleTime: 1000 * 60,
  });
}
