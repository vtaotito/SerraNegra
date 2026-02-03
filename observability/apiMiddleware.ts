import { SpanKind, type Span } from "@opentelemetry/api";
import type { ApiHandler, HttpResponse, Middleware } from "../api/http.js";
import { createObsContext } from "./context.js";
import { createLogger, type StructuredLogger } from "./logger.js";
import { withSpan } from "./tracing.js";

type ObsLogger = StructuredLogger;

type MinimalObs = {
  requestId: string;
  correlationId: string;
  traceId?: string;
  logger: ObsLogger;
  span?: Span;
};

export type ApiObservabilityOptions = {
  logger?: ObsLogger;
  /** Normaliza o nome do span (ex.: remove IDs do path) */
  spanName?: (req: { method: string; path: string }) => string;
};

export const createApiObservabilityMiddleware = (opts: ApiObservabilityOptions = {}): Middleware => {
  const baseLogger = opts.logger ?? createLogger({ name: process.env.OTEL_SERVICE_NAME ?? "wms-api" });
  const spanName = opts.spanName ?? ((req) => `${req.method} ${req.path}`);

  return async (req, ctx, next): Promise<HttpResponse> => {
    const startedAt = Date.now();

    const obsCtx = createObsContext({
      requestId: req.requestId,
      headers: req.headers,
      baseLogger
    });

    const logger = obsCtx.logger.child({
      http: { method: req.method, path: req.path, ip: req.ip, userAgent: req.userAgent }
    });

    const minimal: MinimalObs = {
      requestId: obsCtx.ids.requestId,
      correlationId: obsCtx.ids.correlationId,
      traceId: undefined,
      logger
    };

    ctx.observability = minimal as unknown as typeof ctx.observability;

    try {
      const response = await withSpan(
        obsCtx.tracer,
        spanName({ method: req.method, path: req.path }),
        async (span) => {
          minimal.span = span;
          minimal.traceId = span.spanContext().traceId;

          span.setAttribute("http.method", req.method);
          span.setAttribute("http.route", req.path);
          span.setAttribute("http.client_ip", req.ip ?? "");
          span.setAttribute("correlation.id", minimal.correlationId);
          span.setAttribute("request.id", minimal.requestId);
          if (ctx.auth?.userId) span.setAttribute("enduser.id", ctx.auth.userId);
          if (ctx.auth?.role) span.setAttribute("wms.actor.role", ctx.auth.role);
          span.setAttribute("span.kind", SpanKind.SERVER);

          return await next(req, ctx);
        },
        { kind: SpanKind.SERVER }
      );

      const durationMs = Date.now() - startedAt;
      obsCtx.meter.apiRequestsTotal.add(1, {
        method: req.method,
        path: req.path,
        status: String(response.status),
        role: ctx.auth?.role ?? "unknown"
      });
      obsCtx.meter.apiRequestDurationMs.record(durationMs, {
        method: req.method,
        path: req.path,
        status: String(response.status)
      });

      logger.info("Request concluído.", { status: response.status, durationMs });
      return response;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      obsCtx.meter.apiRequestsTotal.add(1, {
        method: req.method,
        path: req.path,
        status: "500",
        role: ctx.auth?.role ?? "unknown"
      });
      obsCtx.meter.apiRequestDurationMs.record(durationMs, {
        method: req.method,
        path: req.path,
        status: "500"
      });

      logger.error("Request falhou.", {
        durationMs,
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { value: err }
      });
      throw err;
    }
  };
};

/**
 * Helper para instrumentar handlers individualmente (ex.: recordScan, publishEvent).
 * Ele reaproveita o logger do middleware, se existir.
 */
export function withApiHandlerSpan(handlerName: string, handler: ApiHandler): ApiHandler {
  return async (req, ctx) => {
    const baseLogger = (ctx.observability as unknown as MinimalObs | undefined)?.logger ?? createLogger();
    const obsCtx = createObsContext({ requestId: req.requestId, headers: req.headers, baseLogger });

    return await withSpan(obsCtx.tracer, handlerName, async (span) => {
      span.setAttribute("request.id", obsCtx.ids.requestId);
      span.setAttribute("correlation.id", obsCtx.ids.correlationId);
      return await handler(req, ctx);
    });
  };
}

