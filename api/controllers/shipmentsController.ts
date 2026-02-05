import { WmsError } from "../../wms-core/src/errors.js";
import {
  Shipment,
  ShipmentCreateRequest,
  ShipmentQuery,
  ShipmentUpdateRequest
} from "../dtos/shipments.js";
import { ApiHandler } from "../http.js";
import { optionalNumber, optionalString, requireString } from "../utils/validation.js";

export type ShipmentsService = {
  listShipments: (query: ShipmentQuery) => Promise<{ data: Shipment[]; nextCursor?: string }>;
  getShipment: (shipmentId: string) => Promise<Shipment | undefined>;
  createShipment: (input: ShipmentCreateRequest, actorId: string) => Promise<Shipment>;
  updateShipment: (shipmentId: string, input: ShipmentUpdateRequest, actorId: string) => Promise<Shipment>;
  deleteShipment: (shipmentId: string, actorId: string) => Promise<void>;
};

export const createShipmentsController = (service: ShipmentsService) => {
  const listShipments: ApiHandler = async (req) => {
    const query: ShipmentQuery = {
      orderId: optionalString(req.query?.orderId),
      customerId: optionalString(req.query?.customerId),
      status: req.query?.status as ShipmentQuery["status"],
      carrier: optionalString(req.query?.carrier),
      trackingCode: optionalString(req.query?.trackingCode),
      from: optionalString(req.query?.from),
      to: optionalString(req.query?.to),
      limit: optionalNumber(req.query?.limit),
      cursor: optionalString(req.query?.cursor)
    };
    const result = await service.listShipments(query);
    return {
      status: 200,
      body: result
    };
  };

  const getShipment: ApiHandler = async (req) => {
    const shipmentId = req.params?.shipmentId;
    if (!shipmentId) {
      throw new WmsError("WMS-VAL-001", "shipmentId obrigatorio.");
    }
    const shipment = await service.getShipment(shipmentId);
    if (!shipment) {
      return { status: 404, body: { error: { code: "NOT_FOUND", message: "Remessa nao encontrada." } } };
    }
    return {
      status: 200,
      body: shipment
    };
  };

  const createShipment: ApiHandler<ShipmentCreateRequest> = async (req, ctx) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const input: ShipmentCreateRequest = {
      orderId: requireString(req.body.orderId, "orderId"),
      carrier: optionalString(req.body.carrier),
      trackingCode: optionalString(req.body.trackingCode),
      packageCount: req.body.packageCount ?? 1,
      totalWeight: optionalNumber(req.body.totalWeight),
      totalVolume: optionalNumber(req.body.totalVolume),
      shippingMethod: optionalString(req.body.shippingMethod),
      estimatedDeliveryDate: optionalString(req.body.estimatedDeliveryDate),
      notes: optionalString(req.body.notes)
    };
    const shipment = await service.createShipment(input, ctx.auth.userId);
    return {
      status: 201,
      body: shipment
    };
  };

  const updateShipment: ApiHandler<ShipmentUpdateRequest> = async (req, ctx) => {
    const shipmentId = req.params?.shipmentId;
    if (!shipmentId) {
      throw new WmsError("WMS-VAL-001", "shipmentId obrigatorio.");
    }
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const shipment = await service.updateShipment(shipmentId, req.body, ctx.auth.userId);
    return {
      status: 200,
      body: shipment
    };
  };

  const deleteShipment: ApiHandler = async (req, ctx) => {
    const shipmentId = req.params?.shipmentId;
    if (!shipmentId) {
      throw new WmsError("WMS-VAL-001", "shipmentId obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    await service.deleteShipment(shipmentId, ctx.auth.userId);
    return { status: 204 };
  };

  return {
    listShipments,
    getShipment,
    createShipment,
    updateShipment,
    deleteShipment
  };
};
