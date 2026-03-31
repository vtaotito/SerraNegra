import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { CustomersListParams, CustomersListResponse } from "../types";

export function useCustomers(params?: CustomersListParams) {
  return useQuery<CustomersListResponse>({
    queryKey: ["customers", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append("search", params.search);
      if (params?.active !== undefined) searchParams.append("active", params.active.toString());
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined) searchParams.append("offset", params.offset.toString());

      const qs = searchParams.toString();
      const url = qs ? `${API_ENDPOINTS.CUSTOMERS}?${qs}` : API_ENDPOINTS.CUSTOMERS;
      return get<CustomersListResponse>(url);
    },
    staleTime: 1000 * 60 * 5,
  });
}

