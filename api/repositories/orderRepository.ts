/**
 * Order Repository Interface
 * Abstração para persistência de pedidos
 */
import type { Order, OrderEventResult } from "../../wms-core/src/index.js";

export interface OrderRepository {
  /**
   * Salva ou atualiza um pedido
   */
  save(order: Order): Promise<void>;

  /**
   * Busca pedido por ID
   */
  findById(orderId: string): Promise<Order | null>;

  /**
   * Busca pedido por DocEntry do SAP
   */
  findBySapDocEntry(docEntry: number): Promise<Order | null>;

  /**
   * Lista pedidos com filtros opcionais
   */
  findAll(filter?: {
    status?: string;
    carrier?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]>;

  /**
   * Salva transição de estado
   */
  saveTransition(transition: OrderEventResult["transition"]): Promise<void>;

  /**
   * Obtém histórico de transições de um pedido
   */
  getHistory(orderId: string): Promise<OrderEventResult["transition"][]>;

  /**
   * Verifica se existe uma chave de idempotência
   * Retorna o resultado anterior se existir
   */
  checkIdempotency(
    scope: string,
    key: string,
    requestHash: string
  ): Promise<{ exists: boolean; response?: OrderEventResult }>;

  /**
   * Salva chave de idempotência
   */
  saveIdempotency(
    scope: string,
    key: string,
    requestHash: string,
    response: OrderEventResult
  ): Promise<void>;
}
