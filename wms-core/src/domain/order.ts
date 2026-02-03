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

export type OrderActorRole = "PICKER" | "CHECKER" | "SUPERVISOR" | "SHIPPER";

export type OrderItem = {
  sku: string;
  quantity: number;
};

export type Order = {
  id: string;
  externalOrderId?: string;
  customerId: string;
  shipToAddress?: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type OrderEvent = {
  eventType: OrderEventType;
  actorId: string;
  actorRole: OrderActorRole;
  idempotencyKey?: string;
  occurredAt?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type OrderTransition = {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  eventType: OrderEventType;
  actorId: string;
  actorRole: OrderActorRole;
  occurredAt: string;
  idempotencyKey?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type OrderEventResult = {
  order: Order;
  transition: OrderTransition;
};
