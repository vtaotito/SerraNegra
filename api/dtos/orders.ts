import { OrderStatus, OrderItem } from "../../wms-core/src/domain/order.js";

export type OrderResponse = {
  id: string;
  externalOrderId?: string;
  customerId: string;
  customerName?: string;
  shipToAddress?: string;
  status: OrderStatus;
  items: OrderItem[];
  totalItems: number;
  totalWeight?: number;
  totalVolume?: number;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type OrderCreateRequest = {
  externalOrderId?: string;
  customerId: string;
  shipToAddress?: string;
  items: Array<{
    sku: string;
    quantity: number;
  }>;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  notes?: string;
};

export type OrderUpdateRequest = {
  shipToAddress?: string;
  status?: OrderStatus;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  notes?: string;
};

export type OrderQuery = {
  customerId?: string;
  status?: OrderStatus;
  externalOrderId?: string;
  priority?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export type OrderDetailResponse = OrderResponse & {
  tasks?: Array<{
    id: string;
    type: string;
    status: string;
    assignedTo?: string;
    progress: number;
  }>;
  timeline?: Array<{
    eventType: string;
    occurredAt: string;
    actorId: string;
    actorRole: string;
  }>;
};
