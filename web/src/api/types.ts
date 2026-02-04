export type OrderStatus =
  | "A_SEPARAR"
  | "EM_SEPARACAO"
  | "CONFERIDO"
  | "AGUARDANDO_COTACAO"
  | "AGUARDANDO_COLETA"
  | "DESPACHADO";

export type OrderEventType =
  | "INICIAR_SEPARACAO"
  | "FINALIZAR_SEPARACAO"
  | "CONFERIR"
  | "SOLICITAR_COTACAO"
  | "CONFIRMAR_COTACAO"
  | "AGUARDAR_COLETA"
  | "DESPACHAR";

export type OrderItem = {
  sku: string;
  quantity: number;
};

export type Priority = "P1" | "P2" | "P3";

export type Order = {
  orderId: string;
  externalOrderId: string | null;
  sapDocEntry?: number | null;
  sapDocNum?: number | null;
  customerId: string;
  customerName?: string | null;
  shipToAddress?: string | null;
  status: OrderStatus;
  carrier?: string | null;
  priority?: Priority | null;
  slaDueAt?: string | null; // ISO (DocDueDate no SAP)
  docTotal?: number | null; // Valor total do pedido (SAP)
  currency?: string | null; // Moeda do pedido (SAP)
  items: OrderItem[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  metadata?: Record<string, unknown> | null;
};

export type OrderEventActor = {
  kind: "USER" | "SYSTEM" | "INTEGRATION";
  id: string;
};

export type OrderEvent = {
  eventId: string;
  type: OrderEventType;
  from: OrderStatus;
  to: OrderStatus;
  occurredAt: string;
  actor: OrderEventActor;
  idempotencyKey?: string | null;
};

export type OrderHistoryResponse = {
  orderId: string;
  events: OrderEvent[];
};

export type PostOrderEventRequest = {
  type: OrderEventType;
  occurredAt?: string;
  actor: OrderEventActor;
  reason?: string | null;
};

export type PostOrderEventResult = {
  orderId: string;
  previousStatus: OrderStatus;
  currentStatus: OrderStatus;
  applied: boolean;
  event: OrderEvent;
};

// Extensões de UI (scanHistory e pendingIssues são calculados no frontend)
export type UiOrder = Order & {
  pendingIssues?: string[];
  scanHistory?: Array<{
    at: string; // ISO
    by: string;
    sku: string;
    quantity: number;
  }>;
};

