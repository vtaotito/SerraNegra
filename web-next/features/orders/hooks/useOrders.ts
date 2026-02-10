import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  Order,
  OrdersListParams,
  OrdersListResponse,
  OrderEvent,
} from "../types";
import {
  adaptApiOrder,
  adaptApiOrdersList,
  ApiOrder,
  ApiOrdersListResponse,
} from "@/lib/api/adapters";

export function useOrders(params?: OrdersListParams) {
  return useQuery<OrdersListResponse>({
    queryKey: ["orders", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.customerId) searchParams.append("customerId", params.customerId);
      if (params?.status) searchParams.append("status", params.status);
      if (params?.externalOrderId) searchParams.append("externalOrderId", params.externalOrderId);
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      if (params?.cursor) searchParams.append("cursor", params.cursor);

      const url = `${API_ENDPOINTS.ORDERS}?${searchParams.toString()}`;
      const raw = await get<ApiOrdersListResponse>(url);
      return adaptApiOrdersList(raw);
    },
    staleTime: 1000 * 30, // 30 segundos
  });
}

export function useOrder(orderId: string) {
  return useQuery<Order>({
    queryKey: ["orders", orderId],
    queryFn: async () => {
      const raw = await get<ApiOrder>(API_ENDPOINTS.ORDER_BY_ID(orderId));
      return adaptApiOrder(raw);
    },
    enabled: !!orderId,
    staleTime: 1000 * 30,
  });
}

export function useOrderHistory(orderId: string) {
  return useQuery<OrderEvent[]>({
    queryKey: ["orders", orderId, "history"],
    queryFn: async () => {
      try {
        const raw = await get<any>(API_ENDPOINTS.ORDER_HISTORY(orderId));
        // API retorna { orderId, events: [...] }
        const events = raw?.events || raw || [];
        return Array.isArray(events)
          ? events.map((e: any) => ({
              event_id: e.eventId || e.event_id || "",
              order_id: orderId,
              type: e.type || "",
              from_status: e.from || e.from_status || "",
              to_status: e.to || e.to_status || "",
              occurred_at: e.occurredAt || e.occurred_at || "",
              actor_kind: e.actor?.kind || e.actor_kind || "SYSTEM",
              actor_id: e.actor?.id || e.actor_id || "",
            }))
          : [];
      } catch {
        return [];
      }
    },
    enabled: !!orderId,
    staleTime: 1000 * 30,
  });
}

export function useApplyOrderEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      eventType,
      actorId,
    }: {
      orderId: string;
      eventType: string;
      actorId?: string;
    }) =>
      post(API_ENDPOINTS.ORDER_EVENTS(orderId), {
        type: eventType,
        actor: { kind: "USER", id: actorId || "web-user" },
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", variables.orderId] });
      queryClient.invalidateQueries({
        queryKey: ["orders", variables.orderId, "history"],
      });
    },
  });
}
