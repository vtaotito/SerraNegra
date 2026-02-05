/**
 * Mapeamento: SAP B1 Service Layer -> modelo do Orquestrador (SPEC.md).
 *
 * Baseado em mapeamento real da base REDACTED_COMPANY_DB (2026-02-05).
 * Ver documentação completa em: sap-connector/Orders-WMS-Mapping.md
 *
 * Observação importante:
 * - Para "orderId" (interno) o orquestrador deve gerar UUID/ULID.
 * - Aqui mapeamos apenas o "externalOrderId" (ERP) + campos essenciais.
 */
export type ServiceLayerOrder = {
    DocEntry: number;
    DocNum: number;
    CardCode: string;
    CardName?: string;
    DocumentStatus?: "bost_Open" | "bost_Close";
    Cancelled?: "tYES" | "tNO";
    DocDate?: string;
    DocDueDate?: string;
    CreationDate?: string;
    DocTotal?: number;
    DocCurrency?: string;
    DocumentLines?: Array<{
        LineNum: number;
        ItemCode: string;
        ItemDescription?: string;
        Quantity: number;
        WarehouseCode?: string;
        MeasureUnit?: string;
        LineStatus?: "bost_Open" | "bost_Close";
        Price?: number;
        LineTotal?: number;
    }>;
};
export type WmsOrderItem = {
    sku: string;
    quantity: number;
};
export type WmsOrderDraft = {
    externalOrderId: string;
    customerId: string;
    customerName?: string;
    items: WmsOrderItem[];
    sapDocumentId: string;
    sapDocEntry: number;
    sapDocNum: number;
    sapStatus?: string;
    docDate?: string;
    docTotal?: number;
};
export declare function mapOrderFromSapB1(order: ServiceLayerOrder): WmsOrderDraft;
/**
 * Mapeia status do SAP B1 para status inicial do WMS.
 * Nota: o fluxo completo de status é gerenciado pela state machine do WMS.
 */
export declare function mapSapStatusToWmsInitial(sapStatus?: string): string;
