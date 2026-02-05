/**
 * Stock Service
 * 
 * Regras de negócio para estoque (WMS)
 */

import { Pool } from 'pg';
import {
  Stock,
  StockWithDetails,
  StockMovement,
  CreateStockMovementDto,
  StockReservation,
  CreateReservationDto,
  MovementType,
  StockFilter
} from '../models/types';

export class StockService {
  constructor(private db: Pool) {}

  /**
   * Consultar estoque de um produto em um depósito
   */
  async getStock(productId: string, warehouseId: string): Promise<Stock | null> {
    const query = 'SELECT * FROM stock WHERE product_id = $1 AND warehouse_id = $2';
    const result = await this.db.query(query, [productId, warehouseId]);
    return result.rows[0] || null;
  }

  /**
   * Consultar estoque de um produto em todos os depósitos
   */
  async getStockByProduct(productId: string): Promise<Stock[]> {
    const query = `
      SELECT s.*, w.code as warehouse_code, w.name as warehouse_name
      FROM stock s
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.product_id = $1
      ORDER BY s.quantity_available DESC
    `;
    const result = await this.db.query(query, [productId]);
    return result.rows;
  }

  /**
   * Consultar estoque de todos os produtos em um depósito
   */
  async getStockByWarehouse(warehouseId: string): Promise<StockWithDetails[]> {
    const query = `
      SELECT 
        s.*,
        p.sku, p.description as product_description,
        w.code as warehouse_code, w.name as warehouse_name
      FROM stock s
      JOIN products p ON s.product_id = p.id
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.warehouse_id = $1
      ORDER BY p.sku
    `;
    const result = await this.db.query(query, [warehouseId]);
    return result.rows;
  }

  /**
   * Listar estoque com filtros
   */
  async list(filter?: StockFilter): Promise<StockWithDetails[]> {
    const conditions = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filter?.product_id) {
      conditions.push(`s.product_id = $${paramIndex++}`);
      values.push(filter.product_id);
    }
    if (filter?.warehouse_id) {
      conditions.push(`s.warehouse_id = $${paramIndex++}`);
      values.push(filter.warehouse_id);
    }
    if (filter?.min_quantity !== undefined) {
      conditions.push(`s.quantity_available >= $${paramIndex++}`);
      values.push(filter.min_quantity);
    }
    if (filter?.location_zone) {
      conditions.push(`s.location_zone = $${paramIndex++}`);
      values.push(filter.location_zone);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        s.*,
        p.sku, p.description as product_description, p.unit_of_measure,
        w.code as warehouse_code, w.name as warehouse_name
      FROM stock s
      JOIN products p ON s.product_id = p.id
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE ${whereClause}
      ORDER BY p.sku, w.code
    `;

    const result = await this.db.query(query, values);
    return result.rows;
  }

  /**
   * Verificar disponibilidade de estoque
   */
  async checkAvailability(
    productId: string,
    warehouseId: string,
    quantity: number
  ): Promise<boolean> {
    const stock = await this.getStock(productId, warehouseId);
    
    if (!stock) {
      return false;
    }

    return stock.quantity_free >= quantity;
  }

  /**
   * Criar movimentação de estoque
   */
  async createMovement(dto: CreateStockMovementDto): Promise<StockMovement> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Inserir movimentação
      const query = `
        INSERT INTO stock_movements (
          product_id, warehouse_id, movement_type, quantity, unit_of_measure,
          from_warehouse_id, to_warehouse_id, reference_type, reference_id,
          reference_number, batch_number, notes, created_by, source_system
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const values = [
        dto.product_id,
        dto.warehouse_id,
        dto.movement_type,
        dto.quantity,
        dto.unit_of_measure,
        dto.from_warehouse_id || null,
        dto.to_warehouse_id || null,
        dto.reference_type || null,
        dto.reference_id || null,
        dto.reference_number || null,
        dto.batch_number || null,
        dto.notes || null,
        dto.created_by,
        dto.source_system || 'WMS'
      ];

      const result = await client.query(query, values);
      const movement = result.rows[0];

      // O trigger update_stock_after_movement já atualiza o estoque automaticamente

      await client.query('COMMIT');

      return movement;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Entrada de estoque (compra, devolução, etc)
   */
  async stockIn(
    productId: string,
    warehouseId: string,
    quantity: number,
    movementType: 'PURCHASE' | 'RETURN' | 'TRANSFER_IN' | 'ADJUSTMENT_IN',
    referenceNumber?: string,
    notes?: string,
    userId?: string
  ): Promise<StockMovement> {
    // Buscar produto para pegar unidade de medida
    const product = await this.db.query(
      'SELECT unit_of_measure FROM products WHERE id = $1',
      [productId]
    );

    if (product.rows.length === 0) {
      throw new Error(`Produto ${productId} não encontrado`);
    }

    return this.createMovement({
      product_id: productId,
      warehouse_id: warehouseId,
      movement_type: movementType,
      quantity,
      unit_of_measure: product.rows[0].unit_of_measure,
      reference_number: referenceNumber,
      notes,
      created_by: userId || 'system'
    });
  }

  /**
   * Saída de estoque (venda, transferência, etc)
   */
  async stockOut(
    productId: string,
    warehouseId: string,
    quantity: number,
    movementType: 'SALE' | 'TRANSFER_OUT' | 'ADJUSTMENT_OUT' | 'LOSS' | 'DAMAGE',
    referenceNumber?: string,
    notes?: string,
    userId?: string
  ): Promise<StockMovement> {
    // Verificar disponibilidade
    const hasStock = await this.checkAvailability(productId, warehouseId, quantity);
    
    if (!hasStock) {
      const stock = await this.getStock(productId, warehouseId);
      throw new Error(
        `Estoque insuficiente. Disponível: ${stock?.quantity_free || 0}, Necessário: ${quantity}`
      );
    }

    // Buscar produto para pegar unidade de medida
    const product = await this.db.query(
      'SELECT unit_of_measure FROM products WHERE id = $1',
      [productId]
    );

    return this.createMovement({
      product_id: productId,
      warehouse_id: warehouseId,
      movement_type: movementType,
      quantity,
      unit_of_measure: product.rows[0].unit_of_measure,
      reference_number: referenceNumber,
      notes,
      created_by: userId || 'system'
    });
  }

  /**
   * Transferência entre depósitos
   */
  async transfer(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    notes?: string,
    userId?: string
  ): Promise<{ out: StockMovement; in: StockMovement }> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Buscar produto
      const product = await client.query(
        'SELECT unit_of_measure FROM products WHERE id = $1',
        [productId]
      );

      if (product.rows.length === 0) {
        throw new Error(`Produto ${productId} não encontrado`);
      }

      const batchNumber = `TRF-${Date.now()}`;

      // Saída do depósito origem
      const outMovement = await this.createMovement({
        product_id: productId,
        warehouse_id: fromWarehouseId,
        movement_type: 'TRANSFER_OUT',
        quantity,
        unit_of_measure: product.rows[0].unit_of_measure,
        to_warehouse_id: toWarehouseId,
        batch_number: batchNumber,
        notes,
        created_by: userId || 'system'
      });

      // Entrada no depósito destino
      const inMovement = await this.createMovement({
        product_id: productId,
        warehouse_id: toWarehouseId,
        movement_type: 'TRANSFER_IN',
        quantity,
        unit_of_measure: product.rows[0].unit_of_measure,
        from_warehouse_id: fromWarehouseId,
        batch_number: batchNumber,
        notes,
        created_by: userId || 'system'
      });

      await client.query('COMMIT');

      return { out: outMovement, in: inMovement };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reservar estoque para um pedido
   */
  async reserve(dto: CreateReservationDto): Promise<StockReservation> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Verificar disponibilidade
      const hasStock = await this.checkAvailability(
        dto.product_id,
        dto.warehouse_id,
        dto.quantity_reserved
      );

      if (!hasStock) {
        throw new Error('Estoque insuficiente para reserva');
      }

      // Criar reserva
      const query = `
        INSERT INTO stock_reservations (
          product_id, warehouse_id, order_id, order_line_id,
          quantity_reserved, expires_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        dto.product_id,
        dto.warehouse_id,
        dto.order_id,
        dto.order_line_id,
        dto.quantity_reserved,
        dto.expires_at || null,
        dto.created_by || 'system'
      ];

      const result = await client.query(query, values);
      const reservation = result.rows[0];

      // Atualizar quantidade reservada no estoque
      await client.query(
        `UPDATE stock
         SET quantity_reserved = quantity_reserved + $1
         WHERE product_id = $2 AND warehouse_id = $3`,
        [dto.quantity_reserved, dto.product_id, dto.warehouse_id]
      );

      await client.query('COMMIT');

      return reservation;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Liberar reserva
   */
  async releaseReservation(reservationId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Buscar reserva
      const reservation = await client.query(
        'SELECT * FROM stock_reservations WHERE id = $1 AND status = $2',
        [reservationId, 'ACTIVE']
      );

      if (reservation.rows.length === 0) {
        throw new Error('Reserva não encontrada ou já liberada');
      }

      const res = reservation.rows[0];

      // Atualizar status da reserva
      await client.query(
        `UPDATE stock_reservations
         SET status = 'RELEASED', updated_at = NOW()
         WHERE id = $1`,
        [reservationId]
      );

      // Liberar quantidade reservada no estoque
      await client.query(
        `UPDATE stock
         SET quantity_reserved = quantity_reserved - $1
         WHERE product_id = $2 AND warehouse_id = $3`,
        [res.quantity_reserved - res.quantity_picked, res.product_id, res.warehouse_id]
      );

      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Liberar todas as reservas de um pedido
   */
  async releaseReservationsForOrder(orderId: string): Promise<void> {
    const reservations = await this.db.query(
      'SELECT id FROM stock_reservations WHERE order_id = $1 AND status = $2',
      [orderId, 'ACTIVE']
    );

    for (const res of reservations.rows) {
      await this.releaseReservation(res.id);
    }
  }

  /**
   * Confirmar separação (picked) e consumir reserva
   */
  async confirmPick(
    reservationId: string,
    quantityPicked: number
  ): Promise<StockReservation> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Buscar reserva
      const reservation = await client.query(
        'SELECT * FROM stock_reservations WHERE id = $1',
        [reservationId]
      );

      if (reservation.rows.length === 0) {
        throw new Error('Reserva não encontrada');
      }

      const res = reservation.rows[0];

      if (quantityPicked > res.quantity_reserved) {
        throw new Error('Quantidade separada maior que reservada');
      }

      // Atualizar reserva
      await client.query(
        `UPDATE stock_reservations
         SET quantity_picked = $1,
             status = CASE WHEN $1 >= quantity_reserved THEN 'PICKED' ELSE status END,
             updated_at = NOW()
         WHERE id = $2`,
        [quantityPicked, reservationId]
      );

      // Criar movimentação de saída
      await this.createMovement({
        product_id: res.product_id,
        warehouse_id: res.warehouse_id,
        movement_type: 'SALE',
        quantity: quantityPicked,
        unit_of_measure: 'UN', // TODO: pegar do produto
        reference_type: 'ORDER',
        reference_id: res.order_id,
        notes: `Separação do pedido`,
        created_by: 'system',
        source_system: 'WMS'
      });

      await client.query('COMMIT');

      // Buscar reserva atualizada
      const updated = await this.db.query(
        'SELECT * FROM stock_reservations WHERE id = $1',
        [reservationId]
      );

      return updated.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Buscar movimentações de um produto
   */
  async getMovements(
    productId: string,
    warehouseId?: string,
    limit: number = 100
  ): Promise<StockMovement[]> {
    let query = `
      SELECT sm.*, p.sku, p.description, w.code as warehouse_code
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.product_id = $1
    `;

    const values: any[] = [productId];

    if (warehouseId) {
      query += ' AND sm.warehouse_id = $2';
      values.push(warehouseId);
    }

    query += ' ORDER BY sm.created_at DESC LIMIT $' + (values.length + 1);
    values.push(limit);

    const result = await this.db.query(query, values);
    return result.rows;
  }

  /**
   * Ajuste de estoque (inventário)
   */
  async adjust(
    productId: string,
    warehouseId: string,
    newQuantity: number,
    reason: string,
    userId?: string
  ): Promise<StockMovement> {
    const currentStock = await this.getStock(productId, warehouseId);
    const currentQuantity = currentStock?.quantity_available || 0;
    const difference = newQuantity - currentQuantity;

    if (difference === 0) {
      throw new Error('Quantidade não mudou');
    }

    const movementType: MovementType = difference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

    return this.createMovement({
      product_id: productId,
      warehouse_id: warehouseId,
      movement_type: movementType,
      quantity: Math.abs(difference),
      unit_of_measure: 'UN', // TODO: pegar do produto
      notes: `Ajuste de inventário: ${reason}`,
      created_by: userId || 'system'
    });
  }

  /**
   * Buscar produtos com estoque baixo
   */
  async getLowStockProducts(threshold: number = 10): Promise<StockWithDetails[]> {
    const query = `
      SELECT 
        s.*,
        p.sku, p.description as product_description,
        w.code as warehouse_code, w.name as warehouse_name
      FROM stock s
      JOIN products p ON s.product_id = p.id
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.quantity_free <= $1
      ORDER BY s.quantity_free ASC
    `;

    const result = await this.db.query(query, [threshold]);
    return result.rows;
  }
}
