/* ──────────────────────────────────────────────────────────
 *  B2B Portal – API Client
 *  Todas as chamadas passam por /api/b2b/* (Next rewrite → gateway)
 * ────────────────────────────────────────────────────────── */

const BASE = "/api/b2b";

// ─── Tipos ──────────────────────────────────────────────

export interface B2BCustomer {
  cardCode: string;
  cardName: string;
  cnpj: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  customer: B2BCustomer;
}

export interface LookupResponse {
  cardCode: string;
  cardName: string;
  cnpj: string;
  email: string;
  hasPassword: boolean;
}

export interface VerifyEmailResponse {
  ok: boolean;
  message: string;
}

export interface VerifyOTPResponse {
  tempToken: string;
}

export interface SetPasswordResponse {
  token: string;
  customer: B2BCustomer;
}

export interface DashboardData {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  recentOrders: B2BOrder[];
}

export interface B2BOrder {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_due_date: string | null;
  card_code: string;
  card_name: string;
  doc_total: number;
  doc_currency: string;
  doc_status: string;
  cancelled: string;
  comments: string | null;
  num_lines: number;
  total_quantity: number;
  lines: B2BOrderLine[];
  payment_method?: string | null;
  ship_to_code?: string | null;
  address?: string | null;
  address2?: string | null;
}

export interface B2BOrderLine {
  LineNum: number;
  ItemCode: string;
  ItemDescription: string;
  Quantity: number;
  Price: number;
  LineTotal: number;
  WarehouseCode: string;
  DiscountPercent: number;
  UnitPrice: number;
}

export interface B2BOrdersResponse {
  items: B2BOrder[];
  total: number;
}

export interface B2BCatalogItem {
  sku: string;
  name: string;
  description: string;
  category: string | null;
  ean: string | null;
  imageUrl: string | null;
  price: number;
  inStock: boolean;
  stockQuantity: number;
  unitOfMeasure: string;
  packagingType: string | null;
  unitsPerPack: number | null;
}

export interface B2BCatalogResponse {
  items: B2BCatalogItem[];
  total: number;
  page: number;
  pages: number;
}

export interface B2BCategoriesResponse {
  categories: string[];
}

export interface B2BProductDetail extends B2BCatalogItem {
  fullDescription: string | null;
}

export interface B2BStockResponse {
  sku: string;
  totalOnHand: number;
  totalCommitted: number;
  available: number;
  warehouses: { code: string; name: string; available: number }[];
}

export interface CreateOrderPayload {
  items: { sku: string; quantity: number }[];
  dueDate?: string;
  notes?: string;
}

export interface CreateOrderResponse {
  ok: boolean;
  docEntry: number;
  docNum: number;
  message: string;
}

// ─── Token management ───────────────────────────────────

const TOKEN_KEY = "b2b_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Fetch helpers ──────────────────────────────────────

class AuthRedirectError extends Error {
  constructor() {
    super("Sessão expirada");
    this.name = "AuthRedirectError";
  }
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/portal/login";
    }
    throw new AuthRedirectError();
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.detail || j.message || j.error || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Erro ${res.status}`);
  }

  return res.json();
}

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.detail || j.message || j.error || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Erro ${res.status}`);
  }

  return res.json();
}

// ─── Auth (públicos) ────────────────────────────────────

export function authLookup(cnpj: string) {
  return publicPost<LookupResponse>("/auth/lookup", { cnpj });
}

export function authLogin(cnpj: string, password: string) {
  return publicPost<LoginResponse>("/auth/login", { cnpj, password });
}

export function authVerifyEmail(cnpj: string, email: string) {
  return publicPost<VerifyEmailResponse>("/auth/verify-email", { cnpj, email });
}

export function authVerifyOTP(cnpj: string, otp: string) {
  return publicPost<VerifyOTPResponse>("/auth/verify-otp", { cnpj, otp });
}

export function authSetPassword(cnpj: string, tempToken: string, password: string) {
  return publicPost<SetPasswordResponse>("/auth/set-password", {
    cnpj,
    tempToken,
    password,
  });
}

export function authForgotPassword(cnpj: string) {
  return publicPost<{ ok: boolean; message: string }>("/auth/forgot-password", { cnpj });
}

export function authRegister(data: {
  cnpj: string;
  razaoSocial: string;
  email: string;
}) {
  return publicPost<{ ok: boolean; message: string }>("/auth/register", data);
}

// ─── Auth (autenticados) ────────────────────────────────

export function fetchMe() {
  return authFetch<B2BCustomer>("/auth/me");
}

// ─── Dashboard ──────────────────────────────────────────

export function fetchDashboard() {
  return authFetch<DashboardData>("/dashboard");
}

// ─── Pedidos ────────────────────────────────────────────

export function fetchOrders(opts?: { docStatus?: "O" | "C" }) {
  const qs = opts?.docStatus ? `?docStatus=${opts.docStatus}` : "";
  return authFetch<B2BOrdersResponse>(`/orders${qs}`);
}

export function fetchOrderDetail(docEntry: number) {
  return authFetch<B2BOrder>(`/orders/${docEntry}`);
}

export function createOrder(payload: CreateOrderPayload) {
  return authFetch<CreateOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Catálogo ───────────────────────────────────────────

export function fetchCatalogB2B(opts?: {
  search?: string;
  category?: string;
  inStock?: boolean;
  page?: number;
  limit?: number;
}) {
  const p = new URLSearchParams();
  if (opts?.search) p.set("search", opts.search);
  if (opts?.category) p.set("category", opts.category);
  if (opts?.inStock !== undefined) p.set("inStock", String(opts.inStock));
  if (opts?.page) p.set("page", String(opts.page));
  if (opts?.limit) p.set("limit", String(opts.limit));
  const qs = p.toString();
  return authFetch<B2BCatalogResponse>(`/catalog${qs ? `?${qs}` : ""}`);
}

export function fetchCatalogCategories() {
  return authFetch<B2BCategoriesResponse>("/catalog/categories");
}

export function fetchProductDetail(sku: string) {
  return authFetch<B2BProductDetail>(`/catalog/${encodeURIComponent(sku)}`);
}

export function notifyWhenAvailable(sku: string, email?: string) {
  return authFetch<{ ok: boolean; message: string }>(
    `/catalog/${encodeURIComponent(sku)}/notify`,
    {
      method: "POST",
      body: JSON.stringify(email ? { email } : {}),
    },
  );
}

// ─── Produtos / Estoque ─────────────────────────────────

export function fetchProductStock(sku: string) {
  return authFetch<B2BStockResponse>(`/products/${encodeURIComponent(sku)}/stock`);
}

// ─── Helpers de formatação ──────────────────────────────

export function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export function fmtCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function cleanCNPJ(formatted: string): string {
  return formatted.replace(/\D/g, "");
}
