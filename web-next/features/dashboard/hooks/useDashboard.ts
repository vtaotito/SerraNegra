import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { DashboardMetrics } from "../types";

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard", "metrics"],
    queryFn: () => get<DashboardMetrics>(API_ENDPOINTS.DASHBOARD_METRICS),
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

export function useDashboardOrders(params?: {
  status?: string;
  limit?: number;
}) {
  return useQuery<{ data: any[] }>({
    queryKey: ["dashboard", "orders", params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.append("status", params.status);
      if (params?.limit) searchParams.append("limit", params.limit.toString());
      
      const url = `${API_ENDPOINTS.DASHBOARD_ORDERS}?${searchParams.toString()}`;
      return get<{ data: any[] }>(url);
    },
    staleTime: 1000 * 60, // 1 minuto
  });
}
