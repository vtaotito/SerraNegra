/**
 * Order Core Service - Serviço principal de pedidos
 * Integra wms-core com persistência e lógica de negócio
 */
import {
  createOrder,
  applyOrderEvent,
  type Order,
  type OrderEvent,
  type OrderEventResult,
  defaultOrderPermissions
} from "../../wms-core/src/index.js";
import type { SapOrder } from "../../sap-connector/src/sapTypes.js";
import {
  createOrderFromSap,
  buildSapStatusUpdate
} from "../../wms-core/src/services/sapIntegrationService.js";
import { WmsError } from "../../wms-core/src/errors.js";
import { v4 as uuidv4 } from "uuid";
import type { OrderRepository } from "../repositories/orderRepository.js";

/**
 * LEGACY: In-Memory Store (mantido para compatibilidade)
 * Use PostgresOrderRepository em produção
 */
export class InMemoryOrderStore implements OrderRepository {
  private orders = new Map<string, Order>();
  private transitions = new Map<string, OrderEventResult["transition"][]>();
  private sapDocEntryIndex = new Map<number, string>(); // DocEntry -> OrderId
  private idempotencyCache = new Map<string, { requestHash: string; response: OrderEventResult }>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
    if (order.sapDocEntry) {
      this.sapDocEntryIndex.set(order.sapDocEntry, order.id);
    }
  }

  async findById(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) ?? null;
  }

  async findBySapDocEntry(docEntry: number): Promise<Order | null> {
    const orderId = this.sapDocEntryIndex.get(docEntry);
    if (!orderId) return null;
    return this.findById(orderId);
  }

  async findAll(filter?: {
    status?: string;
    carrier?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    let results = Array.from(this.orders.values());

    if (filter?.status) {
      results = results.filter((o) => o.status === filter.status);
    }
    if (filter?.carrier) {
      results = results.filter((o) => o.carrier === filter.carrier);
    }
    if (filter?.priority) {
      results = results.filter((o) => o.priority === filter.priority);
    }

    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const offset = filter?.offset || 0;
    const limit = filter?.limit || 200;
    results = results.slice(offset, offset + limit);

    return results;
  }

  async saveTransition(transition: OrderEventResult["transition"]): Promise<void> {
    const existing = this.transitions.get(transition.orderId) ?? [];
    existing.push(transition);
    this.transitions.set(transition.orderId, existing);
  }

  async getHistory(orderId: string): Promise<OrderEventResult["transition"][]> {
    return this.transitions.get(orderId) ?? [];
  }

  async checkIdempotency(
    scope: string,
    key: string,
    requestHash: string
  ): Promise<{ exists: boolean; response?: OrderEventResult }> {
    const cacheKey = `${scope}:${key}`;
    const cached = this.idempotencyCache.get(cacheKey);

    if (!cached) {
      return { exists: false };
    }

    if (cached.requestHash !== requestHash) {
      throw new WmsError("WMS-IDEM-001", "Idempotency-Key já usada com payload diferente", {
        scope,
        key
      });
    }

    return { exists: true, response: cached.response };
  }

  async saveIdempotency(
    scope: string,
    key: string,
    requestHash: string,
    response: OrderEventResult
  ): Promise<void> {
    const cacheKey = `${scope}:${key}`;
    this.idempotencyCache.set(cacheKey, { requestHash, response });
  }
}

/**
 * Service principal de pedidos
 */
export class OrderCoreService {
  constructor(private repository: OrderRepository) {}

  /**
   * Cria pedido a partir de dados do SAP
   */
  async createFromSap(input: { sapOrder: SapOrder; correlationId?: string }): Promise<Order> {
    // Verifica se já existe pedido com esse DocEntry
    if (input.sapOrder.DocEntry) {
      const existing = await this.repository.findBySapDocEntry(input.sapOrder.DocEntry);
      if (existing) {
        // Já importado, retorna existente
        return existing;
      }
    }

    const orderId = uuidv4();
    const order = createOrderFromSap({
      orderId,
      sapOrder: input.sapOrder
    });

    await this.repository.save(order);
    return order;
  }

  /**
   * Obtém pedido por ID
   */
  async getOrder(orderId: string): Promise<Order> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new WmsError("WMS-VAL-001", `Pedido ${orderId} não encontrado`);
    }
    return order;
  }

  /**
   * Lista pedidos com filtros
   */
  async listOrders(filter?: {
    status?: string;
    carrier?: string;
    priority?: string;
    limit?: number;
  }): Promise<Order[]> {
    return this.repository.findAll(filter);
  }

  /**
   * Aplica evento de transição (com suporte a idempotência)
   */
  async applyEvent(input: {
    orderId: string;
    event: OrderEvent;
    idempotencyKey?: string;
  }): Promise<OrderEventResult> {
    const order = await this.getOrder(input.orderId);

    // Verifica idempotência se fornecida
    if (input.idempotencyKey) {
      const scope = `order-event:${input.orderId}`;
      const requestHash = this.hashEvent(input.event);
      
      const idempotencyCheck = await this.repository.checkIdempotency(
        scope,
        input.idempotencyKey,
        requestHash
      );

      if (idempotencyCheck.exists && idempotencyCheck.response) {
        // Retorna resultado anterior (idempotência)
        return idempotencyCheck.response;
      }

      // Aplica evento
      const result = applyOrderEvent(
        order,
        { ...input.event, idempotencyKey: input.idempotencyKey },
        defaultOrderPermissions
      );

      await this.repository.save(result.order);
      await this.repository.saveTransition(result.transition);

      // Salva para idempotência
      await this.repository.saveIdempotency(scope, input.idempotencyKey, requestHash, result);

      return result;
    }

    // Sem idempotência
    const result = applyOrderEvent(order, input.event, defaultOrderPermissions);

    await this.repository.save(result.order);
    await this.repository.saveTransition(result.transition);

    return result;
  }

  /**
   * Hash do evento para idempotência
   */
  private hashEvent(event: OrderEvent): string {
    const payload = {
      eventType: event.eventType,
      actorId: event.actorId,
      actorRole: event.actorRole,
      reason: event.reason ?? null,
      metadata: event.metadata ?? null
    };
    return JSON.stringify(payload);
  }

  /**
   * Obtém histórico de transições
   */
  async getHistory(orderId: string): Promise<OrderEventResult["transition"][]> {
    // Verifica se pedido existe
    await this.getOrder(orderId);
    return this.repository.getHistory(orderId);
  }

  /**
   * Processa batch de pedidos do SAP (usado pelo Worker)
   */
  async processSapOrdersBatch(input: {
    orders: SapOrder[];
    correlationId?: string;
  }): Promise<{ created: number; updated: number; errors: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const sapOrder of input.orders) {
      try {
        const existing = sapOrder.DocEntry
          ? await this.repository.findBySapDocEntry(sapOrder.DocEntry)
          : null;

        if (existing) {
          // Atualiza campos se necessário
          updated++;
        } else {
          await this.createFromSap({ sapOrder, correlationId: input.correlationId });
          created++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`DocEntry ${sapOrder.DocEntry}: ${msg}`);
      }
    }

    return { created, updated, errors };
  }
}

/**
 * LEGACY: Singleton in-memory store (mantido para compatibilidade)
 * Em produção, use createOrderCoreService() com PostgresOrderRepository
 */
const legacyInMemoryStore = new InMemoryOrderStore();

export const getOrderCoreService = () => new OrderCoreService(legacyInMemoryStore);

/**
 * Factory para criar OrderCoreService com repositório configurável
 * Use este em produção com PostgresOrderRepository
 */
export const createOrderCoreService = (repository: OrderRepository) => 
  new OrderCoreService(repository);
