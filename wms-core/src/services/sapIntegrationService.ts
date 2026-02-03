import type { Order, OrderItem } from "../domain/order.js";
import { createOrder } from "./orderService.js";
import {
  calculatePriority,
  calculateSla,
  enrichOrderWithSapData,
  type SapOrder
} from "./sapEnrichmentService.js";

/**
 * Cria um pedido WMS a partir de um Sales Order do SAP B1
 */
export const createOrderFromSap = (input: {
  orderId: string;
  sapOrder: SapOrder;
}): Order => {
  const items: OrderItem[] =
    input.sapOrder.DocumentLines?.map((line) => ({
      sku: line.ItemCode,
      quantity: line.Quantity
    })) ?? [];

  // Cria o pedido base
  const baseOrder = createOrder({
    id: input.orderId,
    customerId: input.sapOrder.CardCode,
    items,
    externalOrderId: input.sapOrder.DocNum?.toString(),
    createdAt: input.sapOrder.DocDate
  });

  // Enriquece com dados do SAP
  let enriched = enrichOrderWithSapData(baseOrder, input.sapOrder);

  // Calcula prioridade se não veio do SAP
  if (!enriched.priority) {
    enriched = {
      ...enriched,
      priority: calculatePriority({
        slaDueAt: enriched.slaDueAt,
        customerId: enriched.customerId
      })
    };
  }

  // Calcula SLA se não veio do SAP
  if (!enriched.slaDueAt) {
    enriched = {
      ...enriched,
      slaDueAt: calculateSla({
        createdAt: enriched.createdAt,
        carrier: enriched.carrier,
        customerId: enriched.customerId,
        priority: enriched.priority
      })
    };
  }

  return enriched;
};

/**
 * Sincroniza status do WMS de volta para o SAP B1 (UDF)
 */
export type SapStatusUpdate = {
  DocEntry: number;
  U_WMS_STATUS?: string;
  U_WMS_ORDERID?: string;
  U_WMS_LAST_EVENT?: string;
  U_WMS_LAST_TS?: string;
  U_WMS_CORR_ID?: string;
};

export const buildSapStatusUpdate = (input: {
  order: Order;
  eventType?: string;
  correlationId?: string;
}): SapStatusUpdate | null => {
  if (!input.order.sapDocEntry) {
    return null;
  }

  return {
    DocEntry: input.order.sapDocEntry,
    U_WMS_STATUS: input.order.status,
    U_WMS_ORDERID: input.order.id,
    U_WMS_LAST_EVENT: input.eventType,
    U_WMS_LAST_TS: input.order.updatedAt,
    U_WMS_CORR_ID: input.correlationId
  };
};
