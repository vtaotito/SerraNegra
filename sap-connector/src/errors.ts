export class SapConnectorError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "SapConnectorError";
    this.code = code;
    this.cause = cause;
  }
}

export class SapAuthError extends SapConnectorError {
  constructor(message: string, cause?: unknown) {
    super("SAP-AUTH", message, cause);
    this.name = "SapAuthError";
  }
}

export class SapHttpError extends SapConnectorError {
  readonly status: number;
  readonly responseBodyText?: string;
  readonly requestId?: string;

  constructor(args: {
    status: number;
    message: string;
    responseBodyText?: string;
    requestId?: string;
    cause?: unknown;
  }) {
    super("SAP-HTTP", args.message, args.cause);
    this.name = "SapHttpError";
    this.status = args.status;
    this.responseBodyText = args.responseBodyText;
    this.requestId = args.requestId;
  }
}

export class SapCircuitOpenError extends SapConnectorError {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("SAP-CIRCUIT-OPEN", "Circuit breaker aberto; tentativa bloqueada.", undefined);
    this.name = "SapCircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

