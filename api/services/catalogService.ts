/**
 * Catalog Service - Implementação Completa
 * 
 * Gerencia produtos (items) e armazéns (warehouses)
 * com validações de negócio e armazenamento in-memory
 */

import { v4 as uuidv4 } from "uuid";
import { WmsError } from "../../wms-core/src/errors.js";
import type { CatalogItem, CatalogItemQuery, CatalogItemRequest, Warehouse, WarehouseQuery, WarehouseRequest } from "../dtos/catalog.js";
import type { CatalogService } from "../controllers/catalogController.js";

/**
 * Store in-memory para Catálogo
 */
export class CatalogStore {
  private items: Map<string, CatalogItem> = new Map();
  private warehouses: Map<string, Warehouse> = new Map();

  constructor() {
    // Seed inicial com dados de exemplo
    this.seedData();
  }

  private seedData() {
    const now = new Date().toISOString();
    
    // Produtos exemplo
    const sampleItems: CatalogItem[] = [
      {
        itemCode: "PROD-001",
        itemName: "Notebook Dell Inspiron 15",
        description: "Notebook Intel Core i5, 8GB RAM, 256GB SSD",
        barcode: "7891234567890",
        uomCode: "UN",
        uomName: "Unidade",
        weight: 1.8,
        volume: 0.05,
        categoryId: "CAT-ELETRONICOS",
        categoryName: "Eletrônicos",
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        itemCode: "PROD-002",
        itemName: "Mouse Logitech MX Master 3",
        description: "Mouse sem fio ergonômico",
        barcode: "7891234567891",
        uomCode: "UN",
        uomName: "Unidade",
        weight: 0.14,
        volume: 0.001,
        categoryId: "CAT-PERIFERICOS",
        categoryName: "Periféricos",
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        itemCode: "PROD-003",
        itemName: "Teclado Mecânico Keychron K2",
        description: "Teclado mecânico wireless 75%",
        barcode: "7891234567892",
        uomCode: "UN",
        uomName: "Unidade",
        weight: 0.55,
        volume: 0.003,
        categoryId: "CAT-PERIFERICOS",
        categoryName: "Periféricos",
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        itemCode: "PROD-004",
        itemName: "Monitor LG UltraWide 29\"",
        description: "Monitor 29\" 21:9 2560x1080 IPS",
        barcode: "7891234567893",
        uomCode: "UN",
        uomName: "Unidade",
        weight: 4.5,
        volume: 0.08,
        categoryId: "CAT-MONITORES",
        categoryName: "Monitores",
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        itemCode: "PROD-005",
        itemName: "Webcam Logitech C920",
        description: "Webcam Full HD 1080p",
        barcode: "7891234567894",
        uomCode: "UN",
        uomName: "Unidade",
        weight: 0.16,
        volume: 0.002,
        categoryId: "CAT-PERIFERICOS",
        categoryName: "Periféricos",
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    sampleItems.forEach(item => this.items.set(item.itemCode, item));

    // Armazéns exemplo
    const sampleWarehouses: Warehouse[] = [
      {
        warehouseCode: "WH-PRINCIPAL",
        warehouseName: "Armazém Principal",
        location: "Galpão A - Setor Norte",
        address: "Rua Industrial, 1000",
        city: "São Paulo",
        state: "SP",
        zipCode: "01310-100",
        type: "PRINCIPAL",
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        warehouseCode: "WH-SEC-01",
        warehouseName: "Armazém Secundário - Centro",
        location: "Galpão B",
        address: "Av. Paulista, 500",
        city: "São Paulo",
        state: "SP",
        zipCode: "01310-200",
        type: "SECUNDARIO",
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        warehouseCode: "WH-TERCEIROS",
        warehouseName: "CD Terceiros - Logística XYZ",
        location: "Centro de Distribuição",
        address: "Rod. Anhanguera, Km 25",
        city: "Jundiaí",
        state: "SP",
        zipCode: "13200-000",
        type: "TERCEIROS",
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    sampleWarehouses.forEach(wh => this.warehouses.set(wh.warehouseCode, wh));
  }

  // Items
  getAllItems(): CatalogItem[] {
    return Array.from(this.items.values());
  }

  getItem(itemCode: string): CatalogItem | undefined {
    return this.items.get(itemCode);
  }

  setItem(item: CatalogItem): void {
    this.items.set(item.itemCode, item);
  }

  deleteItem(itemCode: string): boolean {
    return this.items.delete(itemCode);
  }

  itemExists(itemCode: string): boolean {
    return this.items.has(itemCode);
  }

  // Warehouses
  getAllWarehouses(): Warehouse[] {
    return Array.from(this.warehouses.values());
  }

  getWarehouse(warehouseCode: string): Warehouse | undefined {
    return this.warehouses.get(warehouseCode);
  }

  setWarehouse(warehouse: Warehouse): void {
    this.warehouses.set(warehouse.warehouseCode, warehouse);
  }

  deleteWarehouse(warehouseCode: string): boolean {
    return this.warehouses.delete(warehouseCode);
  }

  warehouseExists(warehouseCode: string): boolean {
    return this.warehouses.has(warehouseCode);
  }
}

/**
 * Implementação completa do CatalogService
 */
export const createCatalogService = (store: CatalogStore): CatalogService => {
  const now = () => new Date().toISOString();

  return {
    // ===== ITEMS =====
    
    listItems: async (query) => {
      let items = store.getAllItems();

      // Filtrar por busca
      if (query.search) {
        const search = query.search.toLowerCase();
        items = items.filter(
          (item) =>
            item.itemCode.toLowerCase().includes(search) ||
            item.itemName.toLowerCase().includes(search) ||
            (item.description?.toLowerCase().includes(search) ?? false) ||
            (item.barcode?.toLowerCase().includes(search) ?? false)
        );
      }

      // Filtrar por categoria
      if (query.categoryId) {
        items = items.filter((item) => item.categoryId === query.categoryId);
      }

      // Filtrar por ativo
      if (query.active !== undefined) {
        items = items.filter((item) => item.active === query.active);
      }

      // Ordenar por código
      items.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

      // Paginação
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      let startIndex = 0;

      if (query.cursor) {
        const cursorIndex = items.findIndex((item) => item.itemCode === query.cursor);
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1;
        }
      }

      const paginatedItems = items.slice(startIndex, startIndex + limit);
      const nextCursor =
        startIndex + limit < items.length ? paginatedItems[paginatedItems.length - 1]?.itemCode : undefined;

      return {
        data: paginatedItems,
        nextCursor
      };
    },

    getItem: async (itemCode) => {
      return store.getItem(itemCode);
    },

    createItem: async (input) => {
      // Validações
      if (!input.itemCode || input.itemCode.trim() === "") {
        throw new WmsError("WMS-VAL-001", "itemCode não pode ser vazio.");
      }

      if (!input.itemName || input.itemName.trim() === "") {
        throw new WmsError("WMS-VAL-001", "itemName não pode ser vazio.");
      }

      // Verificar se já existe
      if (store.itemExists(input.itemCode)) {
        throw new WmsError("WMS-VAL-002", `Item com código '${input.itemCode}' já existe.`);
      }

      // Validar peso e volume
      if (input.weight !== undefined && input.weight < 0) {
        throw new WmsError("WMS-VAL-001", "Peso não pode ser negativo.");
      }

      if (input.volume !== undefined && input.volume < 0) {
        throw new WmsError("WMS-VAL-001", "Volume não pode ser negativo.");
      }

      const item: CatalogItem = {
        itemCode: input.itemCode,
        itemName: input.itemName,
        description: input.description,
        barcode: input.barcode,
        uomCode: input.uomCode || "UN",
        uomName: input.uomCode ? undefined : "Unidade",
        weight: input.weight,
        volume: input.volume,
        categoryId: input.categoryId,
        active: input.active ?? true,
        createdAt: now(),
        updatedAt: now()
      };

      store.setItem(item);
      return item;
    },

    updateItem: async (itemCode, input) => {
      const existing = store.getItem(itemCode);
      
      if (!existing) {
        throw new WmsError("WMS-NOT-FOUND", `Item '${itemCode}' não encontrado.`);
      }

      // Validações
      if (input.itemName !== undefined && input.itemName.trim() === "") {
        throw new WmsError("WMS-VAL-001", "itemName não pode ser vazio.");
      }

      if (input.weight !== undefined && input.weight < 0) {
        throw new WmsError("WMS-VAL-001", "Peso não pode ser negativo.");
      }

      if (input.volume !== undefined && input.volume < 0) {
        throw new WmsError("WMS-VAL-001", "Volume não pode ser negativo.");
      }

      const updated: CatalogItem = {
        ...existing,
        ...input,
        itemCode, // Não permite alterar o código
        updatedAt: now()
      };

      store.setItem(updated);
      return updated;
    },

    deleteItem: async (itemCode) => {
      if (!store.itemExists(itemCode)) {
        throw new WmsError("WMS-NOT-FOUND", `Item '${itemCode}' não encontrado.`);
      }

      // Soft delete: apenas marcar como inativo
      const item = store.getItem(itemCode);
      if (item) {
        const updated: CatalogItem = {
          ...item,
          active: false,
          updatedAt: now()
        };
        store.setItem(updated);
      }
    },

    // ===== WAREHOUSES =====

    listWarehouses: async (query) => {
      let warehouses = store.getAllWarehouses();

      // Filtrar por busca
      if (query.search) {
        const search = query.search.toLowerCase();
        warehouses = warehouses.filter(
          (wh) =>
            wh.warehouseCode.toLowerCase().includes(search) ||
            wh.warehouseName.toLowerCase().includes(search) ||
            (wh.location?.toLowerCase().includes(search) ?? false) ||
            (wh.city?.toLowerCase().includes(search) ?? false)
        );
      }

      // Filtrar por tipo
      if (query.type) {
        warehouses = warehouses.filter((wh) => wh.type === query.type);
      }

      // Filtrar por ativo
      if (query.active !== undefined) {
        warehouses = warehouses.filter((wh) => wh.active === query.active);
      }

      // Ordenar por código
      warehouses.sort((a, b) => a.warehouseCode.localeCompare(b.warehouseCode));

      // Paginação
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      let startIndex = 0;

      if (query.cursor) {
        const cursorIndex = warehouses.findIndex((wh) => wh.warehouseCode === query.cursor);
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1;
        }
      }

      const paginatedWarehouses = warehouses.slice(startIndex, startIndex + limit);
      const nextCursor =
        startIndex + limit < warehouses.length
          ? paginatedWarehouses[paginatedWarehouses.length - 1]?.warehouseCode
          : undefined;

      return {
        data: paginatedWarehouses,
        nextCursor
      };
    },

    getWarehouse: async (warehouseCode) => {
      return store.getWarehouse(warehouseCode);
    },

    createWarehouse: async (input) => {
      // Validações
      if (!input.warehouseCode || input.warehouseCode.trim() === "") {
        throw new WmsError("WMS-VAL-001", "warehouseCode não pode ser vazio.");
      }

      if (!input.warehouseName || input.warehouseName.trim() === "") {
        throw new WmsError("WMS-VAL-001", "warehouseName não pode ser vazio.");
      }

      // Verificar se já existe
      if (store.warehouseExists(input.warehouseCode)) {
        throw new WmsError("WMS-VAL-002", `Armazém com código '${input.warehouseCode}' já existe.`);
      }

      const warehouse: Warehouse = {
        warehouseCode: input.warehouseCode,
        warehouseName: input.warehouseName,
        location: input.location,
        address: input.address,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        type: input.type || "SECUNDARIO",
        active: input.active ?? true,
        createdAt: now(),
        updatedAt: now()
      };

      store.setWarehouse(warehouse);
      return warehouse;
    },

    updateWarehouse: async (warehouseCode, input) => {
      const existing = store.getWarehouse(warehouseCode);
      
      if (!existing) {
        throw new WmsError("WMS-NOT-FOUND", `Armazém '${warehouseCode}' não encontrado.`);
      }

      // Validações
      if (input.warehouseName !== undefined && input.warehouseName.trim() === "") {
        throw new WmsError("WMS-VAL-001", "warehouseName não pode ser vazio.");
      }

      const updated: Warehouse = {
        ...existing,
        ...input,
        warehouseCode, // Não permite alterar o código
        updatedAt: now()
      };

      store.setWarehouse(updated);
      return updated;
    },

    deleteWarehouse: async (warehouseCode) => {
      if (!store.warehouseExists(warehouseCode)) {
        throw new WmsError("WMS-NOT-FOUND", `Armazém '${warehouseCode}' não encontrado.`);
      }

      // Soft delete: apenas marcar como inativo
      const warehouse = store.getWarehouse(warehouseCode);
      if (warehouse) {
        const updated: Warehouse = {
          ...warehouse,
          active: false,
          updatedAt: now()
        };
        store.setWarehouse(updated);
      }
    }
  };
};
