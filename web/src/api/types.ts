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

export type Order = {
  orderId: string;
  externalOrderId: string | null;
  customerId: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
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

export type Priority = "P1" | "P2" | "P3";

// Extensões de UI (não estão no contrato OpenAPI atual)
export type UiOrder = Order & {
  carrier?: string | null;
  priority?: Priority;
  slaDueAt?: string | null; // ISO
  pendingIssues?: string[];
  scanHistory?: Array<{
    at: string; // ISO
    by: string;
    sku: string;
    quantity: number;
  }>;
};

