import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { smtpStatus } from "@/lib/mailer";
import { rdStationStatus } from "@/lib/rd-station-server";

interface SapHealthResp {
  status?: string;
  sap_connected?: boolean;
  configured?: boolean;
  base_url?: string | null;
  response_time_ms?: number;
  message?: string;
}

/**
 * Sonda o status do SAP via gateway, que é a fonte da verdade (as credenciais
 * SAP vivem apenas no container do gateway, não no painel). Por isso não
 * dependemos de SAP_B1_BASE_URL estar presente no ambiente do painel — usamos
 * apenas como fallback de exibição da base URL quando o gateway não a informa.
 */
async function probeSap(): Promise<{
  configured: boolean;
  healthy: boolean;
  responseTimeMs: number | null;
  message: string | null;
  baseUrl: string | null;
}> {
  const localBaseUrl = process.env.SAP_B1_BASE_URL?.trim() || null;
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
        message: `Gateway respondeu HTTP ${res.status}`,
        baseUrl: localBaseUrl,
      };
    }
    const body = (await res.json()) as SapHealthResp;
    return {
      configured:
        typeof body.configured === "boolean" ? body.configured : true,
      healthy: Boolean(body.sap_connected),
      responseTimeMs:
        typeof body.response_time_ms === "number"
          ? body.response_time_ms
          : elapsed,
      message: body.message ?? body.status ?? null,
      baseUrl: body.base_url ?? localBaseUrl,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Falha de rede";
    return {
      configured: true,
      healthy: false,
      responseTimeMs: null,
      message: `Gateway inacessível: ${reason}`,
      baseUrl: localBaseUrl,
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
