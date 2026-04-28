import { NextRequest, NextResponse } from "next/server";
import { rdMarketingContactByEmail, rdStationMarketingConfigured } from "@/lib/rd-station-server";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  if (!rdStationMarketingConfigured()) {
    return NextResponse.json({
      configured: false as const,
      found: false as const,
      contact: null,
    });
  }

  const email = (req.nextUrl.searchParams.get("email") ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "Parâmetro email é obrigatório." }, { status: 400 });
  }
  if (!EMAIL_OK.test(email)) {
    return NextResponse.json({ error: "Formato de e-mail inválido." }, { status: 400 });
  }

  try {
    const { found, contact } = await rdMarketingContactByEmail(email);
    return NextResponse.json({
      configured: true as const,
      found,
      contact: found ? contact : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao consultar contato RD";
    return NextResponse.json({ configured: true as const, error: msg, found: false, contact: null }, { status: 502 });
  }
}
