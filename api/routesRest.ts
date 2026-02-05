import { createDashboardController, DashboardService } from "./controllers/dashboardController.js";
import { createIntegrationsController, IntegrationService } from "./controllers/integrationsController.js";
import { createScansController, ScanService } from "./controllers/scansController.js";
import { createCatalogController, CatalogService } from "./controllers/catalogController.js";
import { createInventoryController, InventoryService } from "./controllers/inventoryController.js";
import { createOrdersController, OrdersService } from "./controllers/ordersController.js";
import { createShipmentsController, ShipmentsService } from "./controllers/shipmentsController.js";
import { createCustomersController, CustomersService } from "./controllers/customersController.js";
import { ApiHandler, ApiRole, HttpMethod } from "./http.js";
import { createJwtAuthenticationMiddleware } from "./middleware/authentication.js";
import { createAuthorizationMiddleware } from "./middleware/authorization.js";
import { createAuditMiddleware, createConsoleAuditSink, AuditSink } from "./middleware/audit.js";
import { withErrorHandling } from "./middleware/errorHandler.js";
import { createInMemoryIdempotencyStore, createIdempotencyMiddleware, IdempotencyStore } from "./middleware/idempotency.js";
import { createVersioningMiddleware } from "./middleware/versioning.js";
import { composeMiddlewares } from "./http.js";
import { JwtConfig } from "./auth/jwt.js";
import { createApiObservabilityMiddleware } from "../observability/apiMiddleware.js";
import { createLogger } from "../observability/logger.js";

const apiLogger = createLogger({ name: process.env.OTEL_SERVICE_NAME ?? "wms-api" });

export type RestRouteDefinition = {
  method: HttpMethod;
  path: string;
  handler: ApiHandler<any, any, any>;
  requiredRoles: ApiRole[];
  auditAction: string;
  idempotent?: boolean;
};

export type RestApiDependencies = {
  scansService: ScanService;
  dashboardService: DashboardService;
  integrationsService: IntegrationService;
  catalogService: CatalogService;
  inventoryService: InventoryService;
  ordersService: OrdersService;
  shipmentsService: ShipmentsService;
  customersService: CustomersService;
  auditSink?: AuditSink;
  idempotencyStore?: IdempotencyStore;
  jwtConfig: JwtConfig;
};

const wrapRoute = (
  route: RestRouteDefinition,
  auditSink: AuditSink,
  idempotencyStore: IdempotencyStore,
  jwtConfig: JwtConfig
): RestRouteDefinition => {
  const handlerWithIdempotency = route.idempotent
    ? createIdempotencyMiddleware(route.handler, idempotencyStore)
    : route.handler;
  const middlewares = [
    createApiObservabilityMiddleware({ logger: apiLogger }),
    withErrorHandling(),
    createVersioningMiddleware(),
    createJwtAuthenticationMiddleware(jwtConfig),
    createAuthorizationMiddleware(route.requiredRoles),
    createAuditMiddleware(route.auditAction, auditSink)
  ];
  const handler = composeMiddlewares(middlewares, handlerWithIdempotency);
  return { ...route, handler };
};

export const buildRestRoutes = (deps: RestApiDependencies): RestRouteDefinition[] => {
  const scansController = createScansController(deps.scansService);
  const dashboardController = createDashboardController(deps.dashboardService);
  const integrationsController = createIntegrationsController(deps.integrationsService);
  const catalogController = createCatalogController(deps.catalogService);
  const inventoryController = createInventoryController(deps.inventoryService);
  const ordersController = createOrdersController(deps.ordersService);
  const shipmentsController = createShipmentsController(deps.shipmentsService);
  const customersController = createCustomersController(deps.customersService);

  const auditSink = deps.auditSink ?? createConsoleAuditSink();
  const idempotencyStore = deps.idempotencyStore ?? createInMemoryIdempotencyStore();

  const routes: RestRouteDefinition[] = [
    // Scans (Coletor)
    {
      method: "POST",
      path: "/api/v1/scans",
      handler: scansController.recordScan,
      requiredRoles: ["operador", "supervisor", "admin"],
      auditAction: "scan.recorded",
      idempotent: true
    },

    // Dashboard
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

    // Integrations
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
    },

    // Catalog - Items
    {
      method: "GET",
      path: "/api/v1/catalog/items",
      handler: catalogController.listItems,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "catalog.items.listed"
    },
    {
      method: "GET",
      path: "/api/v1/catalog/items/{itemCode}",
      handler: catalogController.getItem,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "catalog.item.viewed"
    },
    {
      method: "POST",
      path: "/api/v1/catalog/items",
      handler: catalogController.createItem,
      requiredRoles: ["comercial", "admin"],
      auditAction: "catalog.item.created",
      idempotent: true
    },
    {
      method: "PUT",
      path: "/api/v1/catalog/items/{itemCode}",
      handler: catalogController.updateItem,
      requiredRoles: ["comercial", "admin"],
      auditAction: "catalog.item.updated"
    },
    {
      method: "DELETE",
      path: "/api/v1/catalog/items/{itemCode}",
      handler: catalogController.deleteItem,
      requiredRoles: ["admin"],
      auditAction: "catalog.item.deleted"
    },

    // Catalog - Warehouses
    {
      method: "GET",
      path: "/api/v1/catalog/warehouses",
      handler: catalogController.listWarehouses,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "catalog.warehouses.listed"
    },
    {
      method: "GET",
      path: "/api/v1/catalog/warehouses/{warehouseCode}",
      handler: catalogController.getWarehouse,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "catalog.warehouse.viewed"
    },
    {
      method: "POST",
      path: "/api/v1/catalog/warehouses",
      handler: catalogController.createWarehouse,
      requiredRoles: ["admin"],
      auditAction: "catalog.warehouse.created",
      idempotent: true
    },
    {
      method: "PUT",
      path: "/api/v1/catalog/warehouses/{warehouseCode}",
      handler: catalogController.updateWarehouse,
      requiredRoles: ["admin"],
      auditAction: "catalog.warehouse.updated"
    },
    {
      method: "DELETE",
      path: "/api/v1/catalog/warehouses/{warehouseCode}",
      handler: catalogController.deleteWarehouse,
      requiredRoles: ["admin"],
      auditAction: "catalog.warehouse.deleted"
    },

    // Inventory
    {
      method: "GET",
      path: "/api/v1/inventory",
      handler: inventoryController.listInventory,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "inventory.listed"
    },
    {
      method: "GET",
      path: "/api/v1/inventory/{itemCode}/{warehouseCode}",
      handler: inventoryController.getInventory,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "inventory.viewed"
    },
    {
      method: "POST",
      path: "/api/v1/inventory/adjustments",
      handler: inventoryController.adjustInventory,
      requiredRoles: ["supervisor", "admin"],
      auditAction: "inventory.adjusted",
      idempotent: true
    },
    {
      method: "POST",
      path: "/api/v1/inventory/transfers",
      handler: inventoryController.transferInventory,
      requiredRoles: ["supervisor", "admin"],
      auditAction: "inventory.transferred",
      idempotent: true
    },

    // Orders
    {
      method: "GET",
      path: "/api/v1/orders",
      handler: ordersController.listOrders,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "orders.listed"
    },
    {
      method: "GET",
      path: "/api/v1/orders/{orderId}",
      handler: ordersController.getOrder,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "order.viewed"
    },
    {
      method: "POST",
      path: "/api/v1/orders",
      handler: ordersController.createOrder,
      requiredRoles: ["comercial", "supervisor", "admin"],
      auditAction: "order.created",
      idempotent: true
    },
    {
      method: "PUT",
      path: "/api/v1/orders/{orderId}",
      handler: ordersController.updateOrder,
      requiredRoles: ["comercial", "supervisor", "admin"],
      auditAction: "order.updated"
    },
    {
      method: "DELETE",
      path: "/api/v1/orders/{orderId}",
      handler: ordersController.deleteOrder,
      requiredRoles: ["admin"],
      auditAction: "order.deleted"
    },

    // Shipments
    {
      method: "GET",
      path: "/api/v1/shipments",
      handler: shipmentsController.listShipments,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "shipments.listed"
    },
    {
      method: "GET",
      path: "/api/v1/shipments/{shipmentId}",
      handler: shipmentsController.getShipment,
      requiredRoles: ["operador", "supervisor", "comercial", "admin"],
      auditAction: "shipment.viewed"
    },
    {
      method: "POST",
      path: "/api/v1/shipments",
      handler: shipmentsController.createShipment,
      requiredRoles: ["supervisor", "admin"],
      auditAction: "shipment.created",
      idempotent: true
    },
    {
      method: "PUT",
      path: "/api/v1/shipments/{shipmentId}",
      handler: shipmentsController.updateShipment,
      requiredRoles: ["supervisor", "admin"],
      auditAction: "shipment.updated"
    },
    {
      method: "DELETE",
      path: "/api/v1/shipments/{shipmentId}",
      handler: shipmentsController.deleteShipment,
      requiredRoles: ["admin"],
      auditAction: "shipment.deleted"
    },

    // Customers
    {
      method: "GET",
      path: "/api/v1/customers",
      handler: customersController.listCustomers,
      requiredRoles: ["comercial", "supervisor", "admin"],
      auditAction: "customers.listed"
    },
    {
      method: "GET",
      path: "/api/v1/customers/{customerId}",
      handler: customersController.getCustomer,
      requiredRoles: ["comercial", "supervisor", "admin"],
      auditAction: "customer.viewed"
    },
    {
      method: "POST",
      path: "/api/v1/customers",
      handler: customersController.createCustomer,
      requiredRoles: ["comercial", "admin"],
      auditAction: "customer.created",
      idempotent: true
    },
    {
      method: "PUT",
      path: "/api/v1/customers/{customerId}",
      handler: customersController.updateCustomer,
      requiredRoles: ["comercial", "admin"],
      auditAction: "customer.updated"
    },
    {
      method: "DELETE",
      path: "/api/v1/customers/{customerId}",
      handler: customersController.deleteCustomer,
      requiredRoles: ["admin"],
      auditAction: "customer.deleted"
    }
  ];

  return routes.map((route) => wrapRoute(route, auditSink, idempotencyStore, deps.jwtConfig));
};
