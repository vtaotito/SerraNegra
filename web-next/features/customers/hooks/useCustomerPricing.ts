import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, put } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type {
  CustomerPricingListResponse,
  UpsertCustomerPricingRequest,
} from "../types";

export type CustomerPricingListParams = {
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
};

export function useCustomerPricing(cardCode: string, params?: CustomerPricingListParams) {
  return useQuery<CustomerPricingListResponse>({
    queryKey: ["customers", cardCode, "pricing", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append("search", params.search);
      if (params?.active !== undefined) searchParams.append("active", params.active.toString());
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined) searchParams.append("offset", params.offset.toString());

      const qs = searchParams.toString();
      const url = qs
        ? `${API_ENDPOINTS.CUSTOMER_PRICING(cardCode)}?${qs}`
        : API_ENDPOINTS.CUSTOMER_PRICING(cardCode);
      return get<CustomerPricingListResponse>(url);
    },
    enabled: !!cardCode,
    staleTime: 1000 * 30,
  });
}

export function useUpsertCustomerPricing(cardCode: string) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { sku: string; payload: UpsertCustomerPricingRequest }
  >({
    mutationFn: ({ sku, payload }) =>
      put(API_ENDPOINTS.CUSTOMER_PRICING_ITEM(cardCode, sku), {
        price: payload.price,
        currency: payload.currency || "BRL",
        is_active: payload.is_active ?? true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", cardCode, "pricing"] });
    },
  });
}

export function useDeactivateCustomerPricing(cardCode: string) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { sku: string }>({
    mutationFn: ({ sku }) => del(API_ENDPOINTS.CUSTOMER_PRICING_ITEM(cardCode, sku)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", cardCode, "pricing"] });
    },
  });
}

