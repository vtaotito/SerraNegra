/**
 * Order Service
 * 
 * Regras de negócio para pedidos (OMS)
 */

import { Pool } from 'pg';
import {
  Order,
  OrderLine,
  OrderWithLines,
  CreateOrderDto,
  UpdateOrderStatusDto,
  OrderStatus,
  OrderFilter,
  PaginationParams,
  PaginatedResponse
} from '../models/types';
import { ProductService } from './ProductService';
import { StockService } from './StockService';

export class OrderService {
  constructor(
    private db: Pool,
    private productService: ProductService,
    private stockService: StockService
  ) {}

  /**
   * Criar pedido
   */
  async create(dto: CreateOrderDto): Promise<OrderWithLines> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Validar cliente
      const customer = await client.query(
        'SELECT * FROM customers WHERE id = $1',
        [dto.customer_id]
      );
      
      if (customer.rows.length === 0) {
        throw new Error(`Cliente ${dto.customer_id} não encontrado`);
      }

      // 2. Validar número do pedido único
      const existing = await client.query(
        'SELECT id FROM orders WHERE order_number = $1',
        [dto.order_number]
      );
      
      if (existing.rows.length > 0) {
        throw new Error(`Pedido ${dto.order_number} já existe`);
      }

      // 3. Calcular total
      const totalAmount = dto.lines.reduce((sum, line) => {
        return sum + ((line.unit_price || 0) * line.quantity);
      }, 0);

      // 4. Inserir pedido
      const orderQuery = `
        INSERT INTO orders (
          order_number, customer_id, customer_name, status,
          order_date, due_date, total_amount, currency, priority,
          notes, sap_doc_entry, sap_doc_num, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const orderValues = [
        dto.order_number,
        dto.customer_id,
        dto.customer_name,
        dto.status || 'PENDING',
        dto.order_date || new Date(),
        dto.due_date || null,
        totalAmount,
        dto.currency || 'BRL',
        dto.priority || 5,
        dto.notes || null,
        dto.sap_doc_entry || null,
        dto.sap_doc_num || null,
        dto.created_by || 'system'
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];

      // 5. Inserir linhas
      const lines: OrderLine[] = [];
      
      for (const lineDto of dto.lines) {
        // Validar produto
        const product = await this.productService.findById(lineDto.product_id);
        if (!product) {
          throw new Error(`Produto ${lineDto.product_id} não encontrado`);
        }

        const lineQuery = `
          INSERT INTO order_lines (
            order_id, product_id, line_number, product_sku,
            product_description, quantity, unit_of_measure,
            unit_price, line_total, warehouse_id, warehouse_code,
            sap_line_num, sap_item_code
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;

        const lineTotal = (lineDto.unit_price || 0) * lineDto.quantity;

        const lineValues = [
          order.id,
          lineDto.product_id,
          lineDto.line_number,
          lineDto.product_sku,
          lineDto.product_description,
          lineDto.quantity,
          lineDto.unit_of_measure,
          lineDto.unit_price || null,
          lineTotal,
          lineDto.warehouse_id || null,
          lineDto.warehouse_code || null,
          lineDto.sap_line_num || null,
          lineDto.sap_item_code || null
        ];

        const lineResult = await client.query(lineQuery, lineValues);
        lines.push(lineResult.rows[0]);
      }

      await client.query('COMMIT');

      return {
        ...order,
        lines
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Buscar pedido por ID
   */
  async findById(id: string): Promise<OrderWithLines | null> {
    const order = await this.db.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (order.rows.length === 0) {
      return null;
    }

    const lines = await this.db.query(
      'SELECT * FROM order_lines WHERE order_id = $1 ORDER BY line_number',
      [id]
    );

    return {
      ...order.rows[0],
      lines: lines.rows
    };
  }

  /**
   * Buscar pedido por número
   */
  async findByNumber(orderNumber: string): Promise<OrderWithLines | null> {
    const order = await this.db.query(
      'SELECT * FROM orders WHERE order_number = $1',
      [orderNumber]
    );

    if (order.rows.length === 0) {
      return null;
    }

    const lines = await this.db.query(
      'SELECT * FROM order_lines WHERE order_id = $1 ORDER BY line_number',
      [order.rows[0].id]
    );

    return {
      ...order.rows[0],
      lines: lines.rows
    };
  }

  /**
   * Buscar pedido por DocEntry do SAP
   */
  async findBySapDocEntry(docEntry: number): Promise<OrderWithLines | null> {
    const order = await this.db.query(
      'SELECT * FROM orders WHERE sap_doc_entry = $1',
      [docEntry]
    );

    if (order.rows.length === 0) {
      return null;
    }

    const lines = await this.db.query(
      'SELECT * FROM order_lines WHERE order_id = $1 ORDER BY line_number',
      [order.rows[0].id]
    );

    return {
      ...order.rows[0],
      lines: lines.rows
    };
  }

  /**
   * Atualizar status do pedido
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findById(id);
    if (!order) {
      throw new Error(`Pedido ${id} não encontrado`);
    }

    // Validar transição de status
    this.validateStatusTransition(order.status, dto.status);

    const query = `
      UPDATE orders
      SET status = $1,
          notes = COALESCE($2, notes),
          updated_by = $3,
          shipped_at = CASE WHEN $1 = 'SHIPPED' THEN NOW() ELSE shipped_at END,
          delivered_at = CASE WHEN $1 = 'DELIVERED' THEN NOW() ELSE delivered_at END
      WHERE id = $4
      RETURNING *
    `;

    const values = [dto.status, dto.notes, dto.updated_by || 'system', id];
    const result = await this.db.query(query, values);

    return result.rows[0];
  }

  /**
   * Validar transição de status
   */
  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      'PENDING': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['PICKING', 'CANCELLED'],
      'PICKING': ['PICKED', 'PROCESSING', 'CANCELLED'],
      'PICKED': ['PACKING', 'PICKING'],
      'PACKING': ['PACKED', 'PICKED'],
      'PACKED': ['READY_TO_SHIP', 'PACKING'],
      'READY_TO_SHIP': ['SHIPPED', 'PACKED'],
      'SHIPPED': ['DELIVERED'],
      'DELIVERED': [],
      'CANCELLED': []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Transição inválida: ${currentStatus} → ${newStatus}`
      );
    }
  }

  /**
   * Processar pedido (iniciar separação)
   */
  async process(orderId: string, userId?: string): Promise<OrderWithLines> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado`);
    }

    // Verificar estoque disponível
    for (const line of order.lines) {
      const hasStock = await this.stockService.checkAvailability(
        line.product_id,
        line.warehouse_id || '',
        line.quantity
      );

      if (!hasStock) {
        throw new Error(
          `Estoque insuficiente para ${line.product_sku} no depósito ${line.warehouse_code}`
        );
      }
    }

    // Atualizar status
    await this.updateStatus(orderId, {
      status: 'PROCESSING',
      notes: 'Pedido em processamento',
      updated_by: userId
    });

    // Reservar estoque
    for (const line of order.lines) {
      await this.stockService.reserve({
        product_id: line.product_id,
        warehouse_id: line.warehouse_id || '',
        order_id: orderId,
        order_line_id: line.id,
        quantity_reserved: line.quantity,
        created_by: userId
      });
    }

    return this.findById(orderId) as Promise<OrderWithLines>;
  }

  /**
   * Iniciar separação (picking)
   */
  async startPicking(orderId: string, userId?: string): Promise<Order> {
    return this.updateStatus(orderId, {
      status: 'PICKING',
      notes: 'Separação iniciada',
      updated_by: userId
    });
  }

  /**
   * Confirmar separação (picked)
   */
  async confirmPicking(orderId: string, userId?: string): Promise<Order> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado`);
    }

    // Verificar se todas as linhas foram separadas
    for (const line of order.lines) {
      if (line.quantity_picked < line.quantity) {
        throw new Error(
          `Linha ${line.line_number} ainda não foi totalmente separada`
        );
      }
    }

    return this.updateStatus(orderId, {
      status: 'PICKED',
      notes: 'Separação concluída',
      updated_by: userId
    });
  }

  /**
   * Registrar quantidade separada em uma linha
   */
  async registerPickedQuantity(
    orderLineId: string,
    quantity: number,
    userId?: string
  ): Promise<OrderLine> {
    const query = `
      UPDATE order_lines
      SET quantity_picked = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, [quantity, orderLineId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Linha de pedido ${orderLineId} não encontrada`);
    }

    return result.rows[0];
  }

  /**
   * Listar pedidos com filtros
   */
  async list(
    filter?: OrderFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Order>> {
    const conditions = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filter?.order_number) {
      conditions.push(`order_number ILIKE $${paramIndex++}`);
      values.push(`%${filter.order_number}%`);
    }
    if (filter?.customer_id) {
      conditions.push(`customer_id = $${paramIndex++}`);
      values.push(filter.customer_id);
    }
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        const placeholders = filter.status.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`status IN (${placeholders})`);
        values.push(...filter.status);
      } else {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filter.status);
      }
    }
    if (filter?.from_date) {
      conditions.push(`order_date >= $${paramIndex++}`);
      values.push(filter.from_date);
    }
    if (filter?.to_date) {
      conditions.push(`order_date <= $${paramIndex++}`);
      values.push(filter.to_date);
    }
    if (filter?.sap_doc_entry) {
      conditions.push(`sap_doc_entry = $${paramIndex++}`);
      values.push(filter.sap_doc_entry);
    }
    if (filter?.sync_status) {
      conditions.push(`sync_status = $${paramIndex++}`);
      values.push(filter.sync_status);
    }

    const whereClause = conditions.join(' AND ');

    // Count
    const countQuery = `SELECT COUNT(*) FROM orders WHERE ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const offset = (page - 1) * limit;

    // Sort
    const sortBy = pagination?.sort_by || 'order_date';
    const sortOrder = pagination?.sort_order || 'DESC';

    // Data
    const dataQuery = `
      SELECT * FROM orders
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    values.push(limit, offset);

    const dataResult = await this.db.query(dataQuery, values);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Importar pedido do SAP
   */
  async importFromSap(sapOrder: any, userId?: string): Promise<OrderWithLines> {
    // Verificar se já existe
    const existing = await this.findBySapDocEntry(sapOrder.DocEntry);
    if (existing) {
      // Atualizar status se necessário
      if (sapOrder.DocumentStatus !== existing.sap_doc_status) {
        await this.db.query(
          `UPDATE orders 
           SET sap_doc_status = $1, last_sync_at = NOW(), sync_status = 'SYNCED'
           WHERE id = $2`,
          [sapOrder.DocumentStatus, existing.id]
        );
      }
      return existing;
    }

    // Criar cliente se não existir
    let customer = await this.db.query(
      'SELECT * FROM customers WHERE sap_card_code = $1',
      [sapOrder.CardCode]
    );

    if (customer.rows.length === 0) {
      await this.db.query(
        `INSERT INTO customers (customer_code, name, sap_card_code, sap_card_name, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [sapOrder.CardCode, sapOrder.CardName, sapOrder.CardCode, sapOrder.CardName, 'sap-sync']
      );
      
      customer = await this.db.query(
        'SELECT * FROM customers WHERE sap_card_code = $1',
        [sapOrder.CardCode]
      );
    }

    // Criar pedido
    const orderNumber = `SAP-${sapOrder.DocNum}`;
    
    const createDto: CreateOrderDto = {
      order_number: orderNumber,
      customer_id: customer.rows[0].id,
      customer_name: sapOrder.CardName,
      order_date: new Date(sapOrder.DocDate),
      due_date: sapOrder.DocDueDate ? new Date(sapOrder.DocDueDate) : undefined,
      total_amount: sapOrder.DocTotal,
      sap_doc_entry: sapOrder.DocEntry,
      sap_doc_num: sapOrder.DocNum,
      lines: sapOrder.DocumentLines.map((sapLine: any, index: number) => ({
        product_id: '', // Será preenchido depois
        product_sku: sapLine.ItemCode,
        product_description: sapLine.ItemDescription || sapLine.ItemCode,
        line_number: sapLine.LineNum || index,
        quantity: sapLine.Quantity,
        unit_of_measure: sapLine.MeasureUnit || 'UN',
        unit_price: sapLine.Price,
        warehouse_code: sapLine.WarehouseCode,
        sap_line_num: sapLine.LineNum,
        sap_item_code: sapLine.ItemCode
      })),
      created_by: userId || 'sap-sync'
    };

    // Buscar/criar produtos
    for (const line of createDto.lines) {
      let product = await this.productService.findBySapCode(line.sap_item_code!);
      
      if (!product) {
        product = await this.productService.create({
          sku: line.sap_item_code!,
          description: line.product_description,
          sap_item_code: line.sap_item_code!,
          created_by: 'sap-sync'
        });
      }

      line.product_id = product.id;

      // Buscar warehouse
      if (line.warehouse_code) {
        const warehouse = await this.db.query(
          'SELECT id FROM warehouses WHERE sap_warehouse_code = $1',
          [line.warehouse_code]
        );
        
        if (warehouse.rows.length > 0) {
          line.warehouse_id = warehouse.rows[0].id;
        }
      }
    }

    // Criar pedido
    const order = await this.create(createDto);

    // Marcar como sincronizado
    await this.db.query(
      `UPDATE orders 
       SET last_sync_at = NOW(), sync_status = 'SYNCED', sap_doc_status = $1
       WHERE id = $2`,
      [sapOrder.DocumentStatus, order.id]
    );

    return order;
  }

  /**
   * Cancelar pedido
   */
  async cancel(orderId: string, reason?: string, userId?: string): Promise<Order> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado`);
    }

    // Liberar reservas
    await this.stockService.releaseReservationsForOrder(orderId);

    return this.updateStatus(orderId, {
      status: 'CANCELLED',
      notes: reason || 'Pedido cancelado',
      updated_by: userId
    });
  }
}
