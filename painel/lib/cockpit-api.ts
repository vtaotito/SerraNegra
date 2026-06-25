const GATEWAY =
  typeof window !== "undefined"
    ? "/api"
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

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, { method: "DELETE" });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.detail || j.message || "";
    } catch { /* ignore */ }
    throw new Error(`DELETE ${path} → ${res.status}${detail ? `: ${detail}` : ""}`);
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
  item_name: string | null;
  quantity_available: number;
  quantity_reserved: number;
  quantity_free: number;
  quantity_on_order: number;
  min_stock: number;
  max_stock: number;
  uom: string | null;
  avg_price: number;
  last_purchase_price: number;
  last_purchase_date: string | null;
  last_sale_date: string | null;
  gross_weight: number;
  lead_time: number;
  item_group_code: number | null;
  item_group_name: string | null;
  last_count_date: string | null;
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
  /** DocEntry do documento base (geralmente o pedido de venda) */
  BaseEntry?: number | null;
  /** 17 = Sales Order, 15 = Delivery, etc. */
  BaseType?: number | null;
  /** Número da linha no documento base */
  BaseLine?: number | null;
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
  /** Número da NF-e (U_TX_NDfe) */
  NfeNumber?: string | null;
  /** Número do folio impresso na NF (FolioNumber) */
  FolioNumber?: string | null;
  /** Chave de acesso de 44 dígitos da NF-e */
  NfeKey?: string | null;
  /** Série da nota */
  SeriesNumber?: number | null;
  /** DocEntry do pedido base no SAP */
  BaseDocEntry?: number | null;
  /** Número visível do pedido base (DocNum em sap_sales_orders) */
  BaseDocNum?: number | null;
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

/**
 * @deprecated Use fetchInvoicesLocal() que lê do PostgreSQL local (muito mais rápido).
 */
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

interface InvoicesLocalResult {
  ok: boolean;
  total: number;
  count: number;
  items: SapInvoice[];
  timestamp: string;
}

export function fetchInvoicesLocal(opts?: {
  dateFrom?: string;
  dateTo?: string;
  cardCode?: string;
  salesPerson?: number;
  cancelled?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<InvoicesLocalResult> {
  const p: Record<string, string> = {};
  if (opts?.dateFrom) p.dateFrom = opts.dateFrom;
  if (opts?.dateTo) p.dateTo = opts.dateTo;
  if (opts?.cardCode) p.cardCode = opts.cardCode;
  if (opts?.salesPerson != null) p.salesPerson = String(opts.salesPerson);
  if (opts?.cancelled) p.cancelled = opts.cancelled;
  if (opts?.search) p.search = opts.search;
  if (opts?.limit) p.limit = String(opts.limit);
  if (opts?.offset) p.offset = String(opts.offset);
  return get("/sap/invoices", p);
}

export function syncInvoices(): Promise<{
  ok: boolean;
  fetched: number;
  upserted: number;
  linesWritten: number;
  message: string;
}> {
  return post("/sap/invoices/sync");
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
  salesPerson?: number;
  limit?: number;
  offset?: number;
}): Promise<SalesOrdersResult> {
  const p: Record<string, string> = {};
  if (opts?.dateFrom) p.dateFrom = opts.dateFrom;
  if (opts?.dateTo) p.dateTo = opts.dateTo;
  if (opts?.cardCode) p.cardCode = opts.cardCode;
  if (opts?.salesPerson != null) p.salesPerson = String(opts.salesPerson);
  if (opts?.limit) p.limit = String(opts.limit);
  if (opts?.offset) p.offset = String(opts.offset);
  return get("/sap/sales-orders", p);
}

// ─── Product Analytics (server-side aggregation) ──────────────

export interface ProductAnalyticsSummary {
  /** Total de pedidos no período (sem JOIN com linhas — todos contam) */
  totalOrders: number;
  /** Pedidos que têm linhas detalhadas sincronizadas (subset) */
  ordersWithLines: number;
  /** Faturamento via cabeçalho (doc_total) — sempre cobre 12m completos */
  totalRevenueHeader: number;
  /** Faturamento via cabeçalho nos últimos 3 meses */
  totalRevenueHeader3m: number;
  /** Clientes distintos no período (header) */
  totalClients: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

export interface ProductAnalyticsRow {
  item_code: string;
  item_description: string;
  total_qty: number;
  total_revenue: number;
  max_sale: number | null;
  min_sale: number | null;
  sale_count: number;
  unique_clients: number;
  qty_3m: number;
  /** Faturamento dos últimos 3 meses (subset) */
  revenue_3m?: number;
  first_sale_date?: string | null;
  last_sale_date?: string | null;
  /**
   * Unidades por embalagem autoritativas do cadastro B2B (b2b_catalog_products),
   * mesma fonte do portalb2b. Quando > 1, prevalece sobre o parsing da descrição.
   */
  units_per_package?: number | null;
  /** Tipo de embalagem autoritativo do cadastro B2B (ex.: "Caixa", "Fardo"). */
  packaging_type?: string | null;
}

export interface ProductAnalyticsResult {
  ok: boolean;
  products: ProductAnalyticsRow[];
  estados: string[];
  vendedorCodes: number[];
  /** Totais globais via cabeçalho (cobrem 12m completos) */
  summary?: ProductAnalyticsSummary;
  timestamp: string;
}

export function fetchProductAnalytics(opts: {
  dateFrom: string;
  dateTo: string;
  date3mCutoff: string;
  estado?: string;
  salesPerson?: number;
}): Promise<ProductAnalyticsResult> {
  const p: Record<string, string> = {
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    date3mCutoff: opts.date3mCutoff,
  };
  if (opts.estado) p.estado = opts.estado;
  if (opts.salesPerson != null) p.salesPerson = String(opts.salesPerson);
  return get("/sap/products/analytics", p);
}

export interface ProductOrderLine {
  doc_num: number;
  doc_date: string;
  card_code: string;
  card_name: string;
  item_code: string;
  item_description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  discount_percent: number;
}

export function fetchProductOrders(opts: {
  itemCodes: string[];
  dateFrom: string;
  dateTo: string;
}): Promise<{ ok: boolean; count: number; orders: ProductOrderLine[] }> {
  const p: Record<string, string> = {
    itemCodes: opts.itemCodes.join(","),
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
  };
  return get("/sap/products/orders", p);
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

// ─── Tabelas de Preço (ITM1 + OPLN) ──────────────

export interface ItemPriceRow {
  ItemCode: string;
  Price: number;
  PriceList: number;
  ListName: string;
}

export interface ItemPricesResult {
  ok: boolean;
  count: number;
  items: ItemPriceRow[];
  priceLists: string[];
  timestamp: string;
}

export function fetchItemPrices(): Promise<ItemPricesResult> {
  return get("/sap/prices");
}

// ─── Preços Praticados (transacionais) ──────────────

export interface PracticedPriceRow {
  item_code: string;
  item_description: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  median_price: number;
  total_qty_sold: number;
  total_revenue: number;
  sale_count: number;
  unique_clients: number;
  last_sale_date: string | null;
  last_price: number;
  avg_discount: number;
}

export interface PracticedPricesResult {
  ok: boolean;
  count: number;
  items: PracticedPriceRow[];
  totals: {
    totalRevenue: number;
    totalQty: number;
    totalSales: number;
  };
  timestamp: string;
}

export function fetchPracticedPrices(): Promise<PracticedPricesResult> {
  return get("/sap/prices/practiced");
}

// ─── MarkUp (Precificação) ──────────────────────────────────

export interface MarkupItem {
  itemCode: string;
  itemName: string;
  itemGroup: number | null;
  manufacturer: string;

  /** Valor sem impostos (milheiro) */
  v: number;
  /** Frete (milheiro) */
  fr: number;
  /** Embalagem / fardo / caixa (milheiro) */
  sc: number;
  /** Comissão (milheiro) */
  co: number;
  /** PIS/COFINS (%) */
  pc: number;
  /** ICMS compra (%) */
  ic: number;
  /** IPI (%) */
  ip: number;

  qtdPallet: number;
  qtdSaco: number;
  custoFixoSaco: number;
  custoFixoPallet: number;

  prices: Record<string, number>;
  hasOverride: boolean;
  /** Valor s/ impostos vindo do SAP — base para "reverter para SAP" */
  sapV: number;
  /** Campos com override manual (v, fr, sc, co, pc, ic, ip, cfSaco, cfPallet, ...) */
  overriddenKeys: string[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface MarkupItemsResult {
  ok: boolean;
  count: number;
  items: MarkupItem[];
  timestamp: string;
}

export function fetchMarkupItems(): Promise<MarkupItemsResult> {
  return get<MarkupItemsResult>("/sap/markup/items").then((data) => ({
    ...data,
    items: data.items.map(normalizeMarkupItem),
  }));
}

export function fetchMarkupItem(itemCode: string): Promise<MarkupItem> {
  return get<{ ok: boolean; item: MarkupItem }>(
    `/sap/markup/items/${encodeURIComponent(itemCode)}`,
  ).then((data) => normalizeMarkupItem(data.item));
}

export function deleteMarkupOverride(itemCode: string): Promise<{ ok: boolean; deleted: boolean }> {
  return del(`/sap/markup/overrides/${encodeURIComponent(itemCode)}`);
}

function toNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMarkupItem(item: MarkupItem): MarkupItem {
  return {
    ...item,
    v: toNum(item.v),
    fr: toNum(item.fr),
    sc: toNum(item.sc),
    co: toNum(item.co),
    pc: toNum(item.pc, 0.09),
    ic: toNum(item.ic, 0.12),
    ip: toNum(item.ip, 0.10),
    qtdPallet: toNum(item.qtdPallet),
    qtdSaco: toNum(item.qtdSaco),
    custoFixoSaco: toNum(item.custoFixoSaco, 0.06),
    custoFixoPallet: toNum(item.custoFixoPallet, 0.03),
    sapV: toNum(item.sapV),
    overriddenKeys: Array.isArray(item.overriddenKeys) ? item.overriddenKeys : [],
    updatedAt: item.updatedAt ?? null,
    updatedBy: item.updatedBy ?? null,
  };
}

export interface SaveMarkupOverrideInput {
  itemCode: string;
  frete?: number | null;
  embalagem?: number | null;
  comissao?: number | null;
  pisCofins?: number | null;
  icmsCompra?: number | null;
  ipi?: number | null;
  custoFixoSaco?: number | null;
  custoFixoPallet?: number | null;
  qtdPallet?: number | null;
  qtdSaco?: number | null;
  precoSemImp?: number | null;
  updatedBy?: string | null;
}

export function saveMarkupOverride(data: SaveMarkupOverrideInput): Promise<{ ok: boolean }> {
  return post("/sap/markup/overrides", data);
}
