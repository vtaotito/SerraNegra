import type { Span } from "@opentelemetry/api";
import { SpanKind } from "@opentelemetry/api";
import type { SapRequestOptions, SapResponse, SapServiceLayerClient } from "../sap-connector/src/index.js";
import { createObsContext } from "./context.js";
import { createLogger, type StructuredLogger } from "./logger.js";
import { withSpan } from "./tracing.js";

export type SapInstrumentOptions = {
  logger?: StructuredLogger;
  componentName?: string; // ex.: "sap"
};

type SapClientLike = Pick<SapServiceLayerClient, "get" | "post" | "patch" | "login" | "logout">;

export function instrumentSapClient<T extends SapClientLike>(
  client: T,
  opts: SapInstrumentOptions = {}
): T {
  const component = opts.componentName ?? "sap";
  const baseLogger = opts.logger ?? createLogger({ name: process.env.OTEL_SERVICE_NAME ?? "wms" });

  const wrap = <TRes>(method: "GET" | "POST" | "PATCH", path: string, f: () => Promise<SapResponse<TRes>>, correlationId?: string) => {
    const obsCtx = createObsContext({
      requestId: correlationId ?? cryptoRandomId(),
      headers: { "x-correlation-id": correlationId },
      baseLogger
    });

    const logger = obsCtx.logger.child({ component, sap: { method, path } });

    return withSpan(
      obsCtx.tracer,
      `SAP ${method} ${path}`,
      async (span: Span) => {
        span.setAttribute("rpc.system", "sap-b1-service-layer");
        span.setAttribute("rpc.method", method);
        span.setAttribute("rpc.service", "ServiceLayer");
        span.setAttribute("url.path", path);
        span.setAttribute("correlation.id", obsCtx.ids.correlationId);

        const startedAt = Date.now();
        try {
          const res = await f();
          const durationMs = Date.now() - startedAt;
          obsCtx.meter.sapRequestsTotal.add(1, {
            method,
            path,
            status: String(res.status)
          });
          obsCtx.meter.sapRequestDurationMs.record(durationMs, {
            method,
            path,
            status: String(res.status)
          });
          logger.info("SAP request OK.", { status: res.status, durationMs, sapRequestId: res.requestId });
          return res;
        } catch (err) {
          const durationMs = Date.now() - startedAt;
          obsCtx.meter.sapRequestsTotal.add(1, {
            method,
            path,
            status: "error"
          });
          obsCtx.meter.sapRequestDurationMs.record(durationMs, {
            method,
            path,
            status: "error"
          });
          logger.error("SAP request falhou.", {
            durationMs,
            error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { value: err }
          });
          throw err;
        }
      },
      { kind: SpanKind.CLIENT }
    );
  };

  // Mantém a mesma interface do client original
  return {
    ...client,
    login: async (correlationId?: string) => {
      const obsCtx = createObsContext({
        requestId: correlationId ?? cryptoRandomId(),
        headers: { "x-correlation-id": correlationId },
        baseLogger
      });
      return await withSpan(obsCtx.tracer, "SAP login", async () => client.login(correlationId), { kind: SpanKind.CLIENT });
    },
    logout: async (correlationId?: string) => {
      const obsCtx = createObsContext({
        requestId: correlationId ?? cryptoRandomId(),
        headers: { "x-correlation-id": correlationId },
        baseLogger
      });
      return await withSpan(obsCtx.tracer, "SAP logout", async () => client.logout(correlationId), { kind: SpanKind.CLIENT });
    },
    get: async <TRes>(path: string, requestOpts?: SapRequestOptions) =>
      await wrap<TRes>("GET", path, () => client.get<TRes>(path, requestOpts), requestOpts?.correlationId),
    post: async <TRes>(path: string, body: unknown, requestOpts?: SapRequestOptions) =>
      await wrap<TRes>("POST", path, () => client.post<TRes>(path, body, requestOpts), requestOpts?.correlationId),
    patch: async <TRes>(path: string, body: unknown, requestOpts?: SapRequestOptions) =>
      await wrap<TRes>("PATCH", path, () => client.patch<TRes>(path, body, requestOpts), requestOpts?.correlationId)
  } as T;
}

function cryptoRandomId(): string {
  // Node 18+: crypto.randomUUID disponível.
  // Mantemos fallback para ambientes que não tenham (test runners).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCrypto = globalThis.crypto as any;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

