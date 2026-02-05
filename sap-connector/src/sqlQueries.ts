/**
 * Helper para SQLQueries do SAP B1 Service Layer.
 * Permite criar e executar queries SQL customizadas.
 */

import type { SapServiceLayerClient } from "./serviceLayerClient.js";
import type { SapRequestOptions } from "./types.js";

export type SqlQueryParam = {
  Name: string;
  Value: string | number | boolean;
};

export type SqlQueryDefinition = {
  QueryCategory: number; // -1 = User query, >= 0 = System category
  QueryDescription: string; // Nome/descrição da query
  Query: string; // SQL query (use [%0], [%1] para parâmetros)
};

export type SqlQueryResult<T = unknown> = {
  value: T[];
};

/**
 * Helper para gerenciar SQLQueries no SAP B1 Service Layer.
 */
export class SqlQueriesHelper {
  constructor(private client: SapServiceLayerClient) {}

  /**
   * Cria uma nova SQLQuery no SAP B1.
   * A query fica salva e pode ser reutilizada.
   */
  async createQuery(definition: SqlQueryDefinition, opts?: SapRequestOptions): Promise<void> {
    await this.client.post("/SQLQueries", definition, opts);
  }

  /**
   * Verifica se uma query existe.
   */
  async queryExists(queryName: string, opts?: SapRequestOptions): Promise<boolean> {
    try {
      await this.client.get(`/SQLQueries('${queryName}')`, opts);
      return true;
    } catch (err) {
      const error = err as { status?: number };
      if (error.status === 404) return false;
      throw err;
    }
  }

  /**
   * Cria uma query se não existir (idempotente).
   */
  async ensureQuery(definition: SqlQueryDefinition, opts?: SapRequestOptions): Promise<void> {
    const exists = await this.queryExists(definition.QueryDescription, opts);
    if (!exists) {
      await this.createQuery(definition, opts);
    }
  }

  /**
   * Executa uma SQLQuery já criada.
   */
  async executeQuery<T = unknown>(
    queryName: string,
    params: SqlQueryParam[] = [],
    opts?: SapRequestOptions
  ): Promise<SqlQueryResult<T>> {
    const body = params.length > 0 ? { ParamsCollection: params } : undefined;
    const res = await this.client.post<SqlQueryResult<T>>(`/SQLQueries('${queryName}')/List`, body, opts);
    return res.data;
  }

  /**
   * Deleta uma SQLQuery.
   */
  async deleteQuery(queryName: string, opts?: SapRequestOptions): Promise<void> {
    await this.client.get(`/SQLQueries('${queryName}')/Delete`, opts);
  }
}

/**
 * Queries padrão para integração WMS.
 */
export const WMS_QUERIES = {
  /**
   * Query: Pedidos completos com itens (otimizada).
   * Parâmetros:
   *  [%0] = Data inicial (YYYY-MM-DD)
   */
  ORDERS_WITH_LINES: {
    QueryCategory: -1,
    QueryDescription: "WMS_Orders_With_Lines",
    Query: `SELECT T0.DocEntry, T0.DocNum, T0.CardCode, T0.CardName, T0.DocDate, T0.DocDueDate, T0.DocTotal, T0.DocCur AS DocCurrency, T0.DocStatus AS DocumentStatus, T0.Canceled AS Cancelled, T0.CreateDate AS CreationDate, T1.LineNum, T1.ItemCode, T1.Dscription AS ItemDescription, T1.Quantity, T1.WhsCode AS WarehouseCode, T1.UomCode AS MeasureUnit, T1.Price, T1.LineTotal, T1.LineStatus FROM ORDR T0 INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry WHERE T0.DocDate >= [%0] ORDER BY T0.DocEntry DESC, T1.LineNum ASC`
  },

  /**
   * Query: Pedidos atualizados recentemente.
   * Parâmetros:
   *  [%0] = Data de atualização (YYYY-MM-DD)
   */
  ORDERS_UPDATED_SINCE: {
    QueryCategory: -1,
    QueryDescription: "WMS_Orders_Updated_Since",
    Query: `SELECT T0.DocEntry, T0.DocNum, T0.CardCode, T0.DocDate, T0.DocStatus AS DocumentStatus, T0.UpdateDate FROM ORDR T0 WHERE T0.UpdateDate >= [%0] ORDER BY T0.UpdateDate DESC`
  },

  /**
   * Query: Estoque por item e depósito.
   * Sem parâmetros (retorna tudo).
   */
  INVENTORY_BY_WAREHOUSE: {
    QueryCategory: -1,
    QueryDescription: "WMS_Inventory_By_Warehouse",
    Query: `SELECT T0.ItemCode, T0.ItemName, T1.WhsCode AS WarehouseCode, T1.OnHand, T1.IsCommited AS Committed, T1.OnOrder AS Ordered FROM OITM T0 INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode WHERE T0.frozenFor = 'N' ORDER BY T0.ItemCode, T1.WhsCode`
  },

  /**
   * Query: Items ativos (catálogo de produtos).
   */
  ACTIVE_ITEMS: {
    QueryCategory: -1,
    QueryDescription: "WMS_Active_Items",
    Query: `SELECT T0.ItemCode, T0.ItemName, T0.InvntryUom AS InventoryUOM, T0.InvntItem AS InventoryItem, T0.SellItem AS SalesItem, T0.PrchseItem AS PurchaseItem, T0.validFor AS Valid, T0.frozenFor AS Frozen FROM OITM T0 WHERE T0.frozenFor = 'N' AND T0.validFor = 'Y' ORDER BY T0.ItemCode`
  },

  /**
   * Query: Depósitos ativos.
   */
  ACTIVE_WAREHOUSES: {
    QueryCategory: -1,
    QueryDescription: "WMS_Active_Warehouses",
    Query: `SELECT T0.WhsCode AS WarehouseCode, T0.WhsName AS WarehouseName, T0.Inactive, T0.Location FROM OWHS T0 WHERE T0.Inactive = 'N' ORDER BY T0.WhsCode`
  },

  /**
   * Query: Clientes ativos.
   */
  ACTIVE_CUSTOMERS: {
    QueryCategory: -1,
    QueryDescription: "WMS_Active_Customers",
    Query: `SELECT T0.CardCode, T0.CardName, T0.CardType, T0.frozenFor AS Frozen, T0.validFor AS Valid FROM OCRD T0 WHERE T0.CardType = 'C' AND T0.frozenFor = 'N' AND T0.validFor = 'Y' ORDER BY T0.CardCode`
  }
} as const;

/**
 * Helper tipado para queries WMS.
 */
export class WmsQueriesHelper extends SqlQueriesHelper {
  /**
   * Garante que todas as queries WMS estão criadas no SAP.
   */
  async ensureWmsQueries(opts?: SapRequestOptions): Promise<void> {
    for (const query of Object.values(WMS_QUERIES)) {
      await this.ensureQuery(query, opts);
    }
  }

  /**
   * Busca pedidos com linhas.
   */
  async getOrdersWithLines(
    dateFrom: string,
    opts?: SapRequestOptions
  ): Promise<SqlQueryResult> {
    return this.executeQuery(
      WMS_QUERIES.ORDERS_WITH_LINES.QueryDescription,
      [{ Name: "dateFrom", Value: dateFrom }],
      opts
    );
  }

  /**
   * Busca pedidos atualizados desde uma data/hora.
   */
  async getOrdersUpdatedSince(since: string, opts?: SapRequestOptions): Promise<SqlQueryResult> {
    return this.executeQuery(
      WMS_QUERIES.ORDERS_UPDATED_SINCE.QueryDescription,
      [{ Name: "since", Value: since }],
      opts
    );
  }

  /**
   * Busca estoque por depósito.
   */
  async getInventory(opts?: SapRequestOptions): Promise<SqlQueryResult> {
    return this.executeQuery(WMS_QUERIES.INVENTORY_BY_WAREHOUSE.QueryDescription, [], opts);
  }

  /**
   * Busca itens ativos (catálogo).
   */
  async getActiveItems(opts?: SapRequestOptions): Promise<SqlQueryResult> {
    return this.executeQuery(WMS_QUERIES.ACTIVE_ITEMS.QueryDescription, [], opts);
  }

  /**
   * Busca depósitos ativos.
   */
  async getActiveWarehouses(opts?: SapRequestOptions): Promise<SqlQueryResult> {
    return this.executeQuery(WMS_QUERIES.ACTIVE_WAREHOUSES.QueryDescription, [], opts);
  }

  /**
   * Busca clientes ativos.
   */
  async getActiveCustomers(opts?: SapRequestOptions): Promise<SqlQueryResult> {
    return this.executeQuery(WMS_QUERIES.ACTIVE_CUSTOMERS.QueryDescription, [], opts);
  }
}
