/**
 * Serviço de integração SAP para o Gateway
 * Wrapper sobre o sap-connector com lógica de negócio específica do WMS
 */
import { SapServiceLayerClient } from "../../sap-connector/src/serviceLayerClient.js";
import type { 
  SapOrder, 
  SapCollectionResponse, 
  SapOrdersFilter, 
  SapOrderStatusUpdate 
} from "../../sap-connector/src/sapTypes.js";
import { SapAuthError, SapHttpError } from "../../sap-connector/src/errors.js";
import { instrumentSapClient } from "../../observability/sapInstrumentation.js";
import { createLogger } from "../../observability/logger.js";

export type SapServiceOptions = {
  baseUrl: string;
  companyDb: string;
  username: string;
  password: string;
  logger?: any;
};

export class SapService {
  private client: SapServiceLayerClient;

  constructor(options: SapServiceOptions) {
    // Logger com mascaramento de segredos
    const logger = options.logger || createLogger({ 
      name: "sap-service",
      redactPaths: ["credentials.password", "password", "Password", "CompanyPassword"]
    });

    const rawClient = new SapServiceLayerClient({
      baseUrl: options.baseUrl,
      credentials: {
        companyDb: options.companyDb,
        username: options.username,
        password: options.password
      },
      logger,
      timeoutMs: Number(process.env.SAP_B1_TIMEOUT_MS ?? 20000),
      retry: {
        maxAttempts: Number(process.env.SAP_B1_MAX_ATTEMPTS ?? 5)
      },
      rateLimit: {
        maxConcurrent: Number(process.env.SAP_B1_MAX_CONCURRENT ?? 8),
        maxRps: Number(process.env.SAP_B1_MAX_RPS ?? 10)
      }
    });

    // Instrumentar com observabilidade
    this.client = instrumentSapClient(rawClient, {
      logger,
      componentName: "sap-gateway"
    });
  }

  /**
   * Testa a conexão com o SAP (faz login e retorna OK)
   */
  async healthCheck(correlationId?: string): Promise<{ ok: boolean; message: string }> {
    try {
      await this.client.login(correlationId);
      return { ok: true, message: "Conexão com SAP OK" };
    } catch (err: unknown) {
      if (err instanceof SapAuthError) {
        return { ok: false, message: `Erro de autenticação: ${err.message}` };
      }
      return { ok: false, message: `Erro na conexão: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  /**
   * Busca pedidos do SAP com filtros
   */
  async getOrders(filter: SapOrdersFilter = {}, correlationId?: string): Promise<SapOrder[]> {
    const { status = "open", cardCode, fromDate, toDate, limit = 100, skip = 0 } = filter;

    // Construir query OData
    const filters: string[] = [];
    
    if (status === "open") {
      filters.push("DocumentStatus eq 'bost_Open'");
    } else if (status === "closed") {
      filters.push("DocumentStatus eq 'bost_Close'");
    }
    
    if (cardCode) {
      filters.push(`CardCode eq '${cardCode}'`);
    }
    
    if (fromDate) {
      filters.push(`DocDate ge '${fromDate}'`);
    }
    
    if (toDate) {
      filters.push(`DocDate le '${toDate}'`);
    }

    const filterQuery = filters.length > 0 ? `&$filter=${filters.join(" and ")}` : "";
    const selectQuery = "$select=DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocStatus,DocumentStatus,DocTotal,DocCurrency,Comments,CreateDate,CreateTime,UpdateDate,UpdateTime,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID";
    const expandQuery = "$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode,Price,UnitPrice,LineTotal)";
    const topQuery = `$top=${limit}`;
    const skipQuery = `$skip=${skip}`;

    const path = `/Orders?${selectQuery}&${expandQuery}&${topQuery}&${skipQuery}${filterQuery}`;

    try {
      const response = await this.client.get<SapCollectionResponse<SapOrder>>(path, { correlationId });
      return response.data.value || [];
    } catch (err: unknown) {
      if (err instanceof SapHttpError) {
        throw new Error(`Erro ao buscar pedidos do SAP: ${err.message} (status: ${err.status})`);
      }
      throw err;
    }
  }

  /**
   * Busca um pedido específico pelo DocEntry
   */
  async getOrder(docEntry: number, correlationId?: string): Promise<SapOrder> {
    const selectQuery = "$select=DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocStatus,DocumentStatus,DocTotal,DocCurrency,Comments,CreateDate,CreateTime,UpdateDate,UpdateTime,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID";
    const expandQuery = "$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode,Price,UnitPrice,LineTotal)";
    const path = `/Orders(${docEntry})?${selectQuery}&${expandQuery}`;

    try {
      const response = await this.client.get<SapOrder>(path, { correlationId });
      return response.data;
    } catch (err: unknown) {
      if (err instanceof SapHttpError) {
        if (err.status === 404) {
          throw new Error(`Pedido ${docEntry} não encontrado no SAP`);
        }
        throw new Error(`Erro ao buscar pedido do SAP: ${err.message} (status: ${err.status})`);
      }
      throw err;
    }
  }

  /**
   * Atualiza o status WMS de um pedido (via UDFs)
   */
  async updateOrderStatus(
    docEntry: number, 
    update: SapOrderStatusUpdate, 
    correlationId?: string
  ): Promise<void> {
    const path = `/Orders(${docEntry})`;

    try {
      await this.client.patch(path, update, { correlationId });
    } catch (err: unknown) {
      if (err instanceof SapHttpError) {
        if (err.status === 404) {
          throw new Error(`Pedido ${docEntry} não encontrado no SAP`);
        }
        throw new Error(`Erro ao atualizar status no SAP: ${err.message} (status: ${err.status})`);
      }
      throw err;
    }
  }

  /**
   * Fecha a sessão (logout)
   */
  async close(correlationId?: string): Promise<void> {
    await this.client.logout(correlationId);
  }
}

// Singleton para reutilizar a conexão
let sapServiceInstance: SapService | null = null;

export function getSapService(logger?: any): SapService {
  if (!sapServiceInstance) {
    const baseUrl = process.env.SAP_B1_BASE_URL;
    const companyDb = process.env.SAP_B1_COMPANY_DB;
    const username = process.env.SAP_B1_USERNAME;
    const password = process.env.SAP_B1_PASSWORD;

    if (!baseUrl || !companyDb || !username || !password) {
      throw new Error("Variáveis de ambiente SAP não configuradas (SAP_B1_BASE_URL, SAP_B1_COMPANY_DB, SAP_B1_USERNAME, SAP_B1_PASSWORD)");
    }

    sapServiceInstance = new SapService({
      baseUrl,
      companyDb,
      username,
      password,
      logger
    });
  }

  return sapServiceInstance;
}
