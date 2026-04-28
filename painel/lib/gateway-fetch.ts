/**
 * Chamadas diretas ao gateway a partir de Route Handlers / SSR.
 * Alinha-se ao prefixo usado em `cockpit-api.ts` no servidor (`.../api` + path).
 */
function gatewayApiBase(): string {
  return (process.env.GATEWAY_INTERNAL_URL ?? "http://127.0.0.1:4000/api").replace(/\/$/, "");
}

export async function gatewayGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const url = `${gatewayApiBase()}${path.startsWith("/") ? path : `/${path}`}${qs}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

export async function gatewayPost<T>(path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method: "POST", cache: "no-store" };
  if (body !== undefined) {
    opts.headers = { "content-type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const url = `${gatewayApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, opts);
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.detail || j.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(`POST ${path} → ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}
