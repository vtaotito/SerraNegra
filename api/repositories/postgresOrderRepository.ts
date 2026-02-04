/**
 * PostgreSQL implementation of OrderRepository
 * Implementação completa com transações e idempotência
 */
import type { Pool, PoolClient } from "pg";
import type { Order, OrderEventResult, OrderItem } from "../../wms-core/src/index.js";
import type { OrderRepository } from "./orderRepository.js";
import { WmsError } from "../../wms-core/src/errors.js";

export class PostgresOrderRepository implements OrderRepository {
  constructor(private pool: Pool) {}

  /**
   * Salva ou atualiza um pedido (com items)
   */
  async save(order: Order): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query("BEGIN");

      // Upsert do pedido
      const orderQuery = `
        INSERT INTO orders (
          id, external_order_id, sap_doc_entry, sap_doc_num,
          customer_id, customer_name, ship_to_address, status,
          carrier, priority, sla_due_at, doc_total, currency, metadata,
          created_at, updated_at, version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          external_order_id = EXCLUDED.external_order_id,
          sap_doc_entry = EXCLUDED.sap_doc_entry,
          sap_doc_num = EXCLUDED.sap_doc_num,
          customer_id = EXCLUDED.customer_id,
          customer_name = EXCLUDED.customer_name,
          ship_to_address = EXCLUDED.ship_to_address,
          status = EXCLUDED.status,
          carrier = EXCLUDED.carrier,
          priority = EXCLUDED.priority,
          sla_due_at = EXCLUDED.sla_due_at,
          doc_total = EXCLUDED.doc_total,
          currency = EXCLUDED.currency,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at,
          version = EXCLUDED.version
      `;

      await client.query(orderQuery, [
        order.id,
        order.externalOrderId || null,
        order.sapDocEntry || null,
        order.sapDocNum || null,
        order.customerId,
        order.customerName || null,
        order.shipToAddress || null,
        order.status,
        order.carrier || null,
        order.priority || null,
        order.slaDueAt || null,
        order.docTotal || null,
        order.currency || null,
        order.metadata ? JSON.stringify(order.metadata) : null,
        order.createdAt,
        order.updatedAt,
        order.version
      ]);

      // Remove items antigos (simplifica upsert)
      await client.query("DELETE FROM order_items WHERE order_id = $1", [order.id]);

      // Insere items novamente
      if (order.items && order.items.length > 0) {
        const itemsQuery = `
          INSERT INTO order_items (id, order_id, sku, quantity, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `;

        for (const item of order.items) {
          const itemId = `${order.id}-${item.sku}-${Date.now()}`;
          await client.query(itemsQuery, [
            itemId,
            order.id,
            item.sku,
            item.quantity,
            order.createdAt
          ]);
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new WmsError("WMS-DB-001", "Erro ao salvar pedido", { error: String(err) });
    } finally {
      client.release();
    }
  }

  /**
   * Busca pedido por ID (com items)
   */
  async findById(orderId: string): Promise<Order | null> {
    const orderQuery = `
      SELECT 
        id, external_order_id, sap_doc_entry, sap_doc_num,
        customer_id, customer_name, ship_to_address, status,
        carrier, priority, sla_due_at, doc_total, currency, metadata,
        created_at, updated_at, version
      FROM orders
      WHERE id = $1
    `;

    const itemsQuery = `
      SELECT sku, quantity
      FROM order_items
      WHERE order_id = $1
      ORDER BY created_at
    `;

    const orderResult = await this.pool.query(orderQuery, [orderId]);
    
    if (orderResult.rows.length === 0) {
      return null;
    }

    const row = orderResult.rows[0];
    const itemsResult = await this.pool.query(itemsQuery, [orderId]);

    const order: Order = {
      id: row.id,
      externalOrderId: row.external_order_id,
      sapDocEntry: row.sap_doc_entry,
      sapDocNum: row.sap_doc_num,
      customerId: row.customer_id,
      customerName: row.customer_name,
      shipToAddress: row.ship_to_address,
      status: row.status,
      carrier: row.carrier,
      priority: row.priority,
      slaDueAt: row.sla_due_at,
      docTotal: row.doc_total,
      currency: row.currency,
      items: itemsResult.rows.map((item) => ({
        sku: item.sku,
        quantity: item.quantity
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };

    return order;
  }

  /**
   * Busca pedido por DocEntry do SAP
   */
  async findBySapDocEntry(docEntry: number): Promise<Order | null> {
    const query = `
      SELECT id FROM orders WHERE sap_doc_entry = $1 LIMIT 1
    `;

    const result = await this.pool.query(query, [docEntry]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.findById(result.rows[0].id);
  }

  /**
   * Lista pedidos com filtros
   */
  async findAll(filter?: {
    status?: string;
    carrier?: string;
    priority?: string;
    externalOrderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filter.status);
    }

    if (filter?.carrier) {
      conditions.push(`carrier = $${paramIndex++}`);
      params.push(filter.carrier);
    }

    if (filter?.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(filter.priority);
    }

    // Busca parcial por externalOrderId usando ILIKE (case-insensitive)
    if (filter?.externalOrderId) {
      conditions.push(`external_order_id ILIKE $${paramIndex++}`);
      params.push(`%${filter.externalOrderId}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter?.limit || 200;
    const offset = filter?.offset || 0;

    const query = `
      SELECT id FROM orders
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    
    // Carrega cada pedido completo (com items)
    const orders = await Promise.all(
      result.rows.map((row) => this.findById(row.id))
    );

    return orders.filter((o): o is Order => o !== null);
  }

  /**
   * Salva transição de estado
   */
  async saveTransition(transition: OrderEventResult["transition"]): Promise<void> {
    const query = `
      INSERT INTO order_transitions (
        id, order_id, from_status, to_status, event_type,
        actor_id, actor_role, occurred_at, idempotency_key,
        reason, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const id = `${transition.orderId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
      await this.pool.query(query, [
        id,
        transition.orderId,
        transition.from,
        transition.to,
        transition.eventType,
        transition.actorId,
        transition.actorRole,
        transition.occurredAt,
        transition.idempotencyKey || null,
        transition.reason || null,
        transition.metadata ? JSON.stringify(transition.metadata) : null
      ]);
    } catch (err) {
      throw new WmsError("WMS-DB-001", "Erro ao salvar transição", { error: String(err) });
    }
  }

  /**
   * Obtém histórico de transições
   */
  async getHistory(orderId: string): Promise<OrderEventResult["transition"][]> {
    const query = `
      SELECT 
        order_id, from_status, to_status, event_type,
        actor_id, actor_role, occurred_at, idempotency_key,
        reason, metadata
      FROM order_transitions
      WHERE order_id = $1
      ORDER BY occurred_at ASC
    `;

    const result = await this.pool.query(query, [orderId]);

    return result.rows.map((row) => ({
      orderId: row.order_id,
      from: row.from_status,
      to: row.to_status,
      eventType: row.event_type,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      occurredAt: row.occurred_at,
      idempotencyKey: row.idempotency_key,
      reason: row.reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Verifica idempotência
   */
  async checkIdempotency(
    scope: string,
    key: string,
    requestHash: string
  ): Promise<{ exists: boolean; response?: OrderEventResult }> {
    const query = `
      SELECT request_hash, response_snapshot
      FROM idempotency_keys
      WHERE scope = $1 AND key = $2
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const result = await this.pool.query(query, [scope, key]);

    if (result.rows.length === 0) {
      return { exists: false };
    }

    const row = result.rows[0];

    // Verifica se o hash do request bate
    if (row.request_hash !== requestHash) {
      throw new WmsError(
        "WMS-IDEM-001",
        "Idempotency-Key já usada com payload diferente",
        { scope, key }
      );
    }

    // Retorna resposta cacheada
    return {
      exists: true,
      response: row.response_snapshot ? JSON.parse(row.response_snapshot) : undefined
    };
  }

  /**
   * Salva idempotência
   */
  async saveIdempotency(
    scope: string,
    key: string,
    requestHash: string,
    response: OrderEventResult
  ): Promise<void> {
    const query = `
      INSERT INTO idempotency_keys (
        id, scope, key, request_hash, response_snapshot, created_at, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '24 hours')
      ON CONFLICT (scope, key) DO NOTHING
    `;

    const id = `${scope}-${key}-${Date.now()}`;

    try {
      await this.pool.query(query, [
        id,
        scope,
        key,
        requestHash,
        JSON.stringify(response)
      ]);
    } catch (err) {
      // Ignora erro de conflito (race condition)
      if (!String(err).includes("duplicate key")) {
        throw new WmsError("WMS-DB-001", "Erro ao salvar idempotência", {
          error: String(err)
        });
      }
    }
  }
}
