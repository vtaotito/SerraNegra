/**
 * Cliente server-side para as rotas admin B2B do gateway.
 * O login admin (B2B_ADMIN_USER/B2B_ADMIN_PASSWORD) acontece somente no
 * servidor do painel — o token nunca chega ao browser.
 */

function gatewayApiBase(): string {
  return (process.env.GATEWAY_INTERNAL_URL ?? "http://127.0.0.1:4000/api").replace(/\/$/, "");
}

const ADMIN_USER = process.env.B2B_ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.B2B_ADMIN_PASSWORD ?? "gsn@comercial2026";

// Token admin do gateway expira em 8h — cacheia por 6h
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAdminToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const res = await fetch(`${gatewayApiBase()}/b2b/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user: ADMIN_USER, password: ADMIN_PASS }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Falha no login admin B2B (${res.status})`);
  }
  const json = (await res.json()) as { token: string };
  cachedToken = { token: json.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return json.token;
}

async function b2bAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const doFetch = async (token: string) =>
    fetch(`${gatewayApiBase()}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.headers as Record<string, string>),
        ...(init?.body ? { "content-type": "application/json" } : {}),
        authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(await getAdminToken());
  if (res.status === 401) {
    // token expirado/invalidado — força novo login uma vez
    res = await doFetch(await getAdminToken(true));
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.error || j.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Erro ${res.status} no gateway B2B`);
  }
  return res.json();
}

// ─── API tipada ─────────────────────────────────────────────

export interface B2BCredentialRow {
  id: number;
  card_code: string;
  cnpj: string;
  card_name: string | null;
  email: string | null;
  has_password: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export function listB2BCredentials() {
  return b2bAdminFetch<{ items: B2BCredentialRow[]; total: number }>(
    "/b2b/admin/credentials",
  );
}

export function resetB2BCredential(cnpj: string) {
  return b2bAdminFetch<{ ok: boolean; message: string }>(
    `/b2b/admin/credentials/${encodeURIComponent(cnpj)}/reset`,
    { method: "POST" },
  );
}

export function setB2BCredentialPassword(cnpj: string, password: string) {
  return b2bAdminFetch<{ ok: boolean; message: string }>(
    `/b2b/admin/credentials/${encodeURIComponent(cnpj)}/set-password`,
    { method: "POST", body: JSON.stringify({ password }) },
  );
}

/** Atualiza o e-mail; passe `null` para remover. */
export function updateB2BCredentialEmail(cnpj: string, email: string | null) {
  return b2bAdminFetch<{ ok: boolean; message: string }>(
    `/b2b/admin/credentials/${encodeURIComponent(cnpj)}/email`,
    { method: "PATCH", body: JSON.stringify({ email }) },
  );
}

// ─── Solicitações de acesso por e-mail (cliente SAP sem e-mail) ──

export interface B2BEmailRequestRow {
  id: number;
  cnpj: string;
  card_code: string | null;
  card_name: string | null;
  requested_email: string;
  contact_name: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listB2BEmailRequests(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return b2bAdminFetch<{ items: B2BEmailRequestRow[]; total: number }>(
    `/b2b/admin/email-requests${qs}`,
  );
}

export function approveB2BEmailRequest(id: number, notes?: string) {
  return b2bAdminFetch<{ ok: boolean; request: B2BEmailRequestRow; emailSent: boolean }>(
    `/b2b/admin/email-requests/${id}/approve`,
    { method: "POST", body: JSON.stringify({ notes: notes ?? null }) },
  );
}

export function rejectB2BEmailRequest(id: number, notes?: string) {
  return b2bAdminFetch<{ ok: boolean; request: B2BEmailRequestRow; emailSent: boolean }>(
    `/b2b/admin/email-requests/${id}/reject`,
    { method: "POST", body: JSON.stringify({ notes: notes ?? null }) },
  );
}

// ─── Follow-ups de pedidos (acompanhamento dos vendedores) ──

export interface B2BOrderFollowup {
  id: number;
  doc_entry: number;
  card_code: string | null;
  status_tag: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
}

export function listB2BOrderFollowups(docEntry: number) {
  return b2bAdminFetch<{ items: B2BOrderFollowup[]; total: number }>(
    `/b2b/admin/orders/${docEntry}/followups`,
  );
}

export function createB2BOrderFollowup(
  docEntry: number,
  data: { note: string; statusTag?: string | null; cardCode?: string | null; createdBy?: string | null },
) {
  return b2bAdminFetch<{ ok: boolean; followup: B2BOrderFollowup }>(
    `/b2b/admin/orders/${docEntry}/followups`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function fetchB2BOrderFollowupCounts(docEntries: number[]) {
  const qs = docEntries.length ? `?docEntries=${docEntries.join(",")}` : "";
  return b2bAdminFetch<{ counts: Record<string, number> }>(
    `/b2b/admin/orders/followups/counts${qs}`,
  );
}

// ─── Conversa do pedido + sinalizações por item ──

export type B2BMessageKind = "message" | "change_request" | "cancel_request";
export type B2BRequestStatus = "aberto" | "resolvido" | "recusado";

export interface B2BOrderMessage {
  id: number;
  docEntry: number;
  authorType: "customer" | "seller";
  authorName: string | null;
  kind: B2BMessageKind;
  body: string;
  status: B2BRequestStatus | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface B2BOrderMessageSummary {
  messages: number;
  openRequests: number;
  lastAuthor: "customer" | "seller" | null;
}

export function listB2BOrderMessages(docEntry: number) {
  return b2bAdminFetch<{ messages: B2BOrderMessage[] }>(
    `/b2b/admin/orders/${docEntry}/messages`,
  );
}

export function replyB2BOrderMessage(
  docEntry: number,
  data: { body: string; authorName?: string | null },
) {
  return b2bAdminFetch<{ ok: boolean; message: B2BOrderMessage }>(
    `/b2b/admin/orders/${docEntry}/messages`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function resolveB2BOrderRequest(
  docEntry: number,
  id: number,
  data: { status: "resolvido" | "recusado"; note?: string | null },
) {
  return b2bAdminFetch<{ ok: boolean; message: B2BOrderMessage }>(
    `/b2b/admin/orders/${docEntry}/requests/${id}/resolve`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function fetchB2BOrderMessageSummary(docEntries: number[]) {
  const qs = docEntries.length ? `?docEntries=${docEntries.join(",")}` : "";
  return b2bAdminFetch<{ map: Record<string, B2BOrderMessageSummary> }>(
    `/b2b/admin/orders/messages/summary${qs}`,
  );
}

export type B2BItemFlag = "falta" | "substituicao" | "observacao";

export interface B2BOrderItemNote {
  id: number;
  doc_entry: number;
  sku: string;
  flag: B2BItemFlag;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export function listB2BOrderItemNotes(docEntry: number) {
  return b2bAdminFetch<{ items: B2BOrderItemNote[] }>(
    `/b2b/admin/orders/${docEntry}/item-notes`,
  );
}

export function createB2BOrderItemNote(
  docEntry: number,
  data: { sku: string; flag: B2BItemFlag; note?: string | null },
) {
  return b2bAdminFetch<{ ok: boolean; item: B2BOrderItemNote }>(
    `/b2b/admin/orders/${docEntry}/item-notes`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function deleteB2BOrderItemNote(docEntry: number, id: number) {
  return b2bAdminFetch<{ ok: boolean }>(
    `/b2b/admin/orders/${docEntry}/item-notes/${id}`,
    { method: "DELETE" },
  );
}

// ─── Status do funil e-commerce (Portal B2B) ──

export const B2B_ORDER_STATUSES = [
  "novo",
  "em_analise",
  "separacao",
  "faturado",
  "enviado",
  "entregue",
  "cancelado",
] as const;

export type B2BOrderStatus = (typeof B2B_ORDER_STATUSES)[number];

export interface B2BOrderStatusRow {
  doc_entry: number;
  card_code: string | null;
  status: B2BOrderStatus;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface B2BOrderStatusDetail {
  status: B2BOrderStatus;
  confirmed: boolean;
}

export function fetchB2BOrderStatusMap(docEntries: number[]) {
  const qs = docEntries.length ? `?docEntries=${docEntries.join(",")}` : "";
  return b2bAdminFetch<{
    map: Record<string, B2BOrderStatus>;
    detail: Record<string, B2BOrderStatusDetail>;
  }>(`/b2b/admin/orders/status${qs}`);
}

/** Confirma um pedido (estado operacional local — não altera o SAP). */
export function confirmB2BOrder(
  docEntry: number,
  data?: { cardCode?: string | null; confirmedBy?: string | null },
) {
  return b2bAdminFetch<{ ok: boolean; status: B2BOrderStatusRow }>(
    `/b2b/admin/orders/${docEntry}/confirm`,
    { method: "POST", body: JSON.stringify(data ?? {}) },
  );
}

export function setB2BOrderStatus(
  docEntry: number,
  data: { status: B2BOrderStatus; cardCode?: string | null; updatedBy?: string | null },
) {
  return b2bAdminFetch<{ ok: boolean; status: B2BOrderStatusRow }>(
    `/b2b/admin/orders/${docEntry}/status`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

// ─── Pedidos pendentes (confirmação manual do vendedor) ──

export type B2BPendingOrderStatus = "pendente" | "confirmado" | "rejeitado";

export interface B2BPendingOrderItem {
  sku: string;
  name: string | null;
  quantity: number;
  warehouse?: string | null;
}

export interface B2BPendingOrderRow {
  id: number;
  card_code: string;
  card_name: string | null;
  items: B2BPendingOrderItem[];
  notes: string | null;
  due_date: string | null;
  status: B2BPendingOrderStatus;
  origin: string;
  created_by: string | null;
  total_quantity: number;
  sap_doc_entry: number | null;
  sap_doc_num: number | null;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function listB2BPendingOrders(status?: B2BPendingOrderStatus) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return b2bAdminFetch<{
    items: B2BPendingOrderRow[];
    total: number;
    pendingCount: number;
  }>(`/b2b/admin/pending-orders${qs}`);
}

export function confirmB2BPendingOrder(id: number) {
  return b2bAdminFetch<{
    ok: boolean;
    docEntry: number;
    docNum: number;
    pending: B2BPendingOrderRow;
  }>(`/b2b/admin/pending-orders/${id}/confirm`, { method: "POST" });
}

export function rejectB2BPendingOrder(id: number, reason?: string) {
  return b2bAdminFetch<{ ok: boolean; pending: B2BPendingOrderRow }>(
    `/b2b/admin/pending-orders/${id}/reject`,
    { method: "POST", body: JSON.stringify({ reason: reason ?? null }) },
  );
}

// ─── Venda assistida (catálogo + criação de pedido pelo vendedor) ──

export interface B2BAdminCatalogItem {
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

export function fetchB2BAdminCatalog(params: {
  search?: string;
  category?: string;
  inStock?: boolean;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.category) qs.set("category", params.category);
  if (typeof params.inStock === "boolean") qs.set("inStock", String(params.inStock));
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return b2bAdminFetch<{
    items: B2BAdminCatalogItem[];
    total: number;
    page: number;
    pages: number;
  }>(`/b2b/admin/catalog${suffix}`);
}

export function createB2BAdminOrder(data: {
  cardCode: string;
  cardName?: string;
  items: { sku: string; quantity: number; warehouse?: string }[];
  notes?: string;
  dueDate?: string;
  createdBy?: string;
}) {
  return b2bAdminFetch<{ ok: boolean; docEntry: number; docNum: number }>(
    `/b2b/admin/orders`,
    { method: "POST", body: JSON.stringify(data) },
  );
}
