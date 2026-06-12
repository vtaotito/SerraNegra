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
