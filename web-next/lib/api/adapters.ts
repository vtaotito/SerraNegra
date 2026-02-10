/**
 * Adaptadores para transformar dados da API do Core para os tipos do frontend.
 * A API retorna formatos camelCase simples, mas o frontend usa tipos mais ricos.
 */

import { Order, OrderLine, OrdersListResponse } from "@/features/orders/types";
import { OrderStatus, SyncStatus } from "@/lib/constants/status";

// ---- Tipos da API (como o Core realmente retorna) ----

export type ApiOrderItem = {
  sku: string;
  quantity: number;
};

export type ApiOrder = {
  orderId: string;
  externalOrderId?: string | null;
  customerId: string;
  status: string;
  items: ApiOrderItem[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type ApiOrdersListResponse = {
  items: ApiOrder[];
  total?: number;
  nextCursor?: string | null;
  limit?: number;
  offset?: number;
};

// ---- Adaptadores ----

function mapApiStatus(status: string): OrderStatus {
  const validStatuses: Record<string, OrderStatus> = {
    A_SEPARAR: OrderStatus.A_SEPARAR,
    EM_SEPARACAO: OrderStatus.EM_SEPARACAO,
    CONFERIDO: OrderStatus.CONFERIDO,
    AGUARDANDO_COTACAO: OrderStatus.AGUARDANDO_COTACAO,
    AGUARDANDO_COLETA: OrderStatus.AGUARDANDO_COLETA,
    DESPACHADO: OrderStatus.DESPACHADO,
  };
  return validStatuses[status] || OrderStatus.A_SEPARAR;
}

export function adaptApiOrder(api: ApiOrder): Order {
  const metadata = api.metadata || {};
  const sapDocEntry = metadata.sapDocEntry as number | undefined;
  const sapDocNum = metadata.sapDocNum as number | undefined;
  const customerName = (metadata.customerName as string) || api.customerId;
  const docTotal = metadata.docTotal as number | undefined;
  const currency = (metadata.currency as string) || "BRL";

  // Gerar linhas do pedido a partir dos items
  const lines: OrderLine[] = api.items.map((item, idx) => ({
    id: `${api.orderId}-line-${idx}`,
    order_id: api.orderId,
    product_id: item.sku,
    line_number: idx + 1,
    product_sku: item.sku,
    product_description: item.sku === "PEDIDO_SAP" ? "Item do Pedido SAP" : item.sku,
    quantity: item.quantity,
    unit_of_measure: "UN",
    quantity_picked: 0,
    quantity_packed: 0,
    quantity_shipped: 0,
    unit_price: null,
    line_total: null,
    warehouse_id: null,
    warehouse_code: null,
    sap_line_num: null,
    sap_item_code: item.sku,
    created_at: api.createdAt,
    updated_at: api.updatedAt,
  }));

  return {
    id: api.orderId,
    order_number: api.externalOrderId
      ? `SAP-${api.externalOrderId}`
      : api.orderId.substring(0, 8).toUpperCase(),
    customer_id: api.customerId,
    customer_name: customerName,
    status: mapApiStatus(api.status),
    order_date: api.createdAt,
    due_date: null,
    shipped_at: api.status === "DESPACHADO" ? api.updatedAt : null,
    delivered_at: null,
    total_amount: docTotal ?? null,
    currency,
    priority: 3,
    notes: null,
    sap_doc_entry: sapDocEntry ?? null,
    sap_doc_num: sapDocNum ?? null,
    sap_doc_status: api.status === "DESPACHADO" ? "bost_Close" : "bost_Open",
    last_sync_at: api.updatedAt,
    sync_status: metadata.source === "SAP_B1" ? SyncStatus.SYNCED : null,
    sync_error: null,
    created_at: api.createdAt,
    updated_at: api.updatedAt,
    lines,
  };
}

export function adaptApiOrdersList(api: ApiOrdersListResponse): OrdersListResponse {
  return {
    data: (api.items || []).map(adaptApiOrder),
    nextCursor: api.nextCursor ?? undefined,
  };
}

/**
 * Calcula métricas de dashboard a partir da lista de pedidos
 */
export function computeDashboardMetrics(orders: Order[]) {
  const ordersByStatus: Record<string, number> = {};

  for (const status of Object.values(OrderStatus)) {
    ordersByStatus[status] = 0;
  }

  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
  }

  return {
    totalOrders: orders.length,
    ordersByStatus: ordersByStatus as Record<OrderStatus, number>,
    openTasks: 0,
    tasksByType: {},
    lastUpdatedAt: new Date().toISOString(),
  };
}
