export type ImperiumService =
  | "expedicao"
  | "produto"
  | "produtoClasse"
  | "notaFiscal"
  | "fornecedor"
  | "fabricante"
  | "estoque";

export type ImperiumConfig = {
  configured: boolean;
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
  defaultPlaca: string;
  defaultGrade: string;
  defaultClasse: string;
  defaultFabricante: string;
  cnpjEmitente: string;
};

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "129.148.29.26" && !parsed.port) {
      parsed.port = "82";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

export function loadImperiumConfig(): ImperiumConfig {
  const baseUrl = normalizeBaseUrl(process.env.IMPERIUM_BASE_URL ?? "");
  const username = (process.env.IMPERIUM_USERNAME ?? "").trim();
  const password = process.env.IMPERIUM_PASSWORD ?? "";
  const rawCnpj = (process.env.IMPERIUM_CNPJ_EMITENTE ?? "").trim();

  return {
    configured: Boolean(baseUrl && username && password),
    baseUrl,
    username,
    password,
    timeoutMs: Number(process.env.IMPERIUM_TIMEOUT_MS ?? "30000"),
    defaultPlaca: (process.env.IMPERIUM_DEFAULT_PLACA ?? "AAA0000").trim(),
    defaultGrade: (process.env.IMPERIUM_DEFAULT_GRADE ?? "UNICA").trim() || "UNICA",
    defaultClasse: (process.env.IMPERIUM_DEFAULT_CLASSE ?? "130900").trim(),
    defaultFabricante: (process.env.IMPERIUM_DEFAULT_FABRICANTE ?? "1").trim(),
    cnpjEmitente: (rawCnpj || "18921882000193").replace(/\D/g, ""),
  };
}

export function serviceUrl(baseUrl: string, service: ImperiumService): string {
  return `${baseUrl}/soap/index/index/service/${service}`;
}

export function wsdlUrl(baseUrl: string, service: ImperiumService): string {
  return `${baseUrl}/soap/index/wsdl/service/${service}`;
}

export function soapAction(baseUrl: string, service: ImperiumService, method: string): string {
  return `${serviceUrl(baseUrl, service)}#${method}`;
}

export function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

export function maskUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}
