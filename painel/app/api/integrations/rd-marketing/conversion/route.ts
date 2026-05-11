import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import {
  rdMarketingSendConversion,
  rdMarketingApiTokenConfigured,
  type RdConversionPayload,
} from "@/lib/rd-station-server";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/integrations/rd-marketing/conversion
 *
 * Envia um evento de conversão para o RD Station Marketing via API Key.
 * Usado tanto para teste da integração quanto para envio programático
 * de conversões a partir do painel.
 *
 * Body: { email, conversion_identifier, name?, tags?[], ... }
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("admin", "supervisor");
  } catch (err) {
    const code =
      err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      {
        success: false,
        error: code === 403 ? "Sem permissão" : "Não autenticado",
      },
      { status: code },
    );
  }

  if (!(await rdMarketingApiTokenConfigured())) {
    return NextResponse.json(
      {
        success: false,
        error:
          "API Token ausente (RD_STATION_API_TOKEN). Configure em Integrações.",
      },
      { status: 400 },
    );
  }

  let body: Partial<RdConversionPayload>;
  try {
    body = (await request.json()) as Partial<RdConversionPayload>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Corpo inválido (JSON)" },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_OK.test(email)) {
    return NextResponse.json(
      { success: false, error: "Informe um e-mail válido." },
      { status: 400 },
    );
  }

  const conversionId = (body.conversion_identifier ?? "").trim();
  if (!conversionId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Informe o identificador da conversão (conversion_identifier).",
      },
      { status: 400 },
    );
  }

  const result = await rdMarketingSendConversion({
    email,
    conversion_identifier: conversionId,
    name: body.name,
    job_title: body.job_title,
    state: body.state,
    city: body.city,
    country: body.country,
    personal_phone: body.personal_phone,
    mobile_phone: body.mobile_phone,
    company_name: body.company_name,
    tags: body.tags,
    cf_custom_fields: body.cf_custom_fields,
  });

  await logActivity(
    session.sub,
    "INTEGRATION_RD_MARKETING_CONVERSION",
    {
      email,
      conversion_identifier: conversionId,
      ok: result.ok,
      status: result.status,
      ms: result.responseTimeMs,
      reason: result.reason ?? null,
    },
    clientIp(request),
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.reason ?? `Falha (HTTP ${result.status})`,
        responseTimeMs: result.responseTimeMs,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      email,
      conversion_identifier: conversionId,
      responseTimeMs: result.responseTimeMs,
      sentAt: new Date().toISOString(),
    },
  });
}
