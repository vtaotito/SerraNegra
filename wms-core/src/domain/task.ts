export type TaskType = "PICKING" | "PACKING" | "SHIPPING";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type TaskLine = {
  sku: string;
  quantity: number;
  scannedQuantity: number;
};

export type Task = {
  id: string;
  orderId: string;
  type: TaskType;
  status: TaskStatus;
  assignedTo?: string;
  dependsOnTaskId?: string;
  lines: TaskLine[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
};
