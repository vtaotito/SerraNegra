import { Middleware } from "../http.js";
import { getHeaderValue } from "../utils/headers.js";

export type AuditEvent = {
  action: string;
  requestId: string;
  correlationId: string;
  actorId?: string;
  actorRole?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  occurredAt: string;
};

export type AuditSink = {
  record: (event: AuditEvent) => Promise<void>;
};

export const createConsoleAuditSink = (): AuditSink => ({
  record: async (event: AuditEvent) => {
    console.info("[audit]", JSON.stringify(event));
  }
});

export const createAuditMiddleware = (action: string, sink: AuditSink): Middleware => {
  return async (req, ctx, next) => {
    const startedAt = Date.now();
    const correlationId = getHeaderValue(req.headers, "x-correlation-id") ?? req.requestId;
    ctx.audit = {
      correlationId,
      requestId: req.requestId,
      actorId: ctx.auth?.userId ?? getHeaderValue(req.headers, "x-actor-id") ?? "unknown",
      actorRole: ctx.auth?.role ?? "operador",
      ip: req.ip,
      userAgent: req.userAgent
    };
    const response = await next(req, ctx);
    const event: AuditEvent = {
      action,
      requestId: req.requestId,
      correlationId,
      actorId: ctx.audit.actorId,
      actorRole: ctx.audit.actorRole,
      method: req.method,
      path: req.path,
      status: response.status,
      durationMs: Date.now() - startedAt,
      tenantId: ctx.auth?.tenantId,
      ip: req.ip,
      userAgent: req.userAgent,
      occurredAt: new Date().toISOString()
    };
    await sink.record(event);
    return response;
  };
};
