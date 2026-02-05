export const API_ENDPOINTS = {
  // Orders
  ORDERS: "/orders",
  ORDER_BY_ID: (id: string) => `/orders/${id}`,
  ORDER_HISTORY: (id: string) => `/orders/${id}/history`,
  ORDER_EVENTS: (id: string) => `/orders/${id}/events`,

  // Products / Catalog Items
  CATALOG_ITEMS: "/api/v1/catalog/items",
  CATALOG_ITEM_BY_CODE: (code: string) => `/api/v1/catalog/items/${code}`,

  // Warehouses
  CATALOG_WAREHOUSES: "/api/v1/catalog/warehouses",
  CATALOG_WAREHOUSE_BY_CODE: (code: string) => `/api/v1/catalog/warehouses/${code}`,

  // Inventory
  INVENTORY: "/api/v1/inventory",
  INVENTORY_BY_ITEM_AND_WAREHOUSE: (itemCode: string, warehouseCode: string) =>
    `/api/v1/inventory/${itemCode}/${warehouseCode}`,

  // Shipments
  SHIPMENTS: "/api/v1/shipments",
  SHIPMENT_BY_ID: (id: string) => `/api/v1/shipments/${id}`,

  // Customers
  CUSTOMERS: "/api/v1/customers",
  CUSTOMER_BY_ID: (id: string) => `/api/v1/customers/${id}`,

  // Dashboard
  DASHBOARD_ORDERS: "/api/v1/dashboard/orders",
  DASHBOARD_TASKS: "/api/v1/dashboard/tasks",
  DASHBOARD_METRICS: "/api/v1/dashboard/metrics",

  // Scans
  SCANS: "/api/v1/scans",

  // Health
  HEALTH: "/health",
} as const;
