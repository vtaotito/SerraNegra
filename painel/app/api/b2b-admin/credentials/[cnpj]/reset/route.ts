import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { resetB2BCredential } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ cnpj: string }> };

/**
 * POST /api/b2b-admin/credentials/:cnpj/reset
 * Remove a senha do cliente B2B — ele refaz o primeiro acesso via OTP.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin");
    const { cnpj } = await params;
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      return NextResponse.json(
        { success: false, error: "CNPJ inválido" },
        { status: 400 },
      );
    }

    const result = await resetB2BCredential(digits);

    await logActivity(session.sub, "B2B_PASSWORD_RESET_BY_ADMIN", {
      cnpj: digits,
      actorRole: session.role,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_RESET]", error);
    const msg = error instanceof Error ? error.message : "Erro ao resetar senha";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
