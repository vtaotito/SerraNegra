import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { smtpStatus } from "@/lib/mailer";
import { rdStationStatus } from "@/lib/rd-station-server";

interface SapHealthResp {
  status?: string;
  sap_connected?: boolean;
  response_time_ms?: number;
  message?: string;
}

async function probeSap(): Promise<{
  configured: boolean;
  healthy: boolean;
  responseTimeMs: number | null;
  message: string | null;
  baseUrl: string | null;
}> {
  const baseUrl = process.env.SAP_B1_BASE_URL?.trim() || null;
  const configured = Boolean(baseUrl);
  if (!configured) {
    return {
      configured: false,
      healthy: false,
      responseTimeMs: null,
      message: "SAP_B1_BASE_URL não definido.",
      baseUrl: null,
    };
  }

  const gatewayUrl =
    process.env.GATEWAY_INTERNAL_URL?.trim() || "http://gateway:3000";
  try {
    const t0 = Date.now();
    const res = await fetch(`${gatewayUrl}/sap/health`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const elapsed = Date.now() - t0;
    if (!res.ok) {
      return {
        configured: true,
        healthy: false,
        responseTimeMs: elapsed,
        message: `HTTP ${res.status}`,
        baseUrl,
      };
    }
    const body = (await res.json()) as SapHealthResp;
    return {
      configured: true,
      healthy: Boolean(body.sap_connected),
      responseTimeMs:
        typeof body.response_time_ms === "number"
          ? body.response_time_ms
          : elapsed,
      message: body.message ?? body.status ?? null,
      baseUrl,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Falha de rede";
    return {
      configured: true,
      healthy: false,
      responseTimeMs: null,
      message: reason,
      baseUrl,
    };
  }
}

export async function GET() {
  try {
    await requireRole("admin", "supervisor");
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Sem permissão" },
      { status: 403 },
    );
  }

  const [sap, smtp, rd] = await Promise.all([
    probeSap(),
    smtpStatus(),
    rdStationStatus(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      sap,
      smtp,
      rdCrm: rd.crm,
      rdMarketing: rd.marketing,
    },
  });
}
