/**
 * Integração RD Station Marketing no gateway (captura de leads do Portal B2B).
 *
 * Espelha os padrões de `painel/lib/rd-station-server.ts`
 * (`rdMarketingSendConversion` / `rdMarketingAddTags`), mas lê a credencial de
 * variáveis de ambiente do serviço em vez de `panel_settings`:
 *   - RD_STATION_API_TOKEN                 -> conversões via ?api_key= (obrigatório)
 *   - RD_STATION_MARKETING_ACCESS_TOKEN    -> tags via Bearer OAuth (opcional)
 *
 * Docs: https://developers.rdstation.com/reference/conversao
 */

const PLATFORM_BASE = "https://api.rd.services";

// Identificador da conversão e tags de origem do lead (Portal B2B).
const CONVERSION_IDENTIFIER =
  process.env.RD_STATION_CONVERSION_IDENTIFIER ?? "Cadastro Portal B2B";
const ORIGIN_TAGS = ["Portal B2B", "Lead B2B"];

export interface RdConversionPayload {
  email: string;
  name?: string;
  jobTitle?: string;
  state?: string;
  city?: string;
  country?: string;
  personalPhone?: string;
  mobilePhone?: string;
  companyName?: string;
  tags?: string[];
  cfCustomFields?: Record<string, string | number | boolean>;
}

export interface RdConversionResult {
  ok: boolean;
  status: number;
  reason?: string;
  responseTimeMs: number;
}

function getApiToken(): string | undefined {
  return process.env.RD_STATION_API_TOKEN?.trim() || undefined;
}

function getMarketingToken(): string | undefined {
  return process.env.RD_STATION_MARKETING_ACCESS_TOKEN?.trim() || undefined;
}

export function rdStationConfigured(): boolean {
  return Boolean(getApiToken());
}

/**
 * Envia um evento de conversão para o RD Station Marketing via API Key.
 * A API Key (`RD_STATION_API_TOKEN`) vai como query param `api_key` (sem Bearer).
 */
export async function rdMarketingSendConversion(
  payload: RdConversionPayload,
): Promise<RdConversionResult> {
  const apiKey = getApiToken();
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      reason: "API Token não configurado (RD_STATION_API_TOKEN).",
      responseTimeMs: 0,
    };
  }

  const url = `${PLATFORM_BASE}/platform/conversions?api_key=${encodeURIComponent(apiKey)}`;

  const body = {
    event_type: "CONVERSION",
    event_family: "CDP",
    payload: {
      conversion_identifier: CONVERSION_IDENTIFIER,
      email: payload.email.trim().toLowerCase(),
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.jobTitle ? { job_title: payload.jobTitle } : {}),
      ...(payload.state ? { state: payload.state } : {}),
      ...(payload.city ? { city: payload.city } : {}),
      ...(payload.country ? { country: payload.country } : {}),
      ...(payload.personalPhone ? { personal_phone: payload.personalPhone } : {}),
      ...(payload.mobilePhone ? { mobile_phone: payload.mobilePhone } : {}),
      ...(payload.companyName ? { company_name: payload.companyName } : {}),
      ...(payload.tags && payload.tags.length > 0 ? { tags: payload.tags } : {}),
      ...(payload.cfCustomFields ? { cf_custom_fields: payload.cfCustomFields } : {}),
    },
  };

  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - t0;

    if (res.ok) {
      return { ok: true, status: res.status, responseTimeMs: elapsed };
    }

    const text = await res.text();
    return {
      ok: false,
      status: res.status,
      reason: `RD Marketing ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
      responseTimeMs: elapsed,
    };
  } catch (err) {
    const elapsed = Date.now() - t0;
    const reason = err instanceof Error ? err.message : "Falha de rede";
    return { ok: false, status: 0, reason, responseTimeMs: elapsed };
  }
}

/**
 * Adiciona tags a um contato existente no RD Station Marketing (Bearer OAuth).
 * Requer `RD_STATION_MARKETING_ACCESS_TOKEN`; sem ele retorna ok=false sem erro.
 */
export async function rdMarketingAddTags(
  email: string,
  tags: string[],
): Promise<{ ok: boolean; addedTags: number; reason?: string; responseTimeMs: number }> {
  if (tags.length === 0) {
    return { ok: true, addedTags: 0, responseTimeMs: 0 };
  }

  const token = getMarketingToken();
  if (!token) {
    return {
      ok: false,
      addedTags: 0,
      reason:
        "Bearer OAuth não configurado — tags não aplicadas ao contato (apenas à conversão).",
      responseTimeMs: 0,
    };
  }

  const emailLower = email.trim().toLowerCase();
  let totalAdded = 0;
  const t0 = Date.now();

  for (const tag of tags) {
    const url = `${PLATFORM_BASE}/platform/contacts/email:${encodeURIComponent(emailLower)}/tag`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ tag }),
      });
      if (res.ok || res.status === 200 || res.status === 201) {
        totalAdded++;
      }
    } catch {
      // Falha silenciosa por tag individual — não aborta o fluxo.
    }
  }

  return {
    ok: totalAdded > 0,
    addedTags: totalAdded,
    responseTimeMs: Date.now() - t0,
  };
}

/**
 * Captura de lead do Portal B2B: dispara conversão + tags de origem.
 * Desenhada para ser chamada em modo fire-and-forget (não lança; loga via
 * callback opcional). Enriquece o lead com a tag identificando a origem.
 */
export async function captureB2BLead(
  lead: {
    email: string;
    name?: string;
    companyName?: string;
    cnpj?: string;
    city?: string;
    state?: string;
    phone?: string;
  },
  logger?: {
    info: (obj: unknown, msg: string) => void;
    warn: (obj: unknown, msg: string) => void;
  },
): Promise<void> {
  if (!rdStationConfigured()) {
    logger?.info(
      { email: lead.email },
      "RDStation: token ausente, captura de lead ignorada",
    );
    return;
  }

  const conversion = await rdMarketingSendConversion({
    email: lead.email,
    name: lead.name,
    companyName: lead.companyName,
    city: lead.city,
    state: lead.state,
    mobilePhone: lead.phone,
    country: "Brasil",
    tags: ORIGIN_TAGS,
    ...(lead.cnpj ? { cfCustomFields: { cf_cnpj: lead.cnpj } } : {}),
  });

  if (conversion.ok) {
    logger?.info(
      { email: lead.email, status: conversion.status },
      "RDStation: conversão de lead B2B enviada",
    );
  } else {
    logger?.warn(
      { email: lead.email, reason: conversion.reason },
      "RDStation: falha ao enviar conversão de lead B2B",
    );
  }

  // Tags via Bearer (opcional): garante o acúmulo da tag de origem no contato.
  const tagResult = await rdMarketingAddTags(lead.email, ORIGIN_TAGS);
  if (!tagResult.ok && tagResult.reason) {
    logger?.info(
      { email: lead.email, reason: tagResult.reason },
      "RDStation: tags não aplicadas via Bearer",
    );
  }
}
