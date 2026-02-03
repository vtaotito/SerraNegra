export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type Logger = {
  debug?: (msg: string, meta?: Record<string, unknown>) => void;
  info?: (msg: string, meta?: Record<string, unknown>) => void;
  warn?: (msg: string, meta?: Record<string, unknown>) => void;
  error?: (msg: string, meta?: Record<string, unknown>) => void;
};

export type SapServiceLayerCredentials = {
  companyDb: string;
  username: string;
  password: string;
};

export type RetryPolicy = {
  maxAttempts: number; // inclui a tentativa inicial
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number; // 0..1
};

export type CircuitBreakerPolicy = {
  failureThreshold: number; // ex.: 5 falhas consecutivas
  successThreshold: number; // ex.: 2 sucessos para fechar
  openStateTimeoutMs: number; // ex.: 30s
};

export type RateLimitPolicy = {
  maxConcurrent: number; // limite de chamadas simultâneas
  maxRps: number; // limite de requests por segundo
};

export type SapServiceLayerClientOptions = {
  baseUrl: string; // ex.: https://sap:50000/b1s/v1
  credentials: SapServiceLayerCredentials;

  /**
   * Nome do header de correlação que será propagado.
   * O padrão do projeto (SPEC) é X-Correlation-Id.
   */
  correlationHeaderName?: string;

  /**
   * Logger opcional (padrão: silencioso).
   */
  logger?: Logger;

  /**
   * Políticas de resiliência.
   */
  retry?: Partial<RetryPolicy>;
  circuitBreaker?: Partial<CircuitBreakerPolicy>;
  rateLimit?: Partial<RateLimitPolicy>;

  /**
   * Timeout por request.
   */
  timeoutMs?: number;
};

export type SapRequestOptions = {
  correlationId?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

export type SapResponse<T> = {
  status: number;
  headers: Headers;
  data: T;
  requestId?: string;
};

