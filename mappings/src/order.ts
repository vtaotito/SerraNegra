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
  DocEntry: number; // chave interna SAP (PK)
  DocNum: number; // número do documento (visível ao usuário)
  CardCode: string; // código do cliente
  CardName?: string; // nome do cliente
  DocumentStatus?: "bost_Open" | "bost_Close"; // Status do pedido (CORRETO)
  Cancelled?: "tYES" | "tNO"; // Se foi cancelado
  DocDate?: string; // Data do pedido (ISO-8601)
  DocDueDate?: string; // Data de vencimento
  CreationDate?: string; // Data de criação
  DocTotal?: number; // Valor total
  DocCurrency?: string; // Moeda (ex: R$)
  DocumentLines?: Array<{
    LineNum: number;
    ItemCode: string;
    ItemDescription?: string;
    Quantity: number;
    WarehouseCode?: string;
    MeasureUnit?: string; // Unidade de medida (ex: UN)
    LineStatus?: "bost_Open" | "bost_Close";
    Price?: number;
    LineTotal?: number;
  }>;
};

export type WmsOrderItem = { sku: string; quantity: number };

export type WmsOrderDraft = {
  externalOrderId: string;
  customerId: string;
  customerName?: string;
  items: WmsOrderItem[];
  sapDocumentId: string;
  sapDocEntry: number;
  sapDocNum: number;
  sapStatus?: string; // Status original do SAP (para referência)
  docDate?: string; // Data do pedido no SAP
  docTotal?: number; // Valor total
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
    customerName: order.CardName,
    items,
    sapDocumentId: `Orders:${order.DocEntry}`,
    sapDocEntry: order.DocEntry,
    sapDocNum: order.DocNum,
    sapStatus: order.DocumentStatus,
    docDate: order.DocDate,
    docTotal: order.DocTotal
  };
}

/**
 * Mapeia status do SAP B1 para status inicial do WMS.
 * Nota: o fluxo completo de status é gerenciado pela state machine do WMS.
 */
export function mapSapStatusToWmsInitial(sapStatus?: string): string {
  switch (sapStatus) {
    case "bost_Open":
      return "A_SEPARAR"; // Pedido aberto no SAP → pendente de separação no WMS
    case "bost_Close":
      return "DESPACHADO"; // Pedido fechado no SAP → considerar já despachado
    default:
      return "A_SEPARAR"; // Default: considerar pendente
  }
}

