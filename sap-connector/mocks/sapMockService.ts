/**
 * SAP B1 Mock Service
 * 
 * Simula a API do SAP Service Layer para testes locais
 * sem necessidade de conexão com SAP real
 */

import type {
  SapOrder,
  SapItem,
  SapWarehouse,
  SapCollectionResponse,
  SapOrdersFilter,
  SapOrderStatusUpdate,
  SapItemWarehouseInfo
} from "../src/sapTypes.js";

import {
  mockOrders,
  mockItems,
  mockWarehouses,
  mockBusinessPartners,
  mockItemWarehouseInfo,
  generateRandomOrder,
  getOrdersByStatus,
  getOrdersByCustomer,
  getItemStock
} from "./sapMockData.js";

/**
 * Mock Service que simula a API do SAP B1
 */
export class SapMockService {
  private orders: SapOrder[] = [...mockOrders];
  private nextDocEntry = 100;
  private nextDocNum = 20;
  private loginSession: string | null = null;

  /**
   * Simula login no SAP
   */
  async login(username: string, password: string, companyDB: string): Promise<{ SessionId: string }> {
    // Simula delay de rede
    await this.delay(300);

    if (!username || !password || !companyDB) {
      throw new Error("Invalid credentials");
    }

    this.loginSession = `mock-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    console.log(`[SAP Mock] Login realizado: ${username}@${companyDB}`);
    
    return { SessionId: this.loginSession };
  }

  /**
   * Simula logout
   */
  async logout(): Promise<void> {
    await this.delay(100);
    this.loginSession = null;
    console.log("[SAP Mock] Logout realizado");
  }

  /**
   * Lista pedidos com filtros
   */
  async getOrders(filter?: SapOrdersFilter): Promise<SapCollectionResponse<SapOrder>> {
    await this.delay(500);

    let results = [...this.orders];

    // Aplicar filtros
    if (filter?.status && filter.status !== "all") {
      results = getOrdersByStatus(filter.status);
    }

    if (filter?.cardCode) {
      results = results.filter(o => o.CardCode === filter.cardCode);
    }

    if (filter?.fromDate) {
      const from = new Date(filter.fromDate);
      results = results.filter(o => o.DocDate && new Date(o.DocDate) >= from);
    }

    if (filter?.toDate) {
      const to = new Date(filter.toDate);
      results = results.filter(o => o.DocDate && new Date(o.DocDate) <= to);
    }

    // Ordenar por DocEntry decrescente
    results.sort((a, b) => b.DocEntry - a.DocEntry);

    // Paginação
    const skip = filter?.skip || 0;
    const limit = filter?.limit || 50;
    results = results.slice(skip, skip + limit);

    console.log(`[SAP Mock] GET Orders: ${results.length} resultados`);

    return {
      "odata.metadata": "https://mock-sap/Orders/$metadata#Orders",
      value: results
    };
  }

  /**
   * Busca pedido por DocEntry
   */
  async getOrderByDocEntry(docEntry: number): Promise<SapOrder> {
    await this.delay(200);

    const order = this.orders.find(o => o.DocEntry === docEntry);
    
    if (!order) {
      throw new Error(`Order ${docEntry} not found`);
    }

    console.log(`[SAP Mock] GET Order ${docEntry}`);
    
    return order;
  }

  /**
   * Busca linhas de um pedido
   */
  async getOrderLines(docEntry: number): Promise<SapCollectionResponse<any>> {
    await this.delay(200);

    const order = this.orders.find(o => o.DocEntry === docEntry);
    
    if (!order || !order.DocumentLines) {
      throw new Error(`Order ${docEntry} not found or has no lines`);
    }

    console.log(`[SAP Mock] GET Order ${docEntry} Lines: ${order.DocumentLines.length} linhas`);

    return {
      "odata.metadata": `https://mock-sap/Orders(${docEntry})/DocumentLines/$metadata`,
      value: order.DocumentLines
    };
  }

  /**
   * Atualiza status do pedido (UDFs)
   */
  async updateOrderStatus(docEntry: number, update: SapOrderStatusUpdate): Promise<void> {
    await this.delay(300);

    const order = this.orders.find(o => o.DocEntry === docEntry);
    
    if (!order) {
      throw new Error(`Order ${docEntry} not found`);
    }

    // Atualizar UDFs
    if (update.U_WMS_STATUS !== undefined) order.U_WMS_STATUS = update.U_WMS_STATUS;
    if (update.U_WMS_ORDERID !== undefined) order.U_WMS_ORDERID = update.U_WMS_ORDERID;
    if (update.U_WMS_LAST_EVENT !== undefined) order.U_WMS_LAST_EVENT = update.U_WMS_LAST_EVENT;
    if (update.U_WMS_LAST_TS !== undefined) order.U_WMS_LAST_TS = update.U_WMS_LAST_TS;
    if (update.U_WMS_CORR_ID !== undefined) order.U_WMS_CORR_ID = update.U_WMS_CORR_ID;

    // Atualizar timestamps
    const now = new Date();
    order.UpdateDate = now.toISOString().split('T')[0];
    order.UpdateTime = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4);

    console.log(`[SAP Mock] PATCH Order ${docEntry} - Status: ${update.U_WMS_STATUS}`);
  }

  /**
   * Cria novo pedido (para testes)
   */
  async createOrder(orderData: Partial<SapOrder>): Promise<SapOrder> {
    await this.delay(400);

    const newOrder: SapOrder = {
      DocEntry: this.nextDocEntry++,
      DocNum: this.nextDocNum++,
      CardCode: orderData.CardCode || "C00000",
      CardName: orderData.CardName || "Cliente Teste",
      DocDate: new Date().toISOString(),
      DocDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      DocStatus: "bost_Open",
      DocumentStatus: "bost_Open",
      DocTotal: orderData.DocTotal || 0,
      DocCurrency: "R$",
      Comments: orderData.Comments || "",
      CreateDate: new Date().toISOString().split('T')[0],
      CreateTime: new Date().toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4),
      UpdateDate: new Date().toISOString().split('T')[0],
      UpdateTime: new Date().toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4),
      DocumentLines: orderData.DocumentLines || []
    };

    this.orders.push(newOrder);

    console.log(`[SAP Mock] POST Order ${newOrder.DocEntry} criado`);

    return newOrder;
  }

  /**
   * Lista produtos
   */
  async getItems(filter?: { itemCode?: string; top?: number }): Promise<SapCollectionResponse<SapItem>> {
    await this.delay(300);

    let results = [...mockItems];

    if (filter?.itemCode) {
      results = results.filter(i => i.ItemCode === filter.itemCode);
    }

    if (filter?.top) {
      results = results.slice(0, filter.top);
    }

    console.log(`[SAP Mock] GET Items: ${results.length} resultados`);

    return {
      "odata.metadata": "https://mock-sap/Items/$metadata#Items",
      value: results
    };
  }

  /**
   * Busca produto por código
   */
  async getItemByCode(itemCode: string): Promise<SapItem> {
    await this.delay(150);

    const item = mockItems.find(i => i.ItemCode === itemCode);
    
    if (!item) {
      throw new Error(`Item ${itemCode} not found`);
    }

    console.log(`[SAP Mock] GET Item ${itemCode}`);

    return item;
  }

  /**
   * Busca estoque de um produto
   */
  async getItemWarehouseInfo(itemCode: string): Promise<SapCollectionResponse<SapItemWarehouseInfo>> {
    await this.delay(200);

    const stock = getItemStock(itemCode);

    console.log(`[SAP Mock] GET Item ${itemCode} Stock: ${stock.length} depósitos`);

    return {
      "odata.metadata": `https://mock-sap/Items('${itemCode}')/ItemWarehouseInfoCollection/$metadata`,
      value: stock
    };
  }

  /**
   * Lista depósitos
   */
  async getWarehouses(): Promise<SapCollectionResponse<SapWarehouse>> {
    await this.delay(200);

    const active = mockWarehouses.filter(w => w.Inactive === "tNO");

    console.log(`[SAP Mock] GET Warehouses: ${active.length} ativos`);

    return {
      "odata.metadata": "https://mock-sap/Warehouses/$metadata#Warehouses",
      value: active
    };
  }

  /**
   * Lista clientes (Business Partners)
   */
  async getBusinessPartners(filter?: { cardCode?: string; cardType?: string }): Promise<SapCollectionResponse<any>> {
    await this.delay(300);

    let results = [...mockBusinessPartners];

    if (filter?.cardCode) {
      results = results.filter(bp => bp.CardCode === filter.cardCode);
    }

    if (filter?.cardType) {
      results = results.filter(bp => bp.CardType === filter.cardType);
    }

    console.log(`[SAP Mock] GET BusinessPartners: ${results.length} resultados`);

    return {
      "odata.metadata": "https://mock-sap/BusinessPartners/$metadata#BusinessPartners",
      value: results
    };
  }

  /**
   * Gera pedidos aleatórios (para testes de carga)
   */
  async generateRandomOrders(count: number): Promise<SapOrder[]> {
    const orders: SapOrder[] = [];

    for (let i = 0; i < count; i++) {
      const order = generateRandomOrder(this.nextDocEntry++, this.nextDocNum++);
      this.orders.push(order);
      orders.push(order);
    }

    console.log(`[SAP Mock] Gerados ${count} pedidos aleatórios`);

    return orders;
  }

  /**
   * Reseta dados para estado inicial
   */
  resetData(): void {
    this.orders = [...mockOrders];
    this.nextDocEntry = 100;
    this.nextDocNum = 20;
    console.log("[SAP Mock] Dados resetados para estado inicial");
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    const openOrders = this.orders.filter(o => o.DocStatus === "bost_Open").length;
    const closedOrders = this.orders.filter(o => o.DocStatus === "bost_Close").length;

    return {
      totalOrders: this.orders.length,
      openOrders,
      closedOrders,
      totalItems: mockItems.length,
      totalWarehouses: mockWarehouses.length,
      totalCustomers: mockBusinessPartners.length,
      isAuthenticated: !!this.loginSession
    };
  }

  /**
   * Simula delay de rede
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Instância singleton do mock service
 */
export const sapMockService = new SapMockService();
