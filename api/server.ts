/**
 * Core API Server
 * Servidor standalone da API principal do WMS
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { v4 as uuidv4 } from "uuid";
import { buildRoutes } from "./routes.js";
import type { RouteDefinition } from "./routes.js";
import type { HttpRequest, RequestContext } from "./http.js";
import { createLogger } from "../observability/logger.js";

// Mock services para desenvolvimento (substituir por implementações reais)
class MockScanService {
  async recordScan() {
    return { ok: true };
  }
}

class MockDashboardService {
  async listOrders() {
    return [];
  }
  async listTasks() {
    return [];
  }
  async getMetrics() {
    return { orders: 0, tasks: 0 };
  }
}

class MockIntegrationService {
  async registerWebhook(input: any) {
    return { id: uuidv4(), ...input };
  }
  async listWebhooks() {
    return [];
  }
  async deleteWebhook(id: string) {
    // noop
  }
  async publishEvent(input: any) {
    return { queued: true };
  }
}

const SERVICE_NAME = process.env.SERVICE_NAME ?? "wms-core-api";
const API_PORT = Number(process.env.API_PORT ?? "8000");
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

const logger = createLogger({ name: SERVICE_NAME, level: LOG_LEVEL as any });

const app = Fastify({
  logger: {
    level: LOG_LEVEL,
    base: { service: SERVICE_NAME }
  }
});

// CORS
await app.register(cors, {
  origin: true,
  credentials: true
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
const routes = buildRoutes({
  scansService: new MockScanService() as any,
  dashboardService: new MockDashboardService() as any,
  integrationsService: new MockIntegrationService() as any
});

// Register routes
for (const route of routes) {
  const method = route.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  
  // Convert path params from `:param` to `{param}` (Fastify style)
  const fastifyPath = route.path.replace(/:(\w+)/g, ":$1");

  app[method](fastifyPath, async (request, reply) => {
    const correlationId = (request as any).correlationId as string;

    // Build HttpRequest
    const httpReq: HttpRequest = {
      method: route.method,
      path: route.path,
      headers: request.headers as Record<string, string>,
      body: request.body,
      params: request.params as Record<string, string>,
      query: request.query as Record<string, string>,
      requestId: uuidv4(),
      receivedAt: new Date().toISOString(),
      ip: request.ip,
      userAgent: request.headers["user-agent"]
    };

    // Build RequestContext (mock auth for MVP)
    const ctx: RequestContext = {
      version: "v1",
      auth: {
        userId: "system",
        role: "admin",
        displayName: "System"
      },
      audit: {
        correlationId,
        requestId: httpReq.requestId,
        actorId: "system",
        actorRole: "admin",
        ip: httpReq.ip,
        userAgent: httpReq.userAgent
      },
      idempotencyKey: request.headers["idempotency-key"] as string | undefined,
      observability: {
        requestId: httpReq.requestId,
        correlationId,
        logger
      }
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
