import { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import type { Logger } from "../../../sap-connector/src/types.js";
import { instrumentSapClient } from "../../../observability/sapInstrumentation.js";

type SapConfig = {
  baseUrl: string;
  companyDb: string;
  username: string;
  password: string;
  timeoutMs: number;
  maxAttempts: number;
  maxConcurrent: number;
  maxRps: number;
};

/**
 * Lê configuração SAP das variáveis de ambiente.
 * IMPORTANTE: Nunca logue senhas ou tokens.
 */
export function loadSapConfig(): SapConfig {
  const baseUrl = process.env.SAP_B1_BASE_URL;
  const companyDb = process.env.SAP_B1_COMPANY_DB;
  const username = process.env.SAP_B1_USERNAME;
  const password = process.env.SAP_B1_PASSWORD;

  if (!baseUrl || !companyDb || !username || !password) {
    throw new Error(
      "Configuração SAP incompleta. Verifique SAP_B1_BASE_URL, SAP_B1_COMPANY_DB, SAP_B1_USERNAME, SAP_B1_PASSWORD no .env"
    );
  }

  return {
    baseUrl,
    companyDb,
    username,
    password,
    timeoutMs: Number(process.env.SAP_B1_TIMEOUT_MS ?? "20000"),
    maxAttempts: Number(process.env.SAP_B1_MAX_ATTEMPTS ?? "5"),
    maxConcurrent: Number(process.env.SAP_B1_MAX_CONCURRENT ?? "8"),
    maxRps: Number(process.env.SAP_B1_MAX_RPS ?? "10")
  };
}

/**
 * Cria instância do SapServiceLayerClient com a configuração do ambiente.
 * IMPORTANTE: O cliente é instrumentado com observabilidade e mascaramento de segredos.
 */
export function createSapClient(logger: Logger): SapServiceLayerClient {
  const config = loadSapConfig();

  // Monta a URL base final: {SAP_BASE_URL}/b1s/v1
  const baseUrl = config.baseUrl.endsWith("/b1s/v1")
    ? config.baseUrl
    : `${config.baseUrl.replace(/\/$/, "")}/b1s/v1`;

  // Logger seguro (sem logar password em plaintext)
  const safeLogger = {
    debug: (msg: string, meta?: Record<string, unknown>) => {
      logger.debug(msg, maskSecrets(meta));
    },
    info: (msg: string, meta?: Record<string, unknown>) => {
      logger.info(msg, maskSecrets(meta));
    },
    warn: (msg: string, meta?: Record<string, unknown>) => {
      logger.warn(msg, maskSecrets(meta));
    },
    error: (msg: string, meta?: Record<string, unknown>) => {
      logger.error(msg, maskSecrets(meta));
    }
  };

  // Criar cliente base
  const rawClient = new SapServiceLayerClient({
    baseUrl,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password
    },
    timeoutMs: config.timeoutMs,
    retry: {
      maxAttempts: config.maxAttempts
    },
    rateLimit: {
      maxConcurrent: config.maxConcurrent,
      maxRps: config.maxRps
    },
    logger: safeLogger,
    correlationHeaderName: "X-Correlation-Id"
  });

  // Instrumentar com observabilidade (traces, métricas)
  return instrumentSapClient(rawClient, {
    logger: safeLogger as any,
    componentName: "sap-gateway"
  });
}

/**
 * Mascara campos sensíveis nos logs.
 */
function maskSecrets(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return meta;

  const masked = { ...meta };
  const sensitiveKeys = [
    "password",
    "Password",
    "PASSWORD",
    "token",
    "Token",
    "apiKey",
    "api_key",
    "secret",
    "Secret",
    "authorization",
    "Authorization",
    "SessionId",
    "sessionId",
    "CompanyPassword"
  ];

  for (const key of sensitiveKeys) {
    if (key in masked) {
      masked[key] = "[REDACTED]";
    }
  }

  // Mascarar também em objetos aninhados (credentials, etc.)
  if (masked.credentials && typeof masked.credentials === "object") {
    const creds = masked.credentials as Record<string, unknown>;
    masked.credentials = {
      ...creds,
      password: "[REDACTED]",
      Password: "[REDACTED]"
    };
  }

  return masked;
}
