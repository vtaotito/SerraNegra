import { OrderStatus, SyncStatus } from "@/lib/constants/status";

export type OrderItem = {
  sku: string;
  itemDescription?: string;
  quantity: number;
  price?: number;
  warehouseCode?: string;
  measureUnit?: string;
  lineTotal?: number;
  lineStatus?: string;
};

export type Order = {
  // Identificação
  id: string;
  order_number: string;

  // Cliente
  customer_id: string;
  customer_name: string;

  // Status e fluxo
  status: OrderStatus;
  order_date: string;
  due_date?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;

  // Valores
  total_amount?: number | null;
  currency: string;

  // Prioridade
  priority: number;

  // Observações
  notes?: string | null;

  // Integração SAP
  sap_doc_entry?: number | null;
  sap_doc_num?: number | null;
  sap_doc_status?: string | null;

  // Sincronização
  last_sync_at?: string | null;
  sync_status?: SyncStatus | null;
  sync_error?: string | null;

  // Metadata
  created_at: string;
  updated_at: string;

  // Relacionamentos
  lines?: OrderLine[];
  events?: OrderEvent[];
};

export type OrderLine = {
  id: string;
  order_id: string;
  product_id: string;

  line_number: number;
  product_sku: string;
  product_description: string;

  quantity: number;
  unit_of_measure: string;

  quantity_picked: number;
  quantity_packed: number;
  quantity_shipped: number;

  unit_price?: number | null;
  line_total?: number | null;

  warehouse_id?: string | null;
  warehouse_code?: string | null;

  sap_line_num?: number | null;
  sap_item_code?: string | null;

  created_at: string;
  updated_at: string;
};

export type OrderEvent = {
  event_id: string;
  order_id: string;
  type: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  occurred_at: string;
  actor_kind: "USER" | "SYSTEM" | "INTEGRATION";
  actor_id: string;
};

export type OrdersListParams = {
  customerId?: string;
  status?: OrderStatus;
  externalOrderId?: string;
  priority?: number;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export type OrdersListResponse = {
  data: Order[];
  nextCursor?: string;
};
