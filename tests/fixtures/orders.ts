import type { OrderItem } from "../../wms-core/src/domain/order.js";

export const fixtureOrderId = "order-e2e-1";
export const fixtureCustomerId = "cust-e2e-1";
export const fixtureShipToAddress = "ADDR-01";

export const fixtureItems: OrderItem[] = [
  { sku: "SKU-1", quantity: 2 },
  { sku: "SKU-2", quantity: 1 }
];

export const fixtureTaskIds = {
  picking: "task-picking-1",
  packing: "task-packing-1",
  shipping: "task-shipping-1"
};

