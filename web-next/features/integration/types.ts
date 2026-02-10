// Tipos para integração SAP B1

export interface SapConfig {
  baseUrl: string;
  companyDb: string;
  username: string;
  password?: string; // Opcional ao exibir
}

export interface SapHealthResponse {
  status: "ok" | "error";
  sap_connected: boolean;
  session_valid?: boolean;
  response_time_ms?: number;
  error?: string;
  timestamp: string;
}

export interface SapSyncStatus {
  last_sync_date: string | null;
  last_sync_count: number;
  last_sync_status: "SUCCESS" | "FAILED" | "PENDING" | null;
  sap_open_orders: number;
  next_sync_estimate: string;
  error?: string;
}

export interface SapSyncHistoryItem {
  id: string;
  sync_date: string;
  status: "SUCCESS" | "FAILED";
  synced_count: number;
  error_message?: string;
  duration_ms: number;
}

export interface SapConfigTestResponse {
  success: boolean;
  message: string;
  connection_time_ms?: number;
  session_id?: string;
  error?: string;
}

/**
 * Pedido SAP mapeado pelo gateway (formato WmsOrder).
 * O gateway retorna os campos já traduzidos para o WMS.
 */
export interface SapOrder {
  orderId: string;
  externalOrderId: string;
  sapDocEntry: number;
  sapDocNum: number;
  customerId: string;
  customerName?: string;
  shipToAddress?: string;
  status: string;
  slaDueAt?: string;
  docTotal?: number;
  currency?: string;
  items: SapOrderItem[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SapOrderItem {
  sku: string;
  quantity: number;
  description?: string;
  warehouse?: string;
  price?: number;
  lineTotal?: number;
  measureUnit?: string;
  lineStatus?: string;
  lineNum?: number;
}

/**
 * Resposta da API GET /sap/orders
 */
export interface SapOrdersResponse {
  items: SapOrder[];
  count: number;
  timestamp: string;
}

export interface SapSyncRequest {
  force?: boolean; // Força re-sync completo
  docEntries?: number[]; // Sincronizar pedidos específicos
}

export interface SapSyncResponse {
  success: boolean;
  message: string;
  synced_count: number;
  errors: string[];
  duration_ms: number;
}

/**
 * Cache stats do gateway
 */
export interface SapCacheStats {
  orders_cache_size?: number;
  items_cache_size?: number;
  hit_rate?: number;
  [key: string]: unknown;
}

/**
 * Controle de sincronização (sync_control table)
 * Nota: não há endpoint REST para isso ainda, usando dados derivados
 */
export interface SyncEntityStatus {
  entityType: "ORDERS" | "PRODUCTS" | "CUSTOMERS" | "STOCK";
  label: string;
  icon: string;
  syncIntervalMinutes: number;
  isEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: "SUCCESS" | "FAILED" | "PENDING" | null;
  totalSynced: number;
  errorCount: number;
  description: string;
}
