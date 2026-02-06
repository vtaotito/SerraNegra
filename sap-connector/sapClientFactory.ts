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

  return {
    useMock,
    mockDelay: parseInt(process.env.SAP_MOCK_DELAY || "300"),
    realSapConfig: {
      host: process.env.SAP_HOST || "localhost",
      port: parseInt(process.env.SAP_PORT || "50000"),
      companyDB: process.env.SAP_COMPANY_DB || "SBODEMO",
      username: process.env.SAP_USERNAME || "",
      password: process.env.SAP_PASSWORD || "",
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
// Cliente SAP Real (placeholder)
// ============================================================================

class RealSapClient implements ISapClient {
  private config: SapConfig["realSapConfig"];

  constructor(config: SapConfig["realSapConfig"]) {
    this.config = config;
  }

  async login(_u: string, _p: string): Promise<{ SessionId: string }> {
    throw new Error("Real SAP Client not implemented. Set USE_SAP_MOCK=true");
  }
  async logout(): Promise<{ success: boolean }> {
    throw new Error("Real SAP Client not implemented");
  }
  async getOrders(_f?: SapOrdersFilter) {
    throw new Error("Real SAP Client not implemented") as never;
  }
  async getOrderByDocEntry(_d: number) {
    throw new Error("Real SAP Client not implemented") as never;
  }
  async updateOrderStatus(_d: number, _data: SapOrderStatusUpdate) {
    throw new Error("Real SAP Client not implemented") as never;
  }
  async getItems() {
    throw new Error("Real SAP Client not implemented") as never;
  }
  async getItemByCode(_c: string) {
    throw new Error("Real SAP Client not implemented") as never;
  }
  async getItemWarehouseInfo(_c: string) {
    throw new Error("Real SAP Client not implemented") as never;
  }
  async getWarehouses() {
    throw new Error("Real SAP Client not implemented") as never;
  }
  async getBusinessPartners() {
    throw new Error("Real SAP Client not implemented") as never;
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
