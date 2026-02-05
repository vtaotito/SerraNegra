export type ShipmentStatus = "PENDING" | "READY" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "RETURNED";

export type Shipment = {
  id: string;
  orderId: string;
  externalOrderId?: string;
  customerId: string;
  customerName?: string;
  carrier?: string;
  trackingCode?: string;
  shipToAddress: string;
  status: ShipmentStatus;
  packageCount: number;
  totalWeight?: number;
  totalVolume?: number;
  shippingMethod?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShipmentCreateRequest = {
  orderId: string;
  carrier?: string;
  trackingCode?: string;
  packageCount: number;
  totalWeight?: number;
  totalVolume?: number;
  shippingMethod?: string;
  estimatedDeliveryDate?: string;
  notes?: string;
};

export type ShipmentUpdateRequest = {
  status?: ShipmentStatus;
  carrier?: string;
  trackingCode?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  notes?: string;
};

export type ShipmentQuery = {
  orderId?: string;
  customerId?: string;
  status?: ShipmentStatus;
  carrier?: string;
  trackingCode?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};
