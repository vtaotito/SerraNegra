import type { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import type { SapOrder, SapOrdersCollection } from "../../../sap-connector/src/types.js";

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

  // Caso contrário, inferir do DocStatus
  if (sapOrder.DocStatus === "O") {
    return "A_SEPARAR";
  }
  if (sapOrder.DocStatus === "C" || sapOrder.Cancelled === "Y") {
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

    // Monta query OData
    // Exemplo: $select=DocEntry,DocNum,CardCode,CardName,DocStatus,UpdateDate,UpdateTime
    //          &$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode)
    //          &$filter=DocStatus eq 'O'
    //          &$top=100
    let path = `/Orders?$select=DocEntry,DocNum,CardCode,CardName,DocStatus,DocumentStatus,Cancelled,DocDate,DocDueDate,DocTotal,DocCurrency,CreateDate,CreateTime,UpdateDate,UpdateTime,Address,Address2,Comments,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID`;
    path += `&$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode,UoMCode,Price,Currency)`;

    const filterParts: string[] = [];
    if (docStatus) {
      filterParts.push(`DocStatus eq '${docStatus}'`);
    }
    if (filters.status && filters.status !== "ALL") {
      // Se o filtro for por status WMS, buscar pelo UDF
      filterParts.push(`U_WMS_STATUS eq '${filters.status}'`);
    }

    if (filterParts.length > 0) {
      path += `&$filter=${filterParts.join(" and ")}`;
    }

    path += `&$top=${limit}`;

    const response = await this.client.get<SapOrdersCollection>(path, { correlationId });

    return response.data.value.map(mapSapOrderToWms);
  }

  /**
   * Busca um pedido específico pelo DocEntry.
   */
  async getOrder(docEntry: number, correlationId?: string): Promise<WmsOrder> {
    const path = `/Orders(${docEntry})?$select=DocEntry,DocNum,CardCode,CardName,DocStatus,DocumentStatus,Cancelled,DocDate,DocDueDate,DocTotal,DocCurrency,CreateDate,CreateTime,UpdateDate,UpdateTime,Address,Address2,Comments,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID&$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode,UoMCode,Price,Currency)`;

    const response = await this.client.get<SapOrder>(path, { correlationId });

    return mapSapOrderToWms(response.data);
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

      return { ok: true, message: `Status atualizado para ${request.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar status";
      return { ok: false, message };
    }
  }
}
