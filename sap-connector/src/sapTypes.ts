/**
 * Tipos para entidades do SAP Business One Service Layer
 * Baseado no contrato de integração (API_CONTRACTS/sap-b1-integration-contract.md)
 */

/**
 * Linha de documento (item do pedido)
 */
export type SapDocumentLine = {
  LineNum: number;
  ItemCode: string;
  ItemDescription?: string;
  Quantity: number;
  WarehouseCode?: string;
  Price?: number;
  Currency?: string;
  TaxCode?: string;
  UnitPrice?: number;
  LineTotal?: number;
};

/**
 * Status do documento no SAP
 */
export type SapDocStatus = "bost_Open" | "bost_Close" | "bost_Paid" | "bost_Delivered";

/**
 * Pedido (Sales Order) do SAP
 */
export type SapOrder = {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName?: string;
  DocDate?: string;
  DocDueDate?: string;
  DocStatus?: SapDocStatus;
  DocumentStatus?: string;
  DocTotal?: number;
  DocCurrency?: string;
  Comments?: string;
  
  // Campos de auditoria
  CreateDate?: string;
  CreateTime?: string;
  UpdateDate?: string;
  UpdateTime?: string;
  
  // UDFs customizados do WMS
  U_WMS_STATUS?: string;
  U_WMS_ORDERID?: string;
  U_WMS_LAST_EVENT?: string;
  U_WMS_LAST_TS?: string;
  U_WMS_CORR_ID?: string;
  
  // Linhas do pedido
  DocumentLines?: SapDocumentLine[];
};

/**
 * Resposta de coleção do SAP (OData)
 */
export type SapCollectionResponse<T> = {
  "odata.metadata"?: string;
  value: T[];
};

/**
 * Item do catálogo
 */
export type SapItem = {
  ItemCode: string;
  ItemName: string;
  InventoryUOM?: string;
  InventoryItem?: "tYES" | "tNO";
  SalesItem?: "tYES" | "tNO";
  PurchaseItem?: "tYES" | "tNO";
  Valid?: "tYES" | "tNO";
  Frozen?: "tYES" | "tNO";
  UpdateDate?: string;
  UpdateTime?: string;
};

/**
 * Depósito (Warehouse)
 */
export type SapWarehouse = {
  WarehouseCode: string;
  WarehouseName: string;
  Inactive?: "tYES" | "tNO";
};

/**
 * Informação de estoque por depósito
 */
export type SapItemWarehouseInfo = {
  WarehouseCode: string;
  InStock?: number;
  Committed?: number;
  Ordered?: number;
  Available?: number;
};

/**
 * Parâmetros de filtro para buscar pedidos
 */
export type SapOrdersFilter = {
  status?: "open" | "closed" | "all";
  cardCode?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  skip?: number;
};

/**
 * Payload para atualizar status do pedido (UDFs)
 */
export type SapOrderStatusUpdate = {
  U_WMS_STATUS?: string;
  U_WMS_ORDERID?: string;
  U_WMS_LAST_EVENT?: string;
  U_WMS_LAST_TS?: string;
  U_WMS_CORR_ID?: string;
};
