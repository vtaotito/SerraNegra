import { WMS_BASE_URL } from "./config";

const GATEWAY =
  typeof window !== "undefined"
    ? `${WMS_BASE_URL}/api`
    : "http://localhost:4000/api";

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${GATEWAY}${path}${qs}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method: "POST" };
  if (body !== undefined) {
    opts.headers = { "content-type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${GATEWAY}${path}`, opts);
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.detail || j.message || "";
    } catch { /* ignore */ }
    throw new Error(`POST ${path} → ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

export interface CatalogItem {
  id: number;
  sku: string;
  description: string;
  ean: string | null;
  category: string | null;
  unit_of_measure: string;
  is_active: boolean;
  is_inventory_item: boolean;
  is_sales_item: boolean;
  sap_item_code: string | null;
  sap_update_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryRow {
  id: number;
  product_id: string;
  warehouse_id: string;
  quantity_available: number;
  quantity_reserved: number;
  quantity_free: number;
  quantity_on_order: number;
  sap_update_date: string | null;
  updated_at: string;
}

export interface CustomerRow {
  id: number;
  card_code: string;
  card_name: string;
  card_type: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  sap_update_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export function fetchCatalog(opts?: {
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Paginated<CatalogItem>> {
  const p: Record<string, string> = {};
  if (opts?.search) p.search = opts.search;
  if (opts?.active !== undefined) p.active = String(opts.active);
  if (opts?.limit) p.limit = String(opts.limit);
  if (opts?.offset) p.offset = String(opts.offset);
  return get("/v1/catalog/items", p);
}

export function fetchInventory(opts?: {
  sku?: string;
  warehouseCode?: string;
  limit?: number;
  offset?: number;
}): Promise<Paginated<InventoryRow>> {
  const p: Record<string, string> = {};
  if (opts?.sku) p.sku = opts.sku;
  if (opts?.warehouseCode) p.warehouseCode = opts.warehouseCode;
  if (opts?.limit) p.limit = String(opts.limit);
  if (opts?.offset) p.offset = String(opts.offset);
  return get("/v1/inventory", p);
}

export function fetchCustomers(opts?: {
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Paginated<CustomerRow>> {
  const p: Record<string, string> = {};
  if (opts?.search) p.search = opts.search;
  if (opts?.active !== undefined) p.active = String(opts.active);
  if (opts?.limit) p.limit = String(opts.limit);
  if (opts?.offset) p.offset = String(opts.offset);
  return get("/v1/customers", p);
}

export interface SapInvoiceLine {
  ItemCode: string;
  ItemDescription: string;
  Quantity: number;
  LineTotal: number;
  DiscountPercent: number;
  UnitPrice: number;
  Price: number;
  CFOPCode: string;
  Usage: number;
}

export interface SapInvoice {
  DocEntry: number;
  DocNum: number;
  DocDate: string;
  DocDueDate: string;
  TaxDate: string;
  CardCode: string;
  CardName: string;
  DocumentStatus: string;
  Cancelled: string;
  DocTotal: number;
  PaymentMethod: string;
  PaymentGroupCode: number;
  SalesPersonCode: number;
  DocumentLines: SapInvoiceLine[];
}

export interface SapSalesPerson {
  SalesEmployeeCode: number;
  SalesEmployeeName: string;
  Active: string;
}

export interface SapBPGroup {
  Code: number;
  Name: string;
  Type: string;
}

interface SyncResult<T> {
  ok: boolean;
  message: string;
  count: number;
  items: T[];
  timestamp: string;
}

export function fetchInvoices(opts?: {
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SyncResult<SapInvoice>> {
  const qs: string[] = [];
  if (opts?.limit) qs.push(`limit=${opts.limit}`);
  if (opts?.dateFrom) qs.push(`dateFrom=${opts.dateFrom}`);
  if (opts?.dateTo) qs.push(`dateTo=${opts.dateTo}`);
  const path = `/sap/sync/invoices${qs.length ? "?" + qs.join("&") : ""}`;
  return post(path);
}

export function fetchSalesPersons(): Promise<SyncResult<SapSalesPerson>> {
  return post("/sap/sync/salespersons");
}

export function fetchBPGroups(): Promise<SyncResult<SapBPGroup>> {
  return post("/sap/sync/bp-groups");
}

export interface SalesOrderLine {
  LineNum?: number;
  ItemCode?: string;
  ItemDescription?: string;
  Quantity?: number;
  Price?: number;
  LineTotal?: number;
  WarehouseCode?: string;
  DiscountPercent?: number;
  UnitPrice?: number;
  CFOPCode?: string;
  Weight?: number;
  TaxCode?: string;
  Usage?: number;
}

export interface SalesOrderRow {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_due_date: string | null;
  card_code: string;
  card_name: string;
  doc_total: number;
  doc_currency: string;
  doc_status: string;
  document_status: string;
  sales_person_code: number | null;
  cancelled: string;
  comments: string | null;
  num_lines: number;
  total_quantity: number;
  lines: SalesOrderLine[];
  synced_at: string;
  payment_method?: string | null;
  payment_group_code?: number | null;
  ship_to_code?: string | null;
  tax_date?: string | null;
  address?: string | null;
  address2?: string | null;
}

interface SalesOrdersResult {
  ok: boolean;
  total: number;
  count: number;
  items: SalesOrderRow[];
  timestamp: string;
}

export function fetchSalesOrders(opts?: {
  dateFrom?: string;
  dateTo?: string;
  cardCode?: string;
  limit?: number;
  offset?: number;
}): Promise<SalesOrdersResult> {
  const p: Record<string, string> = {};
  if (opts?.dateFrom) p.dateFrom = opts.dateFrom;
  if (opts?.dateTo) p.dateTo = opts.dateTo;
  if (opts?.cardCode) p.cardCode = opts.cardCode;
  if (opts?.limit) p.limit = String(opts.limit);
  if (opts?.offset) p.offset = String(opts.offset);
  return get("/sap/sales-orders", p);
}

export function syncSalesOrders(): Promise<{
  ok: boolean;
  fetched: number;
  upserted: number;
  message: string;
}> {
  return post("/sap/sales-orders/sync");
}

export function fetchOrderLines(docEntry: number): Promise<{
  ok: boolean;
  lines: SalesOrderLine[];
  source: "cache" | "sap";
}> {
  return get(`/sap/sales-orders/${docEntry}/lines`);
}

type CockpitSyncResult = {
  ok: boolean;
  message: string;
  results: Record<string, { ok: boolean; count: number; message: string }>;
  timestamp: string;
};

export function syncCockpit(opts?: {
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<CockpitSyncResult> {
  const qs: string[] = [];
  if (opts?.limit) qs.push(`limit=${opts.limit}`);
  if (opts?.dateFrom) qs.push(`dateFrom=${opts.dateFrom}`);
  if (opts?.dateTo) qs.push(`dateTo=${opts.dateTo}`);
  const path = `/sap/sync/cockpit${qs.length ? "?" + qs.join("&") : ""}`;
  return post(path);
}

export function syncSAP(
  endpoint: "invoices" | "salespersons" | "inventory" | "customers" | "products" | "cockpit" | "bp-groups"
): Promise<{ ok: boolean; message: string; count?: number }> {
  return post(`/sap/sync/${endpoint}`);
}

export function sapHealth(): Promise<{
  status: string;
  sap_connected: boolean;
  response_time_ms: number;
  message: string;
}> {
  return get("/sap/health");
}

export function refreshSession(): Promise<{ success: boolean; message: string }> {
  return post("/sap/session/refresh");
}
