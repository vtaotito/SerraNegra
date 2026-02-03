/**
 * Mapeamento: SAP B1 Service Layer -> modelo do Orquestrador (SPEC.md).
 *
 * Observação importante:
 * - Para "orderId" (interno) o orquestrador deve gerar UUID/ULID.
 * - Aqui mapeamos apenas o "externalOrderId" (ERP) + campos essenciais.
 */

export type ServiceLayerOrder = {
  DocEntry: number; // chave interna SAP
  DocNum: number; // número do documento
  CardCode: string; // cliente
  DocStatus?: "O" | "C"; // Open/Closed
  DocumentLines?: Array<{
    LineNum: number;
    ItemCode: string;
    Quantity: number;
    WarehouseCode?: string;
  }>;
  UpdateDate?: string; // YYYY-MM-DD
  UpdateTime?: string; // HH:MM:SS (pode variar)
};

export type WmsOrderItem = { sku: string; quantity: number };

export type WmsOrderDraft = {
  externalOrderId: string;
  customerId: string;
  items: WmsOrderItem[];
  sapDocumentId: string;
  sapDocEntry: number;
  sapDocNum: number;
};

export function mapOrderFromSapB1(order: ServiceLayerOrder): WmsOrderDraft {
  const items =
    order.DocumentLines?.map((l) => ({
      sku: l.ItemCode,
      quantity: l.Quantity
    })) ?? [];

  return {
    externalOrderId: String(order.DocNum),
    customerId: order.CardCode,
    items,
    sapDocumentId: `Orders:${order.DocEntry}`,
    sapDocEntry: order.DocEntry,
    sapDocNum: order.DocNum
  };
}

