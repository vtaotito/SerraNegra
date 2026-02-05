import { OrderStatus } from "@/lib/constants/status";

export type DashboardMetrics = {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  openTasks: number;
  tasksByType: Record<string, number>;
  lastUpdatedAt: string;
};
