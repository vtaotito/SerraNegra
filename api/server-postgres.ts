/**
 * Core API Server with PostgreSQL
 * Servidor standalone da API principal do WMS com suporte a PostgreSQL
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { v4 as uuidv4 } from "uuid";
import { buildRoutes } from "./routes.js";
import type { HttpRequest, RequestContext } from "./http.js";
import { createLogger } from "../observability/logger.js";
import {
  createDatabasePool,
  loadDatabaseConfig,
  testDatabaseConnection,
  closeDatabasePool
} from "./config/database.js";
import { createServices } from "./config/services.js";
import { createOrdersController } from "./controllers/ordersController.js";

// Configurações
const SERVICE_NAME = process.env.SERVICE_NAME ?? "wms-core-api";
const API_PORT = Number(process.env.API_PORT ?? "8000");
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const USE_POSTGRES = process.env.USE_POSTGRES === "true";

const logger = createLogger({ name: SERVICE_NAME, level: LOG_LEVEL as any });

// Mock services temporários (serão substituídos gradualmente)
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

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

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

// ============================================================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ============================================================================

let pool: any = null;

if (USE_POSTGRES) {
  logger.info("Configurando PostgreSQL...");
  
  try {
    const dbConfig = loadDatabaseConfig();
    pool = createDatabasePool(dbConfig);
    
    const connected = await testDatabaseConnection(pool);
    
    if (!connected) {
      logger.error("Falha ao conectar com PostgreSQL");
      process.exit(1);
    }
    
    logger.info("✓ PostgreSQL configurado e conectado");
  } catch (err) {
    logger.error({ err }, "Erro ao configurar PostgreSQL");
    process.exit(1);
  }
} else {
  logger.warn("⚠ Modo desenvolvimento: usando in-memory store");
}

// ============================================================================
// INICIALIZAÇÃO DOS SERVIÇOS
// ============================================================================

const services = createServices({
  usePostgres: USE_POSTGRES,
  pool: pool || undefined
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get("/health", async () => {
  const dbStatus = USE_POSTGRES
    ? pool
      ? "connected"
      : "disconnected"
    : "in-memory";

  return {
    ok: true,
    service: SERVICE_NAME,
    database: dbStatus,
    timestamp: new Date().toISOString()
  };
});

// ============================================================================
// ROTAS
// ============================================================================

const routes = buildRoutes({
  orderCoreService: services.orderCoreService,
  scansService: new MockScanService() as any,
  dashboardService: new MockDashboardService() as any,
  integrationsService: new MockIntegrationService() as any
});

// Registrar rotas
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
        userId: request.headers["x-user-id"] as string || "system",
        role: request.headers["x-user-role"] as string || "admin",
        displayName: request.headers["x-user-name"] as string || "System"
      },
      audit: {
        correlationId,
        requestId: httpReq.requestId,
        actorId: request.headers["x-user-id"] as string || "system",
        actorRole: request.headers["x-user-role"] as string || "admin",
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
      
      const status = (err as any).code?.startsWith("WMS-AUTH") ? 403 : 500;
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

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

await app.listen({ port: API_PORT, host: "0.0.0.0" });
logger.info(`Core API online em :${API_PORT} ${USE_POSTGRES ? "(PostgreSQL)" : "(in-memory)"}`);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const shutdown = async () => {
  logger.info("Shutting down gracefully...");
  
  await app.close();
  
  if (pool) {
    await closeDatabasePool(pool);
  }
  
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
