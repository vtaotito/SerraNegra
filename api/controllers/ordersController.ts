import { WmsError } from "../../wms-core/src/errors.js";
import {
  OrderCreateRequest,
  OrderDetailResponse,
  OrderQuery,
  OrderResponse,
  OrderUpdateRequest
} from "../dtos/orders.js";
import { ApiHandler } from "../http.js";
import { optionalNumber, optionalString, requireString } from "../utils/validation.js";

export type OrdersService = {
  listOrders: (query: OrderQuery) => Promise<{ data: OrderResponse[]; nextCursor?: string }>;
  getOrder: (orderId: string) => Promise<OrderDetailResponse | undefined>;
  createOrder: (input: OrderCreateRequest, actorId: string) => Promise<OrderResponse>;
  updateOrder: (orderId: string, input: OrderUpdateRequest, actorId: string) => Promise<OrderResponse>;
  deleteOrder: (orderId: string, actorId: string) => Promise<void>;
};

export const createOrdersController = (service: OrdersService) => {
  const listOrders: ApiHandler = async (req) => {
    const query: OrderQuery = {
      customerId: optionalString(req.query?.customerId),
      status: req.query?.status as OrderQuery["status"],
      externalOrderId: optionalString(req.query?.externalOrderId),
      priority: optionalString(req.query?.priority),
      from: optionalString(req.query?.from),
      to: optionalString(req.query?.to),
      limit: optionalNumber(req.query?.limit),
      cursor: optionalString(req.query?.cursor)
    };
    const result = await service.listOrders(query);
    return {
      status: 200,
      body: result
    };
  };

  const getOrder: ApiHandler = async (req) => {
    const orderId = req.params?.orderId;
    if (!orderId) {
      throw new WmsError("WMS-VAL-001", "orderId obrigatorio.");
    }
    const order = await service.getOrder(orderId);
    if (!order) {
      return { status: 404, body: { error: { code: "NOT_FOUND", message: "Pedido nao encontrado." } } };
    }
    return {
      status: 200,
      body: order
    };
  };

  const createOrder: ApiHandler<OrderCreateRequest> = async (req, ctx) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const input: OrderCreateRequest = {
      externalOrderId: optionalString(req.body.externalOrderId),
      customerId: requireString(req.body.customerId, "customerId"),
      shipToAddress: optionalString(req.body.shipToAddress),
      items: req.body.items ?? [],
      priority: req.body.priority,
      notes: optionalString(req.body.notes)
    };
    if (input.items.length === 0) {
      throw new WmsError("WMS-VAL-001", "Pedido deve conter pelo menos um item.");
    }
    const order = await service.createOrder(input, ctx.auth.userId);
    return {
      status: 201,
      body: order
    };
  };

  const updateOrder: ApiHandler<OrderUpdateRequest> = async (req, ctx) => {
    const orderId = req.params?.orderId;
    if (!orderId) {
      throw new WmsError("WMS-VAL-001", "orderId obrigatorio.");
    }
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const order = await service.updateOrder(orderId, req.body, ctx.auth.userId);
    return {
      status: 200,
      body: order
    };
  };

  const deleteOrder: ApiHandler = async (req, ctx) => {
    const orderId = req.params?.orderId;
    if (!orderId) {
      throw new WmsError("WMS-VAL-001", "orderId obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    await service.deleteOrder(orderId, ctx.auth.userId);
    return { status: 204 };
  };

  return {
    listOrders,
    getOrder,
    createOrder,
    updateOrder,
    deleteOrder
  };
};
