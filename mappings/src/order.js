/**
 * Mapeamento: SAP B1 Service Layer -> modelo do Orquestrador (SPEC.md).
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
        items,
        sapDocumentId: `Orders:${order.DocEntry}`,
        sapDocEntry: order.DocEntry,
        sapDocNum: order.DocNum
    };
}
//# sourceMappingURL=order.js.map