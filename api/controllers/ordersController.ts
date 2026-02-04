/**
 * Orders Controller - Endpoints REST para pedidos
 */
import { WmsError } from "../../wms-core/src/errors.js";
import type { OrderEvent, OrderEventType, OrderStatus } from "../../wms-core/src/domain/order.js";
import type { OrderCoreService } from "../services/orderCoreService.js";
import type { ApiHandler } from "../http.js";
import { requireString, optionalString } from "../utils/validation.js";

export type OrdersController = {
  createOrder: ApiHandler;
  getOrder: ApiHandler;
  listOrders: ApiHandler;
  applyEvent: ApiHandler;
  getHistory: ApiHandler;
  // Endpoint interno (worker)
  processSapBatch: ApiHandler;
};

export const createOrdersController = (service: OrderCoreService): OrdersController => {
  /**
   * POST /orders
   * Cria um novo pedido manualmente (raro, geralmente vem do SAP)
   */
  const createOrder: ApiHandler = async (req) => {
    if (!req.body || typeof req.body !== "object") {
      throw new WmsError("WMS-VAL-001", "Payload inválido");
    }

    const body = req.body as any;
    const sapOrder = {
      DocEntry: body.sapDocEntry || 0,
      DocNum: body.sapDocNum || 0,
      CardCode: requireString(body.customerId, "customerId"),
      CardName: optionalString(body.customerName),
      DocDate: optionalString(body.createdAt),
      DocDueDate: optionalString(body.slaDueAt),
      DocumentLines: Array.isArray(body.items)
        ? body.items.map((item: any) => ({
            LineNum: 0,
            ItemCode: requireString(item.sku, "sku"),
            Quantity: Number(item.quantity) || 0
          }))
        : []
    };

    const order = await service.createFromSap({
      sapOrder,
      correlationId: req.headers["x-correlation-id"]
    });

    return {
      status: 201,
      body: {
        orderId: order.id,
        status: order.status,
        createdAt: order.createdAt
      }
    };
  };

  /**
   * GET /orders/:orderId
   * Obtém detalhes de um pedido
   */
  const getOrder: ApiHandler = async (req) => {
    const orderId = req.params?.orderId;
    if (!orderId) {
      throw new WmsError("WMS-VAL-002", "orderId é obrigatório");
    }

    const order = await service.getOrder(orderId);

    return {
      status: 200,
      body: order
    };
  };

  /**
   * GET /orders
   * Lista pedidos com filtros
   * Query: status, carrier, priority, limit
   */
  const listOrders: ApiHandler = async (req) => {
    const query = req.query || {};
    const filter = {
      status: query.status as OrderStatus | undefined,
      carrier: query.carrier,
      priority: query.priority,
      limit: query.limit ? Number(query.limit) : 200
    };

    const orders = await service.listOrders(filter);

    return {
      status: 200,
      body: {
        items: orders,
        nextCursor: null // MVP: sem paginação
      }
    };
  };

  /**
   * POST /orders/:orderId/events
   * Aplica um evento de transição
   */
  const applyEvent: ApiHandler = async (req, ctx) => {
    const orderId = req.params?.orderId;
    if (!orderId) {
      throw new WmsError("WMS-VAL-002", "orderId é obrigatório");
    }

    if (!req.body || typeof req.body !== "object") {
      throw new WmsError("WMS-VAL-001", "Payload inválido");
    }

    const body = req.body as any;
    const actorId = ctx.auth?.userId || "system";
    const actorRole = ctx.auth?.role || "SUPERVISOR";

    const event: OrderEvent = {
      eventType: requireString(body.type, "type") as OrderEventType,
      actorId,
      actorRole: actorRole.toUpperCase() as any,
      occurredAt: optionalString(body.occurredAt),
      reason: optionalString(body.reason),
      metadata: body.metadata
    };

    const result = await service.applyEvent({
      orderId,
      event,
      idempotencyKey: ctx.idempotencyKey
    });

    return {
      status: 200,
      body: {
        orderId: result.order.id,
        previousStatus: result.transition.from,
        currentStatus: result.order.status,
        applied: true,
        event: {
          eventId: result.transition.orderId + "-" + Date.now(),
          type: result.transition.eventType,
          from: result.transition.from,
          to: result.transition.to,
          occurredAt: result.transition.occurredAt,
          actor: {
            kind: "USER",
            id: result.transition.actorId
          },
          idempotencyKey: result.transition.idempotencyKey
        }
      }
    };
  };

  /**
   * GET /orders/:orderId/history
   * Obtém histórico de transições
   */
  const getHistory: ApiHandler = async (req) => {
    const orderId = req.params?.orderId;
    if (!orderId) {
      throw new WmsError("WMS-VAL-002", "orderId é obrigatório");
    }

    const transitions = await service.getHistory(orderId);

    return {
      status: 200,
      body: {
        orderId,
        events: transitions.map((t, idx) => ({
          eventId: t.orderId + "-" + idx,
          type: t.eventType,
          from: t.from,
          to: t.to,
          occurredAt: t.occurredAt,
          actor: {
            kind: "USER",
            id: t.actorId
          },
          idempotencyKey: t.idempotencyKey
        }))
      }
    };
  };

  /**
   * POST /internal/sap/orders
   * Endpoint interno para o Worker processar pedidos do SAP
   * Requer X-Internal-Secret header
   */
  const processSapBatch: ApiHandler = async (req) => {
    const secret = req.headers["x-internal-secret"];
    const expectedSecret = process.env.INTERNAL_SHARED_SECRET || "dev-internal-secret";

    if (secret !== expectedSecret) {
      throw new WmsError("WMS-AUTH-001", "Unauthorized");
    }

    if (!req.body || typeof req.body !== "object") {
      throw new WmsError("WMS-VAL-001", "Payload inválido");
    }

    const body = req.body as any;
    if (!Array.isArray(body.orders)) {
      throw new WmsError("WMS-VAL-001", "orders deve ser um array");
    }

    const result = await service.processSapOrdersBatch({
      orders: body.orders,
      correlationId: req.headers["x-correlation-id"]
    });

    return {
      status: 200,
      body: {
        ok: true,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
    };
  };

  return {
    createOrder,
    getOrder,
    listOrders,
    applyEvent,
    getHistory,
    processSapBatch
  };
};
