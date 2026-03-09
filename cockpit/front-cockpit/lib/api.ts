const GATEWAY_URL = typeof window !== "undefined"
  ? `${window.location.origin}/api`
  : "http://localhost:4000/api";

type SyncResult = {
  ok: boolean;
  message: string;
  count?: number;
  results?: Record<string, { ok: boolean; count: number; message: string }>;
  timestamp?: string;
};

export async function syncSAP(
  endpoint: "invoices" | "salespersons" | "inventory" | "customers" | "products" | "cockpit" | "bp-groups",
  params?: Record<string, string>
): Promise<SyncResult> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${GATEWAY_URL}/sap/sync/${endpoint}${qs}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Sync ${endpoint} falhou: ${res.status}`);
  }
  return res.json();
}

export async function sapHealth(): Promise<{
  status: string;
  sap_connected: boolean;
  response_time_ms: number;
  message: string;
}> {
  const res = await fetch(`${GATEWAY_URL}/sap/health`);
  return res.json();
}

export async function refreshSession(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${GATEWAY_URL}/sap/session/refresh`, { method: "POST" });
  return res.json();
}
