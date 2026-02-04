import { createApiClient, randomId } from "./client";
import type { UiOrder, OrderStatus, Priority } from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

const api = BASE_URL
  ? createApiClient({
      baseUrl: BASE_URL,
      defaultHeaders: {
        "X-Correlation-Id": randomId("corr_")
      }
    })
  : null;

/**
 * Tipos específicos para integração SAP
 */
export type SapHealthResponse = {
  status: "ok" | "error";
  message: string;
  timestamp: string;
  details?: string;
  correlationId?: string;
};

export type SapOrdersResponse = {
  items: Array<{
    orderId: string;
    externalOrderId: string;
    sapDocEntry: number;
    sapDocNum: number;
    customerId: string;
    customerName?: string;
    shipToAddress?: string;
    status: OrderStatus;
    slaDueAt?: string;
    docTotal?: number;
    currency?: string;
    items: Array<{
      sku: string;
      quantity: number;
      description?: string;
      warehouse?: string;
    }>;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  }>;
  count: number;
  timestamp: string;
};

export type SapUpdateStatusRequest = {
  status: OrderStatus;
  event?: string;
};

export type SapUpdateStatusResponse = {
  ok: boolean;
  message: string;
  docEntry: number;
  status: string;
  timestamp: string;
  correlationId?: string;
};

/**
 * Testa a conexão com o SAP.
 */
export async function sapHealthCheck(): Promise<SapHealthResponse> {
  if (!api) {
    return {
      status: "error",
      message: "API não configurada. Configure VITE_API_BASE_URL.",
      timestamp: new Date().toISOString()
    };
  }

  return api.request<SapHealthResponse>("/api/sap/health", {
    method: "GET"
  });
}

/**
 * Lista pedidos do SAP.
 * 
 * @param filters - Filtros opcionais
 * @param filters.status - Filtro por status WMS (ex: "A_SEPARAR", "EM_SEPARACAO")
 * @param filters.limit - Limite de resultados (default: 100)
 * @param filters.docStatus - Filtro por status SAP ("O" = Open, "C" = Closed)
 */
export async function listSapOrders(filters?: {
  status?: OrderStatus;
  limit?: number;
  docStatus?: string;
}): Promise<UiOrder[]> {
  if (!api) {
    console.warn("API não configurada. Retornando lista vazia.");
    return [];
  }

  const query: Record<string, string> = {};
  if (filters?.status) query.status = filters.status;
  if (filters?.limit) query.limit = String(filters.limit);
  if (filters?.docStatus) query.docStatus = filters.docStatus;

  const response = await api.request<SapOrdersResponse>("/api/sap/orders", {
    method: "GET",
    query
  });

  // Converter para UiOrder
  return response.items.map((item) => ({
    orderId: item.orderId,
    externalOrderId: item.externalOrderId,
    sapDocEntry: item.sapDocEntry,
    sapDocNum: item.sapDocNum,
    customerId: item.customerId,
    customerName: item.customerName,
    shipToAddress: item.shipToAddress,
    status: item.status,
    carrier: null,
    priority: null,
    slaDueAt: item.slaDueAt || null,
    docTotal: item.docTotal || null,
    currency: item.currency || null,
    items: item.items.map((i) => ({
      sku: i.sku,
      quantity: i.quantity
    })),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    metadata: item.metadata
  }));
}

/**
 * Busca um pedido específico do SAP pelo DocEntry.
 */
export async function getSapOrder(docEntry: number): Promise<UiOrder> {
  if (!api) {
    throw new Error("API não configurada");
  }

  const response = await api.request<SapOrdersResponse["items"][0]>(
    `/api/sap/orders/${docEntry}`,
    {
      method: "GET"
    }
  );

  return {
    orderId: response.orderId,
    externalOrderId: response.externalOrderId,
    sapDocEntry: response.sapDocEntry,
    sapDocNum: response.sapDocNum,
    customerId: response.customerId,
    customerName: response.customerName,
    shipToAddress: response.shipToAddress,
    status: response.status,
    carrier: null,
    priority: null,
    slaDueAt: response.slaDueAt || null,
    docTotal: response.docTotal || null,
    currency: response.currency || null,
    items: response.items.map((i) => ({
      sku: i.sku,
      quantity: i.quantity
    })),
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    metadata: response.metadata
  };
}

/**
 * Atualiza o status de um pedido no SAP.
 */
export async function updateSapOrderStatus(
  docEntry: number,
  request: SapUpdateStatusRequest
): Promise<SapUpdateStatusResponse> {
  if (!api) {
    throw new Error("API não configurada");
  }

  return api.request<SapUpdateStatusResponse>(
    `/api/sap/orders/${docEntry}/status`,
    {
      method: "PATCH",
      body: request
    }
  );
}

/**
 * Dispara sincronização de pedidos do SAP para o WMS.
 * O backend importa pedidos abertos do SAP e os cria no WMS Core.
 */
export async function syncSapOrders(): Promise<{
  ok: boolean;
  message: string;
  imported: number;
  timestamp: string;
}> {
  if (!api) {
    throw new Error("API não configurada");
  }

  return api.request<{
    ok: boolean;
    message: string;
    imported: number;
    timestamp: string;
  }>("/api/sap/sync", {
    method: "POST"
  });
}

/**
 * Verifica se a API SAP está configurada.
 */
export function isSapApiConfigured(): boolean {
  return Boolean(api && BASE_URL);
}
