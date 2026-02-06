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

export interface SapOrder {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName: string;
  DocDate: string;
  DocDueDate: string;
  DocTotal: number;
  DocumentStatus: string;
  U_WMS_STATUS?: string;
  U_WMS_ORDER_ID?: string;
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
