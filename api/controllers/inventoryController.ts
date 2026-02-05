import { WmsError } from "../../wms-core/src/errors.js";
import {
  InventoryAdjustmentRequest,
  InventoryAdjustmentResponse,
  InventoryQuery,
  InventoryRecord,
  InventoryTransferRequest,
  InventoryTransferResponse
} from "../dtos/inventory.js";
import { ApiHandler } from "../http.js";
import { optionalNumber, optionalString, requireString } from "../utils/validation.js";

export type InventoryService = {
  listInventory: (query: InventoryQuery) => Promise<{ data: InventoryRecord[]; nextCursor?: string }>;
  getInventory: (itemCode: string, warehouseCode: string) => Promise<InventoryRecord | undefined>;
  adjustInventory: (input: InventoryAdjustmentRequest, actorId: string) => Promise<InventoryAdjustmentResponse>;
  transferInventory: (input: InventoryTransferRequest, actorId: string) => Promise<InventoryTransferResponse>;
};

export const createInventoryController = (service: InventoryService) => {
  const listInventory: ApiHandler = async (req) => {
    const query: InventoryQuery = {
      itemCode: optionalString(req.query?.itemCode),
      warehouseCode: optionalString(req.query?.warehouseCode),
      batchNumber: optionalString(req.query?.batchNumber),
      minQuantity: optionalNumber(req.query?.minQuantity),
      includeReserved: req.query?.includeReserved === "true",
      limit: optionalNumber(req.query?.limit),
      cursor: optionalString(req.query?.cursor)
    };
    const result = await service.listInventory(query);
    return {
      status: 200,
      body: result
    };
  };

  const getInventory: ApiHandler = async (req) => {
    const itemCode = req.params?.itemCode;
    const warehouseCode = req.params?.warehouseCode;
    if (!itemCode || !warehouseCode) {
      throw new WmsError("WMS-VAL-001", "itemCode e warehouseCode obrigatorios.");
    }
    const inventory = await service.getInventory(itemCode, warehouseCode);
    if (!inventory) {
      return { status: 404, body: { error: { code: "NOT_FOUND", message: "Registro de inventario nao encontrado." } } };
    }
    return {
      status: 200,
      body: inventory
    };
  };

  const adjustInventory: ApiHandler<InventoryAdjustmentRequest> = async (req, ctx) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const input: InventoryAdjustmentRequest = {
      itemCode: requireString(req.body.itemCode, "itemCode"),
      warehouseCode: requireString(req.body.warehouseCode, "warehouseCode"),
      quantity: req.body.quantity ?? 0,
      adjustmentType: req.body.adjustmentType,
      reason: requireString(req.body.reason, "reason"),
      batchNumber: optionalString(req.body.batchNumber),
      location: optionalString(req.body.location),
      notes: optionalString(req.body.notes)
    };
    const result = await service.adjustInventory(input, ctx.auth.userId);
    return {
      status: 201,
      body: result
    };
  };

  const transferInventory: ApiHandler<InventoryTransferRequest> = async (req, ctx) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const input: InventoryTransferRequest = {
      itemCode: requireString(req.body.itemCode, "itemCode"),
      fromWarehouseCode: requireString(req.body.fromWarehouseCode, "fromWarehouseCode"),
      toWarehouseCode: requireString(req.body.toWarehouseCode, "toWarehouseCode"),
      quantity: req.body.quantity ?? 0,
      reason: requireString(req.body.reason, "reason"),
      batchNumber: optionalString(req.body.batchNumber),
      notes: optionalString(req.body.notes)
    };
    const result = await service.transferInventory(input, ctx.auth.userId);
    return {
      status: 202,
      body: result
    };
  };

  return {
    listInventory,
    getInventory,
    adjustInventory,
    transferInventory
  };
};
