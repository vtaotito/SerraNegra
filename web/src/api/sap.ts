/**
 * API de integração com SAP Business One via Gateway
 */
import { createApiClient, randomId } from "./client";
import type { UiOrder, OrderItem } from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
const USE_MOCK = (import.meta.env.VITE_USE_MOCK as string | undefined) === "true" || !BASE_URL;

const api = BASE_URL
  ? createApiClient({
      baseUrl: BASE_URL,
      defaultHeaders: {
        "X-Correlation-Id": randomId("corr_")
      }
    })
  : null;

/**
 * Tipos do SAP
 */
export type SapDocumentLine = {
  LineNum: number;
  ItemCode: string;
  ItemDescription?: string;
  Quantity: number;
  WarehouseCode?: string;
  Price?: number;
  UnitPrice?: number;
  LineTotal?: number;
};

export type SapOrder = {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName?: string;
  DocDate?: string;
  DocDueDate?: string;
  DocStatus?: string;
  DocumentStatus?: string;
  DocTotal?: number;
  DocCurrency?: string;
  Comments?: string;
  CreateDate?: string;
  CreateTime?: string;
  UpdateDate?: string;
  UpdateTime?: string;
  U_WMS_STATUS?: string;
  U_WMS_ORDERID?: string;
  U_WMS_LAST_EVENT?: string;
  U_WMS_LAST_TS?: string;
  U_WMS_CORR_ID?: string;
  DocumentLines?: SapDocumentLine[];
};

export type SapHealthResponse = {
  ok: boolean;
  message: string;
  timestamp: string;
};

export type SapOrdersResponse = {
  orders: SapOrder[];
  count: number;
  timestamp: string;
};

export type SapOrderResponse = {
  order: SapOrder;
  timestamp: string;
};

export type SapOrdersFilter = {
  status?: "open" | "closed" | "all";
  cardCode?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  skip?: number;
};

/**
 * Testa a conexão com o SAP
 */
export async function testSapConnection(): Promise<SapHealthResponse> {
  if (USE_MOCK || !api) {
    return {
      ok: true,
      message: "Conexão com SAP OK (MOCK)",
      timestamp: new Date().toISOString()
    };
  }

  return api.request<SapHealthResponse>("/api/sap/health", {
    method: "GET"
  });
}

/**
 * Busca pedidos do SAP
 */
export async function getSapOrders(filter: SapOrdersFilter = {}): Promise<SapOrdersResponse> {
  if (USE_MOCK || !api) {
    return {
      orders: [],
      count: 0,
      timestamp: new Date().toISOString()
    };
  }

  return api.request<SapOrdersResponse>("/api/sap/orders", {
    method: "GET",
    query: filter as any
  });
}

/**
 * Busca um pedido específico do SAP
 */
export async function getSapOrder(docEntry: number): Promise<SapOrderResponse> {
  if (USE_MOCK || !api) {
    throw new Error("Pedido não encontrado (MOCK)");
  }

  return api.request<SapOrderResponse>(`/api/sap/orders/${docEntry}`, {
    method: "GET"
  });
}

/**
 * Atualiza o status WMS de um pedido no SAP
 */
export async function updateSapOrderStatus(
  docEntry: number,
  status: string,
  orderId?: string,
  lastEvent?: string
): Promise<{ ok: boolean; message: string }> {
  if (USE_MOCK || !api) {
    return {
      ok: true,
      message: "Status atualizado com sucesso (MOCK)"
    };
  }

  return api.request<{ ok: boolean; message: string }>(
    `/api/sap/orders/${docEntry}/status`,
    {
      method: "PATCH",
      body: {
        status,
        orderId,
        lastEvent
      }
    }
  );
}

/**
 * Converte um pedido SAP para o formato do WMS
 */
export function sapOrderToUiOrder(sapOrder: SapOrder): UiOrder {
  const items: OrderItem[] = (sapOrder.DocumentLines || []).map((line) => ({
    sku: line.ItemCode,
    quantity: line.Quantity
  }));

  // Status padrão: se já tem U_WMS_STATUS, usa; senão, inicia como A_SEPARAR
  const status = sapOrder.U_WMS_STATUS || "A_SEPARAR";

  return {
    orderId: sapOrder.U_WMS_ORDERID || `SAP-${sapOrder.DocEntry}`,
    externalOrderId: String(sapOrder.DocNum),
    sapDocEntry: sapOrder.DocEntry,
    sapDocNum: sapOrder.DocNum,
    customerId: sapOrder.CardCode,
    customerName: sapOrder.CardName,
    shipToAddress: null,
    status: status as any,
    carrier: null,
    priority: null,
    slaDueAt: sapOrder.DocDueDate || null,
    items,
    createdAt: sapOrder.CreateDate || new Date().toISOString(),
    updatedAt: sapOrder.UpdateDate || new Date().toISOString(),
    metadata: {
      sapDocTotal: sapOrder.DocTotal,
      sapDocCurrency: sapOrder.DocCurrency,
      sapComments: sapOrder.Comments,
      sapDocStatus: sapOrder.DocumentStatus
    }
  };
}

/**
 * Importa pedidos do SAP para o WMS
 * (Busca do SAP e converte para o formato WMS)
 */
export async function importSapOrders(filter: SapOrdersFilter = {}): Promise<UiOrder[]> {
  const response = await getSapOrders(filter);
  return response.orders.map(sapOrderToUiOrder);
}
