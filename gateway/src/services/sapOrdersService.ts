import { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import type { SapOrder, SapOrdersCollection } from "../../../sap-connector/src/types.js";
import { CacheFactory } from "../utils/cache.js";

export type WmsOrderStatus =
  | "A_SEPARAR"
  | "EM_SEPARACAO"
  | "CONFERIDO"
  | "AGUARDANDO_COTACAO"
  | "AGUARDANDO_COLETA"
  | "DESPACHADO";

export type WmsOrderItem = {
  sku: string;
  quantity: number;
  description?: string;
  warehouse?: string;
};

export type WmsOrder = {
  orderId: string;
  externalOrderId: string;
  sapDocEntry: number;
  sapDocNum: number;
  customerId: string;
  customerName?: string;
  shipToAddress?: string;
  status: WmsOrderStatus;
  slaDueAt?: string;
  docTotal?: number;
  currency?: string;
  items: WmsOrderItem[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type ListOrdersFilters = {
  status?: string;
  limit?: number;
  docStatus?: string; // "O" = Open, "C" = Closed
};

export type UpdateOrderStatusRequest = {
  status: WmsOrderStatus;
  event?: string;
  correlationId?: string;
};

/**
 * Mapeia status do SAP (DocStatus/DocumentStatus) para status WMS.
 * Esta é uma lógica simplificada; ajuste conforme regras do negócio.
 */
function mapSapStatusToWms(sapOrder: SapOrder): WmsOrderStatus {
  // Se já tiver um UDF U_WMS_STATUS, usar ele
  if (sapOrder.U_WMS_STATUS) {
    return sapOrder.U_WMS_STATUS as WmsOrderStatus;
  }

  // Caso contrário, inferir do DocumentStatus (usar DocumentStatus ao invés de DocStatus)
  if (sapOrder.DocumentStatus === "bost_Open") {
    return "A_SEPARAR";
  }
  if (sapOrder.DocumentStatus === "bost_Close" || sapOrder.Cancelled === "Y") {
    return "DESPACHADO"; // ou outro status apropriado
  }

  return "A_SEPARAR";
}

/**
 * Mapeia um SapOrder para WmsOrder.
 */
function mapSapOrderToWms(sapOrder: SapOrder): WmsOrder {
  const items: WmsOrderItem[] = (sapOrder.DocumentLines ?? []).map((line) => ({
    sku: line.ItemCode,
    quantity: line.Quantity,
    description: line.ItemDescription,
    warehouse: line.WarehouseCode
  }));

  // Usar U_WMS_ORDERID se disponível, senão gerar um ID baseado em DocEntry
  const orderId = sapOrder.U_WMS_ORDERID || `SAP-${sapOrder.DocEntry}`;

  return {
    orderId,
    externalOrderId: String(sapOrder.DocNum),
    sapDocEntry: sapOrder.DocEntry,
    sapDocNum: sapOrder.DocNum,
    customerId: sapOrder.CardCode,
    customerName: sapOrder.CardName,
    shipToAddress: sapOrder.Address || sapOrder.Address2,
    status: mapSapStatusToWms(sapOrder),
    slaDueAt: sapOrder.DocDueDate ? `${sapOrder.DocDueDate}T00:00:00Z` : undefined,
    docTotal: sapOrder.DocTotal as number | undefined,
    currency: sapOrder.DocCurrency as string | undefined,
    items,
    createdAt: sapOrder.CreateDate
      ? `${sapOrder.CreateDate}T${sapOrder.CreateTime ?? "00:00:00"}Z`
      : new Date().toISOString(),
    updatedAt: sapOrder.UpdateDate
      ? `${sapOrder.UpdateDate}T${sapOrder.UpdateTime ?? "00:00:00"}Z`
      : new Date().toISOString(),
    metadata: {
      sapDocStatus: sapOrder.DocStatus,
      sapDocumentStatus: sapOrder.DocumentStatus,
      sapCancelled: sapOrder.Cancelled,
      sapComments: sapOrder.Comments
    }
  };
}

/**
 * Serviço para integração com pedidos SAP.
 */
export class SapOrdersService {
  private ordersCache = CacheFactory.getOrdersCache();
  private itemsCache = CacheFactory.getItemsCache();

  constructor(private readonly client: SapServiceLayerClient) {}

  /**
   * Testa a conexão com o SAP fazendo login.
   */
  async healthCheck(correlationId?: string): Promise<{ ok: boolean; message: string }> {
    try {
      await this.client.login(correlationId);
      return { ok: true, message: "Conexão com SAP OK" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      return { ok: false, message };
    }
  }

  /**
   * Lista pedidos do SAP com filtros opcionais.
   */
  async listOrders(
    filters: ListOrdersFilters = {},
    correlationId?: string
  ): Promise<WmsOrder[]> {
    const limit = filters.limit ?? 100;
    const docStatus = filters.docStatus ?? "O"; // Default: pedidos abertos

    // Cache key baseado nos filtros
    const cacheKey = `list:${JSON.stringify({ docStatus, status: filters.status, limit })}`;

    // Tentar obter do cache
    return this.ordersCache.getOrFetch(
      cacheKey,
      async () => {
        // Query mínima para máxima compatibilidade (evita campos que alguns SLs rejeitam com 400)
        let path =
          `/Orders?$select=` +
          [
            "DocEntry",
            "DocNum",
            "CardCode",
            "CardName",
            "DocDate",
            "DocDueDate",
            "DocStatus",
            "DocumentStatus",
            "DocTotal",
            "DocCurrency",
            "CreateDate",
            "UpdateDate",
            "Comments"
          ].join(",");

        // Expand mínimo (campos “seguros”)
        path += `&$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode)`;

        const filterParts: string[] = [];
        if (docStatus) {
          if (docStatus === "O") {
            // Mais compatível que DocumentStatus em alguns ambientes
            filterParts.push(`DocStatus eq 'O'`);
          } else if (docStatus === "C") {
            filterParts.push(`DocStatus eq 'C'`);
          }
        }
        // Nota: Filtro por status WMS (U_WMS_STATUS) desabilitado para compatibilidade
        // Em produção, habilite após criar os UDFs no SAP B1

        if (filterParts.length > 0) {
          path += `&$filter=${filterParts.join(" and ")}`;
        }

        path += `&$top=${limit}`;

        const response = await this.client.get<SapOrdersCollection>(path, { correlationId });

        return response.data.value.map(mapSapOrderToWms);
      },
      60 // TTL 1 minuto para lista de pedidos
    );
  }

  /**
   * Busca um pedido específico pelo DocEntry.
   */
  async getOrder(docEntry: number, correlationId?: string): Promise<WmsOrder> {
    const cacheKey = `order:${docEntry}`;

    return this.ordersCache.getOrFetch(
      cacheKey,
      async () => {
        // Query mínima para máxima compatibilidade
        const path =
          `/Orders(${docEntry})?$select=` +
          [
            "DocEntry",
            "DocNum",
            "CardCode",
            "CardName",
            "DocDate",
            "DocDueDate",
            "DocStatus",
            "DocumentStatus",
            "DocTotal",
            "DocCurrency",
            "CreateDate",
            "UpdateDate",
            "Comments"
          ].join(",") +
          `&$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode)`;

        const response = await this.client.get<SapOrder>(path, { correlationId });

        return mapSapOrderToWms(response.data);
      },
      300 // TTL 5 minutos para pedido individual
    );
  }

  /**
   * Atualiza o status do pedido no SAP (via UDF U_WMS_STATUS).
   */
  async updateOrderStatus(
    docEntry: number,
    request: UpdateOrderStatusRequest
  ): Promise<{ ok: boolean; message: string }> {
    const now = new Date().toISOString();

    const body = {
      U_WMS_STATUS: request.status,
      U_WMS_LAST_EVENT: request.event ?? request.status,
      U_WMS_LAST_TS: now,
      U_WMS_CORR_ID: request.correlationId
    };

    try {
      // PATCH /Orders(DocEntry) com os UDFs
      await this.client.patch(`/Orders(${docEntry})`, body, {
        correlationId: request.correlationId,
        // Idempotência: usar chave baseada em DocEntry + Status
        idempotencyKey: `SAP-ORDER-${docEntry}-${request.status}`
      });

      // Invalidar cache do pedido após atualização
      this.ordersCache.del(`order:${docEntry}`);
      
      // Invalidar cache de listas (pode conter este pedido)
      const listKeys = this.ordersCache.keys().filter(k => k.startsWith("list:"));
      if (listKeys.length > 0) {
        this.ordersCache.del(listKeys);
      }

      return { ok: true, message: `Status atualizado para ${request.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar status";
      return { ok: false, message };
    }
  }
}
