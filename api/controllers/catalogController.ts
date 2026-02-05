import { WmsError } from "../../wms-core/src/errors.js";
import {
  CatalogItem,
  CatalogItemQuery,
  CatalogItemRequest,
  Warehouse,
  WarehouseQuery,
  WarehouseRequest
} from "../dtos/catalog.js";
import { ApiHandler } from "../http.js";
import { optionalNumber, optionalString, requireString } from "../utils/validation.js";

export type CatalogService = {
  listItems: (query: CatalogItemQuery) => Promise<{ data: CatalogItem[]; nextCursor?: string }>;
  getItem: (itemCode: string) => Promise<CatalogItem | undefined>;
  createItem: (input: CatalogItemRequest) => Promise<CatalogItem>;
  updateItem: (itemCode: string, input: Partial<CatalogItemRequest>) => Promise<CatalogItem>;
  deleteItem: (itemCode: string) => Promise<void>;
  listWarehouses: (query: WarehouseQuery) => Promise<{ data: Warehouse[]; nextCursor?: string }>;
  getWarehouse: (warehouseCode: string) => Promise<Warehouse | undefined>;
  createWarehouse: (input: WarehouseRequest) => Promise<Warehouse>;
  updateWarehouse: (warehouseCode: string, input: Partial<WarehouseRequest>) => Promise<Warehouse>;
  deleteWarehouse: (warehouseCode: string) => Promise<void>;
};

export const createCatalogController = (service: CatalogService) => {
  const listItems: ApiHandler = async (req) => {
    const query: CatalogItemQuery = {
      search: optionalString(req.query?.search),
      categoryId: optionalString(req.query?.categoryId),
      active: req.query?.active === "true" ? true : req.query?.active === "false" ? false : undefined,
      limit: optionalNumber(req.query?.limit),
      cursor: optionalString(req.query?.cursor)
    };
    const result = await service.listItems(query);
    return {
      status: 200,
      body: result
    };
  };

  const getItem: ApiHandler = async (req) => {
    const itemCode = req.params?.itemCode;
    if (!itemCode) {
      throw new WmsError("WMS-VAL-001", "itemCode obrigatorio.");
    }
    const item = await service.getItem(itemCode);
    if (!item) {
      return { status: 404, body: { error: { code: "NOT_FOUND", message: "Item nao encontrado." } } };
    }
    return {
      status: 200,
      body: item
    };
  };

  const createItem: ApiHandler<CatalogItemRequest> = async (req) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    const input: CatalogItemRequest = {
      itemCode: requireString(req.body.itemCode, "itemCode"),
      itemName: requireString(req.body.itemName, "itemName"),
      description: optionalString(req.body.description),
      barcode: optionalString(req.body.barcode),
      uomCode: optionalString(req.body.uomCode),
      weight: optionalNumber(req.body.weight),
      volume: optionalNumber(req.body.volume),
      categoryId: optionalString(req.body.categoryId),
      active: req.body.active ?? true
    };
    const item = await service.createItem(input);
    return {
      status: 201,
      body: item
    };
  };

  const updateItem: ApiHandler<Partial<CatalogItemRequest>> = async (req) => {
    const itemCode = req.params?.itemCode;
    if (!itemCode) {
      throw new WmsError("WMS-VAL-001", "itemCode obrigatorio.");
    }
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    const item = await service.updateItem(itemCode, req.body);
    return {
      status: 200,
      body: item
    };
  };

  const deleteItem: ApiHandler = async (req) => {
    const itemCode = req.params?.itemCode;
    if (!itemCode) {
      throw new WmsError("WMS-VAL-001", "itemCode obrigatorio.");
    }
    await service.deleteItem(itemCode);
    return { status: 204 };
  };

  const listWarehouses: ApiHandler = async (req) => {
    const query: WarehouseQuery = {
      search: optionalString(req.query?.search),
      active: req.query?.active === "true" ? true : req.query?.active === "false" ? false : undefined,
      type: optionalString(req.query?.type),
      limit: optionalNumber(req.query?.limit),
      cursor: optionalString(req.query?.cursor)
    };
    const result = await service.listWarehouses(query);
    return {
      status: 200,
      body: result
    };
  };

  const getWarehouse: ApiHandler = async (req) => {
    const warehouseCode = req.params?.warehouseCode;
    if (!warehouseCode) {
      throw new WmsError("WMS-VAL-001", "warehouseCode obrigatorio.");
    }
    const warehouse = await service.getWarehouse(warehouseCode);
    if (!warehouse) {
      return { status: 404, body: { error: { code: "NOT_FOUND", message: "Armazem nao encontrado." } } };
    }
    return {
      status: 200,
      body: warehouse
    };
  };

  const createWarehouse: ApiHandler<WarehouseRequest> = async (req) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    const input: WarehouseRequest = {
      warehouseCode: requireString(req.body.warehouseCode, "warehouseCode"),
      warehouseName: requireString(req.body.warehouseName, "warehouseName"),
      location: optionalString(req.body.location),
      address: optionalString(req.body.address),
      city: optionalString(req.body.city),
      state: optionalString(req.body.state),
      zipCode: optionalString(req.body.zipCode),
      active: req.body.active ?? true,
      type: req.body.type
    };
    const warehouse = await service.createWarehouse(input);
    return {
      status: 201,
      body: warehouse
    };
  };

  const updateWarehouse: ApiHandler<Partial<WarehouseRequest>> = async (req) => {
    const warehouseCode = req.params?.warehouseCode;
    if (!warehouseCode) {
      throw new WmsError("WMS-VAL-001", "warehouseCode obrigatorio.");
    }
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    const warehouse = await service.updateWarehouse(warehouseCode, req.body);
    return {
      status: 200,
      body: warehouse
    };
  };

  const deleteWarehouse: ApiHandler = async (req) => {
    const warehouseCode = req.params?.warehouseCode;
    if (!warehouseCode) {
      throw new WmsError("WMS-VAL-001", "warehouseCode obrigatorio.");
    }
    await service.deleteWarehouse(warehouseCode);
    return { status: 204 };
  };

  return {
    listItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    listWarehouses,
    getWarehouse,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
  };
};
