/**
 * Product Service
 * 
 * Regras de negócio para produtos
 */

import { Pool } from 'pg';
import {
  Product,
  CreateProductDto,
  UpdateProductDto,
  ProductFilter,
  PaginationParams,
  PaginatedResponse
} from '../models/types';

export class ProductService {
  constructor(private db: Pool) {}

  /**
   * Criar produto
   */
  async create(dto: CreateProductDto): Promise<Product> {
    // Validar SKU único
    const existing = await this.findBySku(dto.sku);
    if (existing) {
      throw new Error(`Produto com SKU ${dto.sku} já existe`);
    }

    const query = `
      INSERT INTO products (
        sku, description, ean, category, unit_of_measure,
        is_active, sap_item_code, sap_item_name,
        weight_kg, length_cm, width_cm, height_cm, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      dto.sku,
      dto.description,
      dto.ean || null,
      dto.category || null,
      dto.unit_of_measure || 'UN',
      dto.is_active !== undefined ? dto.is_active : true,
      dto.sap_item_code || null,
      dto.sap_item_name || null,
      dto.weight_kg || null,
      dto.length_cm || null,
      dto.width_cm || null,
      dto.height_cm || null,
      dto.created_by || 'system'
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Buscar produto por ID
   */
  async findById(id: string): Promise<Product | null> {
    const query = 'SELECT * FROM products WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Buscar produto por SKU
   */
  async findBySku(sku: string): Promise<Product | null> {
    const query = 'SELECT * FROM products WHERE sku = $1';
    const result = await this.db.query(query, [sku]);
    return result.rows[0] || null;
  }

  /**
   * Buscar produto por código SAP
   */
  async findBySapCode(sapItemCode: string): Promise<Product | null> {
    const query = 'SELECT * FROM products WHERE sap_item_code = $1';
    const result = await this.db.query(query, [sapItemCode]);
    return result.rows[0] || null;
  }

  /**
   * Atualizar produto
   */
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);
    if (!product) {
      throw new Error(`Produto ${id} não encontrado`);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (dto.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.ean !== undefined) {
      fields.push(`ean = $${paramIndex++}`);
      values.push(dto.ean);
    }
    if (dto.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(dto.category);
    }
    if (dto.unit_of_measure !== undefined) {
      fields.push(`unit_of_measure = $${paramIndex++}`);
      values.push(dto.unit_of_measure);
    }
    if (dto.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(dto.is_active);
    }
    if (dto.sap_item_code !== undefined) {
      fields.push(`sap_item_code = $${paramIndex++}`);
      values.push(dto.sap_item_code);
    }
    if (dto.sap_item_name !== undefined) {
      fields.push(`sap_item_name = $${paramIndex++}`);
      values.push(dto.sap_item_name);
    }
    if (dto.weight_kg !== undefined) {
      fields.push(`weight_kg = $${paramIndex++}`);
      values.push(dto.weight_kg);
    }
    if (dto.length_cm !== undefined) {
      fields.push(`length_cm = $${paramIndex++}`);
      values.push(dto.length_cm);
    }
    if (dto.width_cm !== undefined) {
      fields.push(`width_cm = $${paramIndex++}`);
      values.push(dto.width_cm);
    }
    if (dto.height_cm !== undefined) {
      fields.push(`height_cm = $${paramIndex++}`);
      values.push(dto.height_cm);
    }
    if (dto.updated_by !== undefined) {
      fields.push(`updated_by = $${paramIndex++}`);
      values.push(dto.updated_by);
    }

    if (fields.length === 0) {
      return product;
    }

    values.push(id);
    const query = `
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Ativar/Desativar produto
   */
  async setActive(id: string, isActive: boolean, updatedBy?: string): Promise<Product> {
    return this.update(id, { is_active: isActive, updated_by: updatedBy });
  }

  /**
   * Listar produtos com filtros e paginação
   */
  async list(filter?: ProductFilter, pagination?: PaginationParams): Promise<PaginatedResponse<Product>> {
    const conditions = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filter?.sku) {
      conditions.push(`sku ILIKE $${paramIndex++}`);
      values.push(`%${filter.sku}%`);
    }
    if (filter?.description) {
      conditions.push(`description ILIKE $${paramIndex++}`);
      values.push(`%${filter.description}%`);
    }
    if (filter?.category) {
      conditions.push(`category = $${paramIndex++}`);
      values.push(filter.category);
    }
    if (filter?.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filter.is_active);
    }
    if (filter?.sap_item_code) {
      conditions.push(`sap_item_code = $${paramIndex++}`);
      values.push(filter.sap_item_code);
    }

    const whereClause = conditions.join(' AND ');

    // Count total
    const countQuery = `SELECT COUNT(*) FROM products WHERE ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const offset = (page - 1) * limit;

    // Sort
    const sortBy = pagination?.sort_by || 'created_at';
    const sortOrder = pagination?.sort_order || 'DESC';

    // Query data
    const dataQuery = `
      SELECT * FROM products
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
   * Sincronizar produto do SAP
   */
  async syncFromSap(sapItem: any): Promise<Product> {
    // Buscar produto existente por código SAP
    const existing = await this.findBySapCode(sapItem.ItemCode);

    if (existing) {
      // Atualizar
      return this.update(existing.id, {
        description: sapItem.ItemName,
        sap_item_name: sapItem.ItemName,
        is_active: sapItem.Valid === 'tYES',
        updated_by: 'sap-sync'
      });
    } else {
      // Criar novo
      return this.create({
        sku: sapItem.ItemCode,
        description: sapItem.ItemName,
        sap_item_code: sapItem.ItemCode,
        sap_item_name: sapItem.ItemName,
        is_active: sapItem.Valid === 'tYES',
        unit_of_measure: sapItem.InventoryUOM || 'UN',
        created_by: 'sap-sync'
      });
    }
  }

  /**
   * Deletar produto (soft delete)
   */
  async delete(id: string, deletedBy?: string): Promise<void> {
    await this.setActive(id, false, deletedBy);
  }

  /**
   * Buscar produtos por IDs
   */
  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const query = `SELECT * FROM products WHERE id IN (${placeholders})`;
    const result = await this.db.query(query, ids);
    return result.rows;
  }

  /**
   * Buscar produtos ativos
   */
  async findActive(): Promise<Product[]> {
    const query = 'SELECT * FROM products WHERE is_active = true ORDER BY sku';
    const result = await this.db.query(query);
    return result.rows;
  }
}
