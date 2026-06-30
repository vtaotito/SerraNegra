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
 * Cache de estado das queries: evita tentar criar/executar queries
 * que já sabemos que falham nesta instância SAP.
 * Chave = QueryDescription, Valor = { available, checkedAt }.
 */
const queryStateCache = new Map<string, { available: boolean; checkedAt: number }>();
const QUERY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

/**
 * Indica se /SQLQueries é suportado nesta instância SAP.
 * null = desconhecido, true/false = detectado.
 */
let sqlQueriesEndpointAvailable: boolean | null = null;
let sqlQueriesCheckedAt = 0;

export function isSqlQueriesAvailable(): boolean | null {
  if (sqlQueriesEndpointAvailable === null) return null;
  if (Date.now() - sqlQueriesCheckedAt > QUERY_CACHE_TTL_MS) {
    sqlQueriesEndpointAvailable = null;
    return null;
  }
  return sqlQueriesEndpointAvailable;
}

export function resetSqlQueriesCache(): void {
  queryStateCache.clear();
  sqlQueriesEndpointAvailable = null;
  sqlQueriesCheckedAt = 0;
}

/**
 * Helper para gerenciar SQLQueries no SAP B1 Service Layer.
 */
export class SqlQueriesHelper {
  constructor(private client: SapServiceLayerClient) {}

  /**
   * Cria uma nova SQLQuery no SAP B1.
   *
   * O Service Layer (B1 9.x / HANA) espera o payload com SqlCode/SqlName/SqlText.
   * Mantemos o tipo SqlQueryDefinition (QueryCategory/QueryDescription/Query) por
   * compatibilidade e mapeamos para o schema correto aqui.
   */
  async createQuery(definition: SqlQueryDefinition, opts?: SapRequestOptions): Promise<void> {
    const payload = {
      SqlCode: definition.QueryDescription,
      SqlName: definition.QueryDescription,
      SqlText: definition.Query,
    };
    await this.client.post("/SQLQueries", payload, opts);
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
   * Cria uma query se não existir. Usa cache para evitar requests repetidos.
   */
  async ensureQuery(definition: SqlQueryDefinition, opts?: SapRequestOptions): Promise<void> {
    const name = definition.QueryDescription;
    const cached = queryStateCache.get(name);
    if (cached && Date.now() - cached.checkedAt < QUERY_CACHE_TTL_MS) {
      if (cached.available) return;
      throw new Error(`SQLQuery '${name}' indisponível (cache)`);
    }

    try {
      const exists = await this.queryExists(name, opts);
      if (!exists) {
        await this.createQuery(definition, opts);
      }
      queryStateCache.set(name, { available: true, checkedAt: Date.now() });
      sqlQueriesEndpointAvailable = true;
      sqlQueriesCheckedAt = Date.now();
    } catch (err) {
      queryStateCache.set(name, { available: false, checkedAt: Date.now() });
      const status = (err as { status?: number }).status;
      // Atenção: um 400 normalmente é específico da query (SQL inválido, tabela
      // não acessível, payload), NÃO indica que o endpoint /SQLQueries está
      // indisponível. Marcar o endpoint como indisponível aqui faria queries
      // válidas (ex.: inventário enriquecido) caírem no fallback indevidamente.
      // Só consideramos o endpoint ausente em 404/405 (rota inexistente).
      if (status === 404 || status === 405) {
        sqlQueriesEndpointAvailable = false;
        sqlQueriesCheckedAt = Date.now();
      }
      throw err;
    }
  }

  /**
   * Executa uma SQLQuery já criada, paginando o endpoint /List.
   *
   * O Service Layer retorna no máximo 20 registros por página e expõe
   * `odata.nextLink` para a próxima página. Aqui acumulamos todas as páginas
   * em um único `value` para o chamador (que espera o conjunto completo).
   */
  async executeQuery<T = unknown>(
    queryName: string,
    params: SqlQueryParam[] = [],
    opts?: SapRequestOptions
  ): Promise<SqlQueryResult<T>> {
    const body = params.length > 0 ? { ParamsCollection: params } : undefined;
    const all: T[] = [];
    let path: string | null = `/SQLQueries('${queryName}')/List`;
    let guard = 0;

    while (path && guard < 5000) {
      const res = await this.client.post<
        SqlQueryResult<T> & { "odata.nextLink"?: string; "@odata.nextLink"?: string }
      >(path, body, opts);
      const data = res.data;
      if (Array.isArray(data.value)) all.push(...data.value);
      const next = data["odata.nextLink"] ?? data["@odata.nextLink"];
      path = next ? (next.startsWith("/") ? next : `/${next}`) : null;
      guard++;
    }

    return { value: all };
  }

  /**
   * Deleta uma SQLQuery. Tenta DELETE primeiro, fallback para POST /Delete.
   */
  async deleteQuery(queryName: string, opts?: SapRequestOptions): Promise<void> {
    const path = `/SQLQueries('${queryName}')`;
    try {
      await this.client.delete(path, opts);
      return;
    } catch { /* fallback below */ }
    try {
      await this.client.post(`${path}/Delete`, undefined, opts);
    } catch { /* best-effort */ }
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
  },

  /**
   * Query: Estoque enriquecido com custo, datas, grupo e UDFs.
   * Join OITM + OITW + OITB. Sem parâmetros.
   */
  INVENTORY_ENRICHED: {
    QueryCategory: -1,
    QueryDescription: "WMS_Inventory_Enriched",
    // Apenas OITM + OITW: nesta instância (HANA) a tabela OITB e UDFs não são
    // acessíveis via SQLQueries (retornam 400). O nome do grupo é resolvido
    // posteriormente via OData (/ItemGroups) usando ItmsGrpCod.
    Query: `SELECT T0.ItemCode, T0.ItemName, T0.InvntryUom AS UoM, T0.AvgPrice, T0.LastPurPrc, T0.LastPurDat, T0.LstSalDate, T0.SWeight1 AS GrossWeight, T0.LeadTime, T0.ItmsGrpCod, T1.WhsCode AS WarehouseCode, T1.OnHand, T1.IsCommited AS Committed, T1.OnOrder AS Ordered, T1.MinStock AS WhsMinStock, T1.MaxStock AS WhsMaxStock FROM OITM T0 INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode WHERE T0.frozenFor = 'N' AND T0.validFor = 'Y' AND (T1.OnHand <> 0 OR T1.IsCommited <> 0 OR T1.OnOrder <> 0) ORDER BY T0.ItemCode, T1.WhsCode`
  },

  /**
   * Query: Movimentações de estoque recentes (OINM).
   * Parâmetros:
   *  [%0] = Data inicial (YYYY-MM-DD)
   */
  STOCK_MOVEMENTS: {
    QueryCategory: -1,
    QueryDescription: "WMS_Stock_Movements",
    Query: `SELECT T0.ItemCode, T0.Warehouse, T0.DocDate, T0.CreateDate, T0.InQty, T0.OutQty, T0.TransType, T0.BASE_REF, T0.CalcPrice, T0.Balance FROM OINM T0 WHERE T0.DocDate >= [%0] ORDER BY T0.DocDate DESC, T0.ItemCode`
  },

  /**
   * Query: Preços de venda por lista de preços ativa.
   * Sem parâmetros.
   */
  ITEM_PRICES: {
    QueryCategory: -1,
    QueryDescription: "WMS_Item_Prices",
    Query: `SELECT T0.ItemCode, T0.Price, T0.PriceList, T1.ListName FROM ITM1 T0 INNER JOIN OPLN T1 ON T0.PriceList = T1.ListNum WHERE T1.ValidFor = 'Y' ORDER BY T0.ItemCode, T0.PriceList`
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

  /**
   * Busca estoque enriquecido (OITM+OITW+OITB com custo, datas, grupo).
   */
  async getInventoryEnriched(opts?: SapRequestOptions): Promise<SqlQueryResult<EnrichedInventoryRow>> {
    return this.executeQuery<EnrichedInventoryRow>(
      WMS_QUERIES.INVENTORY_ENRICHED.QueryDescription, [], opts
    );
  }

  /**
   * Busca movimentações de estoque desde uma data.
   */
  async getStockMovements(dateFrom: string, opts?: SapRequestOptions): Promise<SqlQueryResult<StockMovementRow>> {
    return this.executeQuery<StockMovementRow>(
      WMS_QUERIES.STOCK_MOVEMENTS.QueryDescription,
      [{ Name: "dateFrom", Value: dateFrom }],
      opts
    );
  }

  /**
   * Busca preços de venda por lista ativa.
   */
  async getItemPrices(opts?: SapRequestOptions): Promise<SqlQueryResult<ItemPriceRow>> {
    return this.executeQuery<ItemPriceRow>(
      WMS_QUERIES.ITEM_PRICES.QueryDescription, [], opts
    );
  }
}

/* ── Row types retornados pelas SQLQueries ── */

export type EnrichedInventoryRow = {
  ItemCode: string;
  ItemName: string;
  UoM: string;
  AvgPrice: number;
  LastPurPrc: number;
  LastPurDat: string | null;
  LstSalDate: string | null;
  GrossWeight: number;
  LeadTime: number;
  ItmsGrpCod: number;
  WarehouseCode: string;
  OnHand: number;
  Committed: number;
  Ordered: number;
  WhsMinStock: number;
  WhsMaxStock: number;
  // Campos não disponíveis nesta instância (OITB/UDFs/MaxInvtry inacessíveis):
  MaxStock?: number;
  LastSaleQty?: number;
  LastBuyQty?: number;
  GroupName?: string | null;
  U_COD?: string | null;
  U_UNIT?: string | null;
  U_EMBALA?: string | null;
  U_SubNome?: string | null;
  LastCountDate?: string | null;
};

export type StockMovementRow = {
  ItemCode: string;
  Warehouse: string;
  DocDate: string;
  CreateDate: string;
  InQty: number;
  OutQty: number;
  TransType: number;
  BASE_REF: string;
  CalcPrice: number;
  Balance: number;
};

export type ItemPriceRow = {
  ItemCode: string;
  Price: number;
  PriceList: number;
  ListName: string;
};
