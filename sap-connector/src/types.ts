export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type Logger = {
  debug?: (msg: string, meta?: Record<string, unknown>) => void;
  info?: (msg: string, meta?: Record<string, unknown>) => void;
  warn?: (msg: string, meta?: Record<string, unknown>) => void;
  error?: (msg: string, meta?: Record<string, unknown>) => void;
};

export type SapServiceLayerCredentials = {
  companyDb: string;
  username: string;
  password: string;
};

export type RetryPolicy = {
  maxAttempts: number; // inclui a tentativa inicial
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number; // 0..1
};

export type CircuitBreakerPolicy = {
  failureThreshold: number; // ex.: 5 falhas consecutivas
  successThreshold: number; // ex.: 2 sucessos para fechar
  openStateTimeoutMs: number; // ex.: 30s
};

export type RateLimitPolicy = {
  maxConcurrent: number; // limite de chamadas simultâneas
  maxRps: number; // limite de requests por segundo
};

export type SapServiceLayerClientOptions = {
  baseUrl: string; // ex.: https://sap:50000/b1s/v1
  credentials: SapServiceLayerCredentials;

  /**
   * Nome do header de correlação que será propagado.
   * O padrão do projeto (SPEC) é X-Correlation-Id.
   */
  correlationHeaderName?: string;

  /**
   * Logger opcional (padrão: silencioso).
   */
  logger?: Logger;

  /**
   * Políticas de resiliência.
   */
  retry?: Partial<RetryPolicy>;
  circuitBreaker?: Partial<CircuitBreakerPolicy>;
  rateLimit?: Partial<RateLimitPolicy>;

  /**
   * Timeout por request.
   */
  timeoutMs?: number;
};

export type SapRequestOptions = {
  correlationId?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

export type SapResponse<T> = {
  status: number;
  headers: Headers;
  data: T;
  requestId?: string;
};

// ========================================
// Tipos de entidades SAP B1 (Service Layer)
// ========================================

/**
 * Linha de documento (item do pedido).
 */
export type SapDocumentLine = {
  LineNum: number;
  ItemCode: string;
  ItemDescription?: string;
  Quantity: number;
  Price?: number;
  Currency?: string;
  WarehouseCode?: string;
  UoMCode?: string;
  LineStatus?: string;
  RemainingOpenQuantity?: number;
  // UDFs customizados (se houver)
  [key: string]: unknown;
};

/**
 * Pedido de venda (Orders / ORDR).
 */
export type SapOrder = {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName?: string;
  DocDate?: string;
  DocDueDate?: string;
  DocStatus?: string; // "O" = Open, "C" = Closed
  Cancelled?: string; // "Y" / "N"
  DocumentStatus?: string; // "bost_Open", "bost_Close", "bost_Paid"
  UpdateDate?: string;
  UpdateTime?: string;
  CreateDate?: string;
  CreateTime?: string;
  ShipToCode?: string;
  Address?: string;
  Address2?: string;
  Comments?: string;
  DocumentLines?: SapDocumentLine[];
  
  // UDFs customizados do WMS
  U_WMS_STATUS?: string;
  U_WMS_ORDERID?: string;
  U_WMS_LAST_EVENT?: string;
  U_WMS_LAST_TS?: string;
  U_WMS_CORR_ID?: string;
  
  // Outros campos podem ser expandidos conforme necessário
  [key: string]: unknown;
};

/**
 * Coleção de pedidos retornada pelo Service Layer.
 */
export type SapOrdersCollection = {
  "odata.metadata"?: string;
  value: SapOrder[];
  "odata.nextLink"?: string;
};

/**
 * Item do catálogo (Items / OITM).
 */
export type SapItem = {
  ItemCode: string;
  ItemName?: string;
  ItemType?: string;
  InventoryItem?: string; // "Y" / "N"
  SalesItem?: string; // "Y" / "N"
  PurchaseItem?: string; // "Y" / "N"
  InventoryUOM?: string;
  Valid?: string; // "Y" / "N"
  Frozen?: string; // "Y" / "N"
  UpdateDate?: string;
  UpdateTime?: string;
  [key: string]: unknown;
};

/**
 * Warehouse (depósito).
 */
export type SapWarehouse = {
  WarehouseCode: string;
  WarehouseName?: string;
  Inactive?: string; // "Y" / "N"
  [key: string]: unknown;
};

