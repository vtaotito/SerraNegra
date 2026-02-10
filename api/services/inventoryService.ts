/**
 * Inventory Service - Implementação Completa
 * 
 * Gerencia estoque (inventory) com movimentações (ajustes e transferências)
 * Rastreia quantidade disponível, reservada e em trânsito
 */

import { v4 as uuidv4 } from "uuid";
import { WmsError } from "../../wms-core/src/errors.js";
import type {
  InventoryAdjustmentRequest,
  InventoryAdjustmentResponse,
  InventoryQuery,
  InventoryRecord,
  InventoryTransferRequest,
  InventoryTransferResponse
} from "../dtos/inventory.js";
import type { InventoryService } from "../controllers/inventoryController.js";

/**
 * Registro interno de estoque
 */
interface StockRecord extends InventoryRecord {
  // Campos adicionais para controle interno
  lastMovementId?: string;
  lastMovementAt?: string;
  // Observação: o contrato REST expõe apenas {quantity,reserved,available}.
  // Qualquer noção de "em trânsito" deve ficar fora do modelo público (ou em metadata no futuro).
}

/**
 * Registro de movimentação histórica
 */
interface MovementRecord {
  id: string;
  itemCode: string;
  warehouseCode: string;
  type: "ADJUSTMENT" | "TRANSFER_OUT" | "TRANSFER_IN";
  adjustmentType?: "ADD" | "REMOVE" | "SET";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  fromWarehouse?: string;
  toWarehouse?: string;
  transferId?: string;
  batchNumber?: string;
  location?: string;
  notes?: string;
  actorId: string;
  createdAt: string;
}

/**
 * Store in-memory para Inventário
 */
export class InventoryStore {
  // Key: itemCode|warehouseCode
  private inventory: Map<string, StockRecord> = new Map();
  private movements: Map<string, MovementRecord> = new Map();
  private transfers: Map<string, InventoryTransferResponse> = new Map();

  constructor() {
    // Seed inicial com dados de exemplo
    this.seedData();
  }

  private getKey(itemCode: string, warehouseCode: string): string {
    return `${itemCode}|${warehouseCode}`;
  }

  private seedData() {
    const now = new Date().toISOString();
    
    // Estoque inicial para produtos de exemplo
    const sampleInventory: StockRecord[] = [
      {
        id: uuidv4(),
        itemCode: "PROD-001",
        itemName: "Notebook Dell Inspiron 15",
        warehouseCode: "WH-PRINCIPAL",
        warehouseName: "Armazém Principal",
        available: 50,
        reserved: 5,
        quantity: 55,
        batchNumber: "BATCH-2026-001",
        location: "A-01-01",
        lastUpdated: now
      },
      {
        id: uuidv4(),
        itemCode: "PROD-001",
        itemName: "Notebook Dell Inspiron 15",
        warehouseCode: "WH-SEC-01",
        warehouseName: "Armazém Secundário - Centro",
        available: 20,
        reserved: 2,
        quantity: 22,
        batchNumber: "BATCH-2026-001",
        location: "B-02-05",
        lastUpdated: now
      },
      {
        id: uuidv4(),
        itemCode: "PROD-002",
        itemName: "Mouse Logitech MX Master 3",
        warehouseCode: "WH-PRINCIPAL",
        warehouseName: "Armazém Principal",
        available: 150,
        reserved: 10,
        quantity: 160,
        batchNumber: "BATCH-2026-002",
        location: "A-01-02",
        lastUpdated: now
      },
      {
        id: uuidv4(),
        itemCode: "PROD-003",
        itemName: "Teclado Mecânico Keychron K2",
        warehouseCode: "WH-PRINCIPAL",
        warehouseName: "Armazém Principal",
        available: 80,
        reserved: 8,
        quantity: 88,
        batchNumber: "BATCH-2026-003",
        location: "A-01-03",
        lastUpdated: now
      },
      {
        id: uuidv4(),
        itemCode: "PROD-004",
        itemName: "Monitor LG UltraWide 29\"",
        warehouseCode: "WH-PRINCIPAL",
        warehouseName: "Armazém Principal",
        available: 30,
        reserved: 3,
        quantity: 33,
        batchNumber: "BATCH-2026-004",
        location: "A-02-01",
        lastUpdated: now
      },
      {
        id: uuidv4(),
        itemCode: "PROD-005",
        itemName: "Webcam Logitech C920",
        warehouseCode: "WH-PRINCIPAL",
        warehouseName: "Armazém Principal",
        available: 100,
        reserved: 5,
        quantity: 105,
        batchNumber: "BATCH-2026-005",
        location: "A-01-04",
        lastUpdated: now
      }
    ];

    sampleInventory.forEach(inv => {
      this.inventory.set(this.getKey(inv.itemCode, inv.warehouseCode), inv);
    });
  }

  // Inventory
  getAllInventory(): StockRecord[] {
    return Array.from(this.inventory.values());
  }

  getInventory(itemCode: string, warehouseCode: string): StockRecord | undefined {
    return this.inventory.get(this.getKey(itemCode, warehouseCode));
  }

  setInventory(record: StockRecord): void {
    this.inventory.set(this.getKey(record.itemCode, record.warehouseCode), record);
  }

  // Movements
  addMovement(movement: MovementRecord): void {
    this.movements.set(movement.id, movement);
  }

  getMovement(id: string): MovementRecord | undefined {
    return this.movements.get(id);
  }

  getMovementsByItem(itemCode: string, warehouseCode?: string): MovementRecord[] {
    return Array.from(this.movements.values())
      .filter(m => 
        m.itemCode === itemCode && 
        (warehouseCode === undefined || m.warehouseCode === warehouseCode)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // Transfers
  addTransfer(transfer: InventoryTransferResponse): void {
    this.transfers.set(transfer.transferId, transfer);
  }

  getTransfer(transferId: string): InventoryTransferResponse | undefined {
    return this.transfers.get(transferId);
  }

  updateTransferStatus(transferId: string, status: "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED"): void {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.status = status;
    }
  }
}

/**
 * Implementação completa do InventoryService
 */
export const createInventoryService = (store: InventoryStore): InventoryService => {
  const now = () => new Date().toISOString();

  return {
    // ===== LIST INVENTORY =====
    
    listInventory: async (query) => {
      let inventory = store.getAllInventory();

      // Filtrar por item
      if (query.itemCode) {
        inventory = inventory.filter(inv => inv.itemCode === query.itemCode);
      }

      // Filtrar por armazém
      if (query.warehouseCode) {
        inventory = inventory.filter(inv => inv.warehouseCode === query.warehouseCode);
      }

      // Filtrar por lote
      if (query.batchNumber) {
        inventory = inventory.filter(inv => inv.batchNumber === query.batchNumber);
      }

      // Filtrar por quantidade mínima
      if (query.minQuantity !== undefined) {
        const minQty = query.minQuantity;
        inventory = inventory.filter(inv => {
          const totalQty = query.includeReserved 
            ? inv.available + inv.reserved
            : inv.available;
          return totalQty >= minQty;
        });
      }

      // Ordenar por item e armazém
      inventory.sort((a, b) => {
        const itemCompare = a.itemCode.localeCompare(b.itemCode);
        return itemCompare !== 0 ? itemCompare : a.warehouseCode.localeCompare(b.warehouseCode);
      });

      // Paginação
      const limit = query.limit && query.limit > 0 ? query.limit : 50;
      let startIndex = 0;

      if (query.cursor) {
        // Cursor format: itemCode|warehouseCode
        const cursorIndex = inventory.findIndex(
          inv => `${inv.itemCode}|${inv.warehouseCode}` === query.cursor
        );
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1;
        }
      }

      const paginatedInventory = inventory.slice(startIndex, startIndex + limit);
      const nextCursor =
        startIndex + limit < inventory.length
          ? `${paginatedInventory[paginatedInventory.length - 1]?.itemCode}|${paginatedInventory[paginatedInventory.length - 1]?.warehouseCode}`
          : undefined;

      return {
        data: paginatedInventory,
        nextCursor
      };
    },

    // ===== GET INVENTORY =====

    getInventory: async (itemCode, warehouseCode) => {
      return store.getInventory(itemCode, warehouseCode);
    },

    // ===== ADJUST INVENTORY =====

    adjustInventory: async (input, actorId) => {
      // Validações
      if (!input.itemCode || input.itemCode.trim() === "") {
        throw new WmsError("WMS-VAL-001", "itemCode não pode ser vazio.");
      }

      if (!input.warehouseCode || input.warehouseCode.trim() === "") {
        throw new WmsError("WMS-VAL-001", "warehouseCode não pode ser vazio.");
      }

      if (input.quantity === undefined || input.quantity === null) {
        throw new WmsError("WMS-VAL-001", "quantity é obrigatório.");
      }

      if (!input.adjustmentType) {
        throw new WmsError("WMS-VAL-001", "adjustmentType é obrigatório (ADD, REMOVE, SET).");
      }

      if (!input.reason || input.reason.trim() === "") {
        throw new WmsError("WMS-VAL-001", "reason é obrigatório.");
      }

      // Buscar estoque atual
      let existing = store.getInventory(input.itemCode, input.warehouseCode);
      const previousQuantity = existing?.available || 0;
      let newQuantity: number;

      // Calcular nova quantidade baseado no tipo de ajuste
      switch (input.adjustmentType) {
        case "ADD":
          if (input.quantity < 0) {
            throw new WmsError("WMS-VAL-001", "Quantidade para ADD deve ser positiva.");
          }
          newQuantity = previousQuantity + input.quantity;
          break;

        case "REMOVE":
          if (input.quantity < 0) {
            throw new WmsError("WMS-VAL-001", "Quantidade para REMOVE deve ser positiva.");
          }
          newQuantity = previousQuantity - input.quantity;
          if (newQuantity < 0) {
            throw new WmsError(
              "WMS-VAL-003",
              `Quantidade insuficiente. Disponível: ${previousQuantity}, Tentando remover: ${input.quantity}`
            );
          }
          break;

        case "SET":
          if (input.quantity < 0) {
            throw new WmsError("WMS-VAL-001", "Quantidade para SET não pode ser negativa.");
          }
          newQuantity = input.quantity;
          break;

        default:
          throw new WmsError("WMS-VAL-001", `adjustmentType inválido: ${input.adjustmentType}`);
      }

      // Criar ou atualizar registro de inventário
      const timestamp = now();
      const movementId = uuidv4();

      if (!existing) {
        // Criar novo registro
        existing = {
          id: uuidv4(),
          itemCode: input.itemCode,
          itemName: `Item ${input.itemCode}`, // Nome seria buscado do catálogo
          warehouseCode: input.warehouseCode,
          warehouseName: `Armazém ${input.warehouseCode}`, // Nome seria buscado do catálogo
          available: newQuantity,
          reserved: 0,
          quantity: newQuantity,
          batchNumber: input.batchNumber,
          location: input.location,
          lastUpdated: timestamp,
          lastMovementId: movementId,
          lastMovementAt: timestamp
        };
      } else {
        // Atualizar registro existente
        existing = {
          ...existing,
          available: newQuantity,
          quantity: newQuantity + (existing.reserved ?? 0),
          batchNumber: input.batchNumber || existing.batchNumber,
          location: input.location || existing.location,
          lastUpdated: timestamp,
          lastMovementId: movementId,
          lastMovementAt: timestamp
        };
      }

      store.setInventory(existing);

      // Registrar movimentação
      const movement: MovementRecord = {
        id: movementId,
        itemCode: input.itemCode,
        warehouseCode: input.warehouseCode,
        type: "ADJUSTMENT",
        adjustmentType: input.adjustmentType,
        quantity: input.quantity,
        previousQuantity,
        newQuantity,
        reason: input.reason,
        batchNumber: input.batchNumber,
        location: input.location,
        notes: input.notes,
        actorId,
        createdAt: timestamp
      };

      store.addMovement(movement);

      // Retornar resposta
      const response: InventoryAdjustmentResponse = {
        adjustmentId: movementId,
        itemCode: input.itemCode,
        warehouseCode: input.warehouseCode,
        previousQuantity,
        newQuantity,
        adjustmentType: input.adjustmentType,
        adjustedAt: timestamp,
        actorId
      };

      return response;
    },

    // ===== TRANSFER INVENTORY =====

    transferInventory: async (input, actorId) => {
      // Validações
      if (!input.itemCode || input.itemCode.trim() === "") {
        throw new WmsError("WMS-VAL-001", "itemCode não pode ser vazio.");
      }

      if (!input.fromWarehouseCode || input.fromWarehouseCode.trim() === "") {
        throw new WmsError("WMS-VAL-001", "fromWarehouseCode não pode ser vazio.");
      }

      if (!input.toWarehouseCode || input.toWarehouseCode.trim() === "") {
        throw new WmsError("WMS-VAL-001", "toWarehouseCode não pode ser vazio.");
      }

      if (input.fromWarehouseCode === input.toWarehouseCode) {
        throw new WmsError("WMS-VAL-001", "Armazéns de origem e destino não podem ser iguais.");
      }

      if (input.quantity === undefined || input.quantity === null || input.quantity <= 0) {
        throw new WmsError("WMS-VAL-001", "quantity deve ser maior que zero.");
      }

      if (!input.reason || input.reason.trim() === "") {
        throw new WmsError("WMS-VAL-001", "reason é obrigatório.");
      }

      // Verificar estoque de origem
      const fromInventory = store.getInventory(input.itemCode, input.fromWarehouseCode);
      
      if (!fromInventory) {
        throw new WmsError(
          "WMS-NOT-FOUND",
          `Não há estoque do item '${input.itemCode}' no armazém '${input.fromWarehouseCode}'.`
        );
      }

      if (fromInventory.available < input.quantity) {
        throw new WmsError(
          "WMS-VAL-003",
          `Quantidade insuficiente. Disponível: ${fromInventory.available}, Necessário: ${input.quantity}`
        );
      }

      // Criar transferência
      const transferId = uuidv4();
      const timestamp = now();

      // Movimento de saída (origem)
      const outMovementId = uuidv4();
      const fromPreviousQty = fromInventory.available;
      const fromNewQty = fromPreviousQty - input.quantity;

      const updatedFromInventory: StockRecord = {
        ...fromInventory,
        available: fromNewQty,
        quantity: fromNewQty + (fromInventory.reserved ?? 0),
        lastUpdated: timestamp,
        lastMovementId: outMovementId,
        lastMovementAt: timestamp
      };

      store.setInventory(updatedFromInventory);

      const outMovement: MovementRecord = {
        id: outMovementId,
        itemCode: input.itemCode,
        warehouseCode: input.fromWarehouseCode,
        type: "TRANSFER_OUT",
        quantity: input.quantity,
        previousQuantity: fromPreviousQty,
        newQuantity: fromNewQty,
        reason: input.reason,
        toWarehouse: input.toWarehouseCode,
        transferId,
        notes: input.notes,
        actorId,
        createdAt: timestamp
      };

      store.addMovement(outMovement);

      // Destino: adiciona quantidade imediatamente (simplificado)
      let toInventory = store.getInventory(input.itemCode, input.toWarehouseCode);
      
      if (!toInventory) {
        toInventory = {
          id: uuidv4(),
          itemCode: input.itemCode,
          itemName: fromInventory.itemName,
          warehouseCode: input.toWarehouseCode,
          warehouseName: `Armazém ${input.toWarehouseCode}`,
          available: 0,
          reserved: 0,
          quantity: 0,
          batchNumber: input.batchNumber,
          lastUpdated: timestamp
        };
      }

      const inMovementId = uuidv4();
      const toPreviousQty = toInventory.available;
      const toNewQty = toPreviousQty + input.quantity;
      const updatedToInventory: StockRecord = {
        ...toInventory,
        available: toNewQty,
        quantity: toNewQty + (toInventory.reserved ?? 0),
        lastUpdated: timestamp,
        lastMovementId: inMovementId,
        lastMovementAt: timestamp
      };
      store.setInventory(updatedToInventory);

      const inMovement: MovementRecord = {
        id: inMovementId,
        itemCode: input.itemCode,
        warehouseCode: input.toWarehouseCode,
        type: "TRANSFER_IN",
        quantity: input.quantity,
        previousQuantity: toPreviousQty,
        newQuantity: toNewQty,
        reason: input.reason,
        fromWarehouse: input.fromWarehouseCode,
        transferId,
        notes: input.notes,
        actorId,
        createdAt: timestamp
      };
      store.addMovement(inMovement);

      // Criar registro de transferência
      const transfer: InventoryTransferResponse = {
        transferId,
        status: "COMPLETED",
        itemCode: input.itemCode,
        fromWarehouse: input.fromWarehouseCode,
        toWarehouse: input.toWarehouseCode,
        quantity: input.quantity,
        createdAt: timestamp,
        completedAt: timestamp
      };

      store.addTransfer(transfer);

      return transfer;
    }
  };
};

// Nota: a implementação acima completa a transferência imediatamente.
