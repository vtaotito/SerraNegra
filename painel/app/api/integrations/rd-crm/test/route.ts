import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { rdCrmPing } from "@/lib/rd-station-server";

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

  const t0 = Date.now();
  const result = await rdCrmPing();
  const elapsed = Date.now() - t0;

  await logActivity(
    session.sub,
    "INTEGRATION_RD_CRM_TEST",
    { ok: result.ok, reason: result.reason ?? null, ms: elapsed },
    clientIp(request),
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.reason ?? "Falha ao validar token CRM.",
        responseTimeMs: elapsed,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      pipelinesCount: result.pipelinesCount,
      responseTimeMs: elapsed,
      checkedAt: new Date().toISOString(),
    },
  });
}
