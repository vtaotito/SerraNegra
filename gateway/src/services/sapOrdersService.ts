import { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import type { SapOrder, SapOrdersCollection } from "../../../sap-connector/src/types.js";
import { SapHttpError } from "../../../sap-connector/src/errors.js";
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
        const baseSelect = [
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
        ];

        // Select essencial para sincronização (CardCode é obrigatório para customerId)
        const essentialSelect = [
          "DocEntry",
          "DocNum",
          "CardCode",
          "CardName",
          "DocDate",
          "DocDueDate",
          "DocStatus",
          "DocumentStatus",
          "DocTotal",
          "DocCurrency"
        ];

        const minimalSelect = ["DocEntry", "DocNum", "CardCode", "CardName"];
        const bareMinSelect = ["DocEntry", "DocNum"];

        const baseExpand =
          `DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode)`;
        const simpleExpand = `DocumentLines($select=ItemCode,Quantity)`;

        const docStatusFilter =
          docStatus === "O"
            ? `DocStatus eq 'O'`
            : docStatus === "C"
              ? `DocStatus eq 'C'`
              : undefined;

        const documentStatusFilter =
          docStatus === "O"
            ? `DocumentStatus eq 'bost_Open'`
            : docStatus === "C"
              ? `DocumentStatus eq 'bost_Close'`
              : undefined;

        function buildPath(args: {
          select: string[];
          top: number;
          expand?: string;
          filter?: string;
        }): string {
          const selectQuery = `$select=${args.select.join(",")}`;
          const expandQuery = args.expand ? `&$expand=${args.expand}` : "";
          const filterQuery = args.filter ? `&$filter=${args.filter}` : "";
          const topQuery = `&$top=${args.top}`;
          return `/Orders?${selectQuery}${expandQuery}${filterQuery}${topQuery}`;
        }

        const candidates: string[] = [];

        // 1. Ideal: select completo + expand detalhado + filtro DocStatus
        if (docStatusFilter) {
          candidates.push(buildPath({ select: baseSelect, top: limit, expand: baseExpand, filter: docStatusFilter }));
        }
        // 2. select completo + expand detalhado + filtro DocumentStatus
        if (documentStatusFilter) {
          candidates.push(buildPath({ select: baseSelect, top: limit, expand: baseExpand, filter: documentStatusFilter }));
        }
        // 3. select completo + expand simples + filtro
        if (docStatusFilter) {
          candidates.push(buildPath({ select: baseSelect, top: limit, expand: simpleExpand, filter: docStatusFilter }));
        }
        // 4. select completo sem expand + filtro DocStatus
        if (docStatusFilter) {
          candidates.push(buildPath({ select: baseSelect, top: limit, filter: docStatusFilter }));
        }
        // 5. select completo sem expand + filtro DocumentStatus
        if (documentStatusFilter) {
          candidates.push(buildPath({ select: baseSelect, top: limit, filter: documentStatusFilter }));
        }
        // 6. select essencial + expand + sem filtro
        candidates.push(buildPath({ select: essentialSelect, top: limit, expand: baseExpand }));
        // 7. select essencial sem expand, sem filtro
        candidates.push(buildPath({ select: essentialSelect, top: limit }));
        // 8. select mínimo com CardCode + sem filtro
        candidates.push(buildPath({ select: minimalSelect, top: limit }));
        // 9. Último recurso: bare minimum
        candidates.push(buildPath({ select: bareMinSelect, top: limit }));

        let lastError: unknown;
        for (let i = 0; i < candidates.length; i++) {
          const path = candidates[i];
          try {
            const response = await this.client.get<SapOrdersCollection>(path, { correlationId });
            const orders = response.data.value || [];
            console.log(`[listOrders] Candidato #${i + 1}/${candidates.length} OK - ${orders.length} pedidos. Path: ${path.substring(0, 120)}`);
            const mapped = orders.map(mapSapOrderToWms);
            // Verificar se os dados são ricos o suficiente
            const hasCustomerId = mapped.some(o => o.customerId && o.customerId !== "");
            const hasItems = mapped.some(o => o.items.length > 0);
            console.log(`[listOrders] Dados: hasCustomerId=${hasCustomerId}, hasItems=${hasItems}`);
            return mapped;
          } catch (err: unknown) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);
            console.log(`[listOrders] Candidato #${i + 1}/${candidates.length} FALHOU (${err instanceof SapHttpError ? err.status : 'unknown'}): ${errMsg.substring(0, 200)}`);
            // Em 400, tentamos a próxima variação (compatibilidade entre SLs)
            if (err instanceof SapHttpError && err.status === 400) continue;
            throw err;
          }
        }

        throw lastError instanceof Error ? lastError : new Error("Erro ao listar pedidos no SAP.");
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
        const select = [
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

        const allowExpandLines = process.env.SAP_B1_ENABLE_LINES_EXPAND === "true";
        const expand =
          `DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode)`;

        const candidates = [
          `/Orders(${docEntry})?$select=${select}`,
          `/Orders(${docEntry})?$select=DocEntry,DocNum`
        ];
        if (allowExpandLines) {
          candidates.unshift(`/Orders(${docEntry})?$select=${select}&$expand=${expand}`);
        }

        let lastError: unknown;
        for (const path of candidates) {
          try {
            const response = await this.client.get<SapOrder>(path, { correlationId });
            return mapSapOrderToWms(response.data);
          } catch (err: unknown) {
            lastError = err;
            if (err instanceof SapHttpError && err.status === 400) continue;
            throw err;
          }
        }

        throw lastError instanceof Error ? lastError : new Error("Erro ao buscar pedido no SAP.");
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
