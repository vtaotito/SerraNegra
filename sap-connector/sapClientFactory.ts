/**
 * SAP Client Factory
 * 
 * Factory para criar instância do cliente SAP, alternando entre:
 * - Mock Service (desenvolvimento/testes)
 * - SAP Real (produção)
 * 
 * Uso:
 *   const sapClient = createSapClient();
 *   const orders = await sapClient.getOrders();
 */

import { sapMockService } from './mocks/sapMockService';
import type { SapOrder, SapOrdersFilter, SapCollectionResponse, SapItem, SapWarehouse, SapBusinessPartner, SapItemWarehouseInfo, SapOrderStatusUpdate } from './src/sapTypes';

// ============================================================================
// INTERFACE
// ============================================================================

/**
 * Interface comum para clientes SAP (mock e real)
 */
export interface ISapClient {
  // Autenticação
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

  // Parceiros de Negócio
  getBusinessPartners(): Promise<SapCollectionResponse<SapBusinessPartner>>;
}

// ============================================================================
// CONFIGURAÇÃO
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

/**
 * Obter configuração do SAP a partir de variáveis de ambiente
 */
function getSapConfig(): SapConfig {
  const useMock = process.env.USE_SAP_MOCK === 'true' || process.env.NODE_ENV === 'test';
  
  return {
    useMock,
    mockDelay: parseInt(process.env.SAP_MOCK_DELAY || '500'),
    realSapConfig: {
      host: process.env.SAP_HOST || 'localhost',
      port: parseInt(process.env.SAP_PORT || '50000'),
      companyDB: process.env.SAP_COMPANY_DB || 'SBODEMO',
      username: process.env.SAP_USERNAME || '',
      password: process.env.SAP_PASSWORD || ''
    }
  };
}

// ============================================================================
// ADAPTER PARA MOCK
// ============================================================================

/**
 * Adapter para garantir que o mock service implementa ISapClient
 */
class MockSapClientAdapter implements ISapClient {
  private mock = sapMockService;

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
// CLIENTE SAP REAL (PLACEHOLDER)
// ============================================================================

/**
 * Cliente SAP Real
 * TODO: Implementar conexão real com SAP B1 Service Layer
 */
class RealSapClient implements ISapClient {
  private config: SapConfig['realSapConfig'];
  private sessionId?: string;

  constructor(config: SapConfig['realSapConfig']) {
    this.config = config;
  }

  async login(username: string, password: string) {
    // TODO: Implementar login real
    throw new Error('Real SAP Client not implemented yet. Use mock instead (USE_SAP_MOCK=true)');
  }

  async logout() {
    // TODO: Implementar logout real
    throw new Error('Real SAP Client not implemented yet');
  }

  async getOrders(filter?: SapOrdersFilter) {
    // TODO: Implementar busca real
    throw new Error('Real SAP Client not implemented yet');
  }

  async getOrderByDocEntry(docEntry: number) {
    // TODO: Implementar busca real
    throw new Error('Real SAP Client not implemented yet');
  }

  async updateOrderStatus(docEntry: number, data: SapOrderStatusUpdate) {
    // TODO: Implementar update real
    throw new Error('Real SAP Client not implemented yet');
  }

  async getItems() {
    // TODO: Implementar busca real
    throw new Error('Real SAP Client not implemented yet');
  }

  async getItemByCode(itemCode: string) {
    // TODO: Implementar busca real
    throw new Error('Real SAP Client not implemented yet');
  }

  async getItemWarehouseInfo(itemCode: string) {
    // TODO: Implementar busca real
    throw new Error('Real SAP Client not implemented yet');
  }

  async getWarehouses() {
    // TODO: Implementar busca real
    throw new Error('Real SAP Client not implemented yet');
  }

  async getBusinessPartners() {
    // TODO: Implementar busca real
    throw new Error('Real SAP Client not implemented yet');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Criar cliente SAP apropriado baseado na configuração
 */
export function createSapClient(customConfig?: Partial<SapConfig>): ISapClient {
  const config = { ...getSapConfig(), ...customConfig };

  if (config.useMock) {
    console.log('🔧 Usando SAP Mock Service');
    return new MockSapClientAdapter();
  }

  console.log('🌐 Usando SAP Real Service');
  return new RealSapClient(config.realSapConfig);
}

/**
 * Cliente SAP singleton (reutilizável)
 */
let sapClientInstance: ISapClient | null = null;

/**
 * Obter instância singleton do cliente SAP
 */
export function getSapClient(): ISapClient {
  if (!sapClientInstance) {
    sapClientInstance = createSapClient();
  }
  return sapClientInstance;
}

/**
 * Resetar cliente singleton (útil para testes)
 */
export function resetSapClient(): void {
  sapClientInstance = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { SapConfig };
export { MockSapClientAdapter, RealSapClient };
