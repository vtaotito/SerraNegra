/**
 * Mapeamento: SAP B1 Service Layer -> modelo do Orquestrador (SPEC.md).
 *
 * Observação importante:
 * - Para "orderId" (interno) o orquestrador deve gerar UUID/ULID.
 * - Aqui mapeamos apenas o "externalOrderId" (ERP) + campos essenciais.
 */
export type ServiceLayerOrder = {
    DocEntry: number;
    DocNum: number;
    CardCode: string;
    DocStatus?: "O" | "C";
    DocumentLines?: Array<{
        LineNum: number;
        ItemCode: string;
        Quantity: number;
        WarehouseCode?: string;
    }>;
    UpdateDate?: string;
    UpdateTime?: string;
};
export type WmsOrderItem = {
    sku: string;
    quantity: number;
};
export type WmsOrderDraft = {
    externalOrderId: string;
    customerId: string;
    items: WmsOrderItem[];
    sapDocumentId: string;
    sapDocEntry: number;
    sapDocNum: number;
};
export declare function mapOrderFromSapB1(order: ServiceLayerOrder): WmsOrderDraft;
