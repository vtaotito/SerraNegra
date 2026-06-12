import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, logActivity } from "@/lib/auth";
import { setB2BCredentialPassword } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ cnpj: string }> };

const bodySchema = z.object({
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(100),
});

/**
 * POST /api/b2b-admin/credentials/:cnpj/set-password
 * Define uma senha temporária para o cliente B2B.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 },
      );
    }

    const result = await setB2BCredentialPassword(digits, parsed.data.password);

    await logActivity(session.sub, "B2B_TEMP_PASSWORD_SET_BY_ADMIN", {
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
    console.error("[B2B_ADMIN_SET_PASSWORD]", error);
    const msg = error instanceof Error ? error.message : "Erro ao definir senha";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
