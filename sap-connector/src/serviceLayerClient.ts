import { SapAuthError, SapHttpError } from "./errors.js";
import { computeBackoffMs, sleep } from "./utils/backoff.js";
import { CircuitBreaker } from "./utils/circuitBreaker.js";
import { RateLimiter } from "./utils/rateLimiter.js";
import type {
  CircuitBreakerPolicy,
  HttpMethod,
  RateLimitPolicy,
  RetryPolicy,
  SapRequestOptions,
  SapResponse,
  SapServiceLayerClientOptions
} from "./types.js";

type LoginResponse = {
  SessionId?: string;
  Version?: string;
  SessionTimeout?: number;
};

const defaultRetry: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 250,
  maxDelayMs: 10_000,
  jitterRatio: 0.2
};

const defaultCircuit: CircuitBreakerPolicy = {
  failureThreshold: 5,
  successThreshold: 2,
  openStateTimeoutMs: 30_000
};

const defaultRateLimit: RateLimitPolicy = {
  maxConcurrent: 8,
  maxRps: 10
};

function joinUrl(baseUrl: string, path: string): string {
  const b = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function extractSetCookie(headers: Headers): string[] {
  // Node fetch expõe "set-cookie" como header agregado; em alguns runtimes, pode ser diferente.
  // Vamos tratar as duas possibilidades: getSetCookie() (undici) ou get("set-cookie").
  const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

function cookieHeaderFromSetCookies(setCookies: string[]): string | null {
  // Mantém apenas o par chave=valor (ignora Path/HttpOnly/etc.)
  const pairs = setCookies
    .map((c) => c.split(";")[0]?.trim())
    .filter((p): p is string => Boolean(p));
  if (pairs.length === 0) return null;
  return pairs.join("; ");
}

function isJsonContentType(headers: Headers): boolean {
  const ct = headers.get("content-type") ?? "";
  return ct.toLowerCase().includes("application/json");
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export class SapServiceLayerClient {
  private readonly baseUrl: string;
  private readonly correlationHeaderName: string;
  private readonly timeoutMs: number;
  private readonly logger: NonNullable<SapServiceLayerClientOptions["logger"]>;

  private readonly retry: RetryPolicy;
  private readonly circuit: CircuitBreaker;
  private readonly limiter: RateLimiter;

  private readonly credentials: SapServiceLayerClientOptions["credentials"];

  private cookieHeader: string | null = null;
  private loginInFlight: Promise<void> | null = null;

  constructor(options: SapServiceLayerClientOptions) {
    this.baseUrl = options.baseUrl;
    this.credentials = options.credentials;
    this.correlationHeaderName = options.correlationHeaderName ?? "X-Correlation-Id";
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.logger = options.logger ?? {};

    this.retry = { ...defaultRetry, ...(options.retry ?? {}) };
    const circuitPolicy = { ...defaultCircuit, ...(options.circuitBreaker ?? {}) };
    const ratePolicy = { ...defaultRateLimit, ...(options.rateLimit ?? {}) };

    this.circuit = new CircuitBreaker(circuitPolicy);
    this.limiter = new RateLimiter(ratePolicy);
  }

  /**
   * Login no Service Layer.
   * Referência típica: POST /Login { CompanyDB, UserName, Password }.
   * A sessão é propagada via cookies (ex.: B1SESSION / ROUTEID).
   */
  async login(correlationId?: string): Promise<void> {
    if (this.loginInFlight) return this.loginInFlight;
    this.loginInFlight = this._login(correlationId).finally(() => {
      this.loginInFlight = null;
    });
    return this.loginInFlight;
  }

  private async _login(correlationId?: string): Promise<void> {
    const url = joinUrl(this.baseUrl, "/Login");
    const body = {
      CompanyDB: this.credentials.companyDb,
      UserName: this.credentials.username,
      Password: this.credentials.password
    };

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (correlationId) headers[this.correlationHeaderName] = correlationId;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal
      });

      const setCookies = extractSetCookie(res.headers);
      const cookie = cookieHeaderFromSetCookies(setCookies);
      if (!res.ok || !cookie) {
        const text = await safeReadText(res);
        throw new SapAuthError(`Falha no login do Service Layer (status ${res.status}).`, text);
      }

      // tentativa de parse só para fins diagnósticos (não é estritamente necessário)
      if (isJsonContentType(res.headers)) {
        try {
          const parsed = (await res.json()) as LoginResponse;
          this.logger.debug?.("SAP Service Layer login OK.", {
            version: parsed.Version,
            sessionTimeout: parsed.SessionTimeout
          });
        } catch {
          // ignore
        }
      }

      this.cookieHeader = cookie;
    } finally {
      clearTimeout(timer);
    }
  }

  async logout(correlationId?: string): Promise<void> {
    if (!this.cookieHeader) return;
    try {
      await this.requestRaw("POST", "/Logout", undefined, { correlationId });
    } catch {
      // logout é best-effort
    } finally {
      this.cookieHeader = null;
    }
  }

  /**
   * GET genérico.
   */
  async get<T>(path: string, opts?: SapRequestOptions): Promise<SapResponse<T>> {
    return this.requestJson<T>("GET", path, undefined, opts);
  }

  /**
   * PATCH genérico (útil para escrever UDFs em documentos).
   */
  async patch<T>(path: string, body: unknown, opts?: SapRequestOptions): Promise<SapResponse<T>> {
    return this.requestJson<T>("PATCH", path, body, opts);
  }

  async post<T>(path: string, body: unknown, opts?: SapRequestOptions): Promise<SapResponse<T>> {
    return this.requestJson<T>("POST", path, body, opts);
  }

  private async requestJson<T>(
    method: HttpMethod,
    path: string,
    body: unknown | undefined,
    opts?: SapRequestOptions
  ): Promise<SapResponse<T>> {
    const res = await this.requestRaw(method, path, body, opts);
    if (!isJsonContentType(res.headers)) {
      const text = await safeReadText(res);
      throw new SapHttpError({
        status: res.status,
        message: `Resposta não-JSON do SAP (status ${res.status}).`,
        responseBodyText: text,
        requestId: res.headers.get("x-request-id") ?? undefined
      });
    }
    const data = (await res.json()) as T;
    return { status: res.status, headers: res.headers, data, requestId: res.headers.get("x-request-id") ?? undefined };
  }

  private async requestRaw(
    method: HttpMethod,
    path: string,
    body: unknown | undefined,
    opts?: SapRequestOptions
  ): Promise<Response> {
    const canPass = this.circuit.canPass();
    if (canPass !== true) throw canPass;

    const release = await this.limiter.acquire();
    try {
      await this.ensureLoggedIn(opts?.correlationId);
      return await this.requestWithRetry(method, path, body, opts);
    } finally {
      release();
    }
  }

  private async ensureLoggedIn(correlationId?: string): Promise<void> {
    if (this.cookieHeader) return;
    await this.login(correlationId);
  }

  private async requestWithRetry(
    method: HttpMethod,
    path: string,
    body: unknown | undefined,
    opts?: SapRequestOptions
  ): Promise<Response> {
    const url = joinUrl(this.baseUrl, path);

    const headers: Record<string, string> = {
      accept: "application/json"
    };
    if (this.cookieHeader) headers.cookie = this.cookieHeader;
    if (opts?.correlationId) headers[this.correlationHeaderName] = opts.correlationId;
    if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    if (opts?.headers) Object.assign(headers, opts.headers);

    const bodyText = body === undefined ? undefined : JSON.stringify(body);
    if (bodyText) headers["content-type"] = "application/json";

    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt += 1) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: bodyText,
          signal: ctrl.signal
        });

        // sessão expirada → tenta relogar 1x e reexecutar
        if ((res.status === 401 || res.status === 403) && attempt === 1) {
          this.logger.warn?.("Sessão do SAP expirada; relogando.", { status: res.status, path });
          this.cookieHeader = null;
          await this.login(opts?.correlationId);
          if (this.cookieHeader) headers.cookie = this.cookieHeader;
          continue;
        }

        if (res.ok) {
          this.circuit.onSuccess();
          return res;
        }

        const text = await safeReadText(res);
        const httpErr = new SapHttpError({
          status: res.status,
          message: `Erro HTTP do SAP (status ${res.status}) em ${method} ${path}.`,
          responseBodyText: text,
          requestId: res.headers.get("x-request-id") ?? undefined
        });

        if (!shouldRetry(res.status) || attempt === this.retry.maxAttempts) {
          this.circuit.onFailure();
          throw httpErr;
        }

        lastErr = httpErr;
        const delay = computeBackoffMs({
          attempt,
          baseDelayMs: this.retry.baseDelayMs,
          maxDelayMs: this.retry.maxDelayMs,
          jitterRatio: this.retry.jitterRatio
        });
        this.logger.warn?.("Retry SAP (HTTP).", { attempt, delayMs: delay, status: res.status, path });
        await sleep(delay);
        continue;
      } catch (err) {
        clearTimeout(timer);

        // abort/timeouts e erros de rede: retry
        lastErr = err;
        const isLast = attempt === this.retry.maxAttempts;
        if (isLast) {
          this.circuit.onFailure();
          throw err;
        }
        const delay = computeBackoffMs({
          attempt,
          baseDelayMs: this.retry.baseDelayMs,
          maxDelayMs: this.retry.maxDelayMs,
          jitterRatio: this.retry.jitterRatio
        });
        this.logger.warn?.("Retry SAP (network/timeout).", { attempt, delayMs: delay, path });
        await sleep(delay);
        continue;
      } finally {
        clearTimeout(timer);
      }
    }

    this.circuit.onFailure();
    throw lastErr;
  }
}

async function safeReadText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}

