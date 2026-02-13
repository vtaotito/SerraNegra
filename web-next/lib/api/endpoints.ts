export const API_ENDPOINTS = {
  // Orders
  ORDERS: "/orders",
  ORDER_BY_ID: (id: string) => `/orders/${id}`,
  ORDER_HISTORY: (id: string) => `/orders/${id}/history`,
  ORDER_EVENTS: (id: string) => `/orders/${id}/events`,

  // Products / Catalog Items
  CATALOG_ITEMS: "/v1/catalog/items",
  CATALOG_ITEM_BY_CODE: (code: string) => `/v1/catalog/items/${code}`,

  // Warehouses
  CATALOG_WAREHOUSES: "/v1/catalog/warehouses",
  CATALOG_WAREHOUSE_BY_CODE: (code: string) => `/v1/catalog/warehouses/${code}`,

  // Inventory
  INVENTORY: "/v1/inventory",
  INVENTORY_BY_ITEM_AND_WAREHOUSE: (itemCode: string, warehouseCode: string) =>
    `/v1/inventory/${itemCode}/${warehouseCode}`,

  // Customers
  CUSTOMERS: "/v1/customers",
  CUSTOMER_BY_ID: (id: string) => `/v1/customers/${id}`,
  CUSTOMER_PRICING: (cardCode: string) => `/v1/customers/${cardCode}/pricing`,
  CUSTOMER_PRICING_ITEM: (cardCode: string, sku: string) =>
    `/v1/customers/${cardCode}/pricing/${encodeURIComponent(sku)}`,

  // Health
  HEALTH: "/health",

  // SAP Integration
  SAP_HEALTH: "/sap/health",
  SAP_ORDERS: "/sap/orders",
  SAP_ORDER_BY_DOC_ENTRY: (docEntry: number | string) =>
    `/sap/orders/${docEntry}`,
  SAP_ORDER_STATUS: (docEntry: number | string) =>
    `/sap/orders/${docEntry}/status`,
  SAP_SYNC: "/sap/sync",
  SAP_SYNC_ALL: "/sap/sync/all",
  SAP_SYNC_PRODUCTS: "/sap/sync/products",
  SAP_SYNC_INVENTORY: "/sap/sync/inventory",
  SAP_SYNC_CUSTOMERS: "/sap/sync/customers",
  SAP_SYNC_STATUS: "/sap/sync/status",
  SAP_CONFIG: "/sap/config",
  SAP_CONFIG_TEST: "/sap/config/test",
  SAP_SESSION_REFRESH: "/sap/session/refresh",
  SAP_CACHE_STATS: "/sap/cache/stats",
  SAP_CACHE: "/sap/cache",
} as const;
