/**
 * WMS Core - TypeScript Types
 * 
 * Tipos baseados no schema do banco de dados
 */

// ============================================================================
// 1. CATÁLOGO
// ============================================================================

export interface Product {
  id: string;
  sku: string;
  description: string;
  ean?: string;
  category?: string;
  unit_of_measure: string;
  is_active: boolean;
  sap_item_code?: string;
  sap_item_name?: string;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateProductDto {
  sku: string;
  description: string;
  ean?: string;
  category?: string;
  unit_of_measure?: string;
  is_active?: boolean;
  sap_item_code?: string;
  sap_item_name?: string;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  created_by?: string;
}

export interface UpdateProductDto {
  description?: string;
  ean?: string;
  category?: string;
  unit_of_measure?: string;
  is_active?: boolean;
  sap_item_code?: string;
  sap_item_name?: string;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  updated_by?: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  warehouse_type: string;
  is_active: boolean;
  sap_warehouse_code?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  price: number;
  currency: string;
  valid_from: Date;
  valid_until?: Date;
  is_active: boolean;
  created_at: Date;
  created_by?: string;
}

// ============================================================================
// 2. PEDIDOS (OMS)
// ============================================================================

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  segment?: string;
  is_active: boolean;
  sap_card_code?: string;
  sap_card_name?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export type OrderStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'PICKING'
  | 'PICKED'
  | 'PACKING'
  | 'PACKED'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  status: OrderStatus;
  order_date: Date;
  due_date?: Date;
  shipped_at?: Date;
  delivered_at?: Date;
  total_amount?: number;
  currency: string;
  priority: number;
  notes?: string;
  
  // SAP Integration
  sap_doc_entry?: number;
  sap_doc_num?: number;
  sap_doc_status?: string;
  sap_udf_wms_status?: string;
  sap_udf_wms_orderid?: string;
  sap_udf_wms_last_event?: string;
  sap_udf_wms_last_ts?: Date;
  sap_udf_wms_corr_id?: string;
  
  // Sync
  last_sync_at?: Date;
  sync_status?: 'SYNCED' | 'PENDING' | 'ERROR';
  sync_error?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  line_number: number;
  product_sku: string;
  product_description: string;
  quantity: number;
  unit_of_measure: string;
  quantity_picked: number;
  quantity_packed: number;
  quantity_shipped: number;
  unit_price?: number;
  line_total?: number;
  warehouse_id?: string;
  warehouse_code?: string;
  sap_line_num?: number;
  sap_item_code?: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderWithLines extends Order {
  lines: OrderLine[];
}

export interface CreateOrderDto {
  order_number: string;
  customer_id: string;
  customer_name: string;
  status?: OrderStatus;
  order_date?: Date;
  due_date?: Date;
  total_amount?: number;
  currency?: string;
  priority?: number;
  notes?: string;
  sap_doc_entry?: number;
  sap_doc_num?: number;
  lines: CreateOrderLineDto[];
  created_by?: string;
}

export interface CreateOrderLineDto {
  product_id: string;
  product_sku: string;
  product_description: string;
  line_number: number;
  quantity: number;
  unit_of_measure: string;
  unit_price?: number;
  warehouse_id?: string;
  warehouse_code?: string;
  sap_line_num?: number;
  sap_item_code?: string;
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
  notes?: string;
  updated_by?: string;
}

// ============================================================================
// 3. ESTOQUE (WMS)
// ============================================================================

export interface Stock {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity_available: number;
  quantity_reserved: number;
  quantity_on_order: number;
  quantity_free: number; // Computed
  location_zone?: string;
  location_aisle?: string;
  location_rack?: string;
  location_level?: string;
  location_position?: string;
  updated_at: Date;
}

export interface StockWithDetails extends Stock {
  product?: Product;
  warehouse?: Warehouse;
}

export type MovementType = 
  | 'PURCHASE'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_IN'
  | 'SALE'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_OUT'
  | 'LOSS'
  | 'DAMAGE';

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_of_measure: string;
  from_warehouse_id?: string;
  to_warehouse_id?: string;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  batch_number?: string;
  notes?: string;
  created_at: Date;
  created_by: string;
  source_system: string;
}

export interface CreateStockMovementDto {
  product_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_of_measure: string;
  from_warehouse_id?: string;
  to_warehouse_id?: string;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  batch_number?: string;
  notes?: string;
  created_by: string;
  source_system?: string;
}

export type ReservationStatus = 
  | 'ACTIVE'
  | 'PICKED'
  | 'RELEASED'
  | 'EXPIRED';

export interface StockReservation {
  id: string;
  product_id: string;
  warehouse_id: string;
  order_id: string;
  order_line_id: string;
  quantity_reserved: number;
  quantity_picked: number;
  status: ReservationStatus;
  reserved_at: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface CreateReservationDto {
  product_id: string;
  warehouse_id: string;
  order_id: string;
  order_line_id: string;
  quantity_reserved: number;
  expires_at?: Date;
  created_by?: string;
}

// ============================================================================
// 4. SYNC/INTEGRAÇÃO
// ============================================================================

export type EntityType = 
  | 'ORDERS'
  | 'PRODUCTS'
  | 'CUSTOMERS'
  | 'STOCK'
  | 'DELIVERIES';

export type SyncStatus = 
  | 'SUCCESS'
  | 'ERROR'
  | 'RUNNING';

export interface SyncControl {
  id: string;
  entity_type: EntityType;
  last_sync_at?: Date;
  last_sync_status?: SyncStatus;
  last_sync_error?: string;
  next_sync_at?: Date;
  sync_interval_minutes: number;
  is_enabled: boolean;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  last_sap_doc_entry?: number;
  last_sap_update_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export type SyncDirection = 'IN' | 'OUT';

export interface SyncLog {
  id: string;
  entity_type: string;
  sync_direction: SyncDirection;
  entity_id?: string;
  entity_reference?: string;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  error_message?: string;
  request_data?: any;
  response_data?: any;
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
  created_by?: string;
}

export interface CreateSyncLogDto {
  entity_type: string;
  sync_direction: SyncDirection;
  entity_id?: string;
  entity_reference?: string;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  error_message?: string;
  request_data?: any;
  response_data?: any;
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
  created_by?: string;
}

// ============================================================================
// 5. AUDITORIA
// ============================================================================

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: AuditOperation;
  old_values?: any;
  new_values?: any;
  changed_fields?: string[];
  user_id?: string;
  user_name?: string;
  ip_address?: string;
  created_at: Date;
}

// ============================================================================
// 6. VIEWS
// ============================================================================

export interface StockByProduct {
  product_id: string;
  sku: string;
  description: string;
  unit_of_measure: string;
  total_available: number;
  total_reserved: number;
  total_free: number;
  total_on_order: number;
  warehouse_count: number;
}

export interface OrderDetailed {
  id: string;
  order_number: string;
  status: OrderStatus;
  order_date: Date;
  due_date?: Date;
  customer_code: string;
  customer_name: string;
  city?: string;
  state?: string;
  line_count: number;
  total_items: number;
  total_amount?: number;
  sap_doc_entry?: number;
  sap_doc_num?: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// 7. FILTROS E QUERIES
// ============================================================================

export interface ProductFilter {
  sku?: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  sap_item_code?: string;
}

export interface OrderFilter {
  order_number?: string;
  customer_id?: string;
  customer_code?: string;
  status?: OrderStatus | OrderStatus[];
  from_date?: Date;
  to_date?: Date;
  sap_doc_entry?: number;
  sync_status?: 'SYNCED' | 'PENDING' | 'ERROR';
}

export interface StockFilter {
  product_id?: string;
  warehouse_id?: string;
  min_quantity?: number;
  location_zone?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// ============================================================================
// 8. RESPONSES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}
