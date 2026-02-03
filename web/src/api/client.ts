type QueryValue = string | number | boolean | null | undefined;

export type ApiClientOptions = {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toQueryString(query?: Record<string, QueryValue>) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function createApiClient(opts: ApiClientOptions) {
  async function request<T>(
    path: string,
    init?: {
      method?: string;
      query?: Record<string, QueryValue>;
      headers?: Record<string, string>;
      body?: unknown;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    const url = `${opts.baseUrl.replace(/\/$/, "")}${path}${toQueryString(
      init?.query
    )}`;

    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.defaultHeaders ?? {}),
        ...(init?.headers ?? {})
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: init?.signal
    });

    const text = await res.text();
    const data = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && "message" in data
          ? String((data as any).message)
          : res.statusText) || "Erro na API";
      throw new ApiError(msg, res.status, data);
    }

    return data as T;
  }

  return { request };
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function randomId(prefix = "") {
  const s = Math.random().toString(16).slice(2);
  const t = Date.now().toString(16);
  return `${prefix}${t}-${s}`;
}

