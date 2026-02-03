import { createApiClient, randomId } from "./client";
import type {
  OrderHistoryResponse,
  OrderStatus,
  PostOrderEventRequest,
  PostOrderEventResult,
  Priority,
  UiOrder
} from "./types";
import {
  mockCarriers,
  mockGetOrder,
  mockGetOrderHistory,
  mockListOrders,
  mockPostOrderEvent,
  mockReprocess,
  type ListOrdersInput
} from "./mock";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
const USE_MOCK =
  (import.meta.env.VITE_USE_MOCK as string | undefined) === "true" || !BASE_URL;

const api = BASE_URL
  ? createApiClient({
      baseUrl: BASE_URL,
      defaultHeaders: {
        "X-Correlation-Id": randomId("corr_")
      }
    })
  : null;

export type OrdersFilters = {
  search?: string;
  carrier?: string;
  priority?: Priority;
  sla?: "ALL" | "LATE" | "DUE_SOON" | "OK";
};

export async function listOrders(input: OrdersFilters & { status?: OrderStatus }) {
  const params: ListOrdersInput = {
    status: input.status,
    search: input.search,
    carrier: input.carrier,
    priority: input.priority,
    sla: input.sla,
    limit: 200
  };

  if (USE_MOCK || !api) return mockListOrders(params);

  // Contrato atual suporta filtros por `status` e `externalOrderId` (MVP).
  // Aqui mantemos query params “extras” (carrier/priority/sla/search) para compatibilidade futura.
  return api.request<{ items: UiOrder[]; nextCursor: string | null }>("/orders", {
    method: "GET",
    query: {
      status: input.status,
      externalOrderId: input.search // melhor esforço; API pode ignorar
    }
  });
}

export async function getOrder(orderId: string): Promise<UiOrder> {
  if (USE_MOCK || !api) return mockGetOrder(orderId);
  return api.request<UiOrder>(`/orders/${encodeURIComponent(orderId)}`, {
    method: "GET"
  });
}

export async function getOrderHistory(orderId: string): Promise<OrderHistoryResponse> {
  if (USE_MOCK || !api) return mockGetOrderHistory(orderId);
  return api.request<OrderHistoryResponse>(
    `/orders/${encodeURIComponent(orderId)}/history`,
    { method: "GET" }
  );
}

export async function postOrderEvent(
  orderId: string,
  req: PostOrderEventRequest
): Promise<PostOrderEventResult> {
  const idem = randomId("idem_");
  if (USE_MOCK || !api) return mockPostOrderEvent(orderId, req, idem);

  return api.request<PostOrderEventResult>(
    `/orders/${encodeURIComponent(orderId)}/events`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": idem
      },
      body: req
    }
  );
}

export async function reprocessOrder(orderId: string) {
  if (USE_MOCK || !api) return mockReprocess(orderId);

  // Endpoint fora do contrato MVP. Mantemos como “best effort”.
  return api.request<{ ok: true }>(`/orders/${encodeURIComponent(orderId)}/reprocess`, {
    method: "POST"
  });
}

export async function listCarriers(): Promise<string[]> {
  if (USE_MOCK || !api) return mockCarriers();
  // Sem endpoint no contrato; em produção, tipicamente viria de um endpoint de catálogo.
  return [];
}

export function isUsingMock() {
  return USE_MOCK;
}

