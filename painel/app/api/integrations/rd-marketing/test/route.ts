import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import {
  rdMarketingContactByEmail,
  rdStationMarketingConfigured,
} from "@/lib/rd-station-server";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("admin", "supervisor");
  } catch (err) {
    const code = err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      {
        success: false,
        error: code === 403 ? "Sem permissão" : "Não autenticado",
      },
      { status: code },
    );
  }

  if (!rdStationMarketingConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "Token Marketing ausente (RD_STATION_MARKETING_ACCESS_TOKEN).",
      },
      { status: 400 },
    );
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
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

  const t0 = Date.now();
  try {
    const { found, contact } = await rdMarketingContactByEmail(email);
    const elapsed = Date.now() - t0;

    await logActivity(
      session.sub,
      "INTEGRATION_RD_MARKETING_TEST",
      { email, found, ms: elapsed },
      clientIp(request),
    );

    return NextResponse.json({
      success: true,
      data: {
        found,
        contact,
        responseTimeMs: elapsed,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const elapsed = Date.now() - t0;
    const reason =
      err instanceof Error ? err.message : "Falha ao consultar contato RD";
    await logActivity(
      session.sub,
      "INTEGRATION_RD_MARKETING_TEST",
      { email, error: reason, ms: elapsed },
      clientIp(request),
    );
    return NextResponse.json(
      { success: false, error: reason, responseTimeMs: elapsed },
      { status: 502 },
    );
  }
}
