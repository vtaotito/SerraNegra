/**
 * SAP B1 Mock Service — Integração Funcional com UDFs
 *
 * Implementa a mesma interface que o cliente SAP real (ISapClient),
 * usando dados in-memory para desenvolvimento e testes.
 *
 * Cada PATCH de UDFs é refletido em memória. O método `getOrders`
 * filtra corretamente de `this.orders` (não do array estático).
 */

import type {
  SapOrder,
  SapItem,
  SapWarehouse,
  SapBusinessPartner,
  SapCollectionResponse,
  SapOrdersFilter,
  SapOrderStatusUpdate,
  SapItemWarehouseInfo,
} from "../src/sapTypes.js";

import {
  mockOrders,
  mockItems,
  mockWarehouses,
  mockBusinessPartners,
  mockItemWarehouseInfo,
  generateRandomOrder,
} from "./sapMockData.js";

// ============================================================================
// Service
// ============================================================================

export class SapMockService {
  private orders: SapOrder[];
  private nextDocEntry: number;
  private nextDocNum: number;
  private sessionId: string | null = null;

  constructor() {
    this.orders = structuredClone(mockOrders);
    this.nextDocEntry = 100;
    this.nextDocNum = 2000;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Autenticação
  // ──────────────────────────────────────────────────────────────────────────

  async login(
    username: string,
    password: string,
    companyDB?: string,
  ): Promise<{ SessionId: string }> {
    await this.delay(200);
    this.sessionId = `mock-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      `[SAP Mock] Login: ${username}@${companyDB ?? "REDACTED_COMPANY_DB"}`,
    );
    return { SessionId: this.sessionId };
  }

  async logout(): Promise<{ success: boolean }> {
    await this.delay(50);
    this.sessionId = null;
    console.log("[SAP Mock] Logout");
    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pedidos
  // ──────────────────────────────────────────────────────────────────────────

  async getOrders(
    filter?: SapOrdersFilter,
  ): Promise<SapCollectionResponse<SapOrder>> {
    await this.delay(300);

    let results = [...this.orders];

    // Filtro por status SAP (open / closed)
    if (filter?.status && filter.status !== "all") {
      const sapStatus = filter.status === "open" ? "bost_Open" : "bost_Close";
      results = results.filter((o) => o.DocStatus === sapStatus);
    }

    // Filtro por cliente
    if (filter?.cardCode) {
      results = results.filter((o) => o.CardCode === filter.cardCode);
    }

    // Filtro por data
    if (filter?.fromDate) {
      const from = new Date(filter.fromDate);
      results = results.filter((o) => o.DocDate && new Date(o.DocDate) >= from);
    }
    if (filter?.toDate) {
      const to = new Date(filter.toDate);
      results = results.filter((o) => o.DocDate && new Date(o.DocDate) <= to);
    }

    // Ordenar por DocEntry DESC (mais recente primeiro)
    results.sort((a, b) => b.DocEntry - a.DocEntry);

    // Paginação
    const skip = filter?.skip ?? 0;
    const limit = filter?.limit ?? 50;
    results = results.slice(skip, skip + limit);

    console.log(`[SAP Mock] GET Orders → ${results.length} resultados`);

    return {
      "odata.metadata": "https://mock-sap:50000/b1s/v1/Orders/$metadata",
      value: results,
    };
  }

  async getOrderByDocEntry(docEntry: number): Promise<SapOrder | null> {
    await this.delay(150);
    const order = this.orders.find((o) => o.DocEntry === docEntry) ?? null;
    console.log(
      `[SAP Mock] GET Order(${docEntry}) → ${order ? "found" : "null"}`,
    );
    return order;
  }

  async getOrderLines(
    docEntry: number,
  ): Promise<SapCollectionResponse<any>> {
    await this.delay(100);
    const order = this.orders.find((o) => o.DocEntry === docEntry);
    if (!order?.DocumentLines) {
      throw new Error(`Order ${docEntry} not found`);
    }
    return { value: order.DocumentLines };
  }

  async updateOrderStatus(
    docEntry: number,
    update: SapOrderStatusUpdate,
  ): Promise<SapOrder | null> {
    await this.delay(200);

    const order = this.orders.find((o) => o.DocEntry === docEntry);
    if (!order) return null;

    // Aplicar UDFs
    if (update.U_WMS_STATUS !== undefined) order.U_WMS_STATUS = update.U_WMS_STATUS;
    if (update.U_WMS_ORDERID !== undefined) order.U_WMS_ORDERID = update.U_WMS_ORDERID;
    if (update.U_WMS_LAST_EVENT !== undefined) order.U_WMS_LAST_EVENT = update.U_WMS_LAST_EVENT;
    if (update.U_WMS_LAST_TS !== undefined) order.U_WMS_LAST_TS = update.U_WMS_LAST_TS;
    if (update.U_WMS_CORR_ID !== undefined) order.U_WMS_CORR_ID = update.U_WMS_CORR_ID;

    // Atualizar timestamps SAP
    const now = new Date();
    order.UpdateDate = now.toISOString().split("T")[0];
    order.UpdateTime = now.toTimeString().slice(0, 5).replace(":", "");

    console.log(
      `[SAP Mock] PATCH Order(${docEntry}) → U_WMS_STATUS=${update.U_WMS_STATUS}`,
    );

    return { ...order };
  }

  async createOrder(data: Partial<SapOrder>): Promise<SapOrder> {
    await this.delay(300);

    const now = new Date();
    const newOrder: SapOrder = {
      DocEntry: this.nextDocEntry++,
      DocNum: this.nextDocNum++,
      CardCode: data.CardCode ?? "C00000",
      CardName: data.CardName ?? "Cliente Teste",
      DocDate: now.toISOString(),
      DocDueDate:
        data.DocDueDate ?? new Date(Date.now() + 7 * 86400000).toISOString(),
      DocStatus: "bost_Open",
      DocumentStatus: "bost_Open",
      DocTotal: data.DocTotal ?? 0,
      DocCurrency: "R$",
      Comments: data.Comments ?? "",
      CreateDate: now.toISOString().split("T")[0],
      CreateTime: now.toTimeString().slice(0, 5).replace(":", ""),
      UpdateDate: now.toISOString().split("T")[0],
      UpdateTime: now.toTimeString().slice(0, 5).replace(":", ""),
      U_WMS_STATUS: null,
      U_WMS_ORDERID: null,
      U_WMS_LAST_EVENT: null,
      U_WMS_LAST_TS: null,
      U_WMS_CORR_ID: null,
      DocumentLines: data.DocumentLines ?? [],
    };

    this.orders.push(newOrder);
    console.log(`[SAP Mock] POST Order → DocEntry=${newOrder.DocEntry}`);
    return newOrder;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Produtos
  // ──────────────────────────────────────────────────────────────────────────

  async getItems(): Promise<SapCollectionResponse<SapItem>> {
    await this.delay(200);
    console.log(`[SAP Mock] GET Items → ${mockItems.length}`);
    return { value: [...mockItems] };
  }

  async getItemByCode(itemCode: string): Promise<SapItem | null> {
    await this.delay(100);
    return mockItems.find((i) => i.ItemCode === itemCode) ?? null;
  }

  async getItemWarehouseInfo(
    itemCode: string,
  ): Promise<SapCollectionResponse<SapItemWarehouseInfo>> {
    await this.delay(150);
    const info = mockItemWarehouseInfo[itemCode] ?? [];
    console.log(
      `[SAP Mock] GET Stock('${itemCode}') → ${info.length} depósitos`,
    );
    return { value: [...info] };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Depósitos
  // ──────────────────────────────────────────────────────────────────────────

  async getWarehouses(): Promise<SapCollectionResponse<SapWarehouse>> {
    await this.delay(100);
    const active = mockWarehouses.filter((w) => w.Inactive === "tNO");
    console.log(`[SAP Mock] GET Warehouses → ${active.length} ativos`);
    return { value: active };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Business Partners
  // ──────────────────────────────────────────────────────────────────────────

  async getBusinessPartners(): Promise<
    SapCollectionResponse<SapBusinessPartner>
  > {
    await this.delay(150);
    console.log(
      `[SAP Mock] GET BusinessPartners → ${mockBusinessPartners.length}`,
    );
    return { value: [...mockBusinessPartners] };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utilitários de teste
  // ──────────────────────────────────────────────────────────────────────────

  /** Gera N pedidos aleatórios (U_WMS_STATUS=null, como se fossem novos no SAP) */
  async generateRandomOrders(count: number): Promise<SapOrder[]> {
    const created: SapOrder[] = [];
    for (let i = 0; i < count; i++) {
      const o = generateRandomOrder(this.nextDocEntry++, this.nextDocNum++);
      this.orders.push(o);
      created.push(o);
    }
    console.log(`[SAP Mock] Gerados ${count} pedidos aleatórios`);
    return created;
  }

  /** Reseta para o estado inicial dos dados estáticos */
  resetData(): void {
    this.orders = structuredClone(mockOrders);
    this.nextDocEntry = 100;
    this.nextDocNum = 2000;
    this.sessionId = null;
    console.log("[SAP Mock] Dados resetados");
  }

  /** Retorna estatísticas do mock */
  getStats() {
    const open = this.orders.filter((o) => o.DocStatus === "bost_Open");
    const closed = this.orders.filter((o) => o.DocStatus === "bost_Close");

    // Contar por UDF status
    const byWmsStatus: Record<string, number> = {};
    for (const o of this.orders) {
      const key = o.U_WMS_STATUS ?? "(null)";
      byWmsStatus[key] = (byWmsStatus[key] ?? 0) + 1;
    }

    return {
      totalOrders: this.orders.length,
      openOrders: open.length,
      closedOrders: closed.length,
      totalItems: mockItems.length,
      totalWarehouses: mockWarehouses.filter((w) => w.Inactive === "tNO")
        .length,
      totalCustomers: mockBusinessPartners.length,
      isAuthenticated: !!this.sessionId,
      byWmsStatus,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Interno
  // ──────────────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

/** Singleton */
export const sapMockService = new SapMockService();
