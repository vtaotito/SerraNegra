import { ScanEvent } from "../../wms-core/src/domain/scanEvent.js";
import { WmsError } from "../../wms-core/src/errors.js";
import { ScanEventRequest, ScanEventResponse } from "../dtos/scans.js";
import { ApiHandler } from "../http.js";
import { optionalNumber, optionalString, requireString } from "../utils/validation.js";
import { createObsContext } from "../../observability/context.js";

export type RecordScanInput = {
  orderId: string;
  taskId?: string;
  type: ScanEventRequest["type"];
  value: string;
  quantity?: number;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  actorId: string;
  actorRole: string;
  idempotencyKey?: string;
  correlationId?: string;
  requestId: string;
};

export type ScanService = {
  recordScan: (input: RecordScanInput) => Promise<ScanEvent>;
};

export const createScansController = (service: ScanService): { recordScan: ApiHandler } => {
  const recordScan: ApiHandler = async (req, ctx) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (typeof req.body !== "object" || req.body === null) {
      throw new WmsError("WMS-VAL-001", "Payload inválido.");
    }
    const body = req.body as unknown as ScanEventRequest;

    const orderId = requireString(body.orderId, "orderId");
    const type = body.type;
    if (!type) {
      throw new WmsError("WMS-VAL-001", "Campo type obrigatorio.");
    }
    const value = requireString(body.value, "value");
    const taskId = optionalString(body.taskId);
    const occurredAt = optionalString(body.occurredAt);
    const quantity = optionalNumber(body.quantity);
    const metadata = body.metadata;

    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }

    const obs = createObsContext({
      requestId: req.requestId,
      headers: req.headers,
      baseLogger: (ctx.observability as unknown as { logger?: unknown })?.logger as any,
      orderId,
      taskId: taskId ?? undefined
    });

    const event = await service.recordScan({
      orderId,
      taskId,
      type,
      value,
      quantity,
      occurredAt,
      metadata,
      actorId: ctx.auth.userId,
      actorRole: ctx.auth.role,
      idempotencyKey: ctx.idempotencyKey,
      correlationId: ctx.audit?.correlationId,
      requestId: req.requestId
    });

    obs.meter.scanEventsTotal.add(1, {
      type,
      role: ctx.auth.role,
      actorId: ctx.auth.userId
    });
    obs.logger.info("Scan registrado.", { orderId, taskId, type });

    const response: ScanEventResponse = {
      event,
      idempotencyKey: ctx.idempotencyKey,
      requestId: req.requestId
    };

    return {
      status: 201,
      body: response
    };
  };

  return { recordScan };
};
