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
export function mapOrderFromSapB1(order) {
    const items = order.DocumentLines?.map((l) => ({
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
export function mapSapStatusToWmsInitial(sapStatus) {
    switch (sapStatus) {
        case "bost_Open":
            return "A_SEPARAR"; // Pedido aberto no SAP → pendente de separação no WMS
        case "bost_Close":
            return "DESPACHADO"; // Pedido fechado no SAP → considerar já despachado
        default:
            return "A_SEPARAR"; // Default: considerar pendente
    }
}
//# sourceMappingURL=order.js.map