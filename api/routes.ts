import { createDashboardController, DashboardService } from "./controllers/dashboardController.js";
import { createIntegrationsController, IntegrationService } from "./controllers/integrationsController.js";
import { createScansController, ScanService } from "./controllers/scansController.js";
import { createOrdersController } from "./controllers/ordersController.js";
import { getOrderCoreService } from "./services/orderCoreService.js";
import { ApiHandler, ApiRole, HttpMethod } from "./http.js";
import { createAuthenticationMiddleware } from "./middleware/authentication.js";
import { createAuthorizationMiddleware } from "./middleware/authorization.js";
import { createAuditMiddleware, createConsoleAuditSink, AuditSink } from "./middleware/audit.js";
import { withErrorHandling } from "./middleware/errorHandler.js";
import { createInMemoryIdempotencyStore, createIdempotencyMiddleware, IdempotencyStore } from "./middleware/idempotency.js";
import { createVersioningMiddleware } from "./middleware/versioning.js";
import { composeMiddlewares } from "./http.js";
import { createApiObservabilityMiddleware } from "../observability/apiMiddleware.js";
import { createLogger } from "../observability/logger.js";

const apiLogger = createLogger({ name: process.env.OTEL_SERVICE_NAME ?? "wms-api" });

export type RouteDefinition = {
  method: HttpMethod;
  path: string;
  handler: ApiHandler;
  requiredRoles: ApiRole[];
  auditAction: string;
  idempotent?: boolean;
};

export type ApiDependencies = {
  orderCoreService?: ReturnType<typeof getOrderCoreService>;
  scansService: ScanService;
  dashboardService: DashboardService;
  integrationsService: IntegrationService;
  auditSink?: AuditSink;
  idempotencyStore?: IdempotencyStore;
};

const wrapRoute = (route: RouteDefinition, auditSink: AuditSink, idempotencyStore: IdempotencyStore): RouteDefinition => {
  const handlerWithIdempotency = route.idempotent
    ? createIdempotencyMiddleware(route.handler, idempotencyStore)
    : route.handler;
  const middlewares = [
    createApiObservabilityMiddleware({ logger: apiLogger }),
    withErrorHandling(),
    createVersioningMiddleware(),
    createAuthenticationMiddleware(),
    createAuthorizationMiddleware(route.requiredRoles),
    createAuditMiddleware(route.auditAction, auditSink)
  ];
  const handler = composeMiddlewares(middlewares, handlerWithIdempotency);
  return { ...route, handler };
};

export const buildRoutes = (deps: ApiDependencies): RouteDefinition[] => {
  const scansController = createScansController(deps.scansService);
  const dashboardController = createDashboardController(deps.dashboardService);
  const integrationsController = createIntegrationsController(deps.integrationsService);
  const ordersController = createOrdersController(deps.orderCoreService ?? getOrderCoreService());

  const auditSink = deps.auditSink ?? createConsoleAuditSink();
  const idempotencyStore = deps.idempotencyStore ?? createInMemoryIdempotencyStore();

  const routes: RouteDefinition[] = [
    // ========== ORDERS ==========
    {
      method: "POST",
      path: "/orders",
      handler: ordersController.createOrder,
      requiredRoles: ["supervisor", "admin"],
      auditAction: "order.created",
      idempotent: true
    },
    {
      method: "GET",
      path: "/orders/:orderId",
      handler: ordersController.getOrder,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "order.viewed"
    },
    {
      method: "GET",
      path: "/orders",
      handler: ordersController.listOrders,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "orders.listed"
    },
    {
      method: "POST",
      path: "/orders/:orderId/events",
      handler: ordersController.applyEvent,
      requiredRoles: ["operador", "supervisor", "admin"],
      auditAction: "order.event.applied",
      idempotent: true
    },
    {
      method: "GET",
      path: "/orders/:orderId/history",
      handler: ordersController.getHistory,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "order.history.viewed"
    },
    // Endpoint interno (sem auth middleware, apenas secret)
    {
      method: "POST",
      path: "/internal/sap/orders",
      handler: ordersController.processSapBatch,
      requiredRoles: [], // Sem auth, usa secret
      auditAction: "sap.batch.processed"
    },
    // ========== SCANS ==========
    {
      method: "POST",
      path: "/api/v1/scans",
      handler: scansController.recordScan,
      requiredRoles: ["operador", "supervisor", "admin"],
      auditAction: "scan.recorded",
      idempotent: true
    },
    {
      method: "GET",
      path: "/api/v1/dashboard/orders",
      handler: dashboardController.listOrders,
      requiredRoles: ["supervisor", "comercial", "admin"],
      auditAction: "dashboard.orders.listed"
    },
    {
      method: "GET",
      path: "/api/v1/dashboard/tasks",
      handler: dashboardController.listTasks,
      requiredRoles: ["supervisor", "admin"],
      auditAction: "dashboard.tasks.listed"
    },
    {
      method: "GET",
      path: "/api/v1/dashboard/metrics",
      handler: dashboardController.getMetrics,
      requiredRoles: ["supervisor", "comercial", "admin"],
      auditAction: "dashboard.metrics.viewed"
    },
    {
      method: "POST",
      path: "/api/v1/integrations/webhooks",
      handler: integrationsController.registerWebhook,
      requiredRoles: ["comercial", "admin"],
      auditAction: "integrations.webhook.registered",
      idempotent: true
    },
    {
      method: "GET",
      path: "/api/v1/integrations/webhooks",
      handler: integrationsController.listWebhooks,
      requiredRoles: ["comercial", "admin"],
      auditAction: "integrations.webhook.listed"
    },
    {
      method: "DELETE",
      path: "/api/v1/integrations/webhooks/{webhookId}",
      handler: integrationsController.deleteWebhook,
      requiredRoles: ["comercial", "admin"],
      auditAction: "integrations.webhook.deleted"
    },
    {
      method: "POST",
      path: "/api/v1/integrations/events",
      handler: integrationsController.publishEvent,
      requiredRoles: ["supervisor", "comercial", "admin"],
      auditAction: "integrations.event.enqueued",
      idempotent: true
    }
  ];

  return routes.map((route) => wrapRoute(route, auditSink, idempotencyStore));
};
