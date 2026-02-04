import pino, { type Logger as PinoLogger } from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => StructuredLogger;
};

export type LoggerOptions = {
  level?: LogLevel;
  name?: string;
  pretty?: boolean;
  redactPaths?: string[]; // Caminhos para mascarar (ex: ["password", "credentials.password"])
};

function getEnvBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (!v) return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export function createLogger(opts: LoggerOptions = {}): StructuredLogger {
  const level = opts.level ?? ((process.env.LOG_LEVEL as LogLevel | undefined) ?? "info");
  const pretty = opts.pretty ?? getEnvBool("LOG_PRETTY", process.env.NODE_ENV !== "production");
  const name = opts.name ?? process.env.OTEL_SERVICE_NAME ?? "wms";

  // Caminhos padrão para mascarar + opcionais
  const defaultRedactPaths = [
    "password",
    "Password",
    "PASSWORD",
    "token",
    "Token",
    "TOKEN",
    "secret",
    "Secret",
    "SECRET",
    "apiKey",
    "api_key",
    "authorization",
    "Authorization",
    "credentials.password",
    "credentials.Password"
  ];

  const redact = {
    paths: [...defaultRedactPaths, ...(opts.redactPaths || [])],
    censor: "[REDACTED]"
  };

  const base: PinoLogger = pino(
    {
      level,
      name,
      base: undefined,
      messageKey: "message",
      timestamp: pino.stdTimeFunctions.isoTime,
      redact
    },
    pretty
      ? pino.transport({
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard", singleLine: true }
        })
      : undefined
  );

  const wrap = (logger: PinoLogger): StructuredLogger => ({
    debug: (msg, meta) => logger.debug(meta ?? {}, msg),
    info: (msg, meta) => logger.info(meta ?? {}, msg),
    warn: (msg, meta) => logger.warn(meta ?? {}, msg),
    error: (msg, meta) => logger.error(meta ?? {}, msg),
    child: (bindings) => wrap(logger.child(bindings))
  });

  return wrap(base);
}

export function toSapConnectorLogger(logger: StructuredLogger): {
  debug?: (msg: string, meta?: Record<string, unknown>) => void;
  info?: (msg: string, meta?: Record<string, unknown>) => void;
  warn?: (msg: string, meta?: Record<string, unknown>) => void;
  error?: (msg: string, meta?: Record<string, unknown>) => void;
} {
  return {
    debug: (msg, meta) => logger.debug(msg, meta),
    info: (msg, meta) => logger.info(msg, meta),
    warn: (msg, meta) => logger.warn(msg, meta),
    error: (msg, meta) => logger.error(msg, meta)
  };
}

