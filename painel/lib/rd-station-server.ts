/**
 * Chamadas RD Station apenas no servidor (Route Handlers).
 * CRM API v2: https://developers.rdstation.com/crm-v2 — OAuth Bearer.
 * Marketing (contatos por e-mail): https://developers.rdstation.com — Bearer.
 *
 * Configs lidas de `panel_settings` (DB) com fallback para `process.env`.
 * Toda função que precisa do token chama `getRdToken()` para sempre pegar
 * o valor mais recente (sem reiniciar o container ao trocar a credencial).
 */

import { getSetting, getSettings, clearSettingsCache } from "@/lib/settings";

const CRM_BASE = "https://api.rd.services/crm/v2";
const PLATFORM_BASE = "https://api.rd.services";

export const RD_CRM_KEYS = [
  "RD_STATION_CRM_ACCESS_TOKEN",
  "RD_STATION_CRM_CLIENT_ID",
  "RD_STATION_CRM_CLIENT_SECRET",
  "RD_STATION_CRM_REDIRECT_URI",
] as const;

export const RD_MARKETING_KEYS = [
  "RD_STATION_MARKETING_ACCESS_TOKEN",
  "RD_STATION_MARKETING_CLIENT_ID",
  "RD_STATION_MARKETING_CLIENT_SECRET",
  "RD_STATION_MARKETING_REDIRECT_URI",
] as const;

export const RD_SECRET_KEYS: ReadonlySet<string> = new Set([
  "RD_STATION_CRM_ACCESS_TOKEN",
  "RD_STATION_CRM_CLIENT_SECRET",
  "RD_STATION_MARKETING_ACCESS_TOKEN",
  "RD_STATION_MARKETING_CLIENT_SECRET",
]);

export function invalidateRdCache(): void {
  clearSettingsCache("RD_STATION_");
}

export async function rdStationCrmConfigured(): Promise<boolean> {
  const tok = await getSetting("RD_STATION_CRM_ACCESS_TOKEN");
  return Boolean(tok);
}

export async function rdStationMarketingConfigured(): Promise<boolean> {
  const tok = await getSetting("RD_STATION_MARKETING_ACCESS_TOKEN");
  return Boolean(tok);
}

/**
 * Snapshot agregado das integrações RD Station — sem expor tokens.
 */
export async function rdStationStatus(): Promise<{
  crm: {
    configured: boolean;
    hasClientCredentials: boolean;
    redirectUri: string | null;
  };
  marketing: {
    configured: boolean;
    hasClientCredentials: boolean;
    redirectUri: string | null;
  };
}> {
  const all = await getSettings([...RD_CRM_KEYS, ...RD_MARKETING_KEYS]);
  return {
    crm: {
      configured: Boolean(all.RD_STATION_CRM_ACCESS_TOKEN),
      hasClientCredentials: Boolean(
        all.RD_STATION_CRM_CLIENT_ID && all.RD_STATION_CRM_CLIENT_SECRET,
      ),
      redirectUri: all.RD_STATION_CRM_REDIRECT_URI ?? null,
    },
    marketing: {
      configured: Boolean(all.RD_STATION_MARKETING_ACCESS_TOKEN),
      hasClientCredentials: Boolean(
        all.RD_STATION_MARKETING_CLIENT_ID &&
          all.RD_STATION_MARKETING_CLIENT_SECRET,
      ),
      redirectUri: all.RD_STATION_MARKETING_REDIRECT_URI ?? null,
    },
  };
}

/**
 * Validação leve do token CRM — chama /pipelines com page-size=1.
 */
export async function rdCrmPing(): Promise<{
  ok: boolean;
  pipelinesCount: number | null;
  reason?: string;
}> {
  const token = await getSetting("RD_STATION_CRM_ACCESS_TOKEN");
  if (!token) {
    return {
      ok: false,
      pipelinesCount: null,
      reason: "Token CRM ausente. Configure em Integrações.",
    };
  }
  try {
    const payload = await rdCrmJson<RdListEnvelope<RdCrmPipeline>>(
      "/pipelines",
      { "page[number]": "1", "page[size]": "1" },
    );
    const list = pickData<RdCrmPipeline>(payload);
    return { ok: true, pipelinesCount: list.length > 0 ? list.length : 0 };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Falha ao consultar RD CRM.";
    return { ok: false, pipelinesCount: null, reason };
  }
}

async function rdCrmJson<T>(
  path: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const token = await getSetting("RD_STATION_CRM_ACCESS_TOKEN");
  if (!token) {
    throw new Error("Credencial CRM não configurada (RD_STATION_CRM_ACCESS_TOKEN).");
  }
  const qs = searchParams ? new URLSearchParams(searchParams).toString() : "";
  const url = `${CRM_BASE}${path.startsWith("/") ? path : `/${path}`}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RD CRM ${res.status}${text ? `: ${text.slice(0, 280)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export interface RdCrmPipeline {
  id: string;
  name: string;
  order: number | null;
  stage_ids?: string[];
}

interface RdDeal {
  id: string;
  name: string;
  status: string;
  pipeline_id: string | null;
  stage_id?: string | null;
  total_price?: number | null;
  expected_close_date?: string | null;
}

interface RdListEnvelope<T> {
  data?: T[];
}

function pickData<T>(payload: RdListEnvelope<T> | unknown): T[] {
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as RdListEnvelope<T>).data)
  ) {
    return ((payload as RdListEnvelope<T>).data ?? []) as T[];
  }
  return [];
}

async function fetchOngoingDeals(): Promise<{
  deals: RdDeal[];
  truncated: boolean;
}> {
  try {
    const payload = await rdCrmJson<RdListEnvelope<RdDeal>>("/deals", {
      "page[number]": "1",
      "page[size]": "250",
      filter: "status:ongoing",
    });
    const raw = pickData<RdDeal>(payload);
    return { deals: raw, truncated: raw.length >= 250 };
  } catch {
    const payload = await rdCrmJson<RdListEnvelope<RdDeal>>("/deals", {
      "page[number]": "1",
      "page[size]": "250",
    });
    const all = pickData<RdDeal>(payload);
    const ongoing = all.filter((d) => d.status === "ongoing");
    return { deals: ongoing, truncated: all.length >= 250 };
  }
}

export async function rdCrmOverviewData(): Promise<{
  pipelines: RdCrmPipeline[];
  pipelinesWithCounts: Array<{
    id: string;
    name: string;
    stageCount: number;
    ongoingDealCount: number;
  }>;
  ongoingDealsSample: Array<{
    id: string;
    name: string;
    pipelineId: string | null;
    totalPrice: number | null;
    expectedClose: string | null;
  }>;
  ongoingTotals: {
    pipelineCount: number;
    ongoingDealCount: number;
    dealsTruncated: boolean;
    stageBuckets: Record<string, number>;
  };
}> {
  const pipePayload = await rdCrmJson<RdListEnvelope<RdCrmPipeline>>(
    "/pipelines",
    { "page[number]": "1", "page[size]": "50" },
  );
  const pipelines = pickData<RdCrmPipeline>(pipePayload);

  const { deals: ongoingDeals, truncated } = await fetchOngoingDeals();

  const byPipeline = new Map<string, number>();
  const stageBuckets: Record<string, number> = {};
  for (const d of ongoingDeals) {
    const pid = d.pipeline_id ?? "—";
    byPipeline.set(pid, (byPipeline.get(pid) ?? 0) + 1);
    const sid = d.stage_id ?? "—";
    stageBuckets[sid] = (stageBuckets[sid] ?? 0) + 1;
  }

  const pipelinesWithCounts = pipelines.map((p) => ({
    id: p.id,
    name: p.name,
    stageCount: p.stage_ids?.length ?? 0,
    ongoingDealCount: byPipeline.get(p.id) ?? 0,
  }));

  const sample = ongoingDeals.slice(0, 12).map((d) => ({
    id: d.id,
    name: d.name,
    pipelineId: d.pipeline_id,
    totalPrice: d.total_price ?? null,
    expectedClose: d.expected_close_date ?? null,
  }));

  return {
    pipelines,
    pipelinesWithCounts,
    ongoingDealsSample: sample,
    ongoingTotals: {
      pipelineCount: pipelines.length,
      ongoingDealCount: ongoingDeals.length,
      dealsTruncated: truncated,
      stageBuckets,
    },
  };
}

/** Contato RD Marketing por e-mail — base de leads. */
export async function rdMarketingContactByEmail(
  emailRaw: string,
): Promise<{
  found: boolean;
  contact: RdMarketingContactSnippet | null;
  status?: number;
}> {
  const token = await getSetting("RD_STATION_MARKETING_ACCESS_TOKEN");
  if (!token) {
    throw new Error(
      "Credencial Marketing não configurada (RD_STATION_MARKETING_ACCESS_TOKEN).",
    );
  }
  const email = emailRaw.trim().toLowerCase();
  const path = `/platform/contacts/email:${encodeURIComponent(email)}`;
  const res = await fetch(`${PLATFORM_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 404) return { found: false, contact: null, status: 404 };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `RD Marketing ${res.status}${text ? `: ${text.slice(0, 240)}` : ""}`,
    );
  }
  const body = (await res.json()) as Record<string, unknown>;
  const contact = normalizeMarketingContact(body);
  return { found: true, contact, status: 200 };
}

export interface RdMarketingContactSnippet {
  uuid?: string;
  name: string | null;
  email: string | null;
  jobTitle?: string | null;
  city?: string | null;
  state?: string | null;
  lastConversionDate?: string | null;
  tags?: string[];
  lifecycle?: string | null;
  cfCustomFields?: Record<string, string | number | boolean | null>;
}

function normalizeMarketingContact(
  body: Record<string, unknown>,
): RdMarketingContactSnippet {
  const tagsRaw = body.tags ?? body.cf_tags;
  let tags: string[] | undefined;
  if (Array.isArray(tagsRaw)) tags = tagsRaw.map(String);
  else if (tagsRaw && typeof tagsRaw === "object")
    tags = Object.values(tagsRaw).map(String);

  const cf = body.cf_custom_fields ?? body.custom_fields;
  let cfCustomFields:
    | Record<string, string | number | boolean | null>
    | undefined;
  if (cf && typeof cf === "object" && !Array.isArray(cf)) {
    cfCustomFields = {
      ...(cf as Record<string, string | number | boolean | null>),
    };
  }

  return {
    uuid: typeof body.uuid === "string" ? body.uuid : undefined,
    name: typeof body.name === "string" ? body.name : null,
    email: typeof body.email === "string" ? body.email : null,
    jobTitle: typeof body.job_title === "string" ? body.job_title : null,
    city: typeof body.city === "string" ? body.city : null,
    state: typeof body.state === "string" ? body.state : null,
    lastConversionDate:
      typeof body.last_conversion_date === "string"
        ? body.last_conversion_date
        : null,
    tags,
    lifecycle:
      typeof body.lifecycle_stage === "string" ? body.lifecycle_stage : null,
    cfCustomFields,
  };
}
