/**
 * Core API Server
 * Servidor standalone da API principal do WMS
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { v4 as uuidv4 } from "uuid";
import { buildRestRoutes } from "./routesRest.js";
import type { RestRouteDefinition } from "./routesRest.js";
import type { HttpRequest, RequestContext } from "./http.js";
import { createLogger } from "../observability/logger.js";
import {
  createStubCatalogService,
  createStubCustomersService,
  createStubDashboardService,
  createStubIntegrationService,
  createStubInventoryService,
  createStubOrdersService,
  createStubScanService,
  createStubShipmentsService
} from "./services/stubServices.js";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "wms-core-api";
const API_PORT = Number(process.env.API_PORT ?? "8000");
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev-secret-dev-secret-dev-secret-dev-secret";

const logger = createLogger({ name: SERVICE_NAME, level: LOG_LEVEL as any });

const app = Fastify({
  logger: {
    level: LOG_LEVEL,
    base: { service: SERVICE_NAME }
  }
});

// CORS - Configuração completa para aceitar requisições do frontend
await app.register(cors, {
  origin: true, // Em produção, especificar origens permitidas
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-Id",
    "X-User-Name",
    "X-User-Role",
    "X-Correlation-Id",
    "X-Request-Id",
    "Idempotency-Key",
    "Accept",
    "Accept-Version"
  ],
  exposedHeaders: [
    "X-Correlation-Id",
    "X-Request-Id",
    "X-Api-Version"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
});

// Hook para correlationId
app.addHook("onRequest", async (req, reply) => {
  const incoming = req.headers["x-correlation-id"];
  const correlationId =
    typeof incoming === "string" && incoming.length > 0 ? incoming : uuidv4();
  (req as any).correlationId = correlationId;
  reply.header("X-Correlation-Id", correlationId);

  req.log = req.log.child({ correlationId });
});

// Health check
app.get("/health", async () => ({ ok: true, service: SERVICE_NAME }));

// Build routes
const routes = buildRestRoutes({
  catalogService: createStubCatalogService(),
  inventoryService: createStubInventoryService(),
  ordersService: createStubOrdersService(),
  shipmentsService: createStubShipmentsService(),
  customersService: createStubCustomersService(),
  scansService: createStubScanService(),
  dashboardService: createStubDashboardService(),
  integrationsService: createStubIntegrationService(),
  jwtConfig: {
    secret: JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
    issuer: process.env.JWT_ISSUER ?? "wms-api",
    audience: process.env.JWT_AUDIENCE ?? "wms-clients"
  }
});

// Register routes
for (const route of routes) {
  const method = route.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  
  // Fastify usa `:param`. Nossos contratos usam `{param}`.
  const fastifyPath = route.path.replace(/\{(\w+)\}/g, ":$1");

  app[method](fastifyPath, async (request, reply) => {
    const correlationId = (request as any).correlationId as string;

    // Build HttpRequest
    const headers = normalizeHeaders(request.headers as Record<string, unknown>, correlationId);
    const requestId = uuidv4();
    reply.header("X-Request-Id", requestId);

    const httpReq: HttpRequest = {
      method: route.method,
      path: route.path,
      headers,
      body: request.body,
      params: request.params as Record<string, string>,
      query: request.query as Record<string, string>,
      requestId,
      receivedAt: new Date().toISOString(),
      ip: request.ip,
      userAgent: request.headers["user-agent"]
    };

    // Context começa vazio: middlewares (auth/audit/etc) populam.
    const ctx: RequestContext = {
      idempotencyKey: headers["idempotency-key"] ?? undefined,
      observability: { requestId, correlationId, logger }
    };

    try {
      const result = await route.handler(httpReq, ctx);
      
      reply.code(result.status);
      
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          reply.header(key, value);
        }
      }
      
      return result.body;
    } catch (err) {
      request.log.error({ err, correlationId }, "Request error");
      
      const status = (err as any).code === "WMS-AUTH-001" ? 403 : 500;
      const message = err instanceof Error ? err.message : "Internal server error";
      
      reply.code(status);
      return {
        error: message,
        code: (err as any).code || "INTERNAL_ERROR",
        correlationId
      };
    }
  });
}

await app.listen({ port: API_PORT, host: "0.0.0.0" });
logger.info(`Core API online em :${API_PORT}`);

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down gracefully...");
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function normalizeHeaders(input: Record<string, unknown>, correlationId: string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      out[k] = typeof v[0] === "string" ? v[0] : undefined;
    } else if (typeof v === "string") {
      out[k] = v;
    } else if (typeof v === "number") {
      out[k] = String(v);
    } else {
      out[k] = undefined;
    }
  }
  // garante que o correlationId gerado no hook também seja visível pros middlewares
  out["x-correlation-id"] = out["x-correlation-id"] ?? correlationId;
  return out;
}
