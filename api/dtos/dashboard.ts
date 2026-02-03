import { OrderStatus } from "../../wms-core/src/domain/order.js";
import { TaskStatus, TaskType } from "../../wms-core/src/domain/task.js";

export type DashboardOrderSummary = {
  id: string;
  externalOrderId?: string;
  customerId: string;
  status: OrderStatus;
  totalItems: number;
  createdAt: string;
  updatedAt: string;
};

export type DashboardTaskSummary = {
  id: string;
  orderId: string;
  type: TaskType;
  status: TaskStatus;
  assignedTo?: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type DashboardMetricsResponse = {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  openTasks: number;
  tasksByType: Record<TaskType, number>;
  lastUpdatedAt: string;
};

export type DashboardOrderQuery = {
  status?: OrderStatus;
  customerId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export type DashboardTaskQuery = {
  status?: TaskStatus;
  type?: TaskType;
  assignedTo?: string;
  limit?: number;
  cursor?: string;
};
