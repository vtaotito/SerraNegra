import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  Order,
  OrdersListParams,
  OrdersListResponse,
  OrderEvent,
} from "../types";

export function useOrders(params?: OrdersListParams) {
  return useQuery<OrdersListResponse>({
    queryKey: ["orders", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.customerId) searchParams.append("customerId", params.customerId);
      if (params?.status) searchParams.append("status", params.status);
      if (params?.priority) searchParams.append("priority", params.priority.toString());
      if (params?.from) searchParams.append("from", params.from);
      if (params?.to) searchParams.append("to", params.to);
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      if (params?.cursor) searchParams.append("cursor", params.cursor);

      const url = `${API_ENDPOINTS.ORDERS}?${searchParams.toString()}`;
      return get<OrdersListResponse>(url);
    },
    staleTime: 1000 * 60, // 1 minuto
  });
}

export function useOrder(orderId: string) {
  return useQuery<Order>({
    queryKey: ["orders", orderId],
    queryFn: () => get<Order>(API_ENDPOINTS.ORDER_BY_ID(orderId)),
    enabled: !!orderId,
    staleTime: 1000 * 30, // 30 segundos
  });
}

export function useOrderHistory(orderId: string) {
  return useQuery<OrderEvent[]>({
    queryKey: ["orders", orderId, "history"],
    queryFn: () => get<OrderEvent[]>(API_ENDPOINTS.ORDER_HISTORY(orderId)),
    enabled: !!orderId,
    staleTime: 1000 * 30, // 30 segundos
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: Partial<Order> }) =>
      put<Order>(API_ENDPOINTS.ORDER_BY_ID(orderId), data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", variables.orderId] });
    },
  });
}

export function useApplyOrderEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      eventType,
    }: {
      orderId: string;
      eventType: string;
    }) =>
      post(API_ENDPOINTS.ORDER_EVENTS(orderId), { type: eventType }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", variables.orderId] });
      queryClient.invalidateQueries({
        queryKey: ["orders", variables.orderId, "history"],
      });
    },
  });
}
