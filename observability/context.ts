import { context as otelContext, propagation, trace, type Context, type Span, type Tracer } from "@opentelemetry/api";
import { createLogger, type StructuredLogger } from "./logger.js";
import { getMeter, type ObservabilityMeter } from "./metrics.js";

export type CorrelationIds = {
  requestId: string;
  correlationId: string;
  orderId?: string;
  taskId?: string;
};

export type ObservabilityContext = {
  ids: CorrelationIds;
  logger: StructuredLogger;
  tracer: Tracer;
  meter: ObservabilityMeter;
  otelContext: Context;
  span?: Span;
};

export function extractCorrelationId(headers: Record<string, string | undefined>, requestId: string): string {
  const raw =
    headers["x-correlation-id"] ??
    headers["X-Correlation-Id"] ??
    headers["x-correlation-id".toLowerCase()] ??
    undefined;
  return raw?.trim() || requestId;
}

export function extractIncomingOtelContext(headers: Record<string, string | undefined>): Context {
  const carrier: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") carrier[k] = v;
  }
  return propagation.extract(otelContext.active(), carrier);
}

export function createObsContext(input: {
  requestId: string;
  headers: Record<string, string | undefined>;
  baseLogger?: StructuredLogger;
  orderId?: string;
  taskId?: string;
}): ObservabilityContext {
  const correlationId = extractCorrelationId(input.headers, input.requestId);
  const otelCtx = extractIncomingOtelContext(input.headers);
  const tracer = trace.getTracer("wms");
  const meter = getMeter();
  const base = input.baseLogger ?? createLogger();
  const logger = base.child({
    requestId: input.requestId,
    correlationId,
    orderId: input.orderId,
    taskId: input.taskId,
    traceId: trace.getSpanContext(otelCtx)?.traceId
  });

  return {
    ids: { requestId: input.requestId, correlationId, orderId: input.orderId, taskId: input.taskId },
    logger,
    tracer,
    meter,
    otelContext: otelCtx
  };
}

