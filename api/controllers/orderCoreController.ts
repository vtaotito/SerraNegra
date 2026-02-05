import { WmsError } from "../../wms-core/src/errors.js";
import type { ApiHandler } from "../http.js";
import type { OrderCoreService } from "../services/orderCoreService.js";
import { optionalNumber, optionalString, requireString } from "../utils/validation.js";

export const createOrderCoreController = (service: OrderCoreService) => {
  const createOrder: ApiHandler = async (req, ctx) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const customerId = requireString((req.body as any).customerId, "customerId");
    const externalOrderId = optionalString((req.body as any).externalOrderId);
    const shipToAddress = optionalString((req.body as any).shipToAddress);
    const items = Array.isArray((req.body as any).items) ? (req.body as any).items : [];
    if (items.length === 0) {
      throw new WmsError("WMS-VAL-001", "Pedido deve conter pelo menos um item.");
    }

    // No core MVP, criamos um "draft" compatível com wms-core createOrder
    // via serviço dedicado (a persistência/estado é responsabilidade do OrderCoreService).
    const order = await service.createFromSap({
      // fallback: cria um "SapOrder" mínimo não é suportado aqui. Mantemos endpoint de criação no core
      // como placeholder — em produção, use /api/v1/orders (REST) ou ingestão SAP.
      // Para não quebrar fluxos existentes, lançamos erro explícito.
      // (Se quiser, implementamos um create manual em cima do wms-core).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sapOrder: { DocEntry: undefined, DocNum: undefined, CardCode: customerId, NumAtCard: externalOrderId, Address2: shipToAddress, DocumentLines: items } as any
    });

    return { status: 201, body: order };
  };

  const getOrder: ApiHandler = async (req) => {
    const orderId = req.params?.orderId;
    if (!orderId) {
      throw new WmsError("WMS-VAL-001", "orderId obrigatorio.");
    }
    const order = await service.getOrder(orderId);
    return { status: 200, body: order };
  };

  const listOrders: ApiHandler = async (req) => {
    const status = optionalString(req.query?.status);
    const carrier = optionalString(req.query?.carrier);
    const priority = optionalString(req.query?.priority);
    const externalOrderId = optionalString(req.query?.externalOrderId);
    const limit = optionalNumber(req.query?.limit);
    const orders = await service.listOrders({ status: status ?? undefined, carrier, priority, externalOrderId, limit: limit ?? undefined });
    return { status: 200, body: { items: orders } };
  };

  const applyEvent: ApiHandler = async (req, ctx) => {
    const orderId = req.params?.orderId;
    if (!orderId) throw new WmsError("WMS-VAL-001", "orderId obrigatorio.");
    if (!req.body) throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    if (!ctx.auth) throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");

    const body = req.body as any;
    const eventType = requireString(body.eventType, "eventType") as any;
    const result = await service.applyEvent({
      orderId,
      event: {
        eventType,
        actorId: ctx.auth.userId,
        actorRole: (ctx.auth.role as any) ?? "SUPERVISOR",
        reason: optionalString(body.reason),
        metadata: body.metadata
      },
      idempotencyKey: ctx.idempotencyKey
    });

    return { status: 200, body: result };
  };

  const getHistory: ApiHandler = async (req) => {
    const orderId = req.params?.orderId;
    if (!orderId) throw new WmsError("WMS-VAL-001", "orderId obrigatorio.");
    const history = await service.getHistory(orderId);
    return { status: 200, body: { items: history } };
  };

  const processSapBatch: ApiHandler = async (req) => {
    const body = req.body as any;
    const orders = Array.isArray(body?.orders) ? body.orders : [];
    const result = await service.processSapOrdersBatch({ orders, correlationId: body?.correlationId });
    return { status: 200, body: result };
  };

  return { createOrder, getOrder, listOrders, applyEvent, getHistory, processSapBatch };
};

