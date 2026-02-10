import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { DashboardMetrics } from "../types";
import {
  adaptApiOrdersList,
  computeDashboardMetrics,
  ApiOrdersListResponse,
} from "@/lib/api/adapters";
import { Order } from "@/features/orders/types";

/**
 * Busca métricas do dashboard calculadas a partir dos pedidos reais.
 * Usa /api/orders com limit alto para contar por status.
 */
export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard", "metrics"],
    queryFn: async () => {
      const raw = await get<ApiOrdersListResponse>(
        `${API_ENDPOINTS.ORDERS}?limit=200`
      );
      const adapted = adaptApiOrdersList(raw);
      return computeDashboardMetrics(adapted.data);
    },
    staleTime: 1000 * 60, // 1 minuto
  });
}

/**
 * Busca pedidos recentes para o dashboard.
 */
export function useDashboardOrders(params?: {
  status?: string;
  limit?: number;
}) {
  return useQuery<{ data: Order[] }>({
    queryKey: ["dashboard", "orders", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.append("status", params.status);
      if (params?.limit) searchParams.append("limit", params.limit.toString());

      const url = `${API_ENDPOINTS.ORDERS}?${searchParams.toString()}`;
      const raw = await get<ApiOrdersListResponse>(url);
      const adapted = adaptApiOrdersList(raw);
      return { data: adapted.data };
    },
    staleTime: 1000 * 30, // 30 segundos
  });
}
