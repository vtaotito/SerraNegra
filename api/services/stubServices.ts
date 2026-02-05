import { v4 as uuidv4 } from "uuid";
import type {
  CatalogService,
  CustomersService,
  DashboardService,
  IntegrationService,
  InventoryService,
  OrdersService,
  ScanService,
  ShipmentsService
} from "../index.js";
import type { CatalogItem, Warehouse } from "../dtos/catalog.js";
import type { Customer } from "../dtos/customers.js";
import type { OrderDetailResponse, OrderResponse } from "../dtos/orders.js";
import type { Shipment } from "../dtos/shipments.js";

const now = (): string => new Date().toISOString();

export const createStubCatalogService = (): CatalogService => {
  const items: CatalogItem[] = [
    {
      itemCode: "ITEM001",
      itemName: "Parafuso M6",
      barcode: "7891234567890",
      active: true,
      createdAt: now(),
      updatedAt: now()
    },
    {
      itemCode: "ITEM002",
      itemName: "Porca M6",
      barcode: "7891234567891",
      active: true,
      createdAt: now(),
      updatedAt: now()
    }
  ];

  const warehouses: Warehouse[] = [
    {
      warehouseCode: "WH01",
      warehouseName: "Armazém Principal",
      active: true,
      type: "PRINCIPAL",
      createdAt: now(),
      updatedAt: now()
    }
  ];

  return {
    listItems: async (query) => {
      const search = query.search?.toLowerCase();
      const filtered = search
        ? items.filter((i) => i.itemCode.toLowerCase().includes(search) || i.itemName.toLowerCase().includes(search))
        : items;
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      return { data: filtered.slice(0, limit), nextCursor: undefined };
    },
    getItem: async (itemCode) => items.find((i) => i.itemCode === itemCode),
    createItem: async (input) => {
      const created: CatalogItem = {
        ...input,
        active: input.active ?? true,
        createdAt: now(),
        updatedAt: now()
      };
      items.push(created);
      return created;
    },
    updateItem: async (itemCode, input) => {
      const existing = items.find((i) => i.itemCode === itemCode);
      const updated: CatalogItem = {
        ...(existing ?? { itemCode, itemName: "Item", active: true, createdAt: now(), updatedAt: now() }),
        ...input,
        itemCode,
        updatedAt: now()
      };
      const idx = items.findIndex((i) => i.itemCode === itemCode);
      if (idx >= 0) items[idx] = updated;
      else items.push(updated);
      return updated;
    },
    deleteItem: async (itemCode) => {
      const idx = items.findIndex((i) => i.itemCode === itemCode);
      if (idx >= 0) items.splice(idx, 1);
    },
    listWarehouses: async (query) => {
      const search = query.search?.toLowerCase();
      const filtered = search
        ? warehouses.filter(
            (w) =>
              w.warehouseCode.toLowerCase().includes(search) || w.warehouseName.toLowerCase().includes(search)
          )
        : warehouses;
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      return { data: filtered.slice(0, limit), nextCursor: undefined };
    },
    getWarehouse: async (warehouseCode) => warehouses.find((w) => w.warehouseCode === warehouseCode),
    createWarehouse: async (input) => {
      const created: Warehouse = {
        ...input,
        active: input.active ?? true,
        createdAt: now(),
        updatedAt: now()
      };
      warehouses.push(created);
      return created;
    },
    updateWarehouse: async (warehouseCode, input) => {
      const existing = warehouses.find((w) => w.warehouseCode === warehouseCode);
      const updated: Warehouse = {
        ...(existing ?? { warehouseCode, warehouseName: "Armazém", active: true, createdAt: now(), updatedAt: now() }),
        ...input,
        warehouseCode,
        updatedAt: now()
      };
      const idx = warehouses.findIndex((w) => w.warehouseCode === warehouseCode);
      if (idx >= 0) warehouses[idx] = updated;
      else warehouses.push(updated);
      return updated;
    },
    deleteWarehouse: async (warehouseCode) => {
      const idx = warehouses.findIndex((w) => w.warehouseCode === warehouseCode);
      if (idx >= 0) warehouses.splice(idx, 1);
    }
  };
};

export const createStubInventoryService = (): InventoryService => ({
  listInventory: async () => ({ data: [], nextCursor: undefined }),
  getInventory: async () => undefined,
  adjustInventory: async (input, actorId) => ({
    adjustmentId: uuidv4(),
    itemCode: input.itemCode,
    warehouseCode: input.warehouseCode,
    previousQuantity: 0,
    newQuantity: input.adjustmentType === "REMOVE" ? 0 : input.quantity,
    adjustmentType: input.adjustmentType,
    adjustedAt: now(),
    actorId
  }),
  transferInventory: async (input) => ({
    transferId: uuidv4(),
    status: "PENDING",
    itemCode: input.itemCode,
    fromWarehouse: input.fromWarehouseCode,
    toWarehouse: input.toWarehouseCode,
    quantity: input.quantity,
    createdAt: now()
  })
});

export const createStubOrdersService = (): OrdersService => {
  const orders: OrderDetailResponse[] = [];
  return {
    listOrders: async (query) => {
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      return { data: orders.slice(0, limit), nextCursor: undefined };
    },
    getOrder: async (orderId) => orders.find((o) => o.id === orderId),
    createOrder: async (input, actorId) => {
      const created: OrderDetailResponse = {
        id: uuidv4(),
        externalOrderId: input.externalOrderId,
        customerId: input.customerId,
        shipToAddress: input.shipToAddress,
        status: "A_SEPARAR",
        items: input.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        totalItems: input.items.length,
        priority: input.priority,
        notes: input.notes,
        createdAt: now(),
        updatedAt: now(),
        version: 0,
        tasks: [],
        timeline: [
          { eventType: "CREATED", occurredAt: now(), actorId, actorRole: "SUPERVISOR" }
        ]
      };
      orders.push(created);
      return created as unknown as OrderResponse;
    },
    updateOrder: async (orderId, input) => {
      const existing = orders.find((o) => o.id === orderId);
      if (!existing) {
        // cria “por cima” pra não quebrar dev
        const created: OrderDetailResponse = {
          id: orderId,
          customerId: "UNKNOWN",
          status: input.status ?? "A_SEPARAR",
          items: [],
          totalItems: 0,
          createdAt: now(),
          updatedAt: now(),
          version: 0
        };
        orders.push(created);
        return created;
      }
      Object.assign(existing, input, { updatedAt: now(), version: existing.version + 1 });
      return existing;
    },
    deleteOrder: async (orderId) => {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx >= 0) orders.splice(idx, 1);
    }
  };
};

export const createStubShipmentsService = (): ShipmentsService => {
  const shipments: Shipment[] = [];
  return {
    listShipments: async (query) => {
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      return { data: shipments.slice(0, limit), nextCursor: undefined };
    },
    getShipment: async (shipmentId) => shipments.find((s) => s.id === shipmentId),
    createShipment: async (input, actorId) => {
      const created: Shipment = {
        id: uuidv4(),
        orderId: input.orderId,
        status: "PENDING",
        carrier: input.carrier,
        trackingCode: input.trackingCode,
        packageCount: input.packageCount ?? 1,
        totalWeight: input.totalWeight,
        totalVolume: input.totalVolume,
        shippingMethod: input.shippingMethod,
        estimatedDeliveryDate: input.estimatedDeliveryDate,
        notes: input.notes,
        createdAt: now(),
        updatedAt: now()
      } as any;
      shipments.push(created);
      return created;
    },
    updateShipment: async (shipmentId, input) => {
      const existing = shipments.find((s) => s.id === shipmentId);
      if (!existing) {
        const created = { id: shipmentId, status: "PENDING", createdAt: now(), updatedAt: now() } as any;
        shipments.push(created);
        return created;
      }
      Object.assign(existing, input, { updatedAt: now() });
      return existing;
    },
    deleteShipment: async (shipmentId) => {
      const idx = shipments.findIndex((s) => s.id === shipmentId);
      if (idx >= 0) shipments.splice(idx, 1);
    }
  };
};

export const createStubCustomersService = (): CustomersService => {
  const customers: Customer[] = [];
  return {
    listCustomers: async (query) => {
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      return { data: customers.slice(0, limit), nextCursor: undefined };
    },
    getCustomer: async (customerId) => customers.find((c) => c.id === customerId),
    createCustomer: async (input) => {
      const created: Customer = {
        id: uuidv4(),
        customerCode: input.customerCode,
        name: input.name,
        email: input.email,
        phone: input.phone,
        taxId: input.taxId,
        billingAddress: input.billingAddress,
        shippingAddress: input.shippingAddress,
        type: input.type,
        creditLimit: input.creditLimit,
        paymentTerms: input.paymentTerms,
        notes: input.notes,
        active: true,
        createdAt: now(),
        updatedAt: now()
      } as any;
      customers.push(created);
      return created;
    },
    updateCustomer: async (customerId, input) => {
      const existing = customers.find((c) => c.id === customerId);
      if (!existing) {
        const created = { id: customerId, customerCode: "NEW", name: "Cliente", active: true, createdAt: now(), updatedAt: now() } as any;
        customers.push(created);
        return created;
      }
      Object.assign(existing, input, { updatedAt: now() });
      return existing;
    },
    deleteCustomer: async (customerId) => {
      const idx = customers.findIndex((c) => c.id === customerId);
      if (idx >= 0) customers.splice(idx, 1);
    }
  };
};

export const createStubScanService = (): ScanService => ({
  recordScan: async (input) => ({
    id: uuidv4(),
    orderId: input.orderId,
    taskId: input.taskId,
    type: input.type,
    value: input.value,
    quantity: input.quantity,
    occurredAt: input.occurredAt ?? now(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    requestId: input.requestId,
    metadata: input.metadata
  } as any)
});

export const createStubDashboardService = (): DashboardService => ({
  listOrders: async () => ({ data: [], nextCursor: undefined }),
  listTasks: async () => ({ data: [], nextCursor: undefined }),
  getMetrics: async () => ({
    orders: 0,
    tasks: 0,
    lastUpdated: now()
  } as any)
});

export const createStubIntegrationService = (): IntegrationService => ({
  registerWebhook: async (input) => ({
    id: uuidv4(),
    url: input.url,
    eventTypes: input.eventTypes,
    status: "ACTIVE",
    createdAt: now()
  }),
  listWebhooks: async () => [],
  deleteWebhook: async () => {},
  publishEvent: async () => ({ eventId: uuidv4(), enqueuedAt: now() })
});

