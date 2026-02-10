/**
 * SAP Client Factory
 *
 * Factory para criar instância do cliente SAP, alternando entre:
 * - Mock Service (desenvolvimento/testes)
 * - SAP Real (produção)
 *
 * Uso:
 *   const sap = createSapClient();         // respeita env
 *   const sap = getSapClient();             // singleton
 *   const orders = await sap.getOrders();
 */

import { sapMockService, SapMockService } from "./mocks/sapMockService.js";
import { SapServiceLayerClient } from "./src/serviceLayerClient.js";
import type {
  SapOrder,
  SapOrdersFilter,
  SapCollectionResponse,
  SapItem,
  SapWarehouse,
  SapBusinessPartner,
  SapItemWarehouseInfo,
  SapOrderStatusUpdate,
} from "./src/sapTypes.js";

// ============================================================================
// Interface comum (contrato entre mock e real)
// ============================================================================

export interface ISapClient {
  // Auth
  login(username: string, password: string): Promise<{ SessionId: string }>;
  logout(): Promise<{ success: boolean }>;

  // Pedidos
  getOrders(filter?: SapOrdersFilter): Promise<SapCollectionResponse<SapOrder>>;
  getOrderByDocEntry(docEntry: number): Promise<SapOrder | null>;
  updateOrderStatus(docEntry: number, data: SapOrderStatusUpdate): Promise<SapOrder | null>;

  // Produtos
  getItems(): Promise<SapCollectionResponse<SapItem>>;
  getItemByCode(itemCode: string): Promise<SapItem | null>;
  getItemWarehouseInfo(itemCode: string): Promise<SapCollectionResponse<SapItemWarehouseInfo>>;

  // Depósitos
  getWarehouses(): Promise<SapCollectionResponse<SapWarehouse>>;

  // Parceiros
  getBusinessPartners(): Promise<SapCollectionResponse<SapBusinessPartner>>;
}

// ============================================================================
// Configuração
// ============================================================================

interface SapConfig {
  useMock: boolean;
  mockDelay?: number;
  realSapConfig?: {
    host: string;
    port: number;
    companyDB: string;
    username: string;
    password: string;
  };
}

function getSapConfig(): SapConfig {
  const useMock =
    process.env.USE_SAP_MOCK === "true" || process.env.NODE_ENV === "test";

  // Suporta tanto SAP_HOST quanto SAP_B1_BASE_URL
  const host = process.env.SAP_HOST || process.env.SAP_B1_BASE_URL || "localhost";
  const port = parseInt(process.env.SAP_PORT || "50000");

  return {
    useMock,
    mockDelay: parseInt(process.env.SAP_MOCK_DELAY || "300"),
    realSapConfig: {
      host,
      port,
      companyDB: process.env.SAP_COMPANY_DB || process.env.SAP_B1_COMPANY_DB || "SBODEMO",
      username: process.env.SAP_USERNAME || process.env.SAP_B1_USERNAME || "",
      password: process.env.SAP_PASSWORD || process.env.SAP_B1_PASSWORD || "",
    },
  };
}

// ============================================================================
// Adapter Mock → ISapClient
// ============================================================================

class MockSapClientAdapter implements ISapClient {
  constructor(private mock: SapMockService = sapMockService) {}

  async login(username: string, password: string) {
    return this.mock.login(username, password);
  }
  async logout() {
    return this.mock.logout();
  }

  async getOrders(filter?: SapOrdersFilter) {
    return this.mock.getOrders(filter);
  }
  async getOrderByDocEntry(docEntry: number) {
    return this.mock.getOrderByDocEntry(docEntry);
  }
  async updateOrderStatus(docEntry: number, data: SapOrderStatusUpdate) {
    return this.mock.updateOrderStatus(docEntry, data);
  }

  async getItems() {
    return this.mock.getItems();
  }
  async getItemByCode(itemCode: string) {
    return this.mock.getItemByCode(itemCode);
  }
  async getItemWarehouseInfo(itemCode: string) {
    return this.mock.getItemWarehouseInfo(itemCode);
  }

  async getWarehouses() {
    return this.mock.getWarehouses();
  }

  async getBusinessPartners() {
    return this.mock.getBusinessPartners();
  }
}

// ============================================================================
// Cliente SAP Real (Service Layer)
// ============================================================================

class RealSapClient implements ISapClient {
  private readonly client: SapServiceLayerClient;
  private readonly config: NonNullable<SapConfig["realSapConfig"]>;

  constructor(config: NonNullable<SapConfig["realSapConfig"]>) {
    this.config = config;

    // Montar baseUrl: se host já inclui porta ou /b1s/v1, não duplicar
    let baseUrl: string;
    if (config.host.includes("/b1s/v1")) {
      baseUrl = config.host;
    } else {
      const hostClean = config.host.replace(/\/$/, "");
      // Se o host já tem porta (ex: :50000), não adicionar novamente
      const hasPort = /:\d+$/.test(hostClean);
      baseUrl = hasPort
        ? `${hostClean}/b1s/v1`
        : `${hostClean}:${config.port}/b1s/v1`;
    }

    this.client = new SapServiceLayerClient({
      baseUrl,
      credentials: {
        companyDb: config.companyDB,
        username: config.username,
        password: config.password,
      },
      timeoutMs: 60_000,
      retry: { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 10_000, jitterRatio: 0.2 },
      circuitBreaker: { failureThreshold: 10, successThreshold: 2, openStateTimeoutMs: 60_000 },
    });
  }

  async login(_u: string, _p: string): Promise<{ SessionId: string }> {
    await this.client.login();
    return { SessionId: "real-session" };
  }

  async logout(): Promise<{ success: boolean }> {
    await this.client.logout();
    return { success: true };
  }

  // ── Pedidos ──

  async getOrders(filter?: SapOrdersFilter): Promise<SapCollectionResponse<SapOrder>> {
    const parts: string[] = [];

    // Nota: SAP B1 Service Layer não suporta $select + $expand na mesma query.
    // Sem $select, o SAP retorna todos os campos incluindo DocumentLines.

    // Filtros OData
    const filters: string[] = [];
    if (filter?.status === "open") filters.push("DocumentStatus eq 'bost_Open'");
    else if (filter?.status === "closed") filters.push("DocumentStatus eq 'bost_Close'");
    if (filter?.cardCode) filters.push(`CardCode eq '${filter.cardCode}'`);
    if (filter?.fromDate) filters.push(`DocDate ge '${filter.fromDate}'`);
    if (filter?.toDate) filters.push(`DocDate le '${filter.toDate}'`);

    if (filters.length > 0) parts.push(`$filter=${filters.join(" and ")}`);

    // Ordenação e paginação
    parts.push("$orderby=DocEntry desc");
    if (filter?.limit) parts.push(`$top=${filter.limit}`);
    if (filter?.skip) parts.push(`$skip=${filter.skip}`);

    const query = `/Orders?${parts.join("&")}`;
    const res = await this.client.get<SapCollectionResponse<SapOrder>>(query);
    return res.data;
  }

  async getOrderByDocEntry(docEntry: number): Promise<SapOrder | null> {
    try {
      const res = await this.client.get<SapOrder>(`/Orders(${docEntry})`);
      return res.data;
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async updateOrderStatus(docEntry: number, data: SapOrderStatusUpdate): Promise<SapOrder | null> {
    await this.client.patch(`/Orders(${docEntry})`, data);
    // PATCH retorna 204 No Content; relê o pedido para retornar atualizado
    return this.getOrderByDocEntry(docEntry);
  }

  // ── Itens ──

  async getItems(): Promise<SapCollectionResponse<SapItem>> {
    const select = "ItemCode,ItemName,InventoryUOM,InventoryItem,SalesItem,PurchaseItem,Valid,Frozen,QuantityOnStock,UpdateDate,UpdateTime";
    const res = await this.client.get<SapCollectionResponse<SapItem>>(
      `/Items?$select=${select}&$filter=Valid eq 'tYES'&$top=500`,
    );
    return res.data;
  }

  async getItemByCode(itemCode: string): Promise<SapItem | null> {
    try {
      const res = await this.client.get<SapItem>(`/Items('${itemCode}')`);
      return res.data;
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async getItemWarehouseInfo(itemCode: string): Promise<SapCollectionResponse<SapItemWarehouseInfo>> {
    const res = await this.client.get<SapCollectionResponse<SapItemWarehouseInfo>>(
      `/Items('${itemCode}')/ItemWarehouseInfoCollection`,
    );
    return res.data;
  }

  // ── Depósitos ──

  async getWarehouses(): Promise<SapCollectionResponse<SapWarehouse>> {
    const res = await this.client.get<SapCollectionResponse<SapWarehouse>>(
      `/Warehouses?$select=WarehouseCode,WarehouseName,Inactive&$filter=Inactive eq 'tNO'`,
    );
    return res.data;
  }

  // ── Parceiros ──

  async getBusinessPartners(): Promise<SapCollectionResponse<SapBusinessPartner>> {
    const select = "CardCode,CardName,CardType,Phone1,EmailAddress,Address,City,State,ZipCode,Country,FederalTaxID,Valid,Frozen";
    const res = await this.client.get<SapCollectionResponse<SapBusinessPartner>>(
      `/BusinessPartners?$select=${select}&$filter=CardType eq 'cCustomer' and Valid eq 'tYES'&$top=500`,
    );
    return res.data;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createSapClient(customConfig?: Partial<SapConfig>): ISapClient {
  const config = { ...getSapConfig(), ...customConfig };

  if (config.useMock) {
    console.log("🔧 Usando SAP Mock Service (UDFs habilitados)");
    return new MockSapClientAdapter();
  }

  console.log("🌐 Usando SAP Real Service");
  return new RealSapClient(config.realSapConfig);
}

/** Singleton */
let instance: ISapClient | null = null;

export function getSapClient(): ISapClient {
  if (!instance) instance = createSapClient();
  return instance;
}

export function resetSapClient(): void {
  instance = null;
}

// ============================================================================
// Re-exports
// ============================================================================

export type { SapConfig };
export { MockSapClientAdapter, RealSapClient };
