import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { invalidateRdCache } from "@/lib/rd-station-server";

/**
 * GET /api/webhooks/rd-station/crm?code=...
 *
 * Callback OAuth do RD Station CRM.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return redirectWithMessage(request, "error", "Código de autorização ausente.");
  }

  const clientId = await getSetting("RD_STATION_CRM_CLIENT_ID");
  const clientSecret = await getSetting("RD_STATION_CRM_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return redirectWithMessage(
      request,
      "error",
      "Client ID ou Client Secret do RD CRM não configurados.",
    );
  }

  try {
    const tokenRes = await fetch("https://api.rd.services/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      cache: "no-store",
    });

    const tokenBody = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenBody.access_token) {
      const reason = tokenBody.error_description ?? tokenBody.error ?? `HTTP ${tokenRes.status}`;
      return redirectWithMessage(request, "error", `Falha ao obter token CRM: ${reason}`);
    }

    await setSetting({
      key: "RD_STATION_CRM_ACCESS_TOKEN",
      value: tokenBody.access_token,
      isSecret: true,
      updatedBy: null,
    });

    if (tokenBody.refresh_token) {
      await setSetting({
        key: "RD_STATION_CRM_REFRESH_TOKEN",
        value: tokenBody.refresh_token,
        isSecret: true,
        updatedBy: null,
      });
    }

    invalidateRdCache();

    return redirectWithMessage(request, "ok", "Token RD CRM obtido e salvo com sucesso!");
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Erro inesperado";
    return redirectWithMessage(request, "error", `Erro: ${reason}`);
  }
}

function redirectWithMessage(
  request: NextRequest,
  kind: "ok" | "error",
  message: string,
): NextResponse {
  const publicUrl =
    process.env.PANEL_PUBLIC_URL?.replace(/\/$/, "") ??
    `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  const target = new URL("/integracoes", publicUrl);
  target.searchParams.set("rd_oauth", kind);
  target.searchParams.set("rd_msg", message);
  return NextResponse.redirect(target.toString(), { status: 302 });
}
