/**
 * Tipos para entidades do SAP Business One Service Layer
 * Baseado no contrato de integração (API_CONTRACTS/sap-b1-integration-contract.md)
 */

// ============================================================================
// Enums / Literais
// ============================================================================

/** Status do documento no SAP */
export type SapDocStatus =
  | "bost_Open"
  | "bost_Close"
  | "bost_Paid"
  | "bost_Delivered";

/**
 * Valores válidos para o UDF U_WMS_STATUS no SAP.
 * Representam o ciclo de vida do pedido dentro do WMS.
 */
export type WmsUdfStatus =
  | "IMPORTADO"
  | "A_SEPARAR"
  | "EM_SEPARACAO"
  | "SEPARADO"
  | "EM_CONFERENCIA"
  | "CONFERIDO"
  | "EM_EXPEDICAO"
  | "DESPACHADO"
  | "ERRO";

// ============================================================================
// Linha de documento
// ============================================================================

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
  MeasureUnit?: string;
};

// ============================================================================
// Pedido (Sales Order)
// ============================================================================

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

  // Auditoria SAP
  CreateDate?: string;
  CreateTime?: string;
  UpdateDate?: string;
  UpdateTime?: string;

  // UDFs customizados do WMS
  U_WMS_STATUS?: WmsUdfStatus | string | null;
  U_WMS_ORDERID?: string | null;
  U_WMS_LAST_EVENT?: string | null;
  U_WMS_LAST_TS?: string | null;
  U_WMS_CORR_ID?: string | null;

  // Linhas do pedido
  DocumentLines?: SapDocumentLine[];
};

// ============================================================================
// Business Partner (Cliente / Fornecedor)
// ============================================================================

export type SapBusinessPartner = {
  CardCode: string;
  CardName: string;
  CardType?: "cCustomer" | "cSupplier" | "cLead";
  Phone1?: string;
  EmailAddress?: string;
  Address?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Country?: string;
  FederalTaxID?: string;   // CNPJ/CPF
  Valid?: "tYES" | "tNO";
  Frozen?: "tYES" | "tNO";
};

// ============================================================================
// Item (Produto)
// ============================================================================

export type SapItem = {
  ItemCode: string;
  ItemName: string;
  InventoryUOM?: string;
  InventoryItem?: "tYES" | "tNO";
  SalesItem?: "tYES" | "tNO";
  PurchaseItem?: "tYES" | "tNO";
  Valid?: "tYES" | "tNO";
  Frozen?: "tYES" | "tNO";
  QuantityOnStock?: number;
  UpdateDate?: string;
  UpdateTime?: string;
};

// ============================================================================
// Warehouse (Depósito)
// ============================================================================

export type SapWarehouse = {
  WarehouseCode: string;
  WarehouseName: string;
  Inactive?: "tYES" | "tNO";
};

// ============================================================================
// Estoque por depósito
// ============================================================================

export type SapItemWarehouseInfo = {
  WarehouseCode: string;
  InStock?: number;
  Committed?: number;
  Ordered?: number;
  Available?: number;
};

// ============================================================================
// Resposta OData
// ============================================================================

export type SapCollectionResponse<T> = {
  "odata.metadata"?: string;
  value: T[];
};

// ============================================================================
// Filtros
// ============================================================================

export type SapOrdersFilter = {
  status?: "open" | "closed" | "all";
  cardCode?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  skip?: number;
};

// ============================================================================
// Payload para atualizar UDFs do pedido
// ============================================================================

export type SapOrderStatusUpdate = {
  U_WMS_STATUS?: WmsUdfStatus | string;
  U_WMS_ORDERID?: string;
  U_WMS_LAST_EVENT?: string;
  U_WMS_LAST_TS?: string;
  U_WMS_CORR_ID?: string;
};
