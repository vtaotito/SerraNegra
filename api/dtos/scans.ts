import { ScanEvent, ScanEventType } from "../../wms-core/src/domain/scanEvent.js";

export type ScanEventRequest = {
  orderId: string;
  taskId?: string;
  type: ScanEventType;
  value: string;
  quantity?: number;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export type ScanEventResponse = {
  event: ScanEvent;
  idempotencyKey?: string;
  requestId: string;
};
