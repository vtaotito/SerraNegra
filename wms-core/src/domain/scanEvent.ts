export type ScanEventType = "ADDRESS_SCAN" | "PRODUCT_SCAN" | "QUANTITY_SCAN";

export type ScanEvent = {
  id: string;
  orderId: string;
  taskId?: string;
  type: ScanEventType;
  value: string;
  quantity?: number;
  occurredAt: string;
  actorId: string;
  actorRole: string;
  idempotencyKey?: string;
  correlationId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};
